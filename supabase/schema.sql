-- DailyResume Supabase schema
-- Run this in Supabase → SQL Editor, then create a public Storage bucket named "resumes".

-- Users (Google OAuth identities from the app)
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  google_user_id text not null unique,
  email text not null,
  name text not null default '',
  profile_image text not null default '',
  created_at timestamptz not null default now(),
  trial_started_at timestamptz not null default now(),
  trial_expire_at timestamptz not null,
  trial_used boolean not null default true,
  subscription_status text not null default 'trial'
    check (subscription_status in ('trial', 'active', 'expired', 'cancelled')),
  subscription_plan text null
    check (subscription_plan is null or subscription_plan in (
      'free_trial',
      'premium_monthly',
      'premium_1m',
      'premium_3m',
      'premium_6m'
    )),
  subscription_started_at timestamptz null,
  subscription_expire_at timestamptz null,
  account_status text not null default 'active'
    check (account_status in ('active', 'suspended', 'deleted'))
);

create index if not exists users_google_user_id_idx on public.users (google_user_id);
create index if not exists users_email_idx on public.users (email);

-- Anti-fraud: force real 3-day trial on INSERT; lock trial clocks + google_user_id on UPDATE
-- (also in supabase/migrations/003_lock_trial_fields.sql)
create or replace function public.force_trial_on_insert()
returns trigger
language plpgsql
as $$
begin
  new.trial_started_at := now();
  new.trial_expire_at := now() + interval '3 days';
  new.trial_used := true;
  if new.subscription_status is null
     or new.subscription_status not in ('trial', 'active', 'expired', 'cancelled') then
    new.subscription_status := 'trial';
  end if;
  if new.subscription_status = 'active' and new.subscription_expire_at is null then
    new.subscription_status := 'trial';
    new.subscription_plan := 'free_trial';
  elsif new.subscription_status is distinct from 'active' then
    new.subscription_status := 'trial';
    new.subscription_plan := coalesce(new.subscription_plan, 'free_trial');
    new.subscription_started_at := null;
    new.subscription_expire_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists users_force_trial_on_insert on public.users;
create trigger users_force_trial_on_insert
  before insert on public.users
  for each row
  execute function public.force_trial_on_insert();

create or replace function public.prevent_trial_tampering()
returns trigger
language plpgsql
as $$
begin
  if new.google_user_id is distinct from old.google_user_id then
    raise exception 'google_user_id is immutable';
  end if;
  if new.trial_started_at is distinct from old.trial_started_at
     or new.trial_expire_at is distinct from old.trial_expire_at
     or new.trial_used is distinct from old.trial_used then
    raise exception 'Free trial fields are immutable (anti-fraud)';
  end if;
  if new.created_at is distinct from old.created_at then
    raise exception 'created_at is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists users_prevent_trial_tampering on public.users;
create trigger users_prevent_trial_tampering
  before update on public.users
  for each row
  execute function public.prevent_trial_tampering();

-- Per-user automation / Naukri setup
create table if not exists public.user_automation (
  user_id uuid primary key references public.users (id) on delete cascade,
  credentials jsonb null,
  resume jsonb null,
  platforms jsonb not null default '[
    {"id":"naukri","name":"Naukri","connected":false,"last":null},
    {"id":"indeed","name":"Indeed","connected":false,"last":null}
  ]'::jsonb,
  automation_state text not null default 'idle'
    check (automation_state in ('idle', 'running', 'paused')),
  last_run_at timestamptz null,
  updated_at timestamptz not null default now()
);

-- Automation activity logs
create table if not exists public.automation_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  platform text not null check (platform in ('naukri', 'indeed', 'linkedin')),
  ok boolean not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists automation_logs_user_created_idx
  on public.automation_logs (user_id, created_at desc);

-- Resume metadata (file itself lives in Storage bucket "resumes")
create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  file_name text not null,
  file_size_bytes bigint not null default 0,
  storage_path text not null,
  uploaded_at timestamptz not null default now()
);

-- Exactly one resume row per user (latest upload only)
create unique index if not exists resumes_user_id_unique on public.resumes (user_id);

-- MVP policies: app uses custom Google auth (not Supabase Auth yet),
-- so the publishable key needs open table access for now.
-- Tighten these once you switch to Supabase Auth or a service-role server key.
alter table public.users enable row level security;
alter table public.user_automation enable row level security;
alter table public.automation_logs enable row level security;
alter table public.resumes enable row level security;

drop policy if exists "users_all" on public.users;
create policy "users_all" on public.users for all using (true) with check (true);

drop policy if exists "user_automation_all" on public.user_automation;
create policy "user_automation_all" on public.user_automation for all using (true) with check (true);

drop policy if exists "automation_logs_all" on public.automation_logs;
create policy "automation_logs_all" on public.automation_logs for all using (true) with check (true);

drop policy if exists "resumes_all" on public.resumes;
create policy "resumes_all" on public.resumes for all using (true) with check (true);

-- Durable job queue lives in migration 004_automation_jobs_queue.sql
-- (automation_jobs + claim/complete/heartbeat RPCs). Run that migration for Netlify + RPi.

-- Storage bucket (also create via Dashboard → Storage if this fails)
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

drop policy if exists "resumes_storage_all" on storage.objects;
create policy "resumes_storage_all"
  on storage.objects for all
  using (bucket_id = 'resumes')
  with check (bucket_id = 'resumes');
