import { supabase } from '@/lib/supabase'

export interface ExactLessonAttendanceSlot {
  id: string
  classId: string
  subjectId: string
  subject: string
  className: string
  room: string
  start: string
  end: string
  marked: boolean
  schoolId: string
}

export interface LoadExactLessonAttendanceInput {
  teacherId: string
  schoolId: string
  timetableSlotId: string
  occurrenceDate: string
  expectedClassId?: string | null
  expectedSubjectId?: string | null
}

/**
 * Resolves one exact timetable lesson for attendance.
 *
 * This intentionally does not require the slot to remain in today's rebuilt
 * active timetable. Historical occurrences must remain markable after later
 * timetable edits, expiry or replacement.
 */
export async function loadExactLessonAttendance({
  teacherId,
  schoolId,
  timetableSlotId,
  occurrenceDate,
  expectedClassId = null,
  expectedSubjectId = null,
}: LoadExactLessonAttendanceInput): Promise<ExactLessonAttendanceSlot | null> {
  const {
    data: slot,
    error: slotError,
  } = await supabase
    .from('timetable_slots')
    .select(
      'id, school_id, teacher_id, class_id, subject_id, room, start_time, end_time',
    )
    .eq('id', timetableSlotId)
    .eq('teacher_id', teacherId)
    .eq('school_id', schoolId)
    .maybeSingle()

  if (slotError) {
    throw slotError
  }

  if (!slot) {
    return null
  }

  if (
    expectedClassId &&
    slot.class_id !== expectedClassId
  ) {
    return null
  }

  if (
    expectedSubjectId &&
    slot.subject_id !== expectedSubjectId
  ) {
    return null
  }

  const [
    subjectResult,
    classResult,
    attendanceResult,
  ] = await Promise.all([
    supabase
      .from('subjects')
      .select('name')
      .eq('id', slot.subject_id)
      .single(),
    supabase
      .from('classes')
      .select('name, stream, school_id')
      .eq('id', slot.class_id)
      .single(),
    supabase
      .from('attendance')
      .select('student_id', {
        count: 'exact',
        head: true,
      })
      .eq('timetable_slot_id', slot.id)
      .eq('date', occurrenceDate),
  ])

  const firstError =
    subjectResult.error ??
    classResult.error ??
    attendanceResult.error

  if (firstError) {
    throw firstError
  }

  const classRow = classResult.data

  if (
    classRow.school_id &&
    classRow.school_id !== schoolId
  ) {
    return null
  }

  return {
    id: slot.id,
    classId: slot.class_id,
    subjectId: slot.subject_id,
    subject:
      subjectResult.data.name ?? 'Unknown',
    className:
      classRow.name +
      (classRow.stream
        ? ' ' + classRow.stream
        : ''),
    room: slot.room ?? '',
    start: slot.start_time,
    end: slot.end_time,
    marked:
      (attendanceResult.count ?? 0) > 0,
    schoolId,
  }
}
