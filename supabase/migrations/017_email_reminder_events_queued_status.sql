-- Fix: allow status = 'queued' on email_reminder_events.
--
-- Root cause: code (credentialFailureQueue / daily cap overflow) inserts status 'queued',
-- but production still had the original check from 008:
--   status in ('processing', 'sent', 'failed')
-- Migration 013 added 'queued' in repo but was never applied to this database.
--
-- Also re-assert reminder_type allow-list so credential / welcome / reengage emails work.

alter table public.email_reminder_events
  drop constraint if exists email_reminder_events_status_check;

alter table public.email_reminder_events
  add constraint email_reminder_events_status_check
  check (status in ('processing', 'sent', 'failed', 'queued'));

create index if not exists email_reminder_events_queued_idx
  on public.email_reminder_events (status, created_at asc)
  where status = 'queued';

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
      'naukri_credentials_failed',
      'welcome_thank_you',
      'expired_access_reengage'
    )
  );
