-- Canonical teacher delivery read authority.
-- Joins responsibility, effective weekly allocation, timetable capacity and
-- actual teaching occurrences without creating a second mutation path.

create or replace function public.get_teacher_weekly_delivery_authority(
  p_week_start date default null
)
returns table (
  school_id uuid,
  class_id uuid,
  subject_id uuid,
  class_name text,
  stream text,
  subject_name text,
  academic_term_id uuid,
  week_start date,
  week_end date,
  required_units numeric,
  scheduled_units numeric,
  delivered_units numeric,
  missed_units numeric,
  recovered_units numeric,
  remaining_units numeric,
  schedule_status text,
  delivery_status text
)
language plpgsql
security definer
set search_path = 'pg_catalog', 'public'
stable
as $function$
declare
  v_teacher_id uuid := auth.uid();
  v_week_start date := coalesce(
    p_week_start,
    date_trunc('week', (now() at time zone 'Africa/Nairobi'))::date
  );
  v_week_end date := v_week_start + 6;
begin
  if v_teacher_id is null then
    raise exception 'not_authenticated';
  end if;

  return query
  with assignments as (
    select distinct
      tc.school_id,
      tc.class_id,
      tc.subject_id,
      c.name as class_name,
      coalesce(c.stream, '') as stream,
      s.name as subject_name
    from public.teacher_classes tc
    join public.classes c
      on c.id = tc.class_id
     and c.school_id = tc.school_id
    join public.subjects s on s.id = tc.subject_id
    where tc.teacher_id = v_teacher_id
      and public.is_active_school_member(tc.school_id)
  ),
  scoped as (
    select a.*, term.id as academic_term_id
    from assignments a
    left join lateral (
      select t.id
      from public.academic_terms t
      where t.school_id = a.school_id
        and t.start_date <= v_week_end
        and t.end_date >= v_week_start
      order by
        greatest(0, least(t.end_date, v_week_end) - greatest(t.start_date, v_week_start) + 1) desc,
        t.start_date desc,
        t.id
      limit 1
    ) term on true
  ),
  authority as (
    select
      sc.*,
      csa.effective_units_per_week as required_units
    from scoped sc
    left join public.class_subject_allocations csa
      on csa.class_id = sc.class_id
     and csa.subject_id = sc.subject_id
     and csa.academic_term_id = sc.academic_term_id
  ),
  scheduled as (
    select
      a.class_id,
      a.subject_id,
      coalesce(sum(ts.allocation_units), 0)::numeric as scheduled_units
    from authority a
    left join public.timetable_slots ts
      on ts.teacher_id = v_teacher_id
     and ts.class_id = a.class_id
     and ts.subject_id = a.subject_id
     and ts.effective_from <= v_week_end
     and coalesce(ts.effective_until, v_week_end) >= v_week_start
     and ts.effective_from <= (v_week_start + (ts.day_of_week - 1))
     and coalesce(ts.effective_until, v_week_start + (ts.day_of_week - 1))
         >= (v_week_start + (ts.day_of_week - 1))
    group by a.class_id, a.subject_id
  ),
  occurrence_units as (
    select
      a.class_id,
      a.subject_id,
      coalesce(sum(ts.allocation_units) filter (
        where o.lifecycle = 'completed'
      ), 0)::numeric as delivered_units,
      coalesce(sum(ts.allocation_units) filter (
        where o.lifecycle = 'completed' and o.recovered_from_id is not null
      ), 0)::numeric as recovered_units,
      coalesce(sum(ts.allocation_units) filter (
        where o.lifecycle = 'missed'
          and not exists (
            select 1
            from public.teaching_occurrences recovery
            where recovery.recovered_from_id = o.id
              and recovery.lifecycle = 'completed'
          )
      ), 0)::numeric as missed_units
    from authority a
    left join public.teaching_occurrences o
      on o.teacher_id = v_teacher_id
     and o.class_id = a.class_id
     and o.subject_id = a.subject_id
     and o.occurrence_date between v_week_start and v_week_end
    left join public.timetable_slots ts on ts.id = o.timetable_slot_id
    group by a.class_id, a.subject_id
  )
  select
    a.school_id,
    a.class_id,
    a.subject_id,
    a.class_name,
    a.stream,
    a.subject_name,
    a.academic_term_id,
    v_week_start,
    v_week_end,
    a.required_units,
    coalesce(s.scheduled_units, 0),
    coalesce(ou.delivered_units, 0),
    coalesce(ou.missed_units, 0),
    coalesce(ou.recovered_units, 0),
    case
      when a.required_units is null then null
      else greatest(a.required_units - coalesce(ou.delivered_units, 0), 0)
    end,
    case
      when a.academic_term_id is null or a.required_units is null then 'NO_TARGET'
      when coalesce(s.scheduled_units, 0) = 0 then 'UNSCHEDULED'
      when coalesce(s.scheduled_units, 0) < a.required_units then 'UNDER'
      when coalesce(s.scheduled_units, 0) > a.required_units then 'OVER'
      else 'OK'
    end,
    case
      when a.academic_term_id is null or a.required_units is null then 'NO_TARGET'
      when coalesce(ou.delivered_units, 0) >= a.required_units then 'DELIVERED'
      when coalesce(ou.missed_units, 0) > 0 then 'RECOVERY_NEEDED'
      when coalesce(ou.delivered_units, 0) > 0 then 'IN_PROGRESS'
      else 'NOT_STARTED'
    end
  from authority a
  left join scheduled s
    on s.class_id = a.class_id and s.subject_id = a.subject_id
  left join occurrence_units ou
    on ou.class_id = a.class_id and ou.subject_id = a.subject_id
  order by a.school_id, a.class_name, a.stream, a.subject_name;
end;
$function$;

revoke all on function public.get_teacher_weekly_delivery_authority(date) from public;
revoke all on function public.get_teacher_weekly_delivery_authority(date) from anon;
grant execute on function public.get_teacher_weekly_delivery_authority(date) to authenticated;

comment on function public.get_teacher_weekly_delivery_authority(date) is
'Canonical teacher weekly delivery projection: responsibility -> effective allocation -> timetable -> completed/missed/recovered teaching occurrences.';
