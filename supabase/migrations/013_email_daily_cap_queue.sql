-- Queued status for daily cap overflow (max 95 sends/day IST).

alter table public.email_reminder_events
  drop constraint if exists email_reminder_events_status_check;

alter table public.email_reminder_events
  add constraint email_reminder_events_status_check
  check (status in ('processing', 'sent', 'failed', 'queued'));

create index if not exists email_reminder_events_queued_idx
  on public.email_reminder_events (status, created_at asc)
  where status = 'queued';
