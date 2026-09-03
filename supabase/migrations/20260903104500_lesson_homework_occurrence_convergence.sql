begin;

-- Lesson-owned homework may be prepared before teaching begins (for example
-- when a teacher shares the plan with parents). Once the exact occurrence
-- exists, converge the draft onto that occurrence automatically. The reverse
-- direction also applies: homework created after the lesson starts resolves
-- the already-existing exact occurrence from its lesson plan.

create or replace function public.homework_bind_exact_occurrence()
returns trigger
language plpgsql
set search_path = 'public', 'pg_temp'
as $$
declare
  v_plan public.lesson_plans%rowtype;
  v_occurrence_id uuid;
begin
  if new.lesson_plan_id is null or new.teaching_occurrence_id is not null then
    return new;
  end if;

  select *
    into v_plan
    from public.lesson_plans
   where id = new.lesson_plan_id;

  if not found then
    return new;
  end if;

  select o.id
    into v_occurrence_id
    from public.teaching_occurrences o
   where o.timetable_slot_id = v_plan.timetable_slot_id
     and o.occurrence_date = v_plan.taught_date
     and o.school_id = v_plan.school_id
     and o.teacher_id = v_plan.teacher_id
     and o.class_id = v_plan.class_id
     and o.subject_id = v_plan.subject_id
     and o.lifecycle in ('in_progress', 'completed')
   limit 1;

  if v_occurrence_id is not null then
    new.teaching_occurrence_id := v_occurrence_id;
  end if;

  return new;
end;
$$;

revoke all on function public.homework_bind_exact_occurrence() from public;
revoke all on function public.homework_bind_exact_occurrence() from anon;
revoke all on function public.homework_bind_exact_occurrence() from authenticated;

drop trigger if exists trg_homework_bind_exact_occurrence on public.homework;
create trigger trg_homework_bind_exact_occurrence
before insert or update of lesson_plan_id, teaching_occurrence_id
on public.homework
for each row
execute function public.homework_bind_exact_occurrence();

create or replace function public.bind_lesson_homework_on_occurrence_start()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_plan_id uuid;
begin
  if new.lifecycle not in ('in_progress', 'completed') then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.lifecycle = new.lifecycle then
    return new;
  end if;

  select lp.id
    into v_plan_id
    from public.lesson_plans lp
   where lp.timetable_slot_id = new.timetable_slot_id
     and lp.taught_date = new.occurrence_date
     and lp.school_id = new.school_id
     and lp.teacher_id = new.teacher_id
     and lp.class_id = new.class_id
     and lp.subject_id = new.subject_id
   limit 1;

  if v_plan_id is null then
    return new;
  end if;

  update public.homework h
     set teaching_occurrence_id = new.id
   where h.lesson_plan_id = v_plan_id
     and h.teaching_occurrence_id is null
     and h.school_id = new.school_id
     and h.teacher_id = new.teacher_id
     and h.class_id = new.class_id;

  return new;
end;
$$;

revoke all on function public.bind_lesson_homework_on_occurrence_start() from public;
revoke all on function public.bind_lesson_homework_on_occurrence_start() from anon;
revoke all on function public.bind_lesson_homework_on_occurrence_start() from authenticated;

drop trigger if exists trg_bind_lesson_homework_on_occurrence_start on public.teaching_occurrences;
create trigger trg_bind_lesson_homework_on_occurrence_start
after insert or update of lifecycle
on public.teaching_occurrences
for each row
execute function public.bind_lesson_homework_on_occurrence_start();

-- Converge only rows whose exact historical identity is already provable from
-- the current plan + occurrence tuples. Ambiguous legacy homework remains
-- untouched rather than being guessed into an occurrence.
update public.homework h
   set teaching_occurrence_id = o.id
  from public.lesson_plans lp
  join public.teaching_occurrences o
    on o.timetable_slot_id = lp.timetable_slot_id
   and o.occurrence_date = lp.taught_date
   and o.school_id = lp.school_id
   and o.teacher_id = lp.teacher_id
   and o.class_id = lp.class_id
   and o.subject_id = lp.subject_id
   and o.lifecycle in ('in_progress', 'completed')
 where h.teaching_occurrence_id is null
   and h.lesson_plan_id = lp.id
   and h.school_id = o.school_id
   and h.teacher_id = o.teacher_id
   and h.class_id = o.class_id;

commit;
