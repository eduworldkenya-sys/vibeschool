import { supabase } from "@/lib/supabase";
import { isIsoDate, type TimetableRecurrencePattern } from "@/lib/timetable/contracts";

export interface CanonicalTimetableSlot {
  id: string;
  school_id: string;
  teacher_id: string;
  class_id: string;
  subject_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  period_id: string | null;
  allocation_units: number;
  recurrence_pattern: TimetableRecurrencePattern;
  effective_from: string;
  effective_until: string | null;
}

export interface LoadTeacherTimetableOptions {
  teacherId: string;
  schoolId: string;
  activeOn: string;
}

export interface LoadTeacherTimetableRangeOptions {
  teacherId: string;
  schoolId: string;
  rangeStart: string;
  rangeEnd: string;
}

export class TimetableEngineError extends Error {
  readonly causeMessage: string;

  constructor(message: string, causeMessage: string) {
    super(message);
    this.name = "TimetableEngineError";
    this.causeMessage = causeMessage;
  }
}

/**
 * Canonical active timetable loader.
 *
 * This is the only place Teacher OS timetable consumers should implement:
 * - teacher isolation
 * - school isolation
 * - effective-date filtering
 * - canonical ordering
 */
export async function loadActiveTeacherTimetable(
  options: LoadTeacherTimetableOptions
): Promise<CanonicalTimetableSlot[]> {
  const { teacherId, schoolId, activeOn } = options;

  if (!teacherId) {
    throw new TimetableEngineError(
      "Timetable teacher identity is required.",
      "MISSING_TEACHER_ID"
    );
  }

  if (!schoolId) {
    throw new TimetableEngineError(
      "Timetable school identity is required.",
      "MISSING_SCHOOL_ID"
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(activeOn)) {
    throw new TimetableEngineError(
      "Timetable active date must use YYYY-MM-DD.",
      "INVALID_ACTIVE_DATE"
    );
  }

  const { data, error } = await supabase
    .from("timetable_slots")
    .select(
      [
        "id",
        "school_id",
        "teacher_id",
        "class_id",
        "subject_id",
        "day_of_week",
        "start_time",
        "end_time",
        "room",
        "period_id",
        "allocation_units",
        "recurrence_pattern",
        "effective_from",
        "effective_until",
      ].join(",")
    )
    .eq("school_id", schoolId)
    .eq("teacher_id", teacherId)
    .lte("effective_from", activeOn)
    .or(`effective_until.is.null,effective_until.gte.${activeOn}`)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw new TimetableEngineError(
      "Failed to load the active teacher timetable.",
      error.message
    );
  }

  return (data ?? []) as CanonicalTimetableSlot[];
}

/**
 * Load timetable definitions whose effective ranges overlap a requested
 * calendar range.
 *
 * Consumers must still validate each slot's concrete weekday occurrence
 * against effective_from/effective_until.
 */
export async function loadTeacherTimetableForRange(
  options: LoadTeacherTimetableRangeOptions
): Promise<CanonicalTimetableSlot[]> {
  const { teacherId, schoolId, rangeStart, rangeEnd } = options;

  if (!teacherId) {
    throw new TimetableEngineError(
      "Timetable teacher identity is required.",
      "MISSING_TEACHER_ID"
    );
  }

  if (!schoolId) {
    throw new TimetableEngineError(
      "Timetable school identity is required.",
      "MISSING_SCHOOL_ID"
    );
  }

  const datePattern = /^\d{4}-\d{2}-\d{2}$/;

  if (!datePattern.test(rangeStart) || !datePattern.test(rangeEnd)) {
    throw new TimetableEngineError(
      "Timetable range dates must use YYYY-MM-DD.",
      "INVALID_DATE_RANGE"
    );
  }

  if (rangeStart > rangeEnd) {
    throw new TimetableEngineError(
      "Timetable range start cannot be after range end.",
      "INVALID_DATE_RANGE"
    );
  }

  const { data, error } = await supabase
    .from("timetable_slots")
    .select(
      [
        "id",
        "school_id",
        "teacher_id",
        "class_id",
        "subject_id",
        "day_of_week",
        "start_time",
        "end_time",
        "room",
        "period_id",
        "allocation_units",
        "recurrence_pattern",
        "effective_from",
        "effective_until",
      ].join(",")
    )
    .eq("school_id", schoolId)
    .eq("teacher_id", teacherId)
    .lte("effective_from", rangeEnd)
    .or(`effective_until.is.null,effective_until.gte.${rangeStart}`)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw new TimetableEngineError(
      "Failed to load the teacher timetable range.",
      error.message
    );
  }

  return (data ?? []) as CanonicalTimetableSlot[];
}

export interface LoadClassTimetableOptions {
  classId: string;
  schoolId: string;
  activeOn: string;
}

/**
 * Canonical active timetable loader for class-scoped consumers
 * (student surfaces). Mirrors loadActiveTeacherTimetable:
 * - class isolation
 * - school isolation
 * - effective-date filtering
 * - canonical ordering
 */
export async function loadActiveClassTimetable(
  options: LoadClassTimetableOptions
): Promise<CanonicalTimetableSlot[]> {
  const { classId, schoolId, activeOn } = options;

  if (!classId) {
    throw new TimetableEngineError(
      "Timetable class identity is required.",
      "MISSING_CLASS_ID"
    );
  }

  if (!schoolId) {
    throw new TimetableEngineError(
      "Timetable school identity is required.",
      "MISSING_SCHOOL_ID"
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(activeOn)) {
    throw new TimetableEngineError(
      "Timetable active date must use YYYY-MM-DD.",
      "INVALID_ACTIVE_DATE"
    );
  }

  const { data, error } = await supabase
    .from("timetable_slots")
    .select(
      [
        "id",
        "school_id",
        "teacher_id",
        "class_id",
        "subject_id",
        "day_of_week",
        "start_time",
        "end_time",
        "room",
        "period_id",
        "allocation_units",
        "recurrence_pattern",
        "effective_from",
        "effective_until",
      ].join(",")
    )
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .lte("effective_from", activeOn)
    .or(`effective_until.is.null,effective_until.gte.${activeOn}`)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw new TimetableEngineError(
      "Failed to load the active class timetable.",
      error.message
    );
  }

  return (data ?? []) as CanonicalTimetableSlot[];
}

export function timetableSlotsForDay(
  slots: readonly CanonicalTimetableSlot[],
  dayOfWeek: number
): CanonicalTimetableSlot[] {
  return slots.filter((slot) => Number(slot.day_of_week) === dayOfWeek);
}

export function findNextTimetableSlot(
  slots: readonly CanonicalTimetableSlot[],
  dayOfWeek: number,
  currentTime: string
): CanonicalTimetableSlot | null {
  return (
    slots.find(
      (slot) =>
        Number(slot.day_of_week) === dayOfWeek &&
        slot.start_time.localeCompare(currentTime) > 0
    ) ?? null
  );
}


export interface TeacherWeeklyTimetableLoad {
  class_id: string;
  subject_id: string;
  class_name: string;
  stream: string;
  subject_name: string;
  grade: string;
  lessons_per_week: number | null;
  scheduled_count: number;
  status: "NO_TARGET" | "ZERO" | "UNDER" | "OK" | "OVER";
}

export interface TimetableConflict {
  conflict_type: "TEACHER_CONFLICT" | "CLASS_CONFLICT" | "ROOM_CONFLICT" | "SCHEDULE_CONFLICT";
  conflicting_slot_id: string;
  conflicting_teacher_id: string | null;
  conflicting_class_id: string;
  conflicting_subject_id: string;
  conflicting_room: string | null;
  detail: string;
}

/**
 * Allocation-aware teacher workload. Unlike slot-only readers this preserves
 * assigned subjects with zero scheduled slots, so "nothing scheduled" cannot
 * be confused with "nothing to teach".
 */
export async function loadTeacherWeeklyTimetableLoad(): Promise<TeacherWeeklyTimetableLoad[]> {
  const { data, error } = await supabase.rpc("get_teacher_weekly_timetable_load");
  if (error) {
    throw new TimetableEngineError("Failed to load timetable allocation health.", error.message);
  }
  return (data ?? []) as TeacherWeeklyTimetableLoad[];
}

export interface PreviewTimetableConflictsOptions {
  schoolId: string;
  teacherId: string;
  classId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string | null;
  effectiveFrom?: string | null;
  effectiveUntil?: string | null;
  excludeSlotId?: string | null;
}

/**
 * Explainable pre-save conflict intelligence. The database exclusion
 * constraints remain authoritative at write time; this is a safe preview.
 */
export async function previewTimetableConflicts(
  options: PreviewTimetableConflictsOptions
): Promise<TimetableConflict[]> {
  const { data, error } = await supabase.rpc("preview_timetable_conflicts", {
    p_school_id: options.schoolId,
    p_teacher_id: options.teacherId,
    p_class_id: options.classId,
    p_day_of_week: options.dayOfWeek,
    p_start_time: options.startTime,
    p_end_time: options.endTime,
    p_room: options.room ?? null,
    p_effective_from: options.effectiveFrom ?? null,
    p_effective_until: options.effectiveUntil ?? null,
    p_exclude_slot_id: options.excludeSlotId ?? null,
  });
  if (error) {
    throw new TimetableEngineError("Failed to preview timetable conflicts.", error.message);
  }
  return (data ?? []) as TimetableConflict[];
}


/** Published schedule authority for student/Twin consumers. */
export async function loadPublishedClassTimetable(classId: string, activeOn: string): Promise<CanonicalTimetableSlot[]> {
  if (!classId || !isIsoDate(activeOn)) throw new TimetableEngineError("Valid class and date are required.", "INVALID_PUBLISHED_TIMETABLE_REQUEST");
  const { data, error } = await supabase.rpc("get_published_class_timetable", { p_class_id: classId, p_on: activeOn });
  if (error) throw new TimetableEngineError("Failed to load published class timetable.", error.message);
  return (data ?? []) as CanonicalTimetableSlot[];
}

/** Published schedule authority for teacher/Twin consumers. */
export async function loadPublishedTeacherTimetable(teacherId: string, activeOn: string): Promise<CanonicalTimetableSlot[]> {
  if (!teacherId || !isIsoDate(activeOn)) throw new TimetableEngineError("Valid teacher and date are required.", "INVALID_PUBLISHED_TIMETABLE_REQUEST");
  const { data, error } = await supabase.rpc("get_published_teacher_timetable", { p_teacher_id: teacherId, p_on: activeOn });
  if (error) throw new TimetableEngineError("Failed to load published teacher timetable.", error.message);
  return (data ?? []) as CanonicalTimetableSlot[];
}
