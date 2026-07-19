-- Fix 26: teacher-scope analytics. Applied live 2026-07-19 via MCP; tracked
-- copy. One jsonb payload: load, minutes, per-day, busiest day, rooms,
-- subject balance, capacity (when periods defined).

create or replace function public.get_timetable_analytics()
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Africa/Nairobi')::date;
  v_school uuid;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select tc.school_id into v_school from teacher_classes tc where tc.teacher_id = v_uid limit 1;

  with act as (
    select s.* from timetable_slots s
    where s.teacher_id = v_uid
      and s.effective_from <= v_today
      and (s.effective_until is null or s.effective_until >= v_today)
  ),
  per_day as (
    select day_of_week as dow, count(*) as n,
           sum(extract(epoch from (end_time - start_time)) / 60)::integer as mins
    from act group by day_of_week
  ),
  lesson_capacity as (
    select count(*) * 5 as cap
    from school_periods sp
    where sp.school_id = v_school and sp.kind = 'lesson'
  )
  select jsonb_build_object(
    'weekly_slots',    (select count(*) from act),
    'weekly_minutes',  coalesce((select sum(mins) from per_day), 0),
    'per_day',         coalesce((select jsonb_object_agg(dow::text, jsonb_build_object('slots', n, 'minutes', mins)) from per_day), '{}'::jsonb),
    'busiest_day',     (select dow from per_day order by n desc, dow limit 1),
    'rooms_used',      coalesce((select jsonb_agg(distinct room) from act where room is not null), '[]'::jsonb),
    'subject_balance', coalesce((select jsonb_object_agg(sub.name, sub.n) from (
                         select sj.name, count(*) as n
                         from act a join subjects sj on sj.id = a.subject_id
                         group by sj.name) sub), '{}'::jsonb),
    'lesson_capacity_per_week', coalesce((select cap from lesson_capacity), 0),
    'free_capacity',   greatest(coalesce((select cap from lesson_capacity), 0) - (select count(*) from act), 0)
  ) into v_result;
  return v_result;
end $$;

revoke execute on function public.get_timetable_analytics() from anon, public;
grant execute on function public.get_timetable_analytics() to authenticated;
