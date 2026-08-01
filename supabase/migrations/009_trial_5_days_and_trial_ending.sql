-- Extend free trial from 3 days → 5 days (new signups only).
-- Existing users keep their current trial_expire_at (immutable).

create or replace function public.force_trial_on_insert()
returns trigger
language plpgsql
security definer
as $$
begin
  new.trial_started_at := now();
  new.trial_expire_at := now() + interval '5 days';
  new.trial_used := true;
  -- Always start as trial; paid activation is an UPDATE by service-role only
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

-- Allow trial-ending reminder emails (day 2 and day 1 before expiry)
alter table public.email_reminder_events
  drop constraint if exists email_reminder_events_reminder_type_check;

alter table public.email_reminder_events
  add constraint email_reminder_events_reminder_type_check
  check (
    reminder_type in (
      'trial_expired_repurchase',
      'trial_ending',
      'subscription_expired_repurchase',
      'subscription_purchased',
      'subscription_ending'
    )
  );
