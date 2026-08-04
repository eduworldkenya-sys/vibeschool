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

/**
 * Loads the teacher, school, class and learner context needed to prepare one
 * lesson.
 *
 * This function is read-only. It does not resolve curriculum sources and does
 * not create or update lesson plans.
 */
export async function loadLessonContext({
  userId,
  classId,
  subjectId,
}: LoadLessonContextInput): Promise<LessonContext> {
  const { data: profile, error: profileError } =
    await supabase
      .from('profiles')
      .select('full_name, school_id')
      .eq('id', userId)
      .single()

  if (profileError) {
    throw profileError
  }

  const schoolId = profile.school_id ?? null

  const [
    schoolResult,
    studentResult,
    previousResult,
    classResult,
  ] = await Promise.all([
    schoolId
      ? supabase
          .from('schools')
          .select('name')
          .eq('id', schoolId)
          .single()
      : Promise.resolve({
          data: null,
          error: null,
        }),
    supabase
      .from('students')
      .select('id, name, profile_id')
      .eq('class_id', classId),
    supabase
      .from('lesson_plans')
      .select('topic')
      .eq('teacher_id', userId)
      .eq('class_id', classId)
      .eq('subject_id', subjectId)
      .not('topic', 'is', null)
      .order('created_at', {
        ascending: false,
      })
      .limit(5),
    supabase
      .from('classes')
      .select('name')
      .eq('id', classId)
      .single(),
  ])

  if (schoolResult.error) {
    throw schoolResult.error
  }

  if (studentResult.error) {
    throw studentResult.error
  }

  if (previousResult.error) {
    throw previousResult.error
  }

  if (classResult.error) {
    throw classResult.error
  }

  const students =
    (studentResult.data ?? []) as LessonContextStudent[]

  const previousTopics = (
    previousResult.data ?? []
  )
    .map(row => row.topic)
    .filter(
      (topic): topic is string =>
        typeof topic === 'string' &&
        topic.trim().length > 0,
    )

  return {
    teacherName:
      profile.full_name ?? 'Teacher',
    schoolName:
      schoolResult.data?.name ?? 'the school',
    schoolId:
      schoolId ?? '',
    studentCount:
      students.length,
    previousTopics,
    students,
    grade:
      classResult.data?.name ?? null,
  }
}
