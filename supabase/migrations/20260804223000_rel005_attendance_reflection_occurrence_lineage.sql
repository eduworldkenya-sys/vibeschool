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

create or replace function public.upsert_attendance_batch(p_rows jsonb)
returns setof public.attendance
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_row jsonb;
  v_uid uuid := auth.uid();
  v_student_id uuid;
  v_class_id uuid;
  v_school_id uuid;
  v_slot_id uuid;
  v_occurrence_id uuid;
  v_date date;
  v_status public.attendance_status;
  v_is_late boolean;
  v_occurrence public.teaching_occurrences%rowtype;
  rec public.attendance;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'p_rows must be a JSON array';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_student_id := (v_row->>'student_id')::uuid;
    v_class_id := (v_row->>'class_id')::uuid;
    v_school_id := (v_row->>'school_id')::uuid;
    v_slot_id := nullif(v_row->>'timetable_slot_id', '')::uuid;
    v_occurrence_id := nullif(v_row->>'teaching_occurrence_id', '')::uuid;
    v_date := (v_row->>'date')::date;
    if v_row->>'status' = 'late' then
      v_status := 'present'; v_is_late := true;
    else
      v_status := (v_row->>'status')::public.attendance_status;
      v_is_late := coalesce((v_row->>'is_late')::boolean, false);
    end if;

    if not exists (select 1 from public.school_members
      where profile_id=v_uid and school_id=v_school_id) then
      raise exception 'Not a member of school %', v_school_id;
    end if;
    if not exists (select 1 from public.classes
      where id=v_class_id and school_id=v_school_id) then
      raise exception 'Class % does not belong to school %', v_class_id, v_school_id;
    end if;
    if not exists (select 1 from public.students
      where id=v_student_id and class_id=v_class_id) then
      raise exception 'Student % does not belong to class %', v_student_id, v_class_id;
    end if;

    if v_slot_id is not null then
      if v_occurrence_id is null then raise exception 'lesson_attendance_requires_occurrence'; end if;
      select * into v_occurrence from public.teaching_occurrences where id=v_occurrence_id;
      if not found then raise exception 'attendance_occurrence_not_found'; end if;
      if v_occurrence.teacher_id != v_uid
        or v_occurrence.school_id != v_school_id
        or v_occurrence.class_id != v_class_id
        or v_occurrence.timetable_slot_id != v_slot_id
        or v_occurrence.occurrence_date != v_date then
        raise exception 'attendance_occurrence_mismatch';
      end if;
    elsif v_occurrence_id is not null then
      raise exception 'general_attendance_cannot_reference_occurrence';
    end if;

    if v_slot_id is null then
      insert into public.attendance
        (school_id,class_id,student_id,teacher_id,date,status,is_late,marked_at)
      values (v_school_id,v_class_id,v_student_id,v_uid,v_date,v_status,v_is_late,clock_timestamp())
      on conflict (class_id,student_id,date) where timetable_slot_id is null
      do update set status=excluded.status,is_late=excluded.is_late,
        teacher_id=excluded.teacher_id,marked_at=excluded.marked_at
      returning * into rec;
    else
      insert into public.attendance
        (school_id,class_id,student_id,teacher_id,date,status,is_late,
         timetable_slot_id,teaching_occurrence_id,marked_at)
      values (v_school_id,v_class_id,v_student_id,v_uid,v_date,v_status,v_is_late,
        v_slot_id,v_occurrence_id,clock_timestamp())
      on conflict (teaching_occurrence_id,student_id)
        where teaching_occurrence_id is not null
      do update set status=excluded.status,is_late=excluded.is_late,
        teacher_id=excluded.teacher_id,timetable_slot_id=excluded.timetable_slot_id,
        date=excluded.date,marked_at=excluded.marked_at
      returning * into rec;
    end if;
    return next rec;
  end loop;
  return;
end;
$$;

revoke all on function public.upsert_attendance_batch(jsonb) from public;
revoke all on function public.upsert_attendance_batch(jsonb) from anon;
grant execute on function public.upsert_attendance_batch(jsonb) to authenticated;
grant execute on function public.upsert_attendance_batch(jsonb) to service_role;

comment on column
  public.attendance.teaching_occurrence_id
is
  'Exact teaching occurrence whose learner register this row belongs to.';

comment on column
  public.lesson_reflections.teaching_occurrence_id
is
  'Exact teaching occurrence being reflected on.';

commit;
