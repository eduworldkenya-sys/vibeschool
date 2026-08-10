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
  if not exists (select 1 from pg_type where typname = 'member_role' and typnamespace = 'public'::regnamespace) then
    create type public.member_role as enum ('owner','admin','teacher','student','parent');
  end if;
  if not exists (select 1 from pg_type where typname = 'attendance_status' and typnamespace = 'public'::regnamespace) then
    create type public.attendance_status as enum ('present','excused','absent');
  end if;
  if not exists (select 1 from pg_type where typname = 'cbc_performance_level' and typnamespace = 'public'::regnamespace) then
    create type public.cbc_performance_level as enum ('exceeds_expectation','meets_expectation','approaches_expectation','below_expectation');
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

create table if not exists public.school_members (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null,
  joined_at timestamptz not null default clock_timestamp(),
  constraint uq_school_member unique (school_id,profile_id)
);

create or replace function public.is_school_admin(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1
    from public.school_members
    where school_id = p_school_id
      and profile_id = auth.uid()
      and role in ('admin', 'owner')
  );
$$;

revoke all on function public.is_school_admin(uuid) from public;
revoke all on function public.is_school_admin(uuid) from anon;
grant execute on function public.is_school_admin(uuid) to authenticated;
grant execute on function public.is_school_admin(uuid) to service_role;

create table if not exists public.academic_terms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  name text not null,
  term integer not null check (term in (1,2,3)),
  academic_year integer not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'upcoming' check (status in ('active','upcoming','completed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint academic_terms_school_id_term_academic_year_key unique (school_id,term,academic_year)
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references public.profiles(id) on delete set null,
  name text not null,
  stream text default '',
  subject text not null default '',
  created_at timestamptz default now(),
  school_id uuid references public.schools(id) on delete cascade
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references public.classes(id) on delete cascade,
  name text not null,
  admission_number text default '',
  created_at timestamptz default now(),
  profile_id uuid references public.profiles(id),
  date_of_birth date,
  gender text,
  autonomy_level integer default 1,
  deleted_at timestamptz,
  parent_linked_at timestamptz,
  created_by uuid references auth.users(id)
);

create table if not exists public.student_claim_codes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  code text not null unique,
  claimed boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  claimed_by uuid references auth.users(id)
);

create table if not exists public.parent_student_links (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id),
  school_id uuid references public.schools(id) on delete cascade,
  relationship text not null default 'guardian',
  is_primary boolean not null default false,
  can_pickup boolean not null default true,
  receives_alerts boolean not null default true,
  updated_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default clock_timestamp(),
  constraint chk_not_self check (parent_id <> student_id),
  constraint uq_parent_student_school unique (parent_id,student_id,school_id)
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  name text not null,
  updated_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default clock_timestamp()
);

create table if not exists public.cbc_strands (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  grade text not null,
  name text not null,
  sub_strand text,
  created_at timestamptz not null default now(),
  strand_order integer,
  sub_strand_order integer,
  learning_outcomes text[] default '{}'::text[],
  key_inquiry_questions text[] default '{}'::text[],
  suggested_experiences text[] default '{}'::text[],
  core_competencies text[] default '{}'::text[],
  core_values text[] default '{}'::text[],
  term integer,
  week integer,
  source_ref text,
  values text[] default '{}'::text[],
  unique (subject_id, grade, name, sub_strand)
);

create table if not exists public.subject_weekly_allocations (
  id uuid primary key default gen_random_uuid(),
  band text not null check (
    band in ('lower_primary', 'upper_primary', 'junior_school')
  ),
  grade text not null,
  subject_label text not null,
  lessons_per_week integer not null check (lessons_per_week > 0),
  source text not null default
    'MoE/KICD rationalized CBC allocation (Dec 2023 circular)',
  created_at timestamptz not null default now(),
  unique (grade, subject_label)
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

create table if not exists public.curriculum (
  id uuid primary key default gen_random_uuid(),
  curriculum text not null,
  grade text not null,
  subject text not null,
  term integer not null,
  week integer not null,
  strand text not null,
  sub_strand text not null,
  topic text not null,
  periods integer default 3,
  reference text,
  created_at timestamptz default now()
);

create table if not exists public.curriculum_content (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null unique references public.curriculum(id),
  lesson_context jsonb,
  parent_brief jsonb,
  source text not null default 'vibeschool',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create policy "curriculum_content_read"
  on public.curriculum_content
  for select
  to authenticated
  using (true);

create table if not exists public.scheme_of_work (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  teacher_id uuid references public.profiles(id),
  class_id uuid references public.classes(id),
  subject_id uuid not null references public.subjects(id),
  curriculum_id uuid references public.curriculum(id),
  curriculum_type text not null,
  grade text not null,
  subject text not null,
  term integer not null,
  week integer not null,
  date date,
  day_of_week text,
  period integer,
  strand text,
  sub_strand text,
  topic text not null,
  objectives text,
  resources text,
  reference text,
  rollcall text,
  remarks text,
  status text default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.lesson_plans (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid not null,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  week_start date not null,
  day_of_week integer not null check (day_of_week between 1 and 7),
  title text,
  body text,
  generated_by text not null default 'manual' check (generated_by in ('manual','twin')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint chk_lesson_plan_content check (title is not null or body is not null)
);

create table if not exists public.tpad_appraisals (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  term_id uuid references public.academic_terms(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','submitted','countersigned')),
  standard_1_self numeric check (standard_1_self between 1 and 5),
  standard_1_head numeric check (standard_1_head between 1 and 5),
  standard_2_self numeric check (standard_2_self between 1 and 5),
  standard_2_head numeric check (standard_2_head between 1 and 5),
  standard_3_self numeric check (standard_3_self between 1 and 5),
  standard_3_head numeric check (standard_3_head between 1 and 5),
  standard_4_self numeric check (standard_4_self between 1 and 5),
  standard_4_head numeric check (standard_4_head between 1 and 5),
  final_score numeric,
  head_notes text,
  submitted_at timestamptz,
  countersigned_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (teacher_id,term_id)
);

create table if not exists public.vc_threads (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id),
  type text not null check (type in ('direct','circular')),
  subject text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_message_at timestamptz,
  last_message_preview text,
  context_tag text default 'general'
);

create table if not exists public.vc_participants (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references public.vc_threads(id) on delete cascade,
  profile_id uuid references public.profiles(id),
  school_id uuid references public.schools(id),
  joined_at timestamptz default now(),
  left_at timestamptz,
  last_read_at timestamptz,
  unique (thread_id,profile_id)
);

create table if not exists public.vc_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references public.vc_threads(id) on delete cascade,
  school_id uuid references public.schools(id),
  sender_id uuid references public.profiles(id),
  body text not null,
  created_at timestamptz default now(),
  deleted_at timestamptz
);

-- Pre-tracking Teacher OS tables required by the first canonical evidence migration.
-- These represent the original shapes before later migrations add lineage,
-- lifecycle, review and occurrence columns.

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  timetable_slot_id uuid references public.timetable_slots(id) on delete restrict,
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  date date not null check (date <= current_date),
  status public.attendance_status not null,
  is_late boolean not null default false,
  arrived_at time,
  marked_at timestamptz not null default clock_timestamp(),
  notes text
);

create index if not exists idx_attendance_class on public.attendance(class_id);
create index if not exists idx_attendance_date on public.attendance(date);
create index if not exists idx_attendance_slot on public.attendance(timetable_slot_id);
create index if not exists idx_attendance_student on public.attendance(student_id);
create index if not exists idx_attendance_teacher on public.attendance(teacher_id);

create table if not exists public.homework (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  teacher_id uuid references public.profiles(id),
  title text not null,
  subject text,
  instructions text,
  type text not null default 'book',
  due_date date,
  created_at timestamptz default now()
);

create table if not exists public.homework_submissions (
  id uuid primary key default gen_random_uuid(),
  homework_id uuid references public.homework(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  submitted_at timestamptz default now(),
  status text not null default 'pending',
  photo_url text,
  mark integer,
  feedback text,
  created_at timestamptz default now()
);

create table if not exists public.cbc_assessments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  strand_id uuid,
  sub_strand text,
  assessment_type text not null check (assessment_type in ('formative','summative','project')),
  performance public.cbc_performance_level not null,
  term integer not null check (term between 1 and 3),
  academic_year integer not null check (academic_year between 2000 and 2100),
  notes text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint uq_cbc_assessment unique (
    student_id,class_id,subject_id,strand_id,sub_strand,assessment_type,term,academic_year
  )
);

create table if not exists public.lesson_evidence (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lesson_plans(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  evidence_type text not null check (
    evidence_type in ('observation','classwork','exercise','homework','project','practical','quiz')
  ),
  title text,
  description text,
  media_url text,
  score numeric,
  created_at timestamptz not null default now()
);

create index if not exists idx_lesson_evidence_lesson_id
  on public.lesson_evidence(lesson_id);
create index if not exists idx_lesson_evidence_teacher_id
  on public.lesson_evidence(teacher_id);

create table if not exists public.lesson_interventions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lesson_plans(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('remediation','reinforcement','extension')),
  strand_id uuid,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.lesson_notes (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references public.classes(id) on delete set null,
  lesson_plan_id uuid references public.lesson_plans(id) on delete set null,
  homework_id uuid references public.homework(id) on delete set null,
  school_id uuid references public.schools(id) on delete set null,
  subject_id uuid references public.subjects(id) on delete set null,
  teacher_id uuid references public.profiles(id) on delete set null,
  taught_date date not null default current_date,
  what_was_taught text,
  challenges text,
  homework_set text,
  participation_score numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_lesson_notes_class_id
  on public.lesson_notes(class_id);
create index if not exists idx_lesson_notes_homework_id
  on public.lesson_notes(homework_id);
create index if not exists idx_lesson_notes_lesson_plan_id
  on public.lesson_notes(lesson_plan_id);
create index if not exists idx_lesson_notes_teacher_id
  on public.lesson_notes(teacher_id);

create policy "teachers manage own lesson notes"
  on public.lesson_notes
  for all
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

-- RLS is enabled here so later policy-recovery migrations operate against the
-- same security posture as the live core tables. Policies themselves are
-- restored by later canonical migrations.
alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.school_members enable row level security;
alter table public.academic_terms enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.student_claim_codes enable row level security;
alter table public.parent_student_links enable row level security;
alter table public.subjects enable row level security;
alter table public.cbc_strands enable row level security;
alter table public.subject_weekly_allocations enable row level security;
alter table public.teacher_classes enable row level security;
alter table public.timetable_slots enable row level security;
alter table public.curriculum enable row level security;
alter table public.curriculum_content enable row level security;
alter table public.scheme_of_work enable row level security;
alter table public.lesson_plans enable row level security;
alter table public.attendance enable row level security;
alter table public.homework enable row level security;
alter table public.homework_submissions enable row level security;
alter table public.cbc_assessments enable row level security;
alter table public.lesson_evidence enable row level security;
alter table public.lesson_interventions enable row level security;
alter table public.lesson_notes enable row level security;
alter table public.tpad_appraisals enable row level security;
alter table public.vc_threads enable row level security;
alter table public.vc_participants enable row level security;
alter table public.vc_messages enable row level security;

create policy "strands_read"
  on public.cbc_strands
  for select
  to authenticated
  using (true);

create policy "subjects_member_read"
  on public.subjects
  for select
  to authenticated
  using (
    school_id in (
      select sm.school_id
      from public.school_members sm
      where sm.profile_id = auth.uid()
    )
  );

create policy "subject_weekly_allocations_read"
  on public.subject_weekly_allocations
  for select
  to authenticated
  using (true);
