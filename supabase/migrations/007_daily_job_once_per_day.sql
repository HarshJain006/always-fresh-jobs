-- One daily_refresh row per user/platform/IST day once it has run or finished.
-- Prevents Pi restarts from inserting a second job after status = completed.
-- (Previously the unique index only covered pending | claimed | running.)

drop index if exists public.automation_jobs_daily_unique;

create unique index if not exists automation_jobs_daily_unique
  on public.automation_jobs (user_id, platform, scheduled_for)
  where job_type = 'daily_refresh'
    and scheduled_for is not null
    and status in ('pending', 'claimed', 'running', 'completed');
