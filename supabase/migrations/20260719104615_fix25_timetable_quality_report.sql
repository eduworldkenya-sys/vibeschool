-- Fix 25: quality flags per class over ACTIVE slots. Applied live 2026-07-19
-- via MCP; tracked copy. Flags: empty_monday, friday_overload,
-- unbalanced_week, subject_bunching, double_lesson (info).

create or replace function public.timetable_quality_report()
returns table (
  class_id uuid,
  flag text,
  severity text,
  detail text
)
language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Africa/Nairobi')::date;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  return query
  with act as (
    select s.* from timetable_slots s
    where s.teacher_id = v_uid
      and s.effective_from <= v_today
      and (s.effective_until is null or s.effective_until >= v_today)
  ),
  per_day as (
    select a.class_id as c_id, a.day_of_week as dow, count(*) as n
    from act a group by a.class_id, a.day_of_week
  ),
  stats as (
    select p.c_id,
           coalesce(max(p.n) filter (where p.dow = 1), 0) as mon,
           coalesce(max(p.n) filter (where p.dow = 5), 0) as fri,
           max(p.n) as mx, min(p.n) as mn,
           sum(p.n) as total, count(distinct p.dow) as days_used
    from per_day p group by p.c_id
  )
  select st.c_id, 'empty_monday', 'warn',
         'No lessons scheduled on Monday for this class'
  from stats st where st.mon = 0 and st.total > 0
  union all
  select st.c_id, 'friday_overload', 'warn',
         'Friday has ' || st.fri || ' lessons, above the weekly balance'
  from stats st
  where st.fri > 0 and st.days_used > 1
    and st.fri::numeric > ((st.total::numeric / st.days_used) * 1.5)
  union all
  select st.c_id, 'unbalanced_week', 'warn',
         'Busiest day has ' || st.mx || ' lessons, lightest has ' || st.mn
  from stats st where st.days_used > 1 and (st.mx - st.mn) > 2
  union all
  select b.class_id, 'subject_bunching', 'warn',
         'A subject appears ' || b.cnt || ' times on the same day'
  from (
    select a.class_id, a.subject_id, a.day_of_week, count(*) as cnt
    from act a group by a.class_id, a.subject_id, a.day_of_week
    having count(*) >= 3
  ) b
  union all
  select d.class_id, 'double_lesson', 'info',
         'Back-to-back same-subject lessons detected on day ' || d.day_of_week
  from (
    select distinct a.class_id, a.subject_id, a.day_of_week
    from act a
    join act a2
      on a2.class_id = a.class_id and a2.subject_id = a.subject_id
     and a2.day_of_week = a.day_of_week and a2.start_time = a.end_time
  ) d;
end $$;

revoke execute on function public.timetable_quality_report() from anon, public;
grant execute on function public.timetable_quality_report() to authenticated;
