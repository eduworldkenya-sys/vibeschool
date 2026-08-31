-- Final TBL-006 reconciliation after allocation hardening.
-- 1) preserve the hardening migration's complete subject universe,
-- 2) count only one concrete anchor week so timetable revisions are not double-counted,
-- 3) do not disclose another teacher's identity to ordinary teachers during conflict preview.

create or replace function public.get_timetable_allocation_health(
  p_class_id uuid,
  p_academic_term_id uuid
) returns table (
  subject_id uuid,
  subject_name text,
  expected_units numeric,
  scheduled_units numeric,
  missing_units numeric,
  excess_units numeric,
  status text,
  allocation_source text,
  is_override boolean,
  assigned_teacher_count integer,
  teacher_assignment_health text
)
language sql
security definer
set search_path = public
stable
as $$
with ctx as (
  select c.id as class_id,c.school_id,t.start_date,t.end_date,
    case
      when (now() at time zone 'Africa/Nairobi')::date < t.start_date then t.start_date
      when (now() at time zone 'Africa/Nairobi')::date > t.end_date then t.end_date
      else (now() at time zone 'Africa/Nairobi')::date
    end as anchor_date
  from public.classes c
  join public.academic_terms t on t.id=p_academic_term_id and t.school_id=c.school_id
  where c.id=p_class_id and public.is_active_school_member(c.school_id)
), week_ctx as (
  select ctx.*,
    date_trunc('week',anchor_date)::date as week_start,
    date_trunc('week',anchor_date)::date + 6 as week_end
  from ctx
), universe as (
  select a.subject_id
  from public.class_subject_allocations a
  join week_ctx on week_ctx.class_id=a.class_id
  where a.academic_term_id=p_academic_term_id
  union
  select tc.subject_id
  from public.teacher_classes tc
  join week_ctx on week_ctx.class_id=tc.class_id
  union
  select ts.subject_id
  from public.timetable_slots ts
  join week_ctx on week_ctx.class_id=ts.class_id
  where ts.effective_from<=week_ctx.week_end
    and coalesce(ts.effective_until,week_ctx.week_end)>=week_ctx.week_start
    and ts.effective_from <= (week_ctx.week_start + (ts.day_of_week - 1))
    and coalesce(ts.effective_until,(week_ctx.week_start + (ts.day_of_week - 1))) >= (week_ctx.week_start + (ts.day_of_week - 1))
), scheduled as (
  select ts.subject_id,sum(ts.allocation_units)::numeric as units
  from public.timetable_slots ts
  join week_ctx on week_ctx.class_id=ts.class_id
  where ts.effective_from<=week_ctx.week_end
    and coalesce(ts.effective_until,week_ctx.week_end)>=week_ctx.week_start
    and ts.effective_from <= (week_ctx.week_start + (ts.day_of_week - 1))
    and coalesce(ts.effective_until,(week_ctx.week_start + (ts.day_of_week - 1))) >= (week_ctx.week_start + (ts.day_of_week - 1))
  group by ts.subject_id
), teachers as (
  select tc.subject_id,count(distinct tc.teacher_id)::int as teacher_count
  from public.teacher_classes tc
  join week_ctx on week_ctx.class_id=tc.class_id
  group by tc.subject_id
)
select u.subject_id,s.name,a.effective_units_per_week,coalesce(sc.units,0),
  case when a.effective_units_per_week is null then null else greatest(a.effective_units_per_week-coalesce(sc.units,0),0) end,
  case when a.effective_units_per_week is null then null else greatest(coalesce(sc.units,0)-a.effective_units_per_week,0) end,
  case
    when a.id is null or a.effective_units_per_week is null then 'ALLOCATION_UNKNOWN'
    when coalesce(sc.units,0)=0 then 'UNSCHEDULED'
    when coalesce(sc.units,0)<a.effective_units_per_week then 'UNDER_ALLOCATED'
    when coalesce(sc.units,0)>a.effective_units_per_week then 'OVER_ALLOCATED'
    when coalesce(t.teacher_count,0)=0 then 'TEACHER_UNASSIGNED'
    when a.is_override then 'OVERRIDE'
    else 'COMPLETE'
  end,
  coalesce(a.source,'UNKNOWN'),coalesce(a.is_override,false),coalesce(t.teacher_count,0),
  case when coalesce(t.teacher_count,0)=0 then 'TEACHER_UNASSIGNED' else 'ASSIGNED' end
from universe u
join public.subjects s on s.id=u.subject_id
left join public.class_subject_allocations a
  on a.class_id=p_class_id and a.subject_id=u.subject_id and a.academic_term_id=p_academic_term_id
left join scheduled sc on sc.subject_id=u.subject_id
left join teachers t on t.subject_id=u.subject_id
order by s.name;
$$;

revoke all on function public.get_timetable_allocation_health(uuid,uuid) from public;
grant execute on function public.get_timetable_allocation_health(uuid,uuid) to authenticated;

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
