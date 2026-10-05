create table if not exists public.freelancer_favorites (
  user_id uuid not null references public.users(id) on delete cascade,
  profile_id uuid not null references public.freelancer_profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, profile_id)
);

create table if not exists public.freelancer_portfolio_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.freelancer_profiles(user_id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  category text not null default '',
  client_name text not null default '',
  completion_year integer check (completion_year is null or completion_year between 1900 and 2100),
  project_url text not null default '',
  description text not null default '',
  tools text[] not null default '{}',
  results text not null default '',
  image_url text not null,
  image_urls text[] not null default '{}',
  sort_order bigint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.freelancer_profile_reactions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.freelancer_profiles(user_id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  unique (profile_id, user_id)
);

create table if not exists public.freelancer_profile_comments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.freelancer_profiles(user_id) on delete cascade,
  author_id uuid not null references public.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists freelancer_portfolio_profile_idx
  on public.freelancer_portfolio_items (profile_id, sort_order);
create index if not exists freelancer_comments_profile_idx
  on public.freelancer_profile_comments (profile_id, created_at desc);

alter table public.freelancer_favorites enable row level security;
alter table public.freelancer_portfolio_items enable row level security;
alter table public.freelancer_profile_reactions enable row level security;
alter table public.freelancer_profile_comments enable row level security;

revoke all on public.freelancer_favorites from anon, authenticated;
revoke all on public.freelancer_portfolio_items from anon, authenticated;
revoke all on public.freelancer_profile_reactions from anon, authenticated;
revoke all on public.freelancer_profile_comments from anon, authenticated;
grant all on public.freelancer_favorites to service_role;
grant all on public.freelancer_portfolio_items to service_role;
grant all on public.freelancer_profile_reactions to service_role;
grant all on public.freelancer_profile_comments to service_role;

drop policy if exists freelancer_favorites_deny_client on public.freelancer_favorites;
create policy freelancer_favorites_deny_client on public.freelancer_favorites
  for all to anon, authenticated using (false) with check (false);
drop policy if exists freelancer_portfolio_deny_client on public.freelancer_portfolio_items;
create policy freelancer_portfolio_deny_client on public.freelancer_portfolio_items
  for all to anon, authenticated using (false) with check (false);
drop policy if exists freelancer_reactions_deny_client on public.freelancer_profile_reactions;
create policy freelancer_reactions_deny_client on public.freelancer_profile_reactions
  for all to anon, authenticated using (false) with check (false);
drop policy if exists freelancer_comments_deny_client on public.freelancer_profile_comments;
create policy freelancer_comments_deny_client on public.freelancer_profile_comments
  for all to anon, authenticated using (false) with check (false);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('freelancer-media', 'freelancer-media', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists freelancer_media_deny_client_insert on storage.objects;
create policy freelancer_media_deny_client_insert on storage.objects
  for all to anon, authenticated using (false) with check (false);