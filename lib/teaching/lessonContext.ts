import { supabase } from '@/lib/supabase'

export interface LessonContextStudent {
  id: string
  name: string
  profile_id: string | null
}

export interface LessonContext {
  teacherName: string
  schoolName: string
  schoolId: string
  studentCount: number
  previousTopics: string[]
  students: LessonContextStudent[]
  grade: string | null
}

export interface LoadLessonContextInput {
  userId: string
  classId: string
  subjectId: string
  occurrenceDate: string
}

interface EnrollmentLearnerRow {
  id: string
  name: string
  profile_id: string | null
  deleted_at: string | null
}

interface StudentClassRow {
  student_id: string
}

interface CompletedOccurrenceRow {
  timetable_slot_id: string
  occurrence_date: string
}

interface PreviousPlanRow {
  timetable_slot_id: string
  taught_date: string
  topic: string | null
}

function occurrenceKey(
  timetableSlotId: string,
  occurrenceDate: string,
): string {
  return `${timetableSlotId}:${occurrenceDate}`
}

export async function loadLessonContext({
  userId,
  classId,
  subjectId,
  occurrenceDate,
}: LoadLessonContextInput): Promise<LessonContext> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurrenceDate)) {
    throw new Error('lesson_context_occurrence_date_required')
  }

  const [profileResult, assignmentResult, classResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .single(),
    supabase
      .from('teacher_classes')
      .select('school_id,class_id,subject_id')
      .eq('teacher_id', userId)
      .eq('class_id', classId)
      .eq('subject_id', subjectId)
      .maybeSingle(),
    supabase
      .from('classes')
      .select('name,stream,school_id')
      .eq('id', classId)
      .single(),
  ])

  if (profileResult.error) throw profileResult.error
  if (assignmentResult.error) throw assignmentResult.error
  if (classResult.error) throw classResult.error
  if (!assignmentResult.data?.school_id) {
    throw new Error('lesson_context_assignment_not_authorized')
  }

  const schoolId = assignmentResult.data.school_id
  if (classResult.data.school_id !== schoolId) {
    throw new Error('lesson_context_class_school_mismatch')
  }

  const { error: activateError } = await supabase.rpc(
    'teacher_set_active_school',
    { p_school_id: schoolId },
  )
  if (activateError) throw activateError

  const [schoolResult, enrollmentResult, completedResult] = await Promise.all([
    supabase
      .from('schools')
      .select('name')
      .eq('id', schoolId)
      .single(),
    supabase
      .from('student_classes')
      .select('student_id')
      .eq('school_id', schoolId)
      .eq('class_id', classId)
      .eq('is_current', true),
    supabase
      .from('teaching_occurrences')
      .select('timetable_slot_id,occurrence_date')
      .eq('teacher_id', userId)
      .eq('school_id', schoolId)
      .eq('class_id', classId)
      .eq('subject_id', subjectId)
      .eq('lifecycle', 'completed')
      .lt('occurrence_date', occurrenceDate)
      .not('completed_at', 'is', null)
      .order('occurrence_date', { ascending: false })
      .order('completed_at', { ascending: false })
      .limit(5),
  ])

  if (schoolResult.error) throw schoolResult.error
  if (enrollmentResult.error) throw enrollmentResult.error
  if (completedResult.error) throw completedResult.error

  const studentIds = Array.from(new Set(
    ((enrollmentResult.data ?? []) as StudentClassRow[]).map(row => row.student_id),
  ))
  const learnerResult = studentIds.length > 0
    ? await supabase
        .from('students')
        .select('id,name,profile_id,deleted_at')
        .in('id', studentIds)
        .is('deleted_at', null)
    : { data: [] as EnrollmentLearnerRow[], error: null }
  if (learnerResult.error) throw learnerResult.error

  const students: LessonContextStudent[] = ((learnerResult.data ?? []) as EnrollmentLearnerRow[])
    .map(learner => ({
      id: learner.id,
      name: learner.name,
      profile_id: learner.profile_id ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const completedOccurrences =
    (completedResult.data ?? []) as CompletedOccurrenceRow[]

  let previousTopics: string[] = []

  if (completedOccurrences.length > 0) {
    const slotIds = Array.from(
      new Set(completedOccurrences.map(row => row.timetable_slot_id)),
    )
    const taughtDates = Array.from(
      new Set(completedOccurrences.map(row => row.occurrence_date)),
    )

    const { data: planRows, error: planError } = await supabase
      .from('lesson_plans')
      .select('timetable_slot_id,taught_date,topic')
      .eq('teacher_id', userId)
      .eq('school_id', schoolId)
      .eq('class_id', classId)
      .eq('subject_id', subjectId)
      .in('timetable_slot_id', slotIds)
      .in('taught_date', taughtDates)

    if (planError) throw planError

    const topicByOccurrence = new Map<string, string>()
    for (const row of (planRows ?? []) as PreviousPlanRow[]) {
      if (typeof row.topic !== 'string' || row.topic.trim().length === 0) continue
      topicByOccurrence.set(
        occurrenceKey(row.timetable_slot_id, row.taught_date),
        row.topic.trim(),
      )
    }

    previousTopics = completedOccurrences.flatMap(row => {
      const topic = topicByOccurrence.get(
        occurrenceKey(row.timetable_slot_id, row.occurrence_date),
      )
      return topic ? [topic] : []
    })
  }

  return {
    teacherName: profileResult.data.full_name ?? 'Teacher',
    schoolName: schoolResult.data?.name ?? 'the school',
    schoolId,
    studentCount: students.length,
    previousTopics,
    students,
    grade: classResult.data?.name ?? null,
  }
}
