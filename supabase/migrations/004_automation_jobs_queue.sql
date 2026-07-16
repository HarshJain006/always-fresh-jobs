-- Durable job queue in Postgres (free — no Redis/BullMQ).
-- Netlify / dashboard only ENQUEUE. Raspberry Pi worker CLAIMS + RUNS Selenium.
-- If the Pi reboots, leased jobs expire and return to pending automatically.

create table if not exists public.automation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  platform text not null default 'naukri'
    check (platform in ('naukri', 'indeed', 'linkedin')),
  job_type text not null
    check (job_type in ('daily_refresh', 'run_now', 'test')),
  status text not null default 'pending'
    check (status in ('pending', 'claimed', 'running', 'completed', 'failed', 'dead')),
  -- Lower number = higher priority (run_now / test first)
  priority int not null default 100,
  attempts int not null default 0,
  max_attempts int not null default 3,
  worker_id text null,
  locked_at timestamptz null,
  lock_expires_at timestamptz null,
  available_at timestamptz not null default now(),
  -- Calendar day for daily uniqueness (use IST date from app)
  scheduled_for date null,
  error text null,
  result_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz null
);

create index if not exists automation_jobs_claim_idx
  on public.automation_jobs (priority asc, created_at asc)
  where status = 'pending';

create index if not exists automation_jobs_user_created_idx
  on public.automation_jobs (user_id, created_at desc);

create index if not exists automation_jobs_stale_lock_idx
  on public.automation_jobs (lock_expires_at)
  where status in ('claimed', 'running');

-- One in-flight daily job per user/platform/day
create unique index if not exists automation_jobs_daily_unique
  on public.automation_jobs (user_id, platform, scheduled_for)
  where job_type = 'daily_refresh'
    and scheduled_for is not null
    and status in ('pending', 'claimed', 'running');

alter table public.automation_jobs enable row level security;

drop policy if exists "automation_jobs_all" on public.automation_jobs;
create policy "automation_jobs_all" on public.automation_jobs
  for all using (true) with check (true);

-- Reclaim jobs whose lease expired (Pi crashed / lost power)
create or replace function public.reclaim_stale_automation_jobs()
returns int
language plpgsql
security definer
as $$
declare
  n int;
begin
  update public.automation_jobs
  set
    status = 'pending',
    worker_id = null,
    locked_at = null,
    lock_expires_at = null,
    updated_at = now()
  where status in ('claimed', 'running')
    and lock_expires_at is not null
    and lock_expires_at < now();
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Atomically claim the next available job (FOR UPDATE SKIP LOCKED)
create or replace function public.claim_automation_job(
  p_worker_id text,
  p_lease_seconds int default 900
)
returns setof public.automation_jobs
language plpgsql
security definer
as $$
declare
  v_id uuid;
  v_row public.automation_jobs;
begin
  perform public.reclaim_stale_automation_jobs();

  select j.id into v_id
  from public.automation_jobs j
  where j.status = 'pending'
    and j.available_at <= now()
  order by j.priority asc, j.created_at asc
  for update skip locked
  limit 1;

  if v_id is null then
    return;
  end if;

  update public.automation_jobs
  set
    status = 'claimed',
    worker_id = p_worker_id,
    locked_at = now(),
    lock_expires_at = now() + make_interval(secs => greatest(p_lease_seconds, 60)),
    attempts = attempts + 1,
    updated_at = now()
  where id = v_id
  returning * into v_row;

  return next v_row;
end;
$$;

-- Extend lease while Selenium is still running
create or replace function public.heartbeat_automation_job(
  p_job_id uuid,
  p_worker_id text,
  p_lease_seconds int default 900
)
returns boolean
language plpgsql
security definer
as $$
begin
  update public.automation_jobs
  set
    status = 'running',
    lock_expires_at = now() + make_interval(secs => greatest(p_lease_seconds, 60)),
    updated_at = now()
  where id = p_job_id
    and worker_id = p_worker_id
    and status in ('claimed', 'running');
  return found;
end;
$$;

create or replace function public.complete_automation_job(
  p_job_id uuid,
  p_worker_id text,
  p_ok boolean,
  p_message text
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_attempts int;
  v_max int;
begin
  if p_ok then
    update public.automation_jobs
    set
      status = 'completed',
      result_message = p_message,
      error = null,
      worker_id = null,
      locked_at = null,
      lock_expires_at = null,
      completed_at = now(),
      updated_at = now()
    where id = p_job_id
      and worker_id = p_worker_id
      and status in ('claimed', 'running');
    return found;
  end if;

  select attempts, max_attempts into v_attempts, v_max
  from public.automation_jobs
  where id = p_job_id and worker_id = p_worker_id;

  if not found then
    return false;
  end if;

  if v_attempts >= v_max then
    update public.automation_jobs
    set
      status = 'dead',
      error = p_message,
      result_message = p_message,
      worker_id = null,
      locked_at = null,
      lock_expires_at = null,
      completed_at = now(),
      updated_at = now(),
      available_at = now()
    where id = p_job_id;
  else
    -- Retry later (backoff: 2 min * attempts)
    update public.automation_jobs
    set
      status = 'pending',
      error = p_message,
      result_message = p_message,
      worker_id = null,
      locked_at = null,
      lock_expires_at = null,
      available_at = now() + (interval '2 minutes' * v_attempts),
      updated_at = now()
    where id = p_job_id;
  end if;

  return true;
end;
$$;

grant execute on function public.reclaim_stale_automation_jobs() to anon, authenticated, service_role;
grant execute on function public.claim_automation_job(text, int) to anon, authenticated, service_role;
grant execute on function public.heartbeat_automation_job(uuid, text, int) to anon, authenticated, service_role;
grant execute on function public.complete_automation_job(uuid, text, boolean, text) to anon, authenticated, service_role;
