-- Fix 23: recovery slot suggestions. Applied live 2026-07-19 via MCP; tracked
-- copy. Suggests free periods (teacher AND class free) over the next N
-- weekdays; uses school_periods when defined, else the school's time blocks.

create or replace function public.suggest_recovery_slots(
  p_class_id uuid,
  p_days_ahead integer default 7
) returns table (
  suggest_date date,
  day_of_week integer,
  start_time time without time zone,
  end_time time without time zone,
  period_label text
)
language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  v_school uuid;
  v_today date := (now() at time zone 'Africa/Nairobi')::date;
  v_days integer := least(greatest(coalesce(p_days_ahead, 7), 1), 14);
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select tc.school_id into v_school
  from teacher_classes tc
  where tc.teacher_id = v_uid and tc.class_id = p_class_id
  limit 1;
  if v_school is null then raise exception 'assignment_not_found'; end if;

  return query
  with blocks as (
    select sp.start_time as b_start, sp.end_time as b_end, sp.label as b_label
    from school_periods sp
    where sp.school_id = v_school and sp.kind = 'lesson'
    union all
    select distinct s.start_time, s.end_time,
           to_char(s.start_time, 'HH24:MI') || chr(8211) || to_char(s.end_time, 'HH24:MI')
    from timetable_slots s
    where s.school_id = v_school
      and not exists (select 1 from school_periods x where x.school_id = v_school and x.kind = 'lesson')
  ),
  days as (
    select (v_today + d) as c_date, extract(isodow from v_today + d)::integer as c_dow
    from generate_series(1, v_days) d
    where extract(isodow from v_today + d) <= 5
  )
  select d.c_date, d.c_dow, b.b_start, b.b_end, b.b_label
  from days d cross join blocks b
  where not exists (
    select 1 from timetable_slots s
    where s.day_of_week = d.c_dow
      and s.effective_from <= d.c_date
      and (s.effective_until is null or s.effective_until >= d.c_date)
      and tsrange(('2000-01-01'::date + s.start_time), ('2000-01-01'::date + s.end_time))
       && tsrange(('2000-01-01'::date + b.b_start), ('2000-01-01'::date + b.b_end))
      and (s.teacher_id = v_uid or s.class_id = p_class_id)
  )
  order by d.c_date, b.b_start;
end $$;

revoke execute on function public.suggest_recovery_slots(uuid, integer) from anon, public;
grant execute on function public.suggest_recovery_slots(uuid, integer) to authenticated;
