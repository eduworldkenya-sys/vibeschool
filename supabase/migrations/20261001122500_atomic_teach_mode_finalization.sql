-- Close Teach Mode as one atomic server-authoritative lifecycle transition.
-- The wrapper intentionally composes the existing guarded occurrence, progress,
-- and Scheme authorities in one Postgres transaction. Any failure rolls back
-- the whole finish operation so a teacher never gets a false completed state.

create or replace function public.finalize_teaching_occurrence(
  p_timetable_slot_id uuid,
  p_occurrence_date date,
  p_outcome text,
  p_what_was_taught text,
  p_challenges text default null,
  p_teacher_remarks text default null,
  p_next_steps text default null
)
returns table(
  occurrence_id uuid,
  progress_record_id uuid,
  scheme_id uuid,
  scheme_status text
)
language plpgsql
security invoker
set search_path = 'pg_catalog', 'public'
as $function$
declare
  v_occurrence public.teaching_occurrences;
  v_progress_id uuid;
  v_scheme_id uuid;
  v_scheme_status text;
begin
  if p_outcome not in ('covered', 'partial', 'reteach') then
    raise exception 'invalid_coverage_outcome';
  end if;

  if nullif(btrim(coalesce(p_what_was_taught, '')), '') is null then
    raise exception 'what_was_taught_required';
  end if;

  select * into v_occurrence
  from public.complete_teaching_occurrence(p_timetable_slot_id, p_occurrence_date);

  select id into v_progress_id
  from public.save_teaching_progress_record(
    v_occurrence.id,
    p_what_was_taught,
    null,
    p_challenges,
    null,
    p_teacher_remarks,
    p_next_steps
  );

  if v_progress_id is null then
    raise exception 'progress_record_not_persisted';
  end if;

  if p_outcome = 'covered' then
    select m.scheme_id, m.status
      into v_scheme_id, v_scheme_status
      from public.mark_scheme_item_covered(v_occurrence.id) m;

    if v_scheme_id is null or v_scheme_status <> 'done' then
      raise exception 'scheme_coverage_not_persisted';
    end if;
  end if;

  return query
  select v_occurrence.id, v_progress_id, v_scheme_id, v_scheme_status;
end;
$function$;

revoke all on function public.finalize_teaching_occurrence(uuid, date, text, text, text, text, text) from public;
revoke all on function public.finalize_teaching_occurrence(uuid, date, text, text, text, text, text) from anon;
grant execute on function public.finalize_teaching_occurrence(uuid, date, text, text, text, text, text) to authenticated;
