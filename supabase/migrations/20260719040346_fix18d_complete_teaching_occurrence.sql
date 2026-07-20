-- Fix 18D: complete_teaching_occurrence — atomic in_progress -> completed.
--
-- Companion to Fix 18C's start_teaching_occurrence. Uses the same advisory
-- lock key (timetable_slot_id + occurrence_date) so a start and a complete
-- racing on the same occurrence serialize against each other instead of
-- interleaving.
--
-- Permitted transitions:
--   in_progress -> completed   (sets completed_at, preserves started_at/started_by)
--   completed   -> completed   (idempotent success, no-op update)
--
-- Blocked, with a stable error code each:
--   planned / ready / missed  -> occurrence_not_started
--   cancelled                 -> occurrence_cancelled
--   rescheduled               -> occurrence_rescheduled
--   no row at all             -> occurrence_not_found
--
-- Deliberately does NOT touch scheme_of_work / curriculum progress. Marking
-- an occurrence completed is a teaching-workflow event, not a curriculum-
-- coverage event — those are updated through their own explicit rule.

create or replace function public.complete_teaching_occurrence(
  p_timetable_slot_id uuid,
  p_occurrence_date date
)
returns public.teaching_occurrences
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_slot  record;
  v_occ   public.teaching_occurrences;
  v_lock  bigint;
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

  select * into v_occ
    from public.teaching_occurrences
   where timetable_slot_id = p_timetable_slot_id
     and occurrence_date = p_occurrence_date
   for update;

  if not found then
    raise exception 'occurrence_not_found';
  end if;

  if v_occ.lifecycle = 'completed' then
    return v_occ;
  elsif v_occ.lifecycle = 'cancelled' then
    raise exception 'occurrence_cancelled';
  elsif v_occ.lifecycle = 'rescheduled' then
    raise exception 'occurrence_rescheduled';
  elsif v_occ.lifecycle <> 'in_progress' then
    raise exception 'occurrence_not_started';
  end if;

  update public.teaching_occurrences
     set lifecycle    = 'completed',
         completed_at = coalesce(completed_at, now())
   where id = v_occ.id
  returning * into v_occ;

  return v_occ;
end;
$$;

revoke all on function public.complete_teaching_occurrence(uuid, date) from public;
revoke execute on function public.complete_teaching_occurrence(uuid, date) from anon;
grant execute on function public.complete_teaching_occurrence(uuid, date) to authenticated;
