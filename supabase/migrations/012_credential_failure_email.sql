-- Allow credential-failure transactional emails (one per automation_logs entry).

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
      'subscription_ending',
      'naukri_credentials_failed'
    )
  );
