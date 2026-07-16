-- Lock free-trial clocks so a client (or open RLS) cannot extend / reset a trial.
-- Trial is permanently bound to google_user_id (one window per Google account).

-- Force a real 3-day trial on every INSERT (ignores client-supplied dates)
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
  -- New Google accounts always begin on free_trial (paid activation is an UPDATE later)
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

-- Prevent UPDATE of trial timing / Google identity after insert
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
