-- Reconstructed replayable baseline for the live-only migration version
-- 20260520000000_timetable_foundation_baseline.
--
-- Production already records this migration version as applied. This file exists
-- to make a blank/local rebuild reproducible; it must never be reapplied to a
-- populated production database.
--
-- Scope is intentionally limited to core objects that later repository
-- migrations assume already exist and for which no CREATE TABLE exists in the
-- tracked migration chain.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'account_status' and typnamespace = 'public'::regnamespace) then
    create type public.account_status as enum ('active','restricted','suspended','anonymized');
  end if;
  if not exists (select 1 from pg_type where typname = 'school_status' and typnamespace = 'public'::regnamespace) then
    create type public.school_status as enum ('pending','active','suspended','closed');
  end if;
end
$$;

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name varchar not null,
  subdomain varchar not null,
  timezone text not null,
  status public.school_status not null default 'pending',
  country_code char(2) not null,
  requires_dual_approval boolean not null default true,
  created_by uuid,
  deleted_at timestamptz,
  updated_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default clock_timestamp()
);

create unique index if not exists schools_subdomain_key on public.schools(subdomain);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name varchar not null,
  phone varchar,
  date_of_birth date,
  country_code char(2),
  account_status public.account_status not null default 'active',
  is_anonymized boolean not null default false,
  anonymized_at timestamptz,
  parental_consent_at timestamptz,
  parental_consent_by uuid,
  arrived_at timestamptz,
  updated_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default clock_timestamp(),
  role text default 'teacher',
  school_id uuid references public.schools(id) on delete set null
);

alter table public.schools
  drop constraint if exists schools_created_by_fkey;
alter table public.schools
  add constraint schools_created_by_fkey foreign key (created_by)
  references public.profiles(id) on delete set null;

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references public.profiles(id) on delete set null,
  name text not null,
  stream text default '',
  subject text not null default '',
  created_at timestamptz default now(),
  school_id uuid references public.schools(id) on delete cascade
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  name text not null,
  updated_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default clock_timestamp()
);

create table if not exists public.teacher_classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete cascade,
  is_class_teacher boolean not null default false,
  created_at timestamptz not null default clock_timestamp()
);

create table if not exists public.timetable_slots (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete cascade,
  day_of_week integer not null,
  start_time time not null,
  end_time time not null,
  room text,
  effective_from date not null default current_date,
  effective_until date,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

-- RLS is enabled here so later policy-recovery migrations operate against the
-- same security posture as the live core tables. Policies themselves are
-- restored by later canonical migrations.
alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.subjects enable row level security;
alter table public.teacher_classes enable row level security;
alter table public.timetable_slots enable row level security;
