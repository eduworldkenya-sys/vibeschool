#!/usr/bin/env python3
"""
Surgical patch: complete the timetable slot-creation workflow.

- Adds a new forward-only SQL migration correcting create_timetable_slot's
  error-code contract, adding a school-identity defense check, and locking
  down EXECUTE grants (anon currently has EXECUTE on the live function).
- Updates components/teacher/AddSlotModal.tsx: matches the new stable error
  codes, adds a synchronous in-flight submission guard, and resets the form
  only after a confirmed successful save.

Safe to re-run: every anchor is checked with an explicit assert (fails
loudly, before any file is touched, if an anchor is missing/duplicated/
already patched). All writes happen only after every check across every
file has passed, and each write is atomic (write to a temp file, then
os.replace).
"""
import os
import sys

REPO = os.getcwd()

MODAL_PATH = os.path.join(REPO, "components", "teacher", "AddSlotModal.tsx")
MIGRATIONS_DIR = os.path.join(REPO, "supabase", "migrations")
MIGRATION_NAME = "20260720123500_fix28_create_timetable_slot_error_codes_and_grants.sql"
MIGRATION_PATH = os.path.join(MIGRATIONS_DIR, MIGRATION_NAME)

ALREADY_APPLIED_MARKER = "SCHOOL_MISMATCH"


def atomic_write(path, content):
    tmp = path + ".tmp_patch"
    with open(tmp, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)
    os.replace(tmp, path)


def must_count(haystack, needle, expected, label):
    n = haystack.count(needle)
    if n != expected:
        sys.stderr.write(
            f"ABORT: anchor '{label}' found {n} time(s), expected {expected}.\n"
            f"No files have been modified. Anchor text:\n{needle!r}\n"
        )
        sys.exit(1)


# ── Guard: already applied? ─────────────────────────────────────────────────
if os.path.exists(MODAL_PATH):
    with open(MODAL_PATH, "r", encoding="utf-8") as f:
        existing_modal = f.read()
    if ALREADY_APPLIED_MARKER in existing_modal:
        print("Already applied: AddSlotModal.tsx already contains "
              f"'{ALREADY_APPLIED_MARKER}'. Skipping — no changes made.")
        sys.exit(0)
else:
    sys.stderr.write(f"ABORT: {MODAL_PATH} does not exist.\n")
    sys.exit(1)

if not os.path.isdir(MIGRATIONS_DIR):
    sys.stderr.write(f"ABORT: {MIGRATIONS_DIR} does not exist.\n")
    sys.exit(1)

if os.path.exists(MIGRATION_PATH):
    sys.stderr.write(f"ABORT: migration {MIGRATION_NAME} already exists.\n")
    sys.exit(1)

src = existing_modal

# ── Anchor 1: import line ───────────────────────────────────────────────────
A1_OLD = "import { useState, useEffect } from 'react'\n"
A1_NEW = "import { useState, useEffect, useRef } from 'react'\n"
must_count(src, A1_OLD, 1, "react import")

# ── Anchor 2: toFriendlyError switch body ───────────────────────────────────
A2_OLD = """function toFriendlyError(err: { message?: string }): string {
  switch ((err.message ?? '').trim()) {
    case 'TEACHER_CONFLICT':
      return 'You already have a lesson scheduled at that time.'
    case 'CLASS_CONFLICT':
      return 'This class already has a lesson scheduled at that time.'
    case 'DUPLICATE_SLOT':
      return 'This exact lesson is already scheduled.'
    case 'ROOM_CONFLICT':
      return 'This room is already being used at that time.'
    case 'SCHEDULE_CONFLICT':
      return 'This lesson conflicts with another timetable slot.'
    case 'INVALID_TIME':
      return 'The selected time is invalid.'
    case 'INVALID_DATE_RANGE':
      return 'The effective date range is invalid.'
    case 'ASSIGNMENT_NOT_FOUND':
      return 'You are not assigned to this class and subject.'
    default:
      return 'Could not save the timetable slot. Try again.'
  }
}"""
A2_NEW = """function toFriendlyError(err: { message?: string }): string {
  switch ((err.message ?? '').trim()) {
    case 'TEACHER_CONFLICT':
      return 'Teacher already has a lesson at this time.'
    case 'CLASS_CONFLICT':
      return 'This class already has a lesson at this time.'
    case 'ROOM_CONFLICT':
      return 'This room is already occupied.'
    case 'INVALID_ASSIGNMENT':
      return 'You are not assigned to teach this subject for this class.'
    case 'SCHOOL_MISMATCH':
      return 'You are not assigned to teach this subject for this class.'
    case 'INVALID_DAY':
      return 'Choose a valid day.'
    case 'INVALID_TIME_RANGE':
      return 'End time must be after start time.'
    case 'INVALID_EFFECTIVE_RANGE':
      return 'Effective end date cannot be before the start date.'
    case 'UNAUTHENTICATED':
      return 'Your session expired. Please sign in again.'
    default:
      return 'Could not save the timetable slot. Try again.'
  }
}"""
must_count(src, A2_OLD, 1, "toFriendlyError body")

# ── Anchor 3: state block -> add submittingRef + resetForm ──────────────────
A3_OLD = """  const [effectiveFrom,  setEffectiveFrom]  = useState(nairobiTodayISO())

  useEffect(() => {"""
A3_NEW = """  const [effectiveFrom,  setEffectiveFrom]  = useState(nairobiTodayISO())

  // Synchronous guard against duplicate submission. `saving` (React state)
  // only disables the button on the *next* render — a fast double-tap can
  // fire two calls to save() before that re-render happens. This ref is
  // set/cleared synchronously inside save() itself, closing that gap.
  const submittingRef = useRef(false)

  function resetForm() {
    setTeacherClassId('')
    setDayOfWeek('1')
    setStartTime('08:00')
    setEndTime('09:00')
    setRoom('')
    setEffectiveFrom(nairobiTodayISO())
  }

  useEffect(() => {"""
must_count(src, A3_OLD, 1, "state block / useEffect boundary")

# ── Anchor 4: save() entry -> add re-entrancy guard ─────────────────────────
A4_OLD = """  async function save() {
    setError(null)"""
A4_NEW = """  async function save() {
    // Synchronous re-entrancy guard — closes the double-tap gap that the
    // `saving` state alone can't catch (see submittingRef declaration above).
    if (submittingRef.current) return

    setError(null)"""
must_count(src, A4_OLD, 1, "save() entry")

# ── Anchor 5: time-range validation message ─────────────────────────────────
A5_OLD = "    if (startTime >= endTime) { setError('The selected time is invalid.'); return }"
A5_NEW = "    if (startTime >= endTime) { setError('End time must be after start time.'); return }"
must_count(src, A5_OLD, 1, "time range validation message")

# ── Anchor 6: mark in-flight before RPC call ────────────────────────────────
A6_OLD = """    setSaving(true)
    // All conflict/assignment/school checks happen inside this one DB"""
A6_NEW = """    submittingRef.current = true
    setSaving(true)
    // All conflict/assignment/school checks happen inside this one DB"""
must_count(src, A6_OLD, 1, "pre-RPC saving state")

# ── Anchor 7: clear in-flight + reset-on-success ────────────────────────────
A7_OLD = """    setSaving(false)
    if (err) {
      console.error('[Timetable] slot creation failed', err)
      setError(toFriendlyError(err))
      return
    }
    onSaved()
  }"""
A7_NEW = """    setSaving(false)
    submittingRef.current = false

    if (err) {
      console.error('[Timetable] slot creation failed', err)
      // Form values are intentionally left untouched here so a recoverable
      // error (e.g. a conflict) doesn't force the teacher to re-enter
      // everything.
      setError(toFriendlyError(err))
      return
    }

    // Only reset on confirmed success — never on a recoverable error.
    resetForm()
    onSaved()
  }"""
must_count(src, A7_OLD, 1, "post-RPC result handling")

# ── All anchors verified — now apply in memory and write once ──────────────
patched = src
patched = patched.replace(A1_OLD, A1_NEW, 1)
patched = patched.replace(A2_OLD, A2_NEW, 1)
patched = patched.replace(A3_OLD, A3_NEW, 1)
patched = patched.replace(A4_OLD, A4_NEW, 1)
patched = patched.replace(A5_OLD, A5_NEW, 1)
patched = patched.replace(A6_OLD, A6_NEW, 1)
patched = patched.replace(A7_OLD, A7_NEW, 1)

if ALREADY_APPLIED_MARKER not in patched:
    sys.stderr.write("ABORT: post-patch sanity check failed — marker not present after patch.\n")
    sys.exit(1)

MIGRATION_SQL = r"""-- Fix 28: create_timetable_slot — stable, complete error-code contract +
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
"""

# ── Write everything only now that every check has passed ──────────────────
os.makedirs(MIGRATIONS_DIR, exist_ok=True)
atomic_write(MIGRATION_PATH, MIGRATION_SQL)
atomic_write(MODAL_PATH, patched)

print("Patched:")
print(f"  - {os.path.relpath(MODAL_PATH, REPO)}")
print(f"  - {os.path.relpath(MIGRATION_PATH, REPO)} (NEW — review before applying to production)")
