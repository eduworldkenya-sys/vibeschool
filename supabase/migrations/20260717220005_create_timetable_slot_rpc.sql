create or replace function public.create_timetable_slot(
  p_class_id        uuid,
  p_subject_id      uuid,
  p_day_of_week     int,
  p_start_time      time,
  p_end_time        time,
  p_room            text default null,
  p_effective_from  date default null,
  p_effective_until date default null
)
returns timetable_slots
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id     uuid := auth.uid();
  v_school_id      uuid;
  v_effective_from date := coalesce(p_effective_from, (now() at time zone 'Africa/Nairobi')::date);
  v_new_row        timetable_slots;
  v_constraint     text;
begin
  if v_teacher_id is null then
    raise exception 'ASSIGNMENT_NOT_FOUND';
  end if;

  if p_day_of_week is null or p_day_of_week < 1 or p_day_of_week > 7 then
    raise exception 'INVALID_TIME';
  end if;

  if p_start_time is null or p_end_time is null or p_start_time >= p_end_time then
    raise exception 'INVALID_TIME';
  end if;

  if p_effective_until is not null and p_effective_until < v_effective_from then
    raise exception 'INVALID_DATE_RANGE';
  end if;

  -- school_id is derived from the teacher's own assignment row, never
  -- accepted from the client. This makes a school mismatch structurally
  -- impossible rather than a separate error case to check for.
  select tc.school_id into v_school_id
  from teacher_classes tc
  where tc.teacher_id = v_teacher_id
    and tc.class_id = p_class_id
    and tc.subject_id = p_subject_id
  limit 1;

  if v_school_id is null then
    raise exception 'ASSIGNMENT_NOT_FOUND';
  end if;

  begin
    insert into timetable_slots (
      school_id, teacher_id, class_id, subject_id,
      day_of_week, start_time, end_time, room,
      effective_from, effective_until
    ) values (
      v_school_id, v_teacher_id, p_class_id, p_subject_id,
      p_day_of_week, p_start_time, p_end_time, nullif(btrim(p_room), ''),
      v_effective_from, p_effective_until
    )
    returning * into v_new_row;
  exception
    when exclusion_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'excl_teacher_overlap' then
        raise exception 'TEACHER_CONFLICT';
      elsif v_constraint = 'excl_class_overlap' then
        raise exception 'CLASS_CONFLICT';
      else
        raise exception 'TEACHER_CONFLICT';
      end if;
    when unique_violation then
      raise exception 'DUPLICATE_SLOT';
  end;

  return v_new_row;
end;
$$;

revoke all on function public.create_timetable_slot(uuid, uuid, int, time, time, text, date, date) from public;
grant execute on function public.create_timetable_slot(uuid, uuid, int, time, time, text, date, date) to authenticated;
