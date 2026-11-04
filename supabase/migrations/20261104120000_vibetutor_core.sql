-- VibeTutor core: tutor listings and learner requests.
-- One VibeSchool login per person (profiles). Tutors reuse the existing
-- teacher role. Phone numbers stay private to the owner; contact happens
-- through VibeConnect (vc_threads). Listings publish instantly.

begin;

-- authorization-test: public.vibetutor_tutors owner-only read/write; other users see no rows and cannot update; anon has no base-table access; public view excludes phone and paused listings (tested locally against a stand-in schema)
-- authorization-test: public.vibetutor_requests owner-only read/write; other users and anon see no base rows; open-request view excludes phone (tested locally against a stand-in schema)

create table if not exists public.vibetutor_tutors (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) > 0),
  levels text[] not null default '{}',
  subjects text[] not null default '{}',
  teaching_mode text not null default 'either' check (teaching_mode in ('online','physical','either')),
  area text,
  rate_kes integer check (rate_kes is null or rate_kes > 0),
  available_days text[] not null default '{}',
  dayparts text[] not null default '{}',
  holiday_available boolean not null default false,
  bio text,
  phone text,
  photo_path text,
  status text not null default 'published' check (status in ('published','paused')),
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vibetutor_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  learner_label text not null default 'Learner',
  note text,
  dayparts text[] not null default '{}',
  levels text[] not null default '{}',
  subjects text[] not null default '{}',
  teaching_mode text not null default 'either' check (teaching_mode in ('online','physical','either')),
  area text,
  budget_kes integer check (budget_kes is null or budget_kes > 0),
  available_days text[] not null default '{}',
  phone text,
  status text not null default 'open' check (status in ('open','closed')),
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vibetutor_tutors enable row level security;
alter table public.vibetutor_requests enable row level security;

-- Owners manage their own rows. Nobody else reads the base tables,
-- so phone numbers never leave through them.
create policy vibetutor_tutors_owner_all on public.vibetutor_tutors
  for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy vibetutor_requests_owner_all on public.vibetutor_requests
  for all to authenticated
  using (requester_id = auth.uid())
  with check (requester_id = auth.uid());

-- Public browse: published tutors, without phone numbers.
create or replace view public.vibetutor_public_tutors
  with (security_invoker = false) as
  select profile_id, display_name, levels, subjects, teaching_mode, area,
         rate_kes, available_days, dayparts, holiday_available, bio, photo_path, created_at
  from public.vibetutor_tutors
  where status = 'published';

-- Signed-in browse: open requests, without phone numbers.
create or replace view public.vibetutor_open_requests
  with (security_invoker = false) as
  select id, learner_label, note, levels, subjects, teaching_mode, area,
         budget_kes, available_days, dayparts, created_at
  from public.vibetutor_requests
  where status = 'open';

grant select on public.vibetutor_public_tutors to anon, authenticated;
grant select on public.vibetutor_open_requests to authenticated;
grant select, insert, update, delete on public.vibetutor_tutors to authenticated;
grant select, insert, update, delete on public.vibetutor_requests to authenticated;

commit;
