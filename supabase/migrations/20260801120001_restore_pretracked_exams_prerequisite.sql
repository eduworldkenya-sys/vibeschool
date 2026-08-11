-- TBL-011 clean-rebuild prerequisite repair.
--
-- The production target already contains public.exams, as reflected by the
-- generated database types, but no tracked CREATE TABLE for that pre-existing
-- object is present before the Content OS migration first references it.
--
-- Keep this bridge idempotent: it reconstructs the missing prerequisite on a
-- blank database and is a no-op where the production-era table already exists.

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  term integer not null,
  academic_year integer not null,
  exam_type text not null default 'summative',
  pass_mark numeric not null default 50,
  is_locked boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

comment on table public.exams is
  'Pre-tracking exam definition restored for reproducible blank-database migration replay.';
