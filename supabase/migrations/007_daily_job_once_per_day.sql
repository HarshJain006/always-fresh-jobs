-- Prevent a second daily_refresh after today's job already completed.
-- (Previous unique index only covered pending/claimed/running, so Pi restarts
--  could insert a new job and re-upload resumes that already succeeded today.)

drop index if exists public.automation_jobs_daily_unique;

create unique index if not exists automation_jobs_daily_unique
  on public.automation_jobs (user_id, platform, scheduled_for)
  where job_type = 'daily_refresh'
    and scheduled_for is not null
    and status in ('pending', 'claimed', 'running', 'completed');

-- failed / dead rows are intentionally excluded so a cancelled job can be
-- re-queued later the same day if the user starts automation again.
