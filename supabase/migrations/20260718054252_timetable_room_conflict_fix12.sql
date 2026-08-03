-- Fix 12: prevent overlapping use of the same named room within one school.
-- NULL rooms are ignored because an unspecified room cannot be double-booked.
-- school_id is included in the exclusion constraint because room names are
-- only unique within a school, not globally — without it, "Room 4B" at one
-- school would falsely conflict with "Room 4B" at every other school.

create extension if not exists btree_gist;

alter table public.timetable_slots
  drop constraint if exists excl_room_overlap;

alter table public.timetable_slots
  add constraint excl_room_overlap
  exclude using gist (
    school_id with =,
    room with =,
    day_of_week with =,
    tsrange(
      ('2000-01-01'::date + start_time),
      ('2000-01-01'::date + end_time)
    ) with &&,
    daterange(effective_from, effective_until, '[]') with &&
  )
  where (room is not null);

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
  v_teacher_id     uuid := auth.uid();
  v_school_id      uuid;
  v_effective_from date :=
    coalesce(p_effective_from, (now() at time zone 'Africa/Nairobi')::date);
  v_new_row        timetable_slots;
  v_constraint     text;
begin
  if v_teacher_id is null then
    raise exception 'ASSIGNMENT_NOT_FOUND';
  end if;

  if p_day_of_week is null
     or p_day_of_week < 1
     or p_day_of_week > 7 then
    raise exception 'INVALID_TIME';
  end if;

  if p_start_time is null
     or p_end_time is null
     or p_start_time >= p_end_time then
    raise exception 'INVALID_TIME';
  end if;

  if p_effective_until is not null
     and p_effective_until < v_effective_from then
    raise exception 'INVALID_DATE_RANGE';
  end if;

  select tc.school_id
    into v_school_id
  from public.teacher_classes tc
  where tc.teacher_id = v_teacher_id
    and tc.class_id = p_class_id
    and tc.subject_id = p_subject_id
  limit 1;

  if v_school_id is null then
    raise exception 'ASSIGNMENT_NOT_FOUND';
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
        raise exception 'SCHEDULE_CONFLICT';
      end if;

    when unique_violation then
      raise exception 'DUPLICATE_SLOT';
  end;

  return v_new_row;
end;
$function$;
