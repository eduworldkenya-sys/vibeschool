-- Fix 28: create_timetable_slot — stable, complete error-code contract +
-- lock down execution grants. Idempotent: function body and grants already
-- match live state; this call records the migration in the ledger so local
-- and remote parity is restored (closes a pending-migration gap).

create or replace function public.create_timetable_slot(
  p_class_id uuid,
  p_subject_id uuid,
  p_day_of_week integer,
  p_start_time time without time zone,
  p_end_time time without time zone,
  p_room text default null::text,
  p_effective_from date default null::date,
  p_effective_until date default null::date
)
returns timetable_slots
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_teacher_id      uuid := auth.uid();
  v_school_id       uuid;
  v_class_school_id uuid;
  v_effective_from  date :=
    coalesce(p_effective_from, (now() at time zone 'Africa/Nairobi')::date);
  v_new_row         timetable_slots;
  v_constraint      text;
begin
  if v_teacher_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if p_class_id is null or p_subject_id is null then
    raise exception 'INVALID_ASSIGNMENT';
  end if;

  if p_day_of_week is null
     or p_day_of_week < 1
     or p_day_of_week > 7 then
    raise exception 'INVALID_DAY';
  end if;

  if p_start_time is null
     or p_end_time is null
     or p_start_time >= p_end_time then
    raise exception 'INVALID_TIME_RANGE';
  end if;

  if p_effective_until is not null
     and p_effective_until < v_effective_from then
    raise exception 'INVALID_EFFECTIVE_RANGE';
  end if;

  select tc.school_id
    into v_school_id
  from public.teacher_classes tc
  where tc.teacher_id = v_teacher_id
    and tc.class_id = p_class_id
    and tc.subject_id = p_subject_id
  limit 1;

  if v_school_id is null then
    raise exception 'INVALID_ASSIGNMENT';
  end if;

  select c.school_id
    into v_class_school_id
  from public.classes c
  where c.id = p_class_id;

  if v_class_school_id is null or v_class_school_id is distinct from v_school_id then
    raise exception 'SCHOOL_MISMATCH';
  end if;

  begin
    insert into public.timetable_slots (
      school_id,
      teacher_id,
      class_id,
      subject_id,
      day_of_week,
      start_time,
      end_time,
      room,
      effective_from,
      effective_until
    )
    values (
      v_school_id,
      v_teacher_id,
      p_class_id,
      p_subject_id,
      p_day_of_week,
      p_start_time,
      p_end_time,
      nullif(btrim(p_room), ''),
      v_effective_from,
      p_effective_until
    )
    returning * into v_new_row;

  exception
    when exclusion_violation then
      get stacked diagnostics v_constraint = constraint_name;

      if v_constraint = 'excl_teacher_overlap' then
        raise exception 'TEACHER_CONFLICT';
      elsif v_constraint = 'excl_class_overlap' then
        raise exception 'CLASS_CONFLICT';
      elsif v_constraint = 'excl_room_overlap' then
        raise exception 'ROOM_CONFLICT';
      else
        raise exception 'TEACHER_CONFLICT';
      end if;

    when unique_violation then
      raise exception 'TEACHER_CONFLICT';
  end;

  return v_new_row;
end;
$function$;

revoke execute on function public.create_timetable_slot(
  uuid, uuid, integer, time, time, text, date, date
) from anon, public;

grant execute on function public.create_timetable_slot(
  uuid, uuid, integer, time, time, text, date, date
) to authenticated;
