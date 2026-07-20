-- Fix 28: create_timetable_slot — stable, complete error-code contract +
-- lock down execution grants.
--
-- Problems this fixes vs the live function (fix12, 20260718054252):
--   1. Error codes were coarse and didn't match the UI's real decision
--      points: 'ASSIGNMENT_NOT_FOUND' was raised both for "not signed in"
--      and "not assigned to this class/subject", and 'INVALID_TIME' was
--      raised both for a bad day-of-week AND a bad start/end range. That
--      makes it impossible for the client to show an accurate message.
--   2. No school-identity defense: the function trusted teacher_classes'
--      school_id without ever re-checking it against the class row itself,
--      so if a class were ever re-parented to a different school after the
--      teacher's assignment was created, a slot could be silently created
--      against the wrong school.
--   3. EXECUTE was still granted to `anon` (confirmed live) — an
--      unauthenticated caller could invoke the RPC at all (it would fail
--      once auth.uid() is checked, but this is not defense in depth: the
--      function should never be callable pre-auth in the first place).
--
-- This migration is forward-only and non-destructive: it does not touch
-- excl_teacher_overlap / excl_class_overlap / excl_room_overlap, does not
-- drop or alter any table, and preserves every existing validation branch
-- of the function — it only replaces the function body (create or replace)
-- and tightens grants.
--
-- Stable error codes raised by this function (client maps these 1:1 to
-- copy in components/teacher/AddSlotModal.tsx::toFriendlyError):
--   UNAUTHENTICATED         no authenticated caller (auth.uid() is null)
--   INVALID_ASSIGNMENT      null class/subject id, or caller has no
--                           matching teacher_classes row for that
--                           teacher_id + class_id + subject_id
--   SCHOOL_MISMATCH         the class's current school_id no longer
--                           matches the teacher_classes assignment's
--                           school_id (data-integrity guard)
--   INVALID_DAY             day_of_week is null or outside 1..7
--   INVALID_TIME_RANGE      start/end time missing or start >= end
--   INVALID_EFFECTIVE_RANGE effective_until is before effective_from
--   TEACHER_CONFLICT        excl_teacher_overlap violated
--   CLASS_CONFLICT          excl_class_overlap violated
--   ROOM_CONFLICT           excl_room_overlap violated

create or replace function public.create_timetable_slot(
  p_class_id uuid,
  p_subject_id uuid,
  p_day_of_week integer,
  p_start_time time without time zone,
  p_end_time time without time zone,
  p_room text default null::text,
  p_effective_from date default null::date,
  p_effective_until date default null::date
)
returns timetable_slots
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_teacher_id      uuid := auth.uid();
  v_school_id       uuid;
  v_class_school_id uuid;
  v_effective_from  date :=
    coalesce(p_effective_from, (now() at time zone 'Africa/Nairobi')::date);
  v_new_row         timetable_slots;
  v_constraint      text;
begin
  -- Identity: no caller, no slot. This must be checked before touching
  -- any input, since an unauthenticated call has nothing legitimate to
  -- validate against.
  if v_teacher_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  -- Assignment identity must be present before we do anything else with it.
  if p_class_id is null or p_subject_id is null then
    raise exception 'INVALID_ASSIGNMENT';
  end if;

  if p_day_of_week is null
     or p_day_of_week < 1
     or p_day_of_week > 7 then
    raise exception 'INVALID_DAY';
  end if;

  if p_start_time is null
     or p_end_time is null
     or p_start_time >= p_end_time then
    raise exception 'INVALID_TIME_RANGE';
  end if;

  if p_effective_until is not null
     and p_effective_until < v_effective_from then
    raise exception 'INVALID_EFFECTIVE_RANGE';
  end if;

  -- The only source of truth for "is this teacher allowed to teach this
  -- class+subject" is teacher_classes, keyed on the caller's own auth
  -- identity. school_id is derived here, never accepted as a parameter,
  -- so a caller can never claim a school_id they don't actually belong to.
  select tc.school_id
    into v_school_id
  from public.teacher_classes tc
  where tc.teacher_id = v_teacher_id
    and tc.class_id = p_class_id
    and tc.subject_id = p_subject_id
  limit 1;

  if v_school_id is null then
    raise exception 'INVALID_ASSIGNMENT';
  end if;

  -- Defense in depth: re-confirm the class itself still belongs to the
  -- same school as the teacher_classes assignment row. Guards against a
  -- class being re-parented to a different school after the assignment
  -- was made, which must never be allowed to produce a cross-school slot.
  select c.school_id
    into v_class_school_id
  from public.classes c
  where c.id = p_class_id;

  if v_class_school_id is null or v_class_school_id is distinct from v_school_id then
    raise exception 'SCHOOL_MISMATCH';
  end if;

  begin
    insert into public.timetable_slots (
      school_id,
      teacher_id,
      class_id,
      subject_id,
      day_of_week,
      start_time,
      end_time,
      room,
      effective_from,
      effective_until
    )
    values (
      v_school_id,
      v_teacher_id,
      p_class_id,
      p_subject_id,
      p_day_of_week,
      p_start_time,
      p_end_time,
      nullif(btrim(p_room), ''),
      v_effective_from,
      p_effective_until
    )
    returning * into v_new_row;

  exception
    when exclusion_violation then
      get stacked diagnostics v_constraint = constraint_name;

      if v_constraint = 'excl_teacher_overlap' then
        raise exception 'TEACHER_CONFLICT';
      elsif v_constraint = 'excl_class_overlap' then
        raise exception 'CLASS_CONFLICT';
      elsif v_constraint = 'excl_room_overlap' then
        raise exception 'ROOM_CONFLICT';
      else
        -- Unnamed/unknown overlap constraint: fall back to the closest
        -- meaningful code rather than leaking a raw Postgres error.
        raise exception 'TEACHER_CONFLICT';
      end if;

    when unique_violation then
      raise exception 'TEACHER_CONFLICT';
  end;

  return v_new_row;
end;
$function$;

-- Lock down execution: only an authenticated teacher may ever call this.
-- `anon` previously had EXECUTE on the live function — closed here.
revoke execute on function public.create_timetable_slot(
  uuid, uuid, integer, time, time, text, date, date
) from anon, public;

grant execute on function public.create_timetable_slot(
  uuid, uuid, integer, time, time, text, date, date
) to authenticated;
