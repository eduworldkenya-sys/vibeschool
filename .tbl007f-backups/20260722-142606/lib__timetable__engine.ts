import { supabase } from "@/lib/supabase";

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
