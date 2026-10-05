-- Freelancer directory profiles owned by existing DailyResume users.
create table if not exists public.freelancer_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  username text not null unique check (char_length(username) between 2 and 40),
  full_name text not null default '',
  headline text not null default '',
  bio text not null default '',
  avatar_url text,
  location_name text not null default '',
  country text not null default '',
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  tags text[] not null default '{}',
  services text[] not null default '{}',
  starting_price numeric(10, 2) check (starting_price is null or starting_price >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  contact_email text not null default '',
  linkedin_url text not null default '',
  instagram_url text not null default '',
  whatsapp_number text not null default '',
  telegram_id text not null default '',
  address text not null default '',
  show_address boolean not null default false,
  github_repos text[] not null default '{}',
  website_url text not null default '',
  is_available boolean not null default true,
  is_listed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((latitude is null) = (longitude is null)),
  check (not is_listed or (latitude is not null and longitude is not null))
);

create index if not exists freelancer_profiles_map_idx
  on public.freelancer_profiles (latitude, longitude)
  where is_listed = true;
create index if not exists freelancer_profiles_tags_idx
  on public.freelancer_profiles using gin (tags);

alter table public.freelancer_profiles enable row level security;
revoke all on public.freelancer_profiles from anon, authenticated;
grant all on public.freelancer_profiles to service_role;

drop policy if exists freelancer_profiles_deny_client on public.freelancer_profiles;
create policy freelancer_profiles_deny_client
  on public.freelancer_profiles for all to anon, authenticated
  using (false) with check (false);

create or replace function public.set_freelancer_profile_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists freelancer_profiles_set_updated_at on public.freelancer_profiles;
create trigger freelancer_profiles_set_updated_at
  before update on public.freelancer_profiles
  for each row execute function public.set_freelancer_profile_updated_at();