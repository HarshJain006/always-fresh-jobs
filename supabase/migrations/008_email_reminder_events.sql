-- Email reminder event log (idempotent SMTP sends).
-- Supports:
-- 1) purchase confirmation
-- 2) subscription ending soon
-- 3) trial/subscription expired repurchase reminders every 3 days (max 5)

create table if not exists public.email_reminder_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  reminder_type text not null check (
    reminder_type in (
      'trial_expired_repurchase',
      'subscription_expired_repurchase',
      'subscription_purchased',
      'subscription_ending'
    )
  ),
  sequence_no int not null default 1 check (sequence_no >= 1 and sequence_no <= 5),
  context_key text not null default '',
  status text not null default 'processing' check (status in ('processing', 'sent', 'failed')),
  error text null,
  sent_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists email_reminder_events_unique
  on public.email_reminder_events (user_id, reminder_type, sequence_no, context_key);

create index if not exists email_reminder_events_user_created_idx
  on public.email_reminder_events (user_id, created_at desc);

alter table public.email_reminder_events enable row level security;

drop policy if exists "email_reminder_events_deny_client" on public.email_reminder_events;
create policy "email_reminder_events_deny_client" on public.email_reminder_events
  for all using (false) with check (false);

