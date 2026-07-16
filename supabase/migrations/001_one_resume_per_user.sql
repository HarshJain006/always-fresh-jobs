-- Run once if schema.sql was applied before the one-resume constraint existed.
-- Keeps only the newest resume row per user, then enforces uniqueness.

delete from public.resumes r
using public.resumes newer
where r.user_id = newer.user_id
  and r.uploaded_at < newer.uploaded_at;

create unique index if not exists resumes_user_id_unique on public.resumes (user_id);

-- Optional: remove orphaned storage objects (run from app on next upload per user)
