-- The later capacity migration also defines preview_timetable_conflicts.
-- Re-apply the privacy-safe version last so ordinary teachers never receive
-- another teacher's profile id while still seeing the collision itself.

create or replace function public.preview_timetable_conflicts(
  p_school_id uuid,
  p_teacher_id uuid,
  p_class_id uuid,
  p_day_of_week integer,
  p_start_time time,
  p_end_time time,
  p_room text default null,
  p_effective_from date default null,
  p_effective_until date default null,
  p_exclude_slot_id uuid default null
) returns table (
  conflict_type text,
  conflicting_slot_id uuid,
  conflicting_teacher_id uuid,
  conflicting_class_id uuid,
  conflicting_subject_id uuid,
  conflicting_room text,
  detail text
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_uid uuid := auth.uid();
  v_from date := coalesce(p_effective_from,(now() at time zone 'Africa/Nairobi')::date);
  v_until date := coalesce(p_effective_until,'infinity'::date);
  v_is_admin boolean := false;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.is_active_school_member(p_school_id) then raise exception 'SCHOOL_ACCESS_DENIED'; end if;
  v_is_admin := public.is_school_admin(p_school_id);
  if p_teacher_id is distinct from v_uid and not v_is_admin then
    raise exception 'TIMETABLE_PREVIEW_FORBIDDEN';
  end if;
  if p_day_of_week < 1 or p_day_of_week > 7 then raise exception 'INVALID_DAY'; end if;
  if p_start_time is null or p_end_time is null or p_start_time >= p_end_time then raise exception 'INVALID_TIME_RANGE'; end if;
  if p_effective_until is not null and p_effective_until < v_from then raise exception 'INVALID_EFFECTIVE_RANGE'; end if;
  if not exists (select 1 from public.classes c where c.id=p_class_id and c.school_id=p_school_id) then
    raise exception 'CLASS_SCHOOL_MISMATCH';
  end if;

  return query
  select
    case
      when ts.teacher_id=p_teacher_id then 'TEACHER_CONFLICT'
      when ts.class_id=p_class_id then 'CLASS_CONFLICT'
      when p_room is not null and ts.room=nullif(btrim(p_room),'') then 'ROOM_CONFLICT'
      else 'SCHEDULE_CONFLICT'
    end,
    ts.id,
    case when v_is_admin or ts.teacher_id=v_uid then ts.teacher_id else null end,
    ts.class_id,
    ts.subject_id,
    ts.room,
    case
      when ts.teacher_id=p_teacher_id then 'Teacher already has an overlapping lesson in this effective date range.'
      when ts.class_id=p_class_id then 'Class already has an overlapping lesson in this effective date range.'
      else 'Room already has an overlapping lesson in this effective date range.'
    end
  from public.timetable_slots ts
  where ts.school_id=p_school_id
    and ts.id is distinct from p_exclude_slot_id
    and ts.day_of_week=p_day_of_week
    and ts.start_time<p_end_time
    and ts.end_time>p_start_time
    and ts.effective_from<=v_until
    and coalesce(ts.effective_until,'infinity'::date)>=v_from
    and (
      ts.teacher_id=p_teacher_id
      or ts.class_id=p_class_id
      or (p_room is not null and nullif(btrim(p_room),'') is not null and ts.room=nullif(btrim(p_room),''))
    )
  order by conflict_type,ts.start_time,ts.id;
end;
$$;

revoke all on function public.preview_timetable_conflicts(uuid,uuid,uuid,integer,time,time,text,date,date,uuid) from public;
grant execute on function public.preview_timetable_conflicts(uuid,uuid,uuid,integer,time,time,text,date,date,uuid) to authenticated;
