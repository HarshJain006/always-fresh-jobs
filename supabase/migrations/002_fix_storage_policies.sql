-- Fix storage upload permissions for server-side uploads (anon / publishable key).
-- Run in Supabase SQL Editor if resume upload fails with RLS or permission errors.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resumes',
  'resumes',
  false,
  5242880,
  array['application/pdf']::text[]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "resumes_storage_all" on storage.objects;
drop policy if exists "resumes_storage_anon_select" on storage.objects;
drop policy if exists "resumes_storage_anon_insert" on storage.objects;
drop policy if exists "resumes_storage_anon_update" on storage.objects;
drop policy if exists "resumes_storage_anon_delete" on storage.objects;

create policy "resumes_storage_anon_select"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'resumes');

create policy "resumes_storage_anon_insert"
  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'resumes');

create policy "resumes_storage_anon_update"
  on storage.objects for update to anon, authenticated
  using (bucket_id = 'resumes')
  with check (bucket_id = 'resumes');

create policy "resumes_storage_anon_delete"
  on storage.objects for delete to anon, authenticated
  using (bucket_id = 'resumes');
