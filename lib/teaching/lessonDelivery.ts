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
import type {
  LessonPlanSections,
} from '@/lib/teaching/lessonPlanCodec'
import type {
  LessonContextStudent,
} from '@/lib/teaching/lessonContext'
import {
  evaluateLessonReadiness,
} from '@/lib/teaching/lessonReadiness'

export type LessonDeliveryErrorCode =
  | 'authority_mismatch'
  | 'not_ready'
  | 'no_parent_recipients'
  | 'publish_failed'
  | 'parent_delivery_failed'

export class LessonDeliveryError extends Error {
  readonly code: LessonDeliveryErrorCode
  readonly reasons: string[]
  readonly cause?: unknown

  constructor(
    code: LessonDeliveryErrorCode,
    message: string,
    options?: { reasons?: string[]; cause?: unknown },
  ) {
    super(message)
    this.name = 'LessonDeliveryError'
    this.code = code
    this.reasons = options?.reasons ?? []
    this.cause = options?.cause
  }
}

export interface PublishLessonToStudentsInput {
  lessonPlanId: string
  schoolId: string
  topic: string
  subject: string
  teacherName: string
  students: LessonContextStudent[]
}

export interface PublishLessonResult {
  lessonPlanId: string
  published: true
  recipientCount: number
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

export interface ShareLessonResult {
  lessonPlanId: string
  shared: true
  recipientCount: number
  insertedCount: number
  updatedCount: number
  homeworkOutcome: 'not_required' | 'created_or_preserved'
  exerciseOutcome: 'not_required' | 'created_or_preserved'
}

interface RawPublishLessonResult {
  lesson_plan_id?: unknown
  published?: unknown
  recipient_count?: unknown
}

function requireCount(value: unknown, field: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    throw new LessonDeliveryError(
      'publish_failed',
      `Lesson delivery returned an invalid ${field}.`,
    )
  }
  return value
}

export function lessonDeliveryErrorMessage(error: unknown): string {
  if (!(error instanceof LessonDeliveryError)) {
    return 'The lesson could not be delivered. Please try again.'
  }

  if (error.code === 'not_ready') {
    const details = error.reasons.slice(0, 4).join(' ')
    return details
      ? `This lesson is still a draft. ${details}`
      : 'This lesson is still a draft and is not ready to deliver.'
  }

  if (error.code === 'authority_mismatch') {
    return 'This lesson no longer matches your current school or teaching assignment. Reopen it from the timetable.'
  }

  if (error.code === 'no_parent_recipients') {
    return 'No active parent recipients are linked to this class yet. Nothing was marked as shared.'
  }

  return error.message
}

async function assertLessonReadyForDelivery(
  lessonPlanId: string,
  expectedSchoolId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('lesson_plans')
    .select('id,school_id,body')
    .eq('id', lessonPlanId)
    .single()

  if (error) throw error
  if (!data || data.school_id !== expectedSchoolId) {
    throw new LessonDeliveryError(
      'authority_mismatch',
      'Lesson delivery authority no longer matches this school.',
    )
  }

  const readiness = evaluateLessonReadiness(data.body ?? '')
  if (!readiness.ready) {
    throw new LessonDeliveryError(
      'not_ready',
      'Lesson plan is not ready for delivery.',
      { reasons: readiness.reasons },
    )
  }
}

/**
 * Atomically publishes the lesson and writes learner notifications in the
 * database. The client-provided students collection is intentionally not used
 * as authority; the RPC resolves current enrollment from student_classes.
 * recipientCount describes linked learner profiles notified by this publish.
 */
export async function publishLessonToStudents({
  lessonPlanId,
  schoolId,
  topic,
  subject,
  teacherName,
}: PublishLessonToStudentsInput): Promise<PublishLessonResult> {
  await assertLessonReadyForDelivery(lessonPlanId, schoolId)

  const { data, error } = await supabase.rpc(
    'publish_lesson_plan_to_students',
    {
      p_lesson_plan_id: lessonPlanId,
      p_expected_school_id: schoolId,
      p_topic: topic,
      p_subject: subject,
      p_teacher_name: teacherName,
    },
  )

  if (error) {
    throw new LessonDeliveryError(
      'publish_failed',
      error.message || 'Publishing the lesson failed.',
      { cause: error },
    )
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new LessonDeliveryError(
      'publish_failed',
      'Publishing returned an invalid result.',
    )
  }

  const raw = data as RawPublishLessonResult
  if (raw.lesson_plan_id !== lessonPlanId || raw.published !== true) {
    throw new LessonDeliveryError(
      'publish_failed',
      'Publishing returned the wrong lesson identity.',
    )
  }

  return {
    lessonPlanId,
    published: true,
    recipientCount: requireCount(raw.recipient_count, 'recipient_count'),
  }
}

/**
 * Prepares lesson-owned downstream work first, then performs canonical parent
 * delivery. Homework/exercise draft creation is idempotent and preserves
 * teacher edits. The database only stamps parent sharing when at least one
 * active recipient is materialized, so zero recipients can never masquerade
 * as a successful share.
 */
export async function shareLessonToParents({
  lessonPlanId,
  classId,
  teacherId,
  schoolId,
  subject,
  topic,
  sections,
}: ShareLessonToParentsInput): Promise<ShareLessonResult> {
  await assertLessonReadyForDelivery(lessonPlanId, schoolId)

  let homeworkOutcome: ShareLessonResult['homeworkOutcome'] = 'not_required'
  let exerciseOutcome: ShareLessonResult['exerciseOutcome'] = 'not_required'

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

    homeworkOutcome = 'created_or_preserved'

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

    exerciseOutcome = 'created_or_preserved'

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

  let deliveryResult
  try {
    deliveryResult = await deliverLessonPlanToParents({
      lessonPlanId,
      deliveryPurpose: 'lesson_summary',
      subject: subject + ' — Lesson: ' + topic,
      body: summary,
    })
  } catch (error) {
    throw new LessonDeliveryError(
      'parent_delivery_failed',
      error instanceof Error ? error.message : 'Parent lesson delivery failed.',
      { cause: error },
    )
  }

  if (deliveryResult.recipientCount === 0 || !deliveryResult.shared) {
    throw new LessonDeliveryError(
      'no_parent_recipients',
      'No active parent recipients are linked to this class.',
    )
  }

  return {
    lessonPlanId,
    shared: true,
    recipientCount: deliveryResult.recipientCount,
    insertedCount: deliveryResult.insertedCount,
    updatedCount: deliveryResult.updatedCount,
    homeworkOutcome,
    exerciseOutcome,
  }
}
