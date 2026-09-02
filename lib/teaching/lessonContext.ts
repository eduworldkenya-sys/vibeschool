import { supabase } from '@/lib/supabase'

export interface LessonContextStudent {
  id: string
  name: string
  profile_id: string | null
}

export interface PreviousCompletedLesson {
  lessonPlanId: string
  topic: string
  occurrenceDate: string
}

export interface LessonContext {
  teacherName: string
  schoolName: string
  schoolId: string
  studentCount: number
  previousLesson: PreviousCompletedLesson | null
  /**
   * Compatibility view for older lesson-workspace consumers. This is never a
   * query of recent lesson-plan drafts: it is derived only from
   * `previousLesson`, whose authority is the last completed teaching
   * occurrence for the same teacher/class/subject.
   */
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

type EnrollmentLearner = {
  id: string
  name: string
  profile_id: string | null
  deleted_at: string | null
}

type EnrollmentRow = {
  student_id: string
  students: EnrollmentLearner | EnrollmentLearner[] | null
}

function singleEnrollmentLearner(
  value: EnrollmentRow['students'],
): EnrollmentLearner | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

/**
 * Loads the exact teacher → school → class → subject → learner context for one
 * lesson. The teaching assignment is the school authority; neither a stale
 * profile school pointer nor students.class_id may decide lesson identity.
 *
 * "Previous lesson" has one canonical meaning here: the latest COMPLETED
 * teaching occurrence strictly before the occurrence currently being opened,
 * for the same teacher + school + class + subject, with its persisted lesson
 * plan. Recently-created drafts are never treated as teaching history.
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
  occurrenceDate,
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurrenceDate)) {
    throw new Error('lesson_context_occurrence_date_required')
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

  const [schoolResult, enrollmentResult, previousOccurrenceResult] =
    await Promise.all([
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
        .select('timetable_slot_id,occurrence_date,completed_at')
        .eq('teacher_id', userId)
        .eq('school_id', schoolId)
        .eq('class_id', classId)
        .eq('subject_id', subjectId)
        .eq('lifecycle', 'completed')
        .lt('occurrence_date', occurrenceDate)
        .order('occurrence_date', { ascending: false })
        .order('completed_at', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle(),
    ])

  if (schoolResult.error) throw schoolResult.error
  if (enrollmentResult.error) throw enrollmentResult.error
  if (previousOccurrenceResult.error) throw previousOccurrenceResult.error

  let previousLesson: PreviousCompletedLesson | null = null
  const previousOccurrence = previousOccurrenceResult.data
  if (
    previousOccurrence?.timetable_slot_id &&
    previousOccurrence.occurrence_date
  ) {
    const { data: previousPlan, error: previousPlanError } = await supabase
      .from('lesson_plans')
      .select('id,topic')
      .eq('teacher_id', userId)
      .eq('school_id', schoolId)
      .eq('class_id', classId)
      .eq('subject_id', subjectId)
      .eq('timetable_slot_id', previousOccurrence.timetable_slot_id)
      .eq('taught_date', previousOccurrence.occurrence_date)
      .not('topic', 'is', null)
      .maybeSingle()

    if (previousPlanError) throw previousPlanError

    const previousTopic = previousPlan?.topic?.trim()
    if (previousPlan?.id && previousTopic) {
      previousLesson = {
        lessonPlanId: previousPlan.id,
        topic: previousTopic,
        occurrenceDate: previousOccurrence.occurrence_date,
      }
    }
  }

  const students: LessonContextStudent[] = []
  const seen = new Set<string>()
  const enrollmentRows: EnrollmentRow[] = enrollmentResult.data ?? []
  for (const row of enrollmentRows) {
    const learner = singleEnrollmentLearner(row.students)
    if (!learner || learner.deleted_at || seen.has(learner.id)) continue
    seen.add(learner.id)
    students.push({
      id: learner.id,
      name: learner.name,
      profile_id: learner.profile_id ?? null,
    })
  }
  students.sort((a, b) => a.name.localeCompare(b.name))

  return {
    teacherName: profileResult.data.full_name ?? 'Teacher',
    schoolName: schoolResult.data?.name ?? 'the school',
    schoolId,
    studentCount: students.length,
    previousLesson,
    previousTopics: previousLesson ? [previousLesson.topic] : [],
    students,
    grade: classResult.data?.name ?? null,
  }
}
