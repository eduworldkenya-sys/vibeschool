-- One operational timetable: preserve school and private tuition identities,
-- but enforce participant collisions across the two canonical schedules.
-- Tuition access remains invitation-scoped; school rows are never exposed by tuition RPCs.
begin;

create extension if not exists btree_gist;

create index if not exists vibetutor_lessons_active_tutor_time
  on public.vibetutor_lessons(tutor_id, starts_at, ends_at)
  where status = 'scheduled';
create index if not exists vibetutor_lessons_active_student_time
  on public.vibetutor_lessons(student_id, starts_at, ends_at)
  where status = 'scheduled';

-- Database exclusions (not UI previews) close concurrent and direct-write races.
-- Fail deployment on unresolved pre-existing clashes rather than silently exempting them.
alter table public.vibetutor_lessons
  add constraint vibetutor_tutor_no_overlap
  exclude using gist (tutor_id with =, tstzrange(starts_at, ends_at, '[)') with &&)
  where (status = 'scheduled');
alter table public.vibetutor_lessons
  add constraint vibetutor_student_no_overlap
  exclude using gist (student_id with =, tstzrange(starts_at, ends_at, '[)') with &&)
  where (status = 'scheduled');

-- Lock the SAME participants in a stable order across both write paths.
-- Do not serialize unrelated teachers or learners.
create function public.timetable_lock_schedule_participants(
  p_teacher uuid, p_students uuid[]
) returns void language plpgsql security definer set search_path = '' as $$
declare v_key text;
begin
  for v_key in
    select distinct k from (
      select 't:' || p_teacher::text as k where p_teacher is not null
      union all
      select 's:' || x::text from unnest(coalesce(p_students, array[]::uuid[])) as x
      where x is not null
    ) keys order by k
  loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('vs:schedule:' || v_key, 0));
  end loop;
end $$;
revoke all on function public.timetable_lock_schedule_participants(uuid,uuid[]) from public, anon, authenticated;

-- Compare a real one-off tuition interval with each eligible Nairobi-local
-- date of a recurring school slot; include the previous day for midnight edges.
create function public.timetable_school_tuition_overlap(
  p_slot public.timetable_slots, p_lesson public.vibetutor_lessons
) returns boolean language sql stable security definer set search_path = '' as $$
  select
    (p_slot.teacher_id = p_lesson.tutor_id or exists (
      select 1 from public.student_classes sc
      where sc.student_id = p_lesson.student_id
        and sc.class_id = p_slot.class_id
        and sc.school_id = p_slot.school_id
        and sc.is_current = true
        and sc.left_at is null
    ))
    and exists (
      select 1 from pg_catalog.generate_series(
        ((p_lesson.starts_at at time zone 'Africa/Nairobi')::date - 1)::timestamp,
        ((p_lesson.ends_at at time zone 'Africa/Nairobi')::date)::timestamp,
        interval '1 day'
      ) as d(local_day)
      where extract(isodow from d.local_day)::int = p_slot.day_of_week
        and d.local_day::date >= p_slot.effective_from
        and (p_slot.effective_until is null or d.local_day::date <= p_slot.effective_until)
        and p_slot.start_time < p_slot.end_time
        and p_lesson.starts_at <
          ((d.local_day::date + p_slot.end_time) at time zone 'Africa/Nairobi')
        and p_lesson.ends_at >
          ((d.local_day::date + p_slot.start_time) at time zone 'Africa/Nairobi')
        and not exists (
          select 1 from public.school_calendar_exceptions ce
          where ce.school_id = p_slot.school_id
            and ce.exception_date = d.local_day::date
            and ce.suppress_ordinary_teaching = true
        )
    );
$$;
revoke all on function public.timetable_school_tuition_overlap(public.timetable_slots,public.vibetutor_lessons) from public, anon, authenticated;

-- Tuition writer: tutor and student must both be available, including school
-- obligations, before a booking can be persisted.
create function public.vibetutor_guard_cross_schedule()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status <> 'scheduled' then return new; end if;

  perform public.timetable_lock_schedule_participants(new.tutor_id, array[new.student_id]);
  if exists (
    select 1 from public.timetable_slots ts
    where (ts.teacher_id = new.tutor_id or exists (
      select 1 from public.student_classes sc
      where sc.student_id = new.student_id and sc.class_id = ts.class_id
        and sc.school_id = ts.school_id and sc.is_current and sc.left_at is null
    ))
    and public.timetable_school_tuition_overlap(ts, new)
  ) then
    raise exception using errcode = '23514', message = 'SCHOOL_TUITION_CONFLICT';
  end if;
  return new;
end $$;
revoke all on function public.vibetutor_guard_cross_schedule() from public, anon, authenticated;

create trigger vibetutor_guard_cross_schedule
before insert or update of tutor_id, student_id, starts_at, ends_at, status
on public.vibetutor_lessons
for each row execute function public.vibetutor_guard_cross_schedule();

-- School writer: a new or revised recurring slot must not retroactively book
-- over an already-scheduled private appointment for the same tutor or learner.
create function public.timetable_guard_tuition_schedule()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_students uuid[];
begin
  select coalesce(array_agg(distinct sc.student_id order by sc.student_id), array[]::uuid[])
    into v_students
  from public.student_classes sc
  where sc.class_id = new.class_id and sc.school_id = new.school_id
    and sc.is_current and sc.left_at is null;

  perform public.timetable_lock_schedule_participants(new.teacher_id, v_students);
  if exists (
    select 1 from public.vibetutor_lessons l
    where l.status = 'scheduled'
      and (l.tutor_id = new.teacher_id or l.student_id = any(v_students))
      and public.timetable_school_tuition_overlap(new, l)
  ) then
    raise exception using errcode = '23514', message = 'SCHOOL_TUITION_CONFLICT';
  end if;
  return new;
end $$;
revoke all on function public.timetable_guard_tuition_schedule() from public, anon, authenticated;

create trigger timetable_guard_tuition_schedule
before insert or update of teacher_id, class_id, school_id, day_of_week,
  start_time, end_time, effective_from, effective_until
on public.timetable_slots
for each row execute function public.timetable_guard_tuition_schedule();

comment on function public.timetable_school_tuition_overlap(public.timetable_slots,public.vibetutor_lessons)
is 'Cross-context conflict authority only. Returns no school details to tuition callers.';
commit;