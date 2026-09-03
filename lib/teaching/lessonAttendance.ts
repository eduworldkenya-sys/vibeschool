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
  expectedStudentCount: number
  recordedStudentCount: number
}

export interface LoadExactLessonAttendanceInput {
  teacherId: string
  schoolId: string
  timetableSlotId: string
  occurrenceDate: string
  expectedClassId?: string | null
  expectedSubjectId?: string | null
}

interface EnrollmentStudentRow {
  id: string
  deleted_at: string | null
}

interface EnrollmentRow {
  student_id: string
  students: EnrollmentStudentRow | EnrollmentStudentRow[] | null
}

function joinedStudent(
  value: EnrollmentStudentRow | EnrollmentStudentRow[] | null,
): EnrollmentStudentRow | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

/**
 * Resolves one exact timetable lesson for attendance.
 *
 * Historical occurrences remain addressable by exact slot/date after timetable
 * edits. The `marked` flag means the complete canonical current class roster
 * has an attendance record for this exact occurrence; one partial row must
 * never make the lesson appear fully marked.
 */
export async function loadExactLessonAttendance({
  teacherId,
  schoolId,
  timetableSlotId,
  occurrenceDate,
  expectedClassId = null,
  expectedSubjectId = null,
}: LoadExactLessonAttendanceInput): Promise<ExactLessonAttendanceSlot | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurrenceDate)) {
    throw new Error('lessonAttendance: occurrenceDate must be YYYY-MM-DD.')
  }

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

  if (slotError) throw slotError
  if (!slot) return null

  if (expectedClassId && slot.class_id !== expectedClassId) return null
  if (expectedSubjectId && slot.subject_id !== expectedSubjectId) return null

  const [
    subjectResult,
    classResult,
    enrollmentResult,
    attendanceResult,
  ] = await Promise.all([
    supabase
      .from('subjects')
      .select('name, school_id')
      .eq('id', slot.subject_id)
      .single(),
    supabase
      .from('classes')
      .select('name, stream, school_id')
      .eq('id', slot.class_id)
      .single(),
    supabase
      .from('student_classes')
      .select('student_id, students(id,deleted_at)')
      .eq('school_id', schoolId)
      .eq('class_id', slot.class_id)
      .eq('is_current', true),
    supabase
      .from('attendance')
      .select('student_id')
      .eq('school_id', schoolId)
      .eq('class_id', slot.class_id)
      .eq('teacher_id', teacherId)
      .eq('timetable_slot_id', slot.id)
      .eq('date', occurrenceDate),
  ])

  const firstError =
    subjectResult.error ??
    classResult.error ??
    enrollmentResult.error ??
    attendanceResult.error

  if (firstError) throw firstError

  const subjectRow = subjectResult.data
  const classRow = classResult.data

  if (!subjectRow || !classRow) {
    throw new Error(
      'lessonAttendance: subject or class metadata was not found.',
    )
  }

  if (
    classRow.school_id !== schoolId ||
    subjectRow.school_id !== schoolId
  ) {
    return null
  }

  const expectedStudentIds = new Set<string>()
  for (const row of (enrollmentResult.data ?? []) as EnrollmentRow[]) {
    const student = joinedStudent(row.students)
    if (!student || student.deleted_at) continue
    expectedStudentIds.add(row.student_id)
  }

  const recordedStudentIds = new Set(
    (attendanceResult.data ?? [])
      .map(row => row.student_id)
      .filter((studentId): studentId is string => typeof studentId === 'string'),
  )

  const expectedStudentCount = expectedStudentIds.size
  const recordedStudentCount = Array.from(expectedStudentIds)
    .filter(studentId => recordedStudentIds.has(studentId))
    .length

  return {
    id: slot.id,
    classId: slot.class_id,
    subjectId: slot.subject_id,
    subject: subjectRow.name ?? 'Unknown',
    className:
      classRow.name +
      (classRow.stream ? ' ' + classRow.stream : ''),
    room: slot.room ?? '',
    start: slot.start_time,
    end: slot.end_time,
    marked:
      expectedStudentCount > 0 &&
      recordedStudentCount === expectedStudentCount,
    schoolId,
    expectedStudentCount,
    recordedStudentCount,
  }
}
