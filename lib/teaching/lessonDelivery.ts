import { supabase } from '@/lib/supabase'
import { nairobiDateAdd, nairobiDateStr } from '@/lib/time'
import {
  ensureLessonHomeworkDraft,
} from '@/lib/teaching/lessonHomeworkDraft'
import {
  ensureLessonExerciseDraft,
} from '@/lib/teaching/lessonExerciseDraft'
import {
  deliverLessonPlanToParents,
} from '@/lib/teaching/lessonParentDelivery'
import {
  updateLessonPlanStatus,
} from '@/lib/teaching/lessonRepository'
import type {
  LessonPlanSections,
} from '@/lib/teaching/lessonPlanCodec'
import type {
  LessonContextStudent,
} from '@/lib/teaching/lessonContext'

export interface PublishLessonToStudentsInput {
  lessonPlanId: string
  schoolId: string
  topic: string
  subject: string
  teacherName: string
  students: LessonContextStudent[]
}

export interface ShareLessonToParentsInput {
  lessonPlanId: string
  classId: string
  teacherId: string
  schoolId: string
  subject: string
  topic: string
  sections: LessonPlanSections
}

/**
 * Publishes the lesson and notifies linked learner profiles.
 * The lesson-plan repository remains the only lesson_plans write boundary.
 */
export async function publishLessonToStudents({
  lessonPlanId,
  schoolId,
  topic,
  subject,
  teacherName,
  students,
}: PublishLessonToStudentsInput): Promise<void> {
  await updateLessonPlanStatus({ lessonPlanId, status: 'published' })

  const linkedStudents = students.filter(
    (student): student is LessonContextStudent & { profile_id: string } =>
      typeof student.profile_id === 'string' && student.profile_id.length > 0,
  )

  if (linkedStudents.length === 0) return

  const { error } = await supabase
    .from('notifications')
    .insert(
      linkedStudents.map(student => ({
        school_id: schoolId || null,
        user_id: student.profile_id,
        title: 'New Lesson: ' + topic,
        body: subject + ' lesson plan published by ' + teacherName,
        type: 'lesson_plan',
        related_id: lessonPlanId,
      })),
    )

  if (error) throw error
}

/**
 * Prepares lesson-owned downstream work first, then delivers the parent summary
 * and finally advances publication state. Draft creation is idempotent, so a
 * failed parent delivery can be retried without duplicating or overwriting
 * teacher work. Parent delivery therefore never claims a synchronized lesson
 * before its homework/exercise lineage has been established.
 */
export async function shareLessonToParents({
  lessonPlanId,
  classId,
  teacherId,
  schoolId,
  subject,
  topic,
  sections,
}: ShareLessonToParentsInput): Promise<void> {
  if (sections.homework.trim() !== '') {
    const homeworkResult = await ensureLessonHomeworkDraft({
      lessonPlanId,
      classId,
      teacherId,
      schoolId,
      subject,
      title: topic + ' — Homework',
      instructions: sections.homework.trim(),
      suggestedDueDate: nairobiDateAdd(nairobiDateStr(), 1),
    })

    if (homeworkResult.outcome === 'preserved_existing') {
      console.info(
        '[lessonDelivery] existing lesson homework preserved',
        homeworkResult.homeworkId,
      )
    }
  }

  if (sections.consolidation.trim() !== '') {
    const exerciseResult = await ensureLessonExerciseDraft({
      lessonPlanId,
      classId,
      teacherId,
      schoolId,
      title: topic + ' — In-Class Exercise',
      instructions: sections.consolidation.trim(),
    })

    if (exerciseResult.outcome === 'preserved_existing') {
      console.info(
        '[lessonDelivery] existing lesson exercise preserved',
        exerciseResult.exerciseId,
      )
    }
  }

  const summary = [
    'Topic: ' + topic,
    '',
    'Learning Objectives:',
    sections.objectives,
    '',
    sections.homework ? 'Homework:\n' + sections.homework : '',
  ]
    .filter(Boolean)
    .join('\n')

  const deliveryResult = await deliverLessonPlanToParents({
    lessonPlanId,
    deliveryPurpose: 'lesson_summary',
    subject: subject + ' — Lesson: ' + topic,
    body: summary,
  })

  if (deliveryResult.recipientCount === 0) {
    console.info(
      '[lessonDelivery] lesson parent delivery had no active recipients',
      lessonPlanId,
    )
  }

  // assessmentHook remains stored in lesson_plans.body. No learner score is
  // created here because assessment evidence must come from actual teaching.
  await updateLessonPlanStatus({
    lessonPlanId,
    status: 'shared_to_parents',
  })
}
