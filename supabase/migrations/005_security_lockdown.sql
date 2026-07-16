-- Pre-production security lockdown:
-- 1) Deny anon/authenticated table access (service_role bypasses RLS)
-- 2) Revoke queue RPCs from public roles
-- 3) Harden billing / trial INSERT+UPDATE triggers
-- 4) Lock down storage bucket

-- ========== Queue RPCs: service role only ==========
revoke execute on function public.reclaim_stale_automation_jobs() from anon, authenticated, public;
revoke execute on function public.claim_automation_job(text, int) from anon, authenticated, public;
revoke execute on function public.heartbeat_automation_job(uuid, text, int) from anon, authenticated, public;
revoke execute on function public.complete_automation_job(uuid, text, boolean, text) from anon, authenticated, public;

grant execute on function public.reclaim_stale_automation_jobs() to service_role;
grant execute on function public.claim_automation_job(text, int) to service_role;
grant execute on function public.heartbeat_automation_job(uuid, text, int) to service_role;
grant execute on function public.complete_automation_job(uuid, text, boolean, text) to service_role;

-- ========== Drop open RLS policies ==========
drop policy if exists "users_all" on public.users;
drop policy if exists "user_automation_all" on public.user_automation;
drop policy if exists "automation_logs_all" on public.automation_logs;
drop policy if exists "resumes_all" on public.resumes;
drop policy if exists "automation_jobs_all" on public.automation_jobs;

-- Explicit deny for anon/authenticated (service_role bypasses RLS)
create policy "users_deny_client" on public.users
  for all to anon, authenticated using (false) with check (false);
create policy "user_automation_deny_client" on public.user_automation
  for all to anon, authenticated using (false) with check (false);
create policy "automation_logs_deny_client" on public.automation_logs
  for all to anon, authenticated using (false) with check (false);
create policy "resumes_deny_client" on public.resumes
  for all to anon, authenticated using (false) with check (false);
create policy "automation_jobs_deny_client" on public.automation_jobs
  for all to anon, authenticated using (false) with check (false);

-- ========== Storage: remove open access ==========
drop policy if exists "resumes_storage_all" on storage.objects;
-- No anon policies = no public bucket access. App uses service_role for storage I/O.

-- ========== Force real trial on INSERT (never allow paid on self-signup) ==========
create or replace function public.force_trial_on_insert()
returns trigger
language plpgsql
as $$
begin
  new.trial_started_at := now();
  new.trial_expire_at := now() + interval '3 days';
  new.trial_used := true;
  -- Always start as trial; paid activation is an UPDATE by service-role payment webhook only
  new.subscription_status := 'trial';
  new.subscription_plan := 'free_trial';
  new.subscription_started_at := null;
  new.subscription_expire_at := null;
  if new.account_status is null then
    new.account_status := 'active';
  end if;
  return new;
end;
$$;

-- ========== Block billing field tampering on UPDATE unless service_role ==========
create or replace function public.prevent_billing_tampering()
returns trigger
language plpgsql
as $$
declare
  bypass text;
begin
  -- Allow trusted server (service_role) via session setting set by app when needed,
  -- or when JWT role is service_role (PostgREST/service key).
  bypass := current_setting('request.jwt.claim.role', true);
  if bypass = 'service_role' then
    return new;
  end if;

  -- Also allow if app sets: SELECT set_config('app.allow_billing', 'on', true);
  if current_setting('app.allow_billing', true) = 'on' then
    return new;
  end if;

  if new.subscription_status is distinct from old.subscription_status
     or new.subscription_plan is distinct from old.subscription_plan
     or new.subscription_started_at is distinct from old.subscription_started_at
     or new.subscription_expire_at is distinct from old.subscription_expire_at
     or new.account_status is distinct from old.account_status then
    raise exception 'Billing/account fields are protected (anti-fraud)';
  end if;

  return new;
end;
$$;

drop trigger if exists users_prevent_billing_tampering on public.users;
create trigger users_prevent_billing_tampering
  before update on public.users
  for each row
  execute function public.prevent_billing_tampering();

-- Keep trial clock / google_user_id immutable (from 003)
-- prevent_trial_tampering already exists

-- Reconcile status-only updates from our Node service_role client still work
-- because PostgREST sets request.jwt.claim.role = service_role for the service key.
