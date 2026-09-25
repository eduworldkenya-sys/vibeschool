import { getTermForDate, schoolWeekOf } from '@/lib/academicTerm'
import { resolveSchoolId } from '@/lib/school'
import { supabase } from '@/lib/supabase'
import { loadTeacherTimetableForRange } from '@/lib/timetable/engine'
import { nairobiDateAdd, nairobiWeekStart } from '@/lib/time'
import { resolveOccurrence } from '@/lib/teaching/occurrence'
import type { TeachingOccurrence } from '@/lib/teaching/types'

export interface TeacherWorkspaceAssignment {
  classId: string
  className: string
  stream: string | null
  subjectId: string
  subjectName: string
}

export interface TeacherWorkspaceOccurrence {
  timetableSlotId: string
  occurrenceDate: string
  dayOfWeek: number
  startTime: string
  endTime: string
  assignment: TeacherWorkspaceAssignment
  teaching: TeachingOccurrence | null
}

export interface TeacherWorkspaceWeek {
  teacherId: string
  schoolId: string
  weekStart: string
  weekEnd: string
  term: Awaited<ReturnType<typeof getTermForDate>>
  weekNumber: number | null
  assignments: TeacherWorkspaceAssignment[]
  occurrences: TeacherWorkspaceOccurrence[]
}

export async function resolveTeacherWorkspaceSchoolId(userId: string): Promise<string | null> {
  return resolveSchoolId(userId)
}

export async function loadTeacherWorkspaceWeek(input: {
  teacherId: string
  weekOffset?: number
}): Promise<TeacherWorkspaceWeek | null> {
  const schoolId = await resolveTeacherWorkspaceSchoolId(input.teacherId)
  if (!schoolId) return null

  const weekStart = nairobiDateAdd(nairobiWeekStart(), (input.weekOffset ?? 0) * 7)
  const weekEnd = nairobiDateAdd(weekStart, 6)

  const { data: assignmentRows, error: assignmentError } = await supabase
    .from('teacher_classes')
    .select('class_id,subject_id,classes!inner(id,name,stream,school_id),subjects!inner(id,name)')
    .eq('teacher_id', input.teacherId)
    .eq('school_id', schoolId)

  if (assignmentError) throw assignmentError

  const assignments: TeacherWorkspaceAssignment[] = (assignmentRows ?? []).flatMap((row: any) => {
    const klass = Array.isArray(row.classes) ? row.classes[0] : row.classes
    const subject = Array.isArray(row.subjects) ? row.subjects[0] : row.subjects
    if (!klass?.id || klass.school_id !== schoolId || !subject?.id) return []
    return [{
      classId: klass.id,
      className: klass.name ?? 'Class',
      stream: klass.stream ?? null,
      subjectId: subject.id,
      subjectName: subject.name ?? 'Subject',
    }]
  })

  const assignmentByKey = new Map(
    assignments.map(item => [item.classId + ':' + item.subjectId, item]),
  )

  const slots = await loadTeacherTimetableForRange({
    teacherId: input.teacherId,
    schoolId,
    rangeStart: weekStart,
    rangeEnd: weekEnd,
  })

  const occurrenceKeys = slots.flatMap(slot => {
    const occurrenceDate = nairobiDateAdd(weekStart, Number(slot.day_of_week) - 1)
    if (occurrenceDate < slot.effective_from) return []
    if (slot.effective_until && occurrenceDate > slot.effective_until) return []
    const assignment = assignmentByKey.get(slot.class_id + ':' + slot.subject_id)
    if (!assignment) return []
    return [{ slot, occurrenceDate, assignment }]
  })

  const teachingStates = await Promise.all(
    occurrenceKeys.map(({ slot, occurrenceDate }) =>
      resolveOccurrence({
        timetableSlotId: slot.id,
        occurrenceDate,
      }),
    ),
  )

  const occurrences: TeacherWorkspaceOccurrence[] = occurrenceKeys.map(
    ({ slot, occurrenceDate, assignment }, index) => ({
      timetableSlotId: slot.id,
      occurrenceDate,
      dayOfWeek: slot.day_of_week,
      startTime: slot.start_time,
      endTime: slot.end_time,
      assignment,
      teaching: teachingStates[index],
    }),
  )

  // A selected week is governed by the calendar date it represents, not by today's term.
  // Prefer the Monday; if a term opens mid-week, resolve against Sunday so Week 1 still renders.
  const term = await getTermForDate(schoolId, weekStart) ?? await getTermForDate(schoolId, weekEnd)
  const weekNumber = term
    ? schoolWeekOf(term, weekStart) ?? schoolWeekOf(term, weekEnd)
    : null

  return {
    teacherId: input.teacherId,
    schoolId,
    weekStart,
    weekEnd,
    term,
    weekNumber,
    assignments,
    occurrences,
  }
}
