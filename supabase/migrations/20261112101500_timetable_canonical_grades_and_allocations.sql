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
  add column if not exists source_revision text,
  add column if not exists kicd_learning_area text;

alter table public.subject_weekly_allocations
  drop constraint if exists weekly_allocation_minutes_check;

alter table public.subject_weekly_allocations
  add constraint weekly_allocation_minutes_check
  check (lesson_minutes is null or lesson_minutes > 0)
  not valid;

-- The clean migration rebuild may predate some junior-school global
-- learning-area identities. Reconcile by *name* and allow PostgreSQL to
-- generate IDs only when a missing canonical subject is needed.
-- Existing production identities are never replaced.
-- Avoid arbitrary selection when a global subject has duplicate names.
do $vs_timetable_seed$
declare
  v_name text;
  v_count integer;
begin
  foreach v_name in array array[
    'English', 'Kiswahili', 'Mathematics', 'Religious Education',
    'Social Studies', 'Integrated Science', 'Pre-Technical Studies',
    'Agriculture and Nutrition', 'Creative Arts and Sports',
    'Environmental Activities', 'Creative Activities', 'Indigenous Languages',
    'Science and Technology'
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
end $vs_timetable_seed$;

-- Official KICD 2024 national learning-area allocations. VibeSchool labels
-- remain canonical stable subject identities; kicd_learning_area preserves the
-- exact curricular label for source reconciliation without changing history.
-- PPI is ONE separate weekly programme period per grade, NOT another
-- assessed subject. Never double-count it in curriculum/teacher allocation.
-- Official tables: 30+1 (G1–3), 34+1 (G4–6), 40+1 (G7–9).
-- The lower-primary source does not establish lesson duration; do not guess.
with learning_areas(band, subject_label, kicd_learning_area, units) as (
  values
    ('lower_primary', 'Indigenous Languages', 'Indigenous Language Activities', 2),
    ('lower_primary', 'Kiswahili', 'Kiswahili Language Activities / Kenya Sign Language Activities', 4),
    ('lower_primary', 'English', 'English Language Activities', 5),
    ('lower_primary', 'Mathematics', 'Mathematical Activities', 5),
    ('lower_primary', 'Religious Education', 'Religious Education Activities', 3),
    ('lower_primary', 'Environmental Activities', 'Environmental Activities', 4),
    ('lower_primary', 'Creative Activities', 'Creative Activities', 7),
    ('upper_primary', 'English', 'English', 5),
    ('upper_primary', 'Kiswahili', 'Kiswahili / Kenya Sign Language', 4),
    ('upper_primary', 'Mathematics', 'Mathematics', 5),
    ('upper_primary', 'Religious Education', 'Religious Education', 3),
    ('upper_primary', 'Science and Technology', 'Science & Technology', 4),
    ('upper_primary', 'Agriculture and Nutrition', 'Agriculture', 4),
    ('upper_primary', 'Social Studies', 'Social Studies', 3),
    ('upper_primary', 'Creative Arts and Sports', 'Creative Arts', 6),
    ('junior_school', 'English', 'English', 5),
    ('junior_school', 'Kiswahili', 'Kiswahili / Kenya Sign Language', 4),
    ('junior_school', 'Mathematics', 'Mathematics', 5),
    ('junior_school', 'Religious Education', 'Religious Education', 4),
    ('junior_school', 'Social Studies', 'Social Studies', 4),
    ('junior_school', 'Integrated Science', 'Integrated Science', 5),
    ('junior_school', 'Pre-Technical Studies', 'Pre-Technical Studies', 4),
    ('junior_school', 'Agriculture and Nutrition', 'Agriculture', 4),
    ('junior_school', 'Creative Arts and Sports', 'Creative Arts and Sports', 5)
),
grades(grade, band, source_ref, source_revision, lesson_minutes) as (
  values
    ('Grade 1', 'lower_primary', 'https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-1-3-English-Activities-Revised-Sept.pdf', 'Revised 2024, lower-primary allocation', null),
    ('Grade 2', 'lower_primary', 'https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-1-3-English-Activities-Revised-Sept.pdf', 'Revised 2024, lower-primary allocation', null),
    ('Grade 3', 'lower_primary', 'https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-1-3-English-Activities-Revised-Sept.pdf', 'Revised 2024, lower-primary allocation', null),
    ('Grade 4', 'upper_primary', 'https://kicd.ac.ke/wp-content/uploads/2024/10/AGRICULTURE-Grade-6-30.07.2024.pdf', 'Revised 2024, upper-primary allocation', 35),
    ('Grade 5', 'upper_primary', 'https://kicd.ac.ke/wp-content/uploads/2024/10/AGRICULTURE-Grade-6-30.07.2024.pdf', 'Revised 2024, upper-primary allocation', 35),
    ('Grade 6', 'upper_primary', 'https://kicd.ac.ke/wp-content/uploads/2024/10/AGRICULTURE-Grade-6-30.07.2024.pdf', 'Revised 2024, upper-primary allocation', 35),
    ('Grade 7', 'junior_school', 'https://kicd.ac.ke/wp-content/uploads/2024/06/Agriculture-Grade-9-Formatted-April-2024.pdf', '2024 junior-school curriculum design', 40),
    ('Grade 8', 'junior_school', 'https://kicd.ac.ke/wp-content/uploads/2024/06/Agriculture-Grade-9-Formatted-April-2024.pdf', '2024 junior-school curriculum design', 40),
    ('Grade 9', 'junior_school', 'https://kicd.ac.ke/wp-content/uploads/2024/06/Agriculture-Grade-9-Formatted-April-2024.pdf', '2024 junior-school curriculum design', 40)
),
verified_subjects as (
  select
    g.grade, g.band, a.subject_label, a.kicd_learning_area, a.units,
    g.source_ref, g.source_revision, g.lesson_minutes,
    s.id as global_subject_id
  from grades g
  join learning_areas a on a.band = g.band
  join public.subjects s
    on s.name = a.subject_label and s.school_id is null
)
insert into public.subject_weekly_allocations (
  band, grade, subject_label, lessons_per_week,
  global_subject_id, source, source_ref, source_revision,
  lesson_minutes, kicd_learning_area
)
select
  band, grade, subject_label, units,
  global_subject_id, 'KICD official curriculum design',
  source_ref, source_revision, lesson_minutes, kicd_learning_area
from verified_subjects
on conflict (grade, subject_label)
do update set
  band = excluded.band,
  lessons_per_week = excluded.lessons_per_week,
  global_subject_id = excluded.global_subject_id,
  source = excluded.source,
  source_ref = excluded.source_ref,
  source_revision = excluded.source_revision,
  lesson_minutes = excluded.lesson_minutes,
  kicd_learning_area = excluded.kicd_learning_area;

-- Fail closed on missing, duplicate or extra national learning-area records.
-- This also detects a missing global subject or a stale additional subject.
do $kicd_allocation_contract$
declare
  v_grade text;
  v_grade_number integer;
  v_expected_count integer;
  v_expected_lessons integer;
  v_count integer;
  v_total integer;
  v_unmapped integer;
begin
  for v_grade_number in 1..9 loop
    v_grade := 'Grade ' || v_grade_number;
    v_expected_count := case
      when v_grade_number <= 3 then 7
      when v_grade_number <= 6 then 8
      else 9 end;
    v_expected_lessons := case
      when v_grade_number <= 3 then 30
      when v_grade_number <= 6 then 34
      else 40 end;
    select count(*), coalesce(sum(lessons_per_week), 0),
           count(*) filter (
             where global_subject_id is null
                or source_ref is null
                or kicd_learning_area is null
           )
    into v_count, v_total, v_unmapped
    from public.subject_weekly_allocations
    where grade = v_grade;
    if v_count <> v_expected_count
       or v_total <> v_expected_lessons
       or v_unmapped <> 0 then
      raise exception
        'KICD_ALLOCATION_MISMATCH: % (% rows/% expected, % units/% expected, % unmapped)',
        v_grade, v_count, v_expected_count, v_total, v_expected_lessons, v_unmapped;
    end if;
  end loop;
end $kicd_allocation_contract$;

-- Read-only national projection; PPI does not create a teacher assignment or
-- an invented school clock time. Actual PPI scheduling is school-controlled.
create or replace view public.kicd_weekly_grade_allocation
with (security_invoker = true) as
select
  swa.grade,
  count(*)::integer as subject_count,
  sum(swa.lessons_per_week)::integer as curriculum_lessons,
  1::integer as ppi_periods,
  (sum(swa.lessons_per_week) + 1)::integer as total_periods
from public.subject_weekly_allocations swa
where swa.grade in (
  'Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6',
  'Grade 7','Grade 8','Grade 9'
)
group by swa.grade;
revoke all on public.kicd_weekly_grade_allocation from public, anon;
grant select on public.kicd_weekly_grade_allocation to authenticated;

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

-- Resolve VibeSchool's existing subject identities to official national
-- equivalents. KSL and CRE/IRE/HRE are alternatives, never extra allocations.
-- Do not alias unrelated optional languages or split an integrated learning area.
with grades(grade_code, band) as (
  values
    ('Grade 1','lower_primary'),('Grade 2','lower_primary'),
    ('Grade 3','lower_primary'),('Grade 4','upper_primary'),
    ('Grade 5','upper_primary'),('Grade 6','upper_primary'),
    ('Grade 7','junior_school'),('Grade 8','junior_school'),
    ('Grade 9','junior_school')
),
aliases(band, alternative, baseline) as (
  values
    ('lower_primary', 'Indigenous Language', 'Indigenous Languages'),
    ('lower_primary', 'Mathematical Activities', 'Mathematics'),
    ('lower_primary', 'Kenyan Sign Language', 'Kiswahili'),
    ('upper_primary', 'Science & Technology', 'Science and Technology'),
    ('upper_primary', 'Creative Arts', 'Creative Arts and Sports'),
    ('upper_primary', 'Agriculture', 'Agriculture and Nutrition'),
    ('upper_primary', 'Kenyan Sign Language', 'Kiswahili'),
    ('junior_school', 'Kenyan Sign Language', 'Kiswahili'),
    ('junior_school', 'Agriculture', 'Agriculture and Nutrition'),
    ('lower_primary', 'Christian Religious Education', 'Religious Education'),
    ('lower_primary', 'Islamic Religious Education', 'Religious Education'),
    ('lower_primary', 'Hindu Religious Education', 'Religious Education'),
    ('upper_primary', 'Christian Religious Education', 'Religious Education'),
    ('upper_primary', 'Islamic Religious Education', 'Religious Education'),
    ('upper_primary', 'Hindu Religious Education', 'Religious Education'),
    ('junior_school', 'Christian Religious Education', 'Religious Education'),
    ('junior_school', 'Islamic Religious Education', 'Religious Education'),
    ('junior_school', 'Hindu Religious Education', 'Religious Education')
)
insert into public.timetable_allocation_subject_aliases (
  grade_code, subject_id, baseline_subject_id, source_ref
)
select
  g.grade_code,
  alternative.id,
  baseline.id,
  'KICD official learning-area alternatives; 2024'
from grades g
join aliases a on a.band = g.band
join public.subjects alternative
  on alternative.name = a.alternative and alternative.school_id is null
join public.subjects baseline
  on baseline.name = a.baseline and baseline.school_id is null
on conflict (grade_code, subject_id) do nothing;

-- A conflicting pre-existing alias is not silently replaced.
do $kicd_alias_integrity$
begin
  if exists (
    select 1
    from public.timetable_allocation_subject_aliases a
    join public.subjects alternative on alternative.id = a.subject_id
    join public.subjects baseline on baseline.id = a.baseline_subject_id
    where (alternative.name = 'Kenyan Sign Language' and baseline.name <> 'Kiswahili'
      and a.grade_code in ('Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Grade 8','Grade 9'))
       or (alternative.name in ('Christian Religious Education','Islamic Religious Education','Hindu Religious Education')
         and baseline.name <> 'Religious Education'
         and a.grade_code in ('Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Grade 8','Grade 9'))
  ) then
    raise exception 'CONFLICTING_KICD_ALTERNATIVE';
  end if;
end $kicd_alias_integrity$;

commit;
