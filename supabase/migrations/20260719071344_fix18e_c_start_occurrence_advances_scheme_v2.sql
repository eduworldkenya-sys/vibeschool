-- RECOVERED 2026-07-20 from live pg_get_functiondef (version 20260719071344).
-- The deployed start_teaching_occurrence: advisory-locked, plan-gated,
-- effective-window and isodow validated, idempotent, and advances the linked
-- scheme_of_work item from planned to teaching on start.

create or replace function public.start_teaching_occurrence(
  p_timetable_slot_id uuid,
  p_occurrence_date date
)
returns teaching_occurrences
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid        uuid := auth.uid();
  v_slot       record;
  v_plan       uuid;
  v_scheme_id  uuid;
  v_occ        public.teaching_occurrences;
  v_lock       bigint;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if p_timetable_slot_id is null then
    raise exception 'slot_not_found';
  end if;

  if p_occurrence_date is null then
    raise exception 'invalid_occurrence_date';
  end if;

  v_lock := hashtextextended(p_timetable_slot_id::text || ':' || p_occurrence_date::text, 0);
  perform pg_advisory_xact_lock(v_lock);

  select id, school_id, teacher_id, class_id, subject_id, day_of_week,
         effective_from, effective_until
    into v_slot
    from public.timetable_slots
   where id = p_timetable_slot_id;

  if not found then
    raise exception 'slot_not_found';
  end if;

  if v_slot.teacher_id is distinct from v_uid then
    raise exception 'slot_not_owned';
  end if;

  if (v_slot.effective_from is not null and p_occurrence_date < v_slot.effective_from)
     or (v_slot.effective_until is not null and p_occurrence_date > v_slot.effective_until)
     or extract(isodow from p_occurrence_date)::int <> v_slot.day_of_week
  then
    raise exception 'invalid_occurrence_date';
  end if;

  select id, scheme_id
    into v_plan, v_scheme_id
    from public.lesson_plans
   where timetable_slot_id = p_timetable_slot_id
     and taught_date = p_occurrence_date
     and teacher_id = v_uid
     and school_id = v_slot.school_id
   order by updated_at desc nulls last, created_at desc
   limit 1;

  if v_plan is null then
    raise exception 'lesson_plan_required';
  end if;

  select * into v_occ
    from public.teaching_occurrences
   where timetable_slot_id = p_timetable_slot_id
     and occurrence_date = p_occurrence_date
   for update;

  if found then
    if v_occ.lifecycle = 'completed' then
      raise exception 'occurrence_completed';
    elsif v_occ.lifecycle = 'cancelled' then
      raise exception 'occurrence_cancelled';
    elsif v_occ.lifecycle = 'rescheduled' then
      raise exception 'occurrence_rescheduled';
    elsif v_occ.lifecycle = 'in_progress' then
      if v_scheme_id is not null then
        update public.scheme_of_work
           set status = 'teaching'
         where id = v_scheme_id
           and school_id = v_slot.school_id
           and teacher_id = v_uid
           and status = 'planned';
      end if;

      return v_occ;
    end if;

    update public.teaching_occurrences
       set lifecycle  = 'in_progress',
           started_at = coalesce(started_at, now()),
           started_by = coalesce(started_by, v_uid)
     where id = v_occ.id
    returning * into v_occ;

    if v_scheme_id is not null then
      update public.scheme_of_work
         set status = 'teaching'
       where id = v_scheme_id
         and school_id = v_slot.school_id
         and teacher_id = v_uid
         and status = 'planned';
    end if;

    return v_occ;
  end if;

  insert into public.teaching_occurrences (
    school_id, teacher_id, class_id, subject_id,
    timetable_slot_id, occurrence_date,
    lifecycle, started_at, started_by
  ) values (
    v_slot.school_id, v_slot.teacher_id, v_slot.class_id, v_slot.subject_id,
    p_timetable_slot_id, p_occurrence_date,
    'in_progress', now(), v_uid
  )
  returning * into v_occ;

  if v_scheme_id is not null then
    update public.scheme_of_work
       set status = 'teaching'
     where id = v_scheme_id
       and school_id = v_slot.school_id
       and teacher_id = v_uid
       and status = 'planned';
  end if;

  return v_occ;
end;
$function$;

-- Live grant state (post-fix18c lockdown, carried forward):
revoke execute on function public.start_teaching_occurrence(uuid, date) from public;
revoke execute on function public.start_teaching_occurrence(uuid, date) from anon;
grant execute on function public.start_teaching_occurrence(uuid, date) to authenticated;
grant execute on function public.start_teaching_occurrence(uuid, date) to service_role;
