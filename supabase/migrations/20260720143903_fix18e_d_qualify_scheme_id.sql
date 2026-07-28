-- Behavioral fix 4: mark_scheme_item_covered had a latent runtime bug — bare
-- scheme_id in the lesson-plan lookup is ambiguous against the function's
-- scheme_id OUT parameter (plpgsql variable_conflict = error). Never fired
-- only because zero occurrences existed. Qualified throughout.
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

  select lp.id, lp.scheme_id
    into v_plan, v_scheme_id
    from public.lesson_plans lp
   where lp.timetable_slot_id = v_occ.timetable_slot_id
     and lp.taught_date = v_occ.occurrence_date
     and lp.teacher_id = v_uid
     and lp.school_id = v_occ.school_id
   order by lp.updated_at desc nulls last, lp.created_at desc
   limit 1;

  if v_plan is null then
    raise exception 'lesson_plan_not_found';
  end if;

  if v_scheme_id is null then
    raise exception 'scheme_item_not_found';
  end if;

  select * into v_scheme
    from public.scheme_of_work sow
   where sow.id = v_scheme_id
     and sow.school_id = v_occ.school_id
     and sow.teacher_id = v_uid
   for update;

  if not found then
    raise exception 'scheme_item_not_found';
  end if;

  if v_scheme.status = 'done' then
    return query select v_scheme.id, v_scheme.status;
    return;
  end if;

  if v_scheme.status <> 'teaching' then
    raise exception 'scheme_item_not_ready';
  end if;

  update public.scheme_of_work
     set status = 'done'
   where id = v_scheme.id
  returning * into v_scheme;

  return query select v_scheme.id, v_scheme.status;
end;
$function$;

revoke execute on function public.mark_scheme_item_covered(uuid) from public;
revoke execute on function public.mark_scheme_item_covered(uuid) from anon;
grant execute on function public.mark_scheme_item_covered(uuid) to authenticated;
grant execute on function public.mark_scheme_item_covered(uuid) to service_role;
