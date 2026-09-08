-- Fix: Start daily refresh fails with
--   "Could not start free trial: Free trial fields are immutable (anti-fraud)"
--
-- Cause: prevent_trial_tampering blocked ALL trial field updates when
-- request.jwt.claim.role was not detected as service_role (old 003 trigger,
-- or JWT claim GUC missing on newer Supabase). Clients already cannot UPDATE
-- users (RLS deny-all); only service_role reaches this trigger for app writes.
--
-- Fix: allow one-time pending → started (trial_used false → true). After the
-- clock has started, keep clocks locked. Detect service_role via multiple paths.

create or replace function public.jwt_role()
returns text
language plpgsql
stable
as $$
declare
  claims jsonb;
  role text;
begin
  role := nullif(current_setting('request.jwt.claim.role', true), '');
  if role is not null then
    return role;
  end if;

  begin
    claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  exception when others then
    claims := null;
  end;

  if claims is not null then
    role := nullif(claims->>'role', '');
    if role is not null then
      return role;
    end if;
  end if;

  begin
    return nullif(auth.role(), '');
  exception when others then
    return null;
  end;
end;
$$;

create or replace function public.prevent_trial_tampering()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role text;
begin
  if new.google_user_id is distinct from old.google_user_id then
    raise exception 'google_user_id is immutable';
  end if;

  if new.created_at is distinct from old.created_at then
    raise exception 'created_at is immutable';
  end if;

  -- One-time free-trial activation (Start daily refresh).
  -- RLS already restricts UPDATEs on users to service_role.
  if old.trial_used is distinct from true
     and new.trial_used = true then
    return new;
  end if;

  role := public.jwt_role();

  -- Once the clock has started, never allow resets/extensions (even service_role).
  -- Use a dedicated SQL rescue if an admin reset is ever required.
  if old.trial_used = true then
    if new.trial_used is distinct from true
       or new.trial_started_at is distinct from old.trial_started_at
       or new.trial_expire_at is distinct from old.trial_expire_at then
      raise exception 'Free trial fields are immutable after trial has started (anti-fraud)';
    end if;
    return new;
  end if;

  -- Pending trial: allow non-clock updates; block clock edits that do not activate
  if new.trial_started_at is distinct from old.trial_started_at
     or new.trial_expire_at is distinct from old.trial_expire_at
     or new.trial_used is distinct from old.trial_used then
    if role = 'service_role' or current_setting('app.allow_billing', true) = 'on' then
      return new;
    end if;
    raise exception 'Free trial fields are immutable (anti-fraud)';
  end if;

  return new;
end;
$$;

-- Keep billing bypass in sync with the same JWT role helper
create or replace function public.prevent_billing_tampering()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role text;
begin
  role := public.jwt_role();
  if role = 'service_role' then
    return new;
  end if;

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

-- Ensure triggers still point at the updated functions
drop trigger if exists users_prevent_trial_tampering on public.users;
create trigger users_prevent_trial_tampering
  before update on public.users
  for each row
  execute function public.prevent_trial_tampering();

drop trigger if exists users_prevent_billing_tampering on public.users;
create trigger users_prevent_billing_tampering
  before update on public.users
  for each row
  execute function public.prevent_billing_tampering();
