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
}

interface EnrollmentLearnerRow {
  id: string
  name: string
  profile_id: string | null
  deleted_at: string | null
}

interface StudentClassJoinRow {
  student_id: string
  students: EnrollmentLearnerRow | EnrollmentLearnerRow[] | null
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

function firstJoinedLearner(
  value: EnrollmentLearnerRow | EnrollmentLearnerRow[] | null,
): EnrollmentLearnerRow | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

function occurrenceKey(
  timetableSlotId: string,
  occurrenceDate: string,
): string {
  return `${timetableSlotId}:${occurrenceDate}`
}

/**
 * Loads the exact teacher → school → class → subject → learner context for one
 * lesson. The teaching assignment is the school authority; neither a stale
 * profile school pointer nor students.class_id may decide lesson identity.
 *
 * Opening a valid lesson also activates that exact authorized school through
 * the guarded context RPC. This keeps older teacher consumers that still read
 * legacy school pointers aligned with the canonical assignment during the
 * transition to teacher_get_operating_context.
 */
export async function loadLessonContext({
  userId,
  classId,
  subjectId,
}: LoadLessonContextInput): Promise<LessonContext> {
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
      .select('student_id,students(id,name,profile_id,deleted_at)')
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
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(5),
  ])

  if (schoolResult.error) throw schoolResult.error
  if (enrollmentResult.error) throw enrollmentResult.error
  if (completedResult.error) throw completedResult.error

  const students: LessonContextStudent[] = []
  const seen = new Set<string>()
  for (const row of (enrollmentResult.data ?? []) as StudentClassJoinRow[]) {
    const learner = firstJoinedLearner(row.students)
    if (!learner || learner.deleted_at || seen.has(learner.id)) continue
    seen.add(learner.id)
    students.push({
      id: learner.id,
      name: learner.name,
      profile_id: learner.profile_id ?? null,
    })
  }
  students.sort((a, b) => a.name.localeCompare(b.name))

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
      if (typeof row.topic !== 'string' || row.topic.trim().length === 0) {
        continue
      }
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
