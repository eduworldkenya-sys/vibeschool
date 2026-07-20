-- RECOVERED 2026-07-20 from live pg_get_functiondef (version 20260719091655).
-- The deployed mark_scheme_item_covered: completion-gated, ownership-checked,
-- idempotent on done, minimal TABLE(scheme_id, status) return.

create or replace function public.mark_scheme_item_covered(p_occurrence_id uuid)
returns table(scheme_id uuid, status text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid       uuid := auth.uid();
  v_occ       record;
  v_plan      uuid;
  v_scheme_id uuid;
  v_scheme    public.scheme_of_work;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if p_occurrence_id is null then
    raise exception 'occurrence_not_found';
  end if;

  select id, school_id, teacher_id, timetable_slot_id, occurrence_date, lifecycle
    into v_occ
    from public.teaching_occurrences
   where id = p_occurrence_id;

  if not found then
    raise exception 'occurrence_not_found';
  end if;

  if v_occ.teacher_id is distinct from v_uid then
    raise exception 'occurrence_not_owned';
  end if;

  if v_occ.lifecycle <> 'completed' then
    raise exception 'occurrence_not_completed';
  end if;

  -- LATENT LIVE DEFECT, preserved verbatim for baseline fidelity: the bare
  -- scheme_id below is ambiguous against this function's scheme_id OUT
  -- parameter (plpgsql variable_conflict defaults to error). The function has
  -- never executed in production (zero teaching_occurrences), so the error
  -- has never fired. Qualifying it is a behavioural fix for a later
  -- migration, not for baseline recovery.
  select id, scheme_id
    into v_plan, v_scheme_id
    from public.lesson_plans
   where timetable_slot_id = v_occ.timetable_slot_id
     and taught_date = v_occ.occurrence_date
     and teacher_id = v_uid
     and school_id = v_occ.school_id
   order by updated_at desc nulls last, created_at desc
   limit 1;

  if v_plan is null then
    raise exception 'lesson_plan_not_found';
  end if;

  if v_scheme_id is null then
    raise exception 'scheme_item_not_found';
  end if;

  select * into v_scheme
    from public.scheme_of_work
   where id = v_scheme_id
     and school_id = v_occ.school_id
     and teacher_id = v_uid
   for update;

  if not found then
    raise exception 'scheme_item_not_found';
  end if;

  if v_scheme.status = 'done' then
    return query
    select v_scheme.id, v_scheme.status;
    return;
  end if;

  if v_scheme.status <> 'teaching' then
    raise exception 'scheme_item_not_ready';
  end if;

  update public.scheme_of_work
     set status = 'done'
   where id = v_scheme.id
  returning * into v_scheme;

  return query
  select v_scheme.id, v_scheme.status;
end;
$function$;

-- Live grant state:
revoke execute on function public.mark_scheme_item_covered(uuid) from public;
revoke execute on function public.mark_scheme_item_covered(uuid) from anon;
grant execute on function public.mark_scheme_item_covered(uuid) to authenticated;
grant execute on function public.mark_scheme_item_covered(uuid) to service_role;
