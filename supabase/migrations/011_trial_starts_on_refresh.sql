-- Free trial clock starts only when the user starts daily refresh (not at signup).
--
-- Semantics:
--   trial_used = false  → trial pending (setup allowed; countdown NOT running)
--   trial_used = true   → clock started; trial_started_at / trial_expire_at are locked

-- 1) Signup: pending trial (no countdown)
create or replace function public.force_trial_on_insert()
returns trigger
language plpgsql
security definer
as $$
begin
  new.trial_started_at := now();
  -- Placeholder only — ignored while trial_used = false
  new.trial_expire_at := now();
  new.trial_used := false;
  new.subscription_status := 'trial';
  new.subscription_plan := 'free_trial';
  new.subscription_started_at := null;
  new.subscription_expire_at := null;
  if new.account_status is null
     or new.account_status not in ('active', 'suspended', 'deleted') then
    new.account_status := 'active';
  end if;
  return new;
end;
$$;

-- 2) Trial clocks: immutable once started; allow one-time false → true activation
--    (and full bypass for service_role, same pattern as billing)
create or replace function public.prevent_trial_tampering()
returns trigger
language plpgsql
security definer
as $$
declare
  bypass text;
begin
  if new.google_user_id is distinct from old.google_user_id then
    raise exception 'google_user_id is immutable';
  end if;

  if new.created_at is distinct from old.created_at then
    raise exception 'created_at is immutable';
  end if;

  bypass := current_setting('request.jwt.claim.role', true);
  if bypass = 'service_role' then
    -- Trusted app: still harden against resetting a started trial
    if old.trial_used = true then
      if new.trial_used is distinct from true
         or new.trial_started_at is distinct from old.trial_started_at
         or new.trial_expire_at is distinct from old.trial_expire_at then
        raise exception 'Free trial fields are immutable after trial has started (anti-fraud)';
      end if;
    end if;
    return new;
  end if;

  if current_setting('app.allow_billing', true) = 'on' then
    if old.trial_used = true then
      if new.trial_used is distinct from true
         or new.trial_started_at is distinct from old.trial_started_at
         or new.trial_expire_at is distinct from old.trial_expire_at then
        raise exception 'Free trial fields are immutable after trial has started (anti-fraud)';
      end if;
    end if;
    return new;
  end if;

  -- Client / anon: never touch trial clocks
  if new.trial_started_at is distinct from old.trial_started_at
     or new.trial_expire_at is distinct from old.trial_expire_at
     or new.trial_used is distinct from old.trial_used then
    raise exception 'Free trial fields are immutable (anti-fraud)';
  end if;

  return new;
end;
$$;

-- 3) Rescue accounts that never started automation: give them a pending trial again
--    (only if they never ran / never had running automation, and never paid)
alter table public.users disable trigger users_prevent_trial_tampering;

update public.users u
set
  trial_used = false,
  trial_started_at = now(),
  trial_expire_at = now(),
  subscription_status = 'trial',
  subscription_plan = 'free_trial'
where u.account_status = 'active'
  and u.subscription_expire_at is null
  and u.subscription_status in ('trial', 'expired')
  and not exists (
    select 1
    from public.user_automation ua
    where ua.user_id = u.id
      and (
        ua.automation_state in ('running', 'paused')
        or ua.last_run_at is not null
      )
  );

alter table public.users enable trigger users_prevent_trial_tampering;
