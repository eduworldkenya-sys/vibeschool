begin;

alter table public.attendance
  add column if not exists
    teaching_occurrence_id uuid null
  references public.teaching_occurrences(id)
  on delete set null;

alter table public.lesson_reflections
  add column if not exists
    teaching_occurrence_id uuid null
  references public.teaching_occurrences(id)
  on delete set null;

create index if not exists
  attendance_teaching_occurrence_idx
on public.attendance(teaching_occurrence_id)
where teaching_occurrence_id is not null;

create unique index if not exists
  attendance_occurrence_student_uidx
on public.attendance(
  teaching_occurrence_id,
  student_id
)
where teaching_occurrence_id is not null;

create index if not exists
  lesson_reflections_teaching_occurrence_idx
on public.lesson_reflections(teaching_occurrence_id)
where teaching_occurrence_id is not null;

create unique index if not exists
  lesson_reflections_occurrence_uidx
on public.lesson_reflections(teaching_occurrence_id)
where teaching_occurrence_id is not null;

update public.attendance a
set teaching_occurrence_id = o.id
from public.teaching_occurrences o
where a.teaching_occurrence_id is null
  and a.timetable_slot_id is not null
  and o.timetable_slot_id =
    a.timetable_slot_id
  and o.occurrence_date = a.date
  and o.teacher_id = a.teacher_id
  and o.class_id = a.class_id
  and o.school_id = a.school_id;

update public.lesson_reflections r
set teaching_occurrence_id = o.id
from public.lesson_plans lp
join public.teaching_occurrences o
  on o.timetable_slot_id =
    lp.timetable_slot_id
 and o.occurrence_date =
    lp.taught_date
 and o.teacher_id =
    lp.teacher_id
 and o.class_id =
    lp.class_id
where r.teaching_occurrence_id is null
  and lp.id = r.lesson_plan_id;

create or replace function
  public.validate_lesson_reflection_occurrence()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  occurrence_row
    public.teaching_occurrences%rowtype;
  lesson_row
    public.lesson_plans%rowtype;
begin
  if new.teaching_occurrence_id is null then
    return new;
  end if;

  if new.lesson_plan_id is null then
    raise exception
      'reflection_occurrence_requires_lesson_plan';
  end if;

  select *
  into occurrence_row
  from public.teaching_occurrences
  where id = new.teaching_occurrence_id;

  if not found then
    raise exception
      'reflection_occurrence_not_found';
  end if;

  select *
  into lesson_row
  from public.lesson_plans
  where id = new.lesson_plan_id;

  if not found then
    raise exception
      'reflection_lesson_plan_not_found';
  end if;

  if new.teacher_id
       is distinct from occurrence_row.teacher_id
     or new.class_id
       is distinct from occurrence_row.class_id
     or lesson_row.teacher_id
       is distinct from occurrence_row.teacher_id
     or lesson_row.class_id
       is distinct from occurrence_row.class_id
     or lesson_row.subject_id
       is distinct from occurrence_row.subject_id
     or lesson_row.timetable_slot_id
       is distinct from occurrence_row.timetable_slot_id
     or lesson_row.taught_date
       is distinct from occurrence_row.occurrence_date
  then
    raise exception
      'reflection_occurrence_mismatch';
  end if;

  if new.school_id is not null
     and new.school_id
       is distinct from occurrence_row.school_id
  then
    raise exception
      'reflection_school_mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists
  validate_lesson_reflection_occurrence_trigger
on public.lesson_reflections;

create trigger
  validate_lesson_reflection_occurrence_trigger
before insert or update of
  teaching_occurrence_id,
  lesson_plan_id,
  teacher_id,
  class_id,
  school_id
on public.lesson_reflections
for each row
execute function
  public.validate_lesson_reflection_occurrence();

-- The production migration also replaces
-- upsert_attendance_batch(jsonb) so lesson rows:
--   1. require teaching_occurrence_id;
--   2. validate teacher, school, class, slot and date;
--   3. conflict on occurrence + student;
--   4. keep general class registers occurrence-free.
--
-- Full authoritative function was applied to production
-- with this migration before repository parity.

comment on column
  public.attendance.teaching_occurrence_id
is
  'Exact teaching occurrence whose learner register this row belongs to.';

comment on column
  public.lesson_reflections.teaching_occurrence_id
is
  'Exact teaching occurrence being reflected on.';

commit;
