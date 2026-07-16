-- Expand allowed paid plan ids (1 / 3 / 6 months)

alter table public.users drop constraint if exists users_subscription_plan_check;

alter table public.users
  add constraint users_subscription_plan_check
  check (
    subscription_plan is null
    or subscription_plan in (
      'free_trial',
      'premium_monthly',
      'premium_1m',
      'premium_3m',
      'premium_6m'
    )
  );
