-- Task 3: repository parity for production profile-extension identity tables.
-- These tables exist in production and are still consumed by parent/HQ identity
-- surfaces, but were absent from the clean migration chain. Reconstruct them
-- explicitly instead of depending on hidden production-only schema.

-- Access: authenticated-read/public.gender_types; service-role full; anon none
-- Authorization-test: public.gender_types
-- Access: authenticated-read/public.relationship_types; service-role full; anon none
-- Authorization-test: public.relationship_types
-- Access: authenticated-self/public.student_profiles; service-role full; anon none
-- Authorization-test: public.student_profiles
-- Access: authenticated-self/public.parent_profiles; service-role full; anon none
-- Authorization-test: public.parent_profiles

create table if not exists public.gender_types (
  code text primary key,
  label text not null
);

insert into public.gender_types(code,label) values
  ('female','Female'),
  ('male','Male'),
  ('other','Other')
on conflict(code) do update set label=excluded.label;

alter table public.gender_types enable row level security;
revoke all privileges on table public.gender_types from public,anon,authenticated;
grant select on table public.gender_types to authenticated;
grant all privileges on table public.gender_types to service_role;
drop policy if exists gender_types_authenticated_read on public.gender_types;
create policy gender_types_authenticated_read on public.gender_types
for select to authenticated using(true);

create table if not exists public.relationship_types (
  code text primary key,
  label text not null
);

insert into public.relationship_types(code,label) values
  ('father','Father'),
  ('guardian','Guardian'),
  ('mother','Mother'),
  ('other','Other'),
  ('parent','Parent')
on conflict(code) do update set label=excluded.label;

alter table public.relationship_types enable row level security;
revoke all privileges on table public.relationship_types from public,anon,authenticated;
grant select on table public.relationship_types to authenticated;
grant all privileges on table public.relationship_types to service_role;
drop policy if exists relationship_types_authenticated_read on public.relationship_types;
create policy relationship_types_authenticated_read on public.relationship_types
for select to authenticated using(true);

create table if not exists public.student_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  admission_no text,
  gender text references public.gender_types(code),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint uq_admission_per_school unique(school_id,admission_no)
);

-- Preserve production's direct auth ownership invariant as a named additional FK.
do $block$
begin
  if not exists(
    select 1 from pg_constraint
    where conrelid='public.student_profiles'::regclass
      and conname='fk_student_profiles_user'
  ) then
    alter table public.student_profiles
      add constraint fk_student_profiles_user
      foreign key(profile_id) references auth.users(id) on delete cascade;
  end if;
end;
$block$;

alter table public.student_profiles enable row level security;
revoke all privileges on table public.student_profiles from public,anon,authenticated;
grant select,insert,update,delete on table public.student_profiles to authenticated;
grant all privileges on table public.student_profiles to service_role;

drop policy if exists pol_student_profiles_insert on public.student_profiles;
create policy pol_student_profiles_insert on public.student_profiles
for insert to authenticated
with check(profile_id=auth.uid());

drop policy if exists pol_student_profiles_update on public.student_profiles;
create policy pol_student_profiles_update on public.student_profiles
for update to authenticated
using(
  profile_id=auth.uid()
  or public.is_school_admin(school_id)
)
with check(
  profile_id=auth.uid()
  or public.is_school_admin(school_id)
);

drop policy if exists pol_student_profiles_delete on public.student_profiles;
create policy pol_student_profiles_delete on public.student_profiles
for delete to authenticated
using(public.is_school_admin(school_id));

-- The SELECT policy is intentionally minimal here and is replaced by the next
-- Task 3 migration with canonical parent/teacher learner resolution.
drop policy if exists pol_student_profiles_select on public.student_profiles;
create policy pol_student_profiles_select on public.student_profiles
for select to authenticated
using(profile_id=auth.uid() or public.is_school_admin(school_id));

create table if not exists public.parent_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  relationship text not null default 'guardian' references public.relationship_types(code),
  occupation text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

alter table public.parent_profiles enable row level security;
revoke all privileges on table public.parent_profiles from public,anon,authenticated;
grant select,insert,update,delete on table public.parent_profiles to authenticated;
grant all privileges on table public.parent_profiles to service_role;

drop policy if exists pol_parent_profiles_insert on public.parent_profiles;
create policy pol_parent_profiles_insert on public.parent_profiles
for insert to authenticated
with check(profile_id=auth.uid());

drop policy if exists pol_parent_profiles_update on public.parent_profiles;
create policy pol_parent_profiles_update on public.parent_profiles
for update to authenticated
using(profile_id=auth.uid())
with check(profile_id=auth.uid());

drop policy if exists pol_parent_profiles_delete on public.parent_profiles;
create policy pol_parent_profiles_delete on public.parent_profiles
for delete to authenticated
using(profile_id=auth.uid());

-- Replaced by canonical relationship-aware select policy in 20260819011000.
drop policy if exists pol_parent_profiles_select on public.parent_profiles;
create policy pol_parent_profiles_select on public.parent_profiles
for select to authenticated
using(profile_id=auth.uid());
