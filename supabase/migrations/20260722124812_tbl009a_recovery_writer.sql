-- TBL-009A: recovery writer for missed teaching occurrences.
-- Model C + ancestry (decision report accepted 2026-07-22):
--   1. one-day recovery slot (effective_from = effective_until = date) —
--      the three date-aware exclusion constraints give authoritative
--      teacher/class/room conflict enforcement for free;
--   2. planned recovery occurrence linked via recovered_from_id;
--   3. original transitions missed -> rescheduled with forward pointers
--      (satisfying teaching_occurrences_reschedule_target_check).
-- Idempotency: advisory xact lock on the original + the partial unique
-- index below, which permanently enforces at most one ACTIVE recovery
-- per original against any future RPC or maintenance path.
-- Error codes are lowercase, matching the Fix 20 family.

create unique index if not exists uq_active_recovery_ancestry
  on public.teaching_occurrences (recovered_from_id)
  where recovered_from_id is not null and lifecycle <> 'cancelled';

create or replace function public.schedule_recovery_occurrence(
  p_occurrence_id uuid,
  p_recovery_date date,
  p_start_time    time,
  p_end_time      time,
  p_room          text default null
) returns table(recovery_occurrence_id uuid, recovery_slot_id uuid, original_lifecycle text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid          uuid := auth.uid();
  v_today        date := (now() at time zone 'Africa/Nairobi')::date;
  v_orig         public.teaching_occurrences;
  v_existing     public.teaching_occurrences;
  v_school       uuid;
  v_class_school uuid;
  v_dow          integer;
  v_slot         public.timetable_slots;
  v_rec          public.teaching_occurrences;
  v_constraint   text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_occurrence_id is null then raise exception 'occurrence_not_found'; end if;

  -- Serialize all recovery activity for this original.
  perform pg_advisory_xact_lock(
    hashtextextended('recovery:' || p_occurrence_id::text, 0));

  select * into v_orig
    from public.teaching_occurrences
   where id = p_occurrence_id
   for update;

  if not found then raise exception 'occurrence_not_found'; end if;
  if v_orig.teacher_id is distinct from v_uid then
    raise exception 'occurrence_not_owned';
  end if;

  -- Idempotent path: already rescheduled -> return the active recovery.
  if v_orig.lifecycle = 'rescheduled' then
    select * into v_existing
      from public.teaching_occurrences
     where recovered_from_id = v_orig.id
       and lifecycle <> 'cancelled'
     limit 1;
    if found then
      return query select v_existing.id, v_existing.timetable_slot_id,
                          v_orig.lifecycle;
      return;
    end if;
    raise exception 'not_recoverable';
  end if;

  if v_orig.lifecycle <> 'missed' then
    raise exception 'not_recoverable';
  end if;

  if p_recovery_date is null
     or p_recovery_date < v_today
     or p_recovery_date > v_today + 14 then
    raise exception 'invalid_recovery_date';
  end if;

  if p_start_time is null or p_end_time is null
     or p_start_time >= p_end_time then
    raise exception 'invalid_time_range';
  end if;

  -- Authorization: school derived from the caller's OWN assignment row,
  -- never from parameters; must agree with the original and the class.
  select tc.school_id into v_school
    from public.teacher_classes tc
   where tc.teacher_id = v_uid
     and tc.class_id = v_orig.class_id
     and tc.subject_id = v_orig.subject_id
   limit 1;

  if v_school is null or v_school is distinct from v_orig.school_id then
    raise exception 'school_mismatch';
  end if;

  select c.school_id into v_class_school
    from public.classes c where c.id = v_orig.class_id;

  if v_class_school is null or v_class_school is distinct from v_school then
    raise exception 'school_mismatch';
  end if;

  v_dow := extract(isodow from p_recovery_date)::integer;

  begin
    insert into public.timetable_slots (
      school_id, teacher_id, class_id, subject_id, day_of_week,
      start_time, end_time, room, effective_from, effective_until
    ) values (
      v_school, v_uid, v_orig.class_id, v_orig.subject_id, v_dow,
      p_start_time, p_end_time, nullif(btrim(p_room), ''),
      p_recovery_date, p_recovery_date
    )
    returning * into v_slot;
  exception
    when exclusion_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'excl_class_overlap' then
        raise exception 'class_conflict';
      elsif v_constraint = 'excl_room_overlap' then
        raise exception 'room_conflict';
      else
        raise exception 'teacher_conflict';
      end if;
    when unique_violation then
      raise exception 'teacher_conflict';
  end;

  insert into public.teaching_occurrences (
    school_id, teacher_id, class_id, subject_id,
    timetable_slot_id, occurrence_date, lifecycle, recovered_from_id
  ) values (
    v_school, v_uid, v_orig.class_id, v_orig.subject_id,
    v_slot.id, p_recovery_date, 'planned', v_orig.id
  )
  returning * into v_rec;

  update public.teaching_occurrences
     set lifecycle = 'rescheduled',
         rescheduled_to_slot_id = v_slot.id,
         rescheduled_to_date = p_recovery_date
   where id = v_orig.id;

  return query select v_rec.id, v_slot.id, 'rescheduled'::text;
end $function$;

create or replace function public.cancel_recovery_occurrence(
  p_recovery_occurrence_id uuid,
  p_reason text
) returns table(original_occurrence_id uuid, original_lifecycle text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_rec public.teaching_occurrences;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_recovery_occurrence_id is null then
    raise exception 'occurrence_not_found';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'reason_required';
  end if;

  -- Read once (unlocked) to learn the ancestry key, take the SAME advisory
  -- lock schedule_recovery_occurrence uses, then re-read locked and
  -- re-validate. Lock order is advisory -> rows in both functions.
  select * into v_rec
    from public.teaching_occurrences
   where id = p_recovery_occurrence_id;

  if not found then raise exception 'occurrence_not_found'; end if;
  if v_rec.recovered_from_id is null then raise exception 'not_cancellable'; end if;

  perform pg_advisory_xact_lock(
    hashtextextended('recovery:' || v_rec.recovered_from_id::text, 0));

  select * into v_rec
    from public.teaching_occurrences
   where id = p_recovery_occurrence_id
   for update;

  if not found or v_rec.recovered_from_id is null then
    raise exception 'not_cancellable';
  end if;
  if v_rec.teacher_id is distinct from v_uid then
    raise exception 'occurrence_not_owned';
  end if;
  if v_rec.lifecycle not in ('planned', 'ready') then
    raise exception 'not_cancellable';
  end if;

  update public.teaching_occurrences
     set lifecycle = 'cancelled',
         cancelled_reason = btrim(p_reason),
         cancelled_at = now()
   where id = v_rec.id;

  update public.teaching_occurrences
     set lifecycle = 'missed',
         rescheduled_to_slot_id = null,
         rescheduled_to_date = null
   where id = v_rec.recovered_from_id
     and lifecycle = 'rescheduled';

  return query select v_rec.recovered_from_id, 'missed'::text;
end $function$;

revoke execute on function public.schedule_recovery_occurrence(uuid, date, time, time, text) from public, anon;
grant  execute on function public.schedule_recovery_occurrence(uuid, date, time, time, text) to authenticated, service_role;
revoke execute on function public.cancel_recovery_occurrence(uuid, text) from public, anon;
grant  execute on function public.cancel_recovery_occurrence(uuid, text) to authenticated, service_role;
