-- TBL-011: scheme_pacing_status returned no rows for anyone because its
-- current-week CTE joined term_weeks.school_id = scheme_of_work.school_id,
-- and every term_weeks row has NULL school_id (scoping lives one hop away
-- via term_id -> academic_terms.school_id). Fix: join through academic_terms
-- and additionally match term, preventing cross-term comparison. Signature,
-- return type, security mode, search_path, and grants are preserved.
-- get_teacher_active_weeks is intentionally untouched (already correct).

create or replace function public.scheme_pacing_status()
returns table(class_id uuid, subject_id uuid, term integer, current_week integer, behind_count integer, earliest_behind_week integer, missed_occurrences integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Africa/Nairobi')::date;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  return query
  with cw as (
    -- TBL-011: school and term scoping via academic_terms (term_weeks.school_id
    -- is unpopulated by design; the national calendar rows are shared and each
    -- school's weeks are identified by its own academic_terms row).
    select at.school_id, at.term, tw.week_number
    from term_weeks tw
    join academic_terms at on at.id = tw.term_id
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
  join cw on cw.school_id = sow.school_id and cw.term = sow.term
  where sow.teacher_id = v_uid
  group by sow.class_id, sow.subject_id, sow.term, cw.week_number
  having count(*) filter (
    where sow.week < cw.week_number
      and coalesce(sow.status, 'planned') not in ('done', 'cancelled')
  ) > 0;
end $function$;

revoke execute on function public.scheme_pacing_status() from public, anon;
grant execute on function public.scheme_pacing_status() to authenticated, service_role;
