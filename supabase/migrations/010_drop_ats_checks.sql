-- Optional cleanup: drop ATS checker table if Lovable created it in this project.
-- Safe to run even if the table never existed.

drop policy if exists "ats_checks_all" on public.ats_checks;
drop index if exists public.ats_checks_user_created_idx;
drop table if exists public.ats_checks;
