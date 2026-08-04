import {
  completeTeachingOccurrence,
  markSchemeItemCovered,
  resolveOccurrence,
  startTeachingOccurrence,
} from '@/lib/teaching/occurrence'
import type {
  TeachingOccurrence,
} from '@/lib/teaching/types'

export interface LessonOccurrenceKey {
  timetableSlotId: string
  occurrenceDate: string
}

export interface LessonAttendanceHandoffInput
  extends LessonOccurrenceKey {
  classId: string
  subjectId: string
  subjectName: string
}

/**
 * Loads the complete canonical teaching occurrence for one exact slot/date.
 */
export async function loadLessonOccurrence(
  key: LessonOccurrenceKey,
): Promise<TeachingOccurrence | null> {
  return resolveOccurrence(key)
}

/**
 * Starts one exact occurrence through the guarded lifecycle authority.
 */
export async function startLessonOccurrence(
  key: LessonOccurrenceKey,
) {
  return startTeachingOccurrence(key)
}

/**
 * Completes one exact occurrence through the guarded lifecycle authority.
 *
 * This operation does not mark Scheme coverage. Coverage remains a separate,
 * explicit teacher action.
 */
export async function completeLessonOccurrence(
  key: LessonOccurrenceKey,
) {
  return completeTeachingOccurrence(key)
}

/**
 * Marks the Scheme item linked to a completed occurrence as covered.
 */
export async function markLessonSchemeCovered(
  occurrenceId: string,
): Promise<void> {
  await markSchemeItemCovered(occurrenceId)
}

/**
 * Builds the canonical attendance handoff for the same teaching occurrence.
 */
export function buildLessonAttendanceUrl({
  classId,
  timetableSlotId,
  occurrenceDate,
  subjectId,
  subjectName,
}: LessonAttendanceHandoffInput): string {
  return (
    '/teacher/attendance?mode=lesson' +
    `&classId=${encodeURIComponent(classId)}` +
    `&timetableSlotId=${encodeURIComponent(timetableSlotId)}` +
    `&date=${encodeURIComponent(occurrenceDate)}` +
    `&subjectId=${encodeURIComponent(subjectId)}` +
    `&subject=${encodeURIComponent(subjectName)}`
  )
}
