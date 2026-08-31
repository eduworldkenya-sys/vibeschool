-- Finalize allocation health after the capacity/collision follow-up.
-- The health universe must include canonical allocations, teacher assignments,
-- and timetable-only subjects so nothing disappears merely because setup is incomplete.

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
  select c.id class_id,c.school_id,t.start_date,t.end_date,
         case
           when (now() at time zone 'Africa/Nairobi')::date < t.start_date then t.start_date
           when (now() at time zone 'Africa/Nairobi')::date > t.end_date then t.end_date
           else (now() at time zone 'Africa/Nairobi')::date
         end anchor_date
  from public.classes c
  join public.academic_terms t on t.id=p_academic_term_id and t.school_id=c.school_id
  where c.id=p_class_id and public.is_active_school_member(c.school_id)
), week_ctx as (
  select ctx.*,date_trunc('week',anchor_date)::date week_start,date_trunc('week',anchor_date)::date+6 week_end from ctx
), universe as (
  select a.subject_id from public.class_subject_allocations a join week_ctx w on w.class_id=a.class_id where a.academic_term_id=p_academic_term_id
  union
  select tc.subject_id from public.teacher_classes tc join week_ctx w on w.class_id=tc.class_id
  union
  select ts.subject_id from public.timetable_slots ts join week_ctx w on w.class_id=ts.class_id
    where ts.effective_from<=w.week_end
      and coalesce(ts.effective_until,w.week_end)>=w.week_start
      and ts.effective_from <= (w.week_start + (ts.day_of_week - 1))
      and coalesce(ts.effective_until,(w.week_start + (ts.day_of_week - 1))) >= (w.week_start + (ts.day_of_week - 1))
), scheduled as (
  select ts.subject_id,sum(ts.allocation_units)::numeric units
  from public.timetable_slots ts join week_ctx w on w.class_id=ts.class_id
  where ts.effective_from<=w.week_end
    and coalesce(ts.effective_until,w.week_end)>=w.week_start
    and ts.effective_from <= (w.week_start + (ts.day_of_week - 1))
    and coalesce(ts.effective_until,(w.week_start + (ts.day_of_week - 1))) >= (w.week_start + (ts.day_of_week - 1))
  group by ts.subject_id
), teachers as (
  select tc.subject_id,count(distinct tc.teacher_id)::integer teacher_count
  from public.teacher_classes tc join week_ctx w on w.class_id=tc.class_id
  group by tc.subject_id
)
select u.subject_id,s.name,a.effective_units_per_week,coalesce(sc.units,0)::numeric,
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
