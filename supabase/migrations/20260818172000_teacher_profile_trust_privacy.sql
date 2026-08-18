-- Teacher Profile trust/privacy closure.
-- Keeps professional identity, audience visibility and verification authority separate.
-- authorization-test: public.teacher_profile_privacy
-- authorization-test: public.teacher_profile_verifications

create table if not exists public.teacher_profile_privacy (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  parent_visibility boolean not null default false,
  student_visibility boolean not null default false,
  colleague_visibility boolean not null default true,
  directory_visibility text not null default 'school_only'
    check (directory_visibility in ('private','school_only','school_community')),
  updated_at timestamptz not null default now()
);

alter table public.teacher_profile_privacy enable row level security;
revoke all on public.teacher_profile_privacy from anon;
revoke all on public.teacher_profile_privacy from authenticated;
grant select, insert, update on public.teacher_profile_privacy to authenticated;

create policy teacher_profile_privacy_select_own
on public.teacher_profile_privacy
for select to authenticated
using (profile_id = auth.uid());

create policy teacher_profile_privacy_insert_own
on public.teacher_profile_privacy
for insert to authenticated
with check (profile_id = auth.uid());

create policy teacher_profile_privacy_update_own
on public.teacher_profile_privacy
for update to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create table if not exists public.teacher_profile_verifications (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  tsc_status text not null default 'unverified'
    check (tsc_status in ('unverified','pending','verified','rejected')),
  school_status text not null default 'unverified'
    check (school_status in ('unverified','pending','verified','rejected')),
  employment_status text not null default 'unverified'
    check (employment_status in ('unverified','pending','verified','rejected')),
  verified_school_id uuid references public.schools(id) on delete set null,
  tsc_verified_at timestamptz,
  school_verified_at timestamptz,
  employment_verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  evidence jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.teacher_profile_verifications enable row level security;
revoke all on public.teacher_profile_verifications from anon;
revoke all on public.teacher_profile_verifications from authenticated;
grant select on public.teacher_profile_verifications to authenticated;

create policy teacher_profile_verifications_select_own
on public.teacher_profile_verifications
for select to authenticated
using (profile_id = auth.uid());

comment on table public.teacher_profile_verifications is
  'Platform/school verification evidence. Authenticated teachers may read only their own trust state; writes remain service/admin governed.';
comment on table public.teacher_profile_privacy is
  'Teacher-owned audience visibility preferences. Does not override downstream authorization/RLS.';
