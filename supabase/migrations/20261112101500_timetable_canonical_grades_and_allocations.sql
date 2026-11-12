begin;

-- VibeSchool: class identity must not depend on a display name.
alter table public.classes
  add column if not exists grade_code text;

-- Backfill only unambiguous existing identities.
-- Keep unknown identities NULL for explicit reconciliation.
update public.classes
set grade_code = initcap(btrim(name))
where grade_code is null
  and btrim(name) ~* '^Grade ([1-9]|1[0-2])$';

update public.classes set grade_code = upper(btrim(name))
where grade_code is null and btrim(name) ~* '^PP[12]$';

alter table public.classes
  drop constraint if exists classes_grade_code_check;

alter table public.classes
  add constraint classes_grade_code_check
  check (
    grade_code is null
    or grade_code ~ '^Grade ([1-9]|1[0-2])$'
    or grade_code in ('PP1','PP2')
  ) not valid;

-- Preserve existing national allocation identities.
-- Enrich them with verifiable source and duration metadata.
alter table public.subject_weekly_allocations
  add column if not exists lesson_minutes integer,
  add column if not exists source_ref text,
  add column if not exists source_revision text;

alter table public.subject_weekly_allocations
  drop constraint if exists weekly_allocation_minutes_check;

alter table public.subject_weekly_allocations
  add constraint weekly_allocation_minutes_check
  check (lesson_minutes is null or lesson_minutes > 0)
  not valid;

-- Existing Grade 4–6 allocation is 35 minutes per lesson.
update public.subject_weekly_allocations
set lesson_minutes = 35
where grade in ('Grade 4', 'Grade 5', 'Grade 6')
  and lesson_minutes is null;

-- The clean migration rebuild may predate some junior-school global
-- learning-area identities. Reconcile by *name* and allow PostgreSQL to
-- generate IDs only when a missing canonical subject is needed.
-- Existing production identities are never replaced.
-- Avoid arbitrary selection when a global subject has duplicate names.
do $
declare
  v_name text;
  v_count integer;
begin
  foreach v_name in array array[
    'English', 'Kiswahili', 'Mathematics', 'Religious Education',
    'Social Studies', 'Integrated Science', 'Pre-Technical Studies',
    'Agriculture and Nutrition', 'Creative Arts and Sports'
  ] loop
    select count(*) into v_count
    from public.subjects s
    where s.school_id is null and s.name = v_name;
    if v_count > 1 then
      raise exception 'AMBIGUOUS_GLOBAL_SUBJECT: %', v_name;
    end if;
    if v_count = 0 then
      insert into public.subjects (name,school_id,global_subject_id)
      values (v_name,null,null);
    end if;
  end loop;
end $;

-- Revised junior-school learning-area allocations:
-- 40 curriculum lessons, plus a separate PPI period.
-- These labels resolve to VibeSchool's existing global subjects.
with learning_areas(subject_label, units) as (
  values
    ('English', 5),
    ('Kiswahili', 4),
    ('Mathematics', 5),
    ('Religious Education', 4),
    ('Social Studies', 4),
    ('Integrated Science', 5),
    ('Pre-Technical Studies', 4),
    ('Agriculture and Nutrition', 4),
    ('Creative Arts and Sports', 5)
),
grades(grade) as (
  values ('Grade 7'), ('Grade 8'), ('Grade 9')
),
verified_subjects as (
  select
    g.grade,
    a.subject_label,
    a.units,
    s.id as global_subject_id
  from grades g
  cross join learning_areas a
  join public.subjects s
    on s.name = a.subject_label
   and s.school_id is null
)
insert into public.subject_weekly_allocations (
  band,
  grade,
  subject_label,
  lessons_per_week,
  global_subject_id,
  source,
  source_ref,
  source_revision,
  lesson_minutes
)
select
  'junior_school',
  grade,
  subject_label,
  units,
  global_subject_id,
  'KICD revised 2024',
  'https://kicd.ac.ke/wp-content/uploads/2024/02/GRADE.7.HRE_.pdf',
  '2024 revised junior-school allocation',
  40
from verified_subjects
on conflict (grade, subject_label)
do update set
  lessons_per_week = excluded.lessons_per_week,
  global_subject_id = excluded.global_subject_id,
  source = excluded.source,
  source_ref = excluded.source_ref,
  source_revision = excluded.source_revision,
  lesson_minutes = excluded.lesson_minutes;

-- Fail the migration if a global subject is missing or
-- the required junior-school allocation is incomplete.
do $$
declare
  v_grade text;
  v_count integer;
  v_total integer;
begin
  foreach v_grade in array
    array['Grade 7', 'Grade 8', 'Grade 9']
  loop
    select count(*), coalesce(sum(lessons_per_week), 0)
    into v_count, v_total
    from public.subject_weekly_allocations
    where grade = v_grade;

    if v_count <> 9 or v_total <> 40 then
      raise exception
        'JUNIOR_ALLOCATION_INCOMPLETE: % (% rows, % units)',
        v_grade, v_count, v_total;
    end if;
  end loop;
end $$;

create index if not exists
  idx_classes_school_grade_code
  on public.classes(school_id, grade_code);

create index if not exists
  idx_weekly_allocations_grade_subject
  on public.subject_weekly_allocations
    (grade, global_subject_id);

-- access: service-only public.timetable_allocation_subject_aliases
-- authorization-test: public.timetable_allocation_subject_aliases is not
-- readable/writable by anon or authenticated; access only via authorized RPCs.
create table if not exists
public.timetable_allocation_subject_aliases (
  grade_code text not null,
  subject_id uuid not null
    references public.subjects(id) on delete restrict,
  baseline_subject_id uuid not null
    references public.subjects(id) on delete restrict,
  source_ref text not null,
  primary key (grade_code, subject_id)
);

alter table public.timetable_allocation_subject_aliases
  enable row level security;

revoke all on public.timetable_allocation_subject_aliases
  from public, anon, authenticated;

-- Verified junior-school allocation alternatives.
with grades(grade_code) as (
  values ('Grade 7'), ('Grade 8'), ('Grade 9')
),
aliases(alternative, baseline) as (
  values
    ('Kenyan Sign Language', 'Kiswahili'),
    ('Christian Religious Education', 'Religious Education'),
    ('Islamic Religious Education', 'Religious Education'),
    ('Hindu Religious Education', 'Religious Education'),
    ('Agriculture', 'Agriculture and Nutrition')
)
insert into public.timetable_allocation_subject_aliases (
  grade_code,
  subject_id,
  baseline_subject_id,
  source_ref
)
select
  g.grade_code,
  alternative.id,
  baseline.id,
  'KICD revised junior-school learning-area allocation'
from grades g
cross join aliases a
join public.subjects alternative
  on alternative.name = a.alternative
 and alternative.school_id is null
join public.subjects baseline
  on baseline.name = a.baseline
 and baseline.school_id is null
on conflict (grade_code, subject_id) do nothing;

commit;
