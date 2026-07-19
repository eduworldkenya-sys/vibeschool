-- Fix 22: occurrence pre-generation + missed sweep. Applied live 2026-07-19
-- via MCP; tracked copy. Occurrences exist as 'planned' before Start;
-- stale planned/ready rows on past dates are persisted as 'missed'.

create or replace function public.generate_daily_occurrences(p_date date default null)
returns table (generated integer, marked_missed integer)
language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Africa/Nairobi')::date;
  v_date date := coalesce(p_date, (now() at time zone 'Africa/Nairobi')::date);
  v_dow integer;
  v_generated integer;
  v_missed integer;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if v_date < v_today or v_date > v_today + 7 then raise exception 'invalid_date'; end if;
  v_dow := extract(isodow from v_date)::integer;

  insert into teaching_occurrences
    (timetable_slot_id, occurrence_date, school_id, teacher_id, class_id, subject_id, lifecycle)
  select s.id, v_date, s.school_id, s.teacher_id, s.class_id, s.subject_id, 'planned'
  from timetable_slots s
  where s.teacher_id = v_uid
    and s.day_of_week = v_dow
    and s.effective_from <= v_date
    and (s.effective_until is null or s.effective_until >= v_date)
  on conflict (timetable_slot_id, occurrence_date) do nothing;
  get diagnostics v_generated = row_count;

  update teaching_occurrences
     set lifecycle = 'missed'
   where teacher_id = v_uid
     and lifecycle in ('planned','ready')
     and occurrence_date < v_today;
  get diagnostics v_missed = row_count;

  return query select v_generated, v_missed;
end $$;

revoke execute on function public.generate_daily_occurrences(date) from anon, public;
grant execute on function public.generate_daily_occurrences(date) to authenticated;
