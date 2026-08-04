-- FND-002C — deterministic Scheme of Work sequencing
--
-- Establishes one stable sequence position for each valid teacher-owned
-- class/subject/academic-term scheme.
--
-- Progress authority:
--   teaching_occurrences.lifecycle = 'completed'
--
-- Security authority:
--   auth.uid() must have the exact class/subject assignment in teacher_classes.
--
-- This migration does not:
--   - guess sequence for rows missing teacher/class/academic-term identity;
--   - alter lesson completion;
--   - update scheme status;
--   - replace the LessonPlanModal caller yet.

alter table public.scheme_of_work
  add column if not exists sequence_number integer;

comment on column public.scheme_of_work.sequence_number is
  'Stable 1-based curriculum order within teacher, school, class, subject and academic term.';

-- Backfill only rows with a complete authoritative partition identity.
-- Live preflight verified that no valid partition currently has more than
-- one row in the same week.
with ranked as (
  select
    id,
    row_number() over (
      partition by
        teacher_id,
        school_id,
        class_id,
        subject_id,
        academic_term_id
      order by
        week asc,
        lesson_number asc nulls last,
        created_at asc nulls last,
        id asc
    )::integer as resolved_sequence
  from public.scheme_of_work
  where teacher_id is not null
    and class_id is not null
    and academic_term_id is not null
)
update public.scheme_of_work sw
   set sequence_number = ranked.resolved_sequence
  from ranked
 where sw.id = ranked.id
   and sw.sequence_number is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.scheme_of_work'::regclass
      and conname = 'scheme_of_work_sequence_number_positive'
  ) then
    alter table public.scheme_of_work
      add constraint scheme_of_work_sequence_number_positive
      check (
        sequence_number is null
        or sequence_number > 0
      );
  end if;
end;
$$;

create unique index if not exists
  scheme_of_work_authoritative_sequence_uidx
on public.scheme_of_work (
  teacher_id,
  school_id,
  class_id,
  subject_id,
  academic_term_id,
  sequence_number
)
where teacher_id is not null
  and class_id is not null
  and academic_term_id is not null
  and sequence_number is not null;

create index if not exists
  scheme_of_work_sequence_lookup_idx
on public.scheme_of_work (
  teacher_id,
  school_id,
  class_id,
  subject_id,
  academic_term_id,
  sequence_number
)
where sequence_number is not null;

create or replace function public.get_next_scheme_item(
  p_class_id uuid,
  p_subject_id uuid,
  p_academic_term_id uuid
)
returns table (
  scheme_id uuid,
  curriculum_id uuid,
  strand text,
  sub_strand text,
  topic text,
  objectives text,
  key_inquiry_question text,
  learning_resources text,
  week integer,
  lesson_number integer,
  sequence_number integer,
  last_completed_sequence integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_school_id uuid;
  v_last_completed_sequence integer;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'not_authenticated'
      using errcode = 'P0001';
  end if;

  -- Resolve and authorize the exact teacher assignment.
  select tc.school_id
    into v_school_id
    from public.teacher_classes tc
   where tc.teacher_id = v_user_id
     and tc.class_id = p_class_id
     and tc.subject_id = p_subject_id
   limit 1;

  if v_school_id is null then
    raise exception 'assignment_not_found'
      using errcode = 'P0001';
  end if;

  -- The supplied academic term must belong to the same school.
  if not exists (
    select 1
      from public.academic_terms at
     where at.id = p_academic_term_id
       and at.school_id = v_school_id
  ) then
    raise exception 'academic_term_not_found'
      using errcode = 'P0001';
  end if;

  -- Actual progress is the greatest sequence reached by a completed
  -- teaching occurrence whose exact slot/date lesson plan is linked
  -- to this authoritative scheme partition.
  select max(sw.sequence_number)
    into v_last_completed_sequence
    from public.teaching_occurrences occurrence
    join public.lesson_plans lp
      on lp.timetable_slot_id = occurrence.timetable_slot_id
     and lp.taught_date = occurrence.occurrence_date
    join public.scheme_of_work sw
      on sw.id = lp.scheme_id
   where occurrence.lifecycle = 'completed'
     and lp.teacher_id = v_user_id
     and lp.school_id = v_school_id
     and lp.class_id = p_class_id
     and lp.subject_id = p_subject_id
     and sw.teacher_id = v_user_id
     and sw.school_id = v_school_id
     and sw.class_id = p_class_id
     and sw.subject_id = p_subject_id
     and sw.academic_term_id = p_academic_term_id
     and sw.sequence_number is not null;

  return query
  select
    sw.id,
    sw.curriculum_id,
    sw.strand,
    sw.sub_strand,
    sw.topic,
    sw.objectives,
    sw.key_inquiry_question,
    sw.learning_resources,
    sw.week,
    sw.lesson_number,
    sw.sequence_number,
    v_last_completed_sequence
  from public.scheme_of_work sw
  where sw.teacher_id = v_user_id
    and sw.school_id = v_school_id
    and sw.class_id = p_class_id
    and sw.subject_id = p_subject_id
    and sw.academic_term_id = p_academic_term_id
    and sw.sequence_number is not null
    and (
      v_last_completed_sequence is null
      or sw.sequence_number > v_last_completed_sequence
    )
  order by sw.sequence_number asc
  limit 1;
end;
$$;

revoke all on function public.get_next_scheme_item(
  uuid,
  uuid,
  uuid
) from public;

grant execute on function public.get_next_scheme_item(
  uuid,
  uuid,
  uuid
) to authenticated;

-- Postflight assertions.
do $$
declare
  v_duplicate_positions integer;
  v_unsequenced_valid_rows integer;
begin
  select count(*)
    into v_duplicate_positions
    from (
      select
        teacher_id,
        school_id,
        class_id,
        subject_id,
        academic_term_id,
        sequence_number
      from public.scheme_of_work
      where teacher_id is not null
        and class_id is not null
        and academic_term_id is not null
        and sequence_number is not null
      group by
        teacher_id,
        school_id,
        class_id,
        subject_id,
        academic_term_id,
        sequence_number
      having count(*) > 1
    ) duplicates;

  if v_duplicate_positions <> 0 then
    raise exception
      'FND-002C postflight failed: % duplicate sequence positions',
      v_duplicate_positions;
  end if;

  select count(*)
    into v_unsequenced_valid_rows
    from public.scheme_of_work
   where teacher_id is not null
     and class_id is not null
     and academic_term_id is not null
     and sequence_number is null;

  if v_unsequenced_valid_rows <> 0 then
    raise exception
      'FND-002C postflight failed: % valid rows remain unsequenced',
      v_unsequenced_valid_rows;
  end if;

  raise notice
    'FND-002C postflight complete: duplicate_positions=%, unsequenced_valid_rows=%',
    v_duplicate_positions,
    v_unsequenced_valid_rows;
end;
$$;
