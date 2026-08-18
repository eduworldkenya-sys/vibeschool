begin;

create or replace function public.upsert_attendance_batch(p_rows jsonb)
returns setof public.attendance
language plpgsql
set search_path = public, auth, pg_temp
as $$
declare
  v_row               jsonb;
  v_student_id        uuid;
  v_class_id          uuid;
  v_school_id         uuid;
  v_slot_id           uuid;
  v_occurrence_id     uuid;
  v_date              date;
  v_status            public.attendance_status;
  v_is_late           boolean;
  v_uid               uuid := auth.uid();
  v_class_school_id   uuid;
  v_slot_class_id     uuid;
  v_slot_school_id    uuid;
  v_occurrence        public.teaching_occurrences%rowtype;
  rec                 public.attendance;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'attendance_rows_must_be_array';
  end if;

  if jsonb_array_length(p_rows) = 0 then
    return;
  end if;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    v_student_id    := nullif(v_row->>'student_id', '')::uuid;
    v_class_id      := nullif(v_row->>'class_id', '')::uuid;
    v_school_id     := nullif(v_row->>'school_id', '')::uuid;
    v_slot_id       := nullif(v_row->>'timetable_slot_id', '')::uuid;
    v_occurrence_id := nullif(v_row->>'teaching_occurrence_id', '')::uuid;
    v_date          := nullif(v_row->>'date', '')::date;

    if v_student_id is null or v_class_id is null or v_school_id is null or v_date is null then
      raise exception 'attendance_identity_required';
    end if;

    if v_row->>'status' = 'late' then
      v_status  := 'present';
      v_is_late := true;
    else
      v_status  := (v_row->>'status')::public.attendance_status;
      v_is_late := coalesce((v_row->>'is_late')::boolean, false);
    end if;

    if not exists (
      select 1
      from public.school_members sm
      where sm.profile_id = v_uid
        and sm.school_id = v_school_id
        and sm.role::text = 'teacher'
    ) then
      raise exception 'teacher_school_not_authorized';
    end if;

    if not exists (
      select 1
      from public.teacher_classes tc
      where tc.teacher_id = v_uid
        and tc.school_id = v_school_id
        and tc.class_id = v_class_id
    ) then
      raise exception 'teacher_class_not_authorized';
    end if;

    select c.school_id
      into v_class_school_id
    from public.classes c
    where c.id = v_class_id;

    if v_class_school_id is null or v_class_school_id <> v_school_id then
      raise exception 'attendance_class_school_mismatch';
    end if;

    if not exists (
      select 1
      from public.students s
      join public.student_classes sc
        on sc.student_id = s.id
       and sc.class_id = v_class_id
       and sc.school_id = v_school_id
       and sc.is_current = true
      where s.id = v_student_id
        and s.deleted_at is null
    ) then
      raise exception 'student_not_currently_enrolled';
    end if;

    if v_slot_id is not null then
      if v_occurrence_id is null then
        raise exception 'lesson_attendance_requires_occurrence';
      end if;

      select ts.class_id, ts.school_id
        into v_slot_class_id, v_slot_school_id
      from public.timetable_slots ts
      where ts.id = v_slot_id
        and ts.teacher_id = v_uid;

      if v_slot_class_id is null
         or v_slot_class_id <> v_class_id
         or v_slot_school_id <> v_school_id
      then
        raise exception 'attendance_slot_scope_mismatch';
      end if;

      select *
        into v_occurrence
      from public.teaching_occurrences t
      where t.id = v_occurrence_id;

      if not found then
        raise exception 'attendance_occurrence_not_found';
      end if;

      if v_occurrence.teacher_id <> v_uid
         or v_occurrence.school_id <> v_school_id
         or v_occurrence.class_id <> v_class_id
         or v_occurrence.timetable_slot_id <> v_slot_id
         or v_occurrence.occurrence_date <> v_date
      then
        raise exception 'attendance_occurrence_mismatch';
      end if;
    elsif v_occurrence_id is not null then
      raise exception 'general_attendance_cannot_reference_occurrence';
    end if;

    if v_slot_id is null then
      insert into public.attendance
        (school_id, class_id, student_id, teacher_id, date, status, is_late, timetable_slot_id, teaching_occurrence_id, marked_at)
      values
        (v_school_id, v_class_id, v_student_id, v_uid, v_date, v_status, v_is_late, null, null, clock_timestamp())
      on conflict (class_id, student_id, date) where timetable_slot_id is null
      do update set
        status = excluded.status,
        is_late = excluded.is_late,
        teacher_id = excluded.teacher_id,
        marked_at = excluded.marked_at
      returning * into rec;
    else
      insert into public.attendance
        (school_id, class_id, student_id, teacher_id, date, status, is_late, timetable_slot_id, teaching_occurrence_id, marked_at)
      values
        (v_school_id, v_class_id, v_student_id, v_uid, v_date, v_status, v_is_late, v_slot_id, v_occurrence_id, clock_timestamp())
      on conflict (teaching_occurrence_id, student_id) where teaching_occurrence_id is not null
      do update set
        status = excluded.status,
        is_late = excluded.is_late,
        teacher_id = excluded.teacher_id,
        timetable_slot_id = excluded.timetable_slot_id,
        date = excluded.date,
        marked_at = excluded.marked_at
      returning * into rec;
    end if;

    return next rec;
  end loop;

  return;
end;
$$;

revoke all on function public.upsert_attendance_batch(jsonb) from public, anon;
grant execute on function public.upsert_attendance_batch(jsonb) to authenticated, service_role;

commit;
