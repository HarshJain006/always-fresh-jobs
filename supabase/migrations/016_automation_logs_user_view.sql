-- Clarify automation_logs identity: id = log row, user_id = owner (users.id).
-- No data is modified or deleted.

comment on table public.automation_logs is
  'One row per dashboard activity event. id is the log row UUID; user_id links to users.id.';

comment on column public.automation_logs.id is
  'Unique ID of this log row (NOT the user ID). New UUID per event.';

comment on column public.automation_logs.user_id is
  'Owner — matches public.users.id. Use this to join logs to users.';

create index if not exists automation_logs_user_id_idx
  on public.automation_logs (user_id);

-- Support / admin view: logs with user email & name (read-only).
create or replace view public.automation_logs_with_users as
select
  l.id as log_id,
  l.user_id,
  u.email as user_email,
  u.name as user_name,
  u.google_user_id,
  l.platform,
  l.ok,
  l.message,
  l.created_at
from public.automation_logs l
left join public.users u on u.id = l.user_id;

comment on view public.automation_logs_with_users is
  'Join activity logs to users. Match credential emails: email_reminder_events.context_key = log_id.';

-- Email events with user details + link to activity log when applicable.
create or replace view public.email_reminder_events_with_users as
select
  e.id as event_id,
  e.user_id,
  u.email as user_email,
  u.name as user_name,
  e.reminder_type,
  e.sequence_no,
  e.context_key,
  case
    when e.reminder_type = 'naukri_credentials_failed' then e.context_key
    else null
  end as linked_automation_log_id,
  e.status,
  e.error,
  e.sent_at,
  e.created_at,
  e.updated_at
from public.email_reminder_events e
left join public.users u on u.id = e.user_id;

comment on view public.email_reminder_events_with_users is
  'Transactional email audit trail with user email. Wrong-password rows: context_key = automation_logs.id.';
