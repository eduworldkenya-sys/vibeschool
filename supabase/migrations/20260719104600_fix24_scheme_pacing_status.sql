-- Fix 24: scheme pacing. Applied live 2026-07-19 via MCP; tracked copy.
-- term_weeks is the calendar truth; scheme_of_work.status the coverage truth.

create or replace function public.scheme_pacing_status()
returns table (
  class_id uuid,
  subject_id uuid,
  term integer,
  current_week integer,
  behind_count integer,
  earliest_behind_week integer,
  missed_occurrences integer
)
language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Africa/Nairobi')::date;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  return query
  with cw as (
    select tw.school_id, tw.week_number
    from term_weeks tw
    where v_today between tw.start_date and tw.end_date
  )
  select
    sow.class_id,
    sow.subject_id,
    sow.term,
    cw.week_number as current_week,
    count(*) filter (
      where sow.week < cw.week_number
        and coalesce(sow.status, 'planned') not in ('done', 'cancelled')
    )::integer as behind_count,
    min(sow.week) filter (
      where sow.week < cw.week_number
        and coalesce(sow.status, 'planned') not in ('done', 'cancelled')
    )::integer as earliest_behind_week,
    (select count(*)::integer from teaching_occurrences o
      where o.teacher_id = v_uid and o.class_id = sow.class_id
        and o.subject_id = sow.subject_id and o.lifecycle = 'missed') as missed_occurrences
  from scheme_of_work sow
  join cw on cw.school_id = sow.school_id
  where sow.teacher_id = v_uid
  group by sow.class_id, sow.subject_id, sow.term, cw.week_number
  having count(*) filter (
    where sow.week < cw.week_number
      and coalesce(sow.status, 'planned') not in ('done', 'cancelled')
  ) > 0;
end $$;

revoke execute on function public.scheme_pacing_status() from anon, public;
grant execute on function public.scheme_pacing_status() to authenticated;
