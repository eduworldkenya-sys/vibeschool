import { supabase } from '@/lib/supabase'

export type LessonPlanStatus =
  | 'draft'
  | 'published'
  | 'shared_to_parents'

export interface LessonPlanSourceIdentity {
  curriculumId: string | null
  strandId: string | null
  schemeId: string | null
}

export interface ExistingLessonPlan {
  id: string
  title: string | null
  body: string | null
  topic: string | null
  status: LessonPlanStatus | null
  curriculum_id: string | null
  strand_id: string | null
  scheme_id: string | null
  previous_lesson_plan_id: string | null
}

export interface SaveGeneratedLessonPlanInput {
  planId: string | null
  payload: {
    teacher_id: string
    school_id: string | null
    class_id: string
    subject_id: string
    timetable_slot_id: string
    week_start: string
    day_of_week: number
    taught_date: string
    topic: string
    title: string
    body: string
    status: 'draft'
    generated_by: string
    curriculum_id: string | null
    strand_id: string | null
    scheme_id: string | null
    /**
     * Optional only during the migration window for older consumers. When the
     * caller omits it, persistence derives the exact predecessor from the last
     * completed teaching occurrence. A supplied value is still verified.
     */
    previous_lesson_plan_id?: string | null
  }
  expectedIdentity: LessonPlanSourceIdentity
}

export interface SavedLessonPlanIdentity {
  id: string
  curriculum_id: string | null
  strand_id: string | null
  scheme_id: string | null
}

type SavePayload = SaveGeneratedLessonPlanInput['payload']

async function resolvePreviousCompletedLessonPlanId(
  payload: SavePayload,
): Promise<string | null> {
  if (!payload.school_id) return null

  const { data: occurrence, error: occurrenceError } = await supabase
    .from('teaching_occurrences')
    .select('timetable_slot_id,occurrence_date,completed_at')
    .eq('teacher_id', payload.teacher_id)
    .eq('school_id', payload.school_id)
    .eq('class_id', payload.class_id)
    .eq('subject_id', payload.subject_id)
    .eq('lifecycle', 'completed')
    .lt('occurrence_date', payload.taught_date)
    .order('occurrence_date', { ascending: false })
    .order('completed_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (occurrenceError) throw occurrenceError
  if (!occurrence?.timetable_slot_id || !occurrence.occurrence_date) {
    return null
  }

  const { data: previousPlan, error: previousPlanError } = await supabase
    .from('lesson_plans')
    .select('id')
    .eq('teacher_id', payload.teacher_id)
    .eq('school_id', payload.school_id)
    .eq('class_id', payload.class_id)
    .eq('subject_id', payload.subject_id)
    .eq('timetable_slot_id', occurrence.timetable_slot_id)
    .eq('taught_date', occurrence.occurrence_date)
    .maybeSingle()

  if (previousPlanError) throw previousPlanError
  return previousPlan?.id ?? null
}

/**
 * Loads the canonical lesson plan for one exact timetable occurrence.
 *
 * Occurrence identity is always:
 *   timetable_slot_id + taught_date
 */
export async function loadLessonPlanForOccurrence({
  teacherId,
  timetableSlotId,
  taughtDate,
}: {
  teacherId: string
  timetableSlotId: string
  taughtDate: string
}): Promise<ExistingLessonPlan | null> {
  const { data, error } = await supabase
    .from('lesson_plans')
    .select(
      'id, title, body, topic, status, curriculum_id, strand_id, scheme_id, previous_lesson_plan_id',
    )
    .eq('teacher_id', teacherId)
    .eq('timetable_slot_id', timetableSlotId)
    .eq('taught_date', taughtDate)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data as ExistingLessonPlan | null
}

/**
 * Inserts or updates a generated plan and verifies both the educational source
 * identity and the previous-completed-lesson lineage before reporting success.
 */
export async function saveGeneratedLessonPlan({
  planId,
  payload,
  expectedIdentity,
}: SaveGeneratedLessonPlanInput): Promise<SavedLessonPlanIdentity> {
  const authoritativePreviousPlanId =
    await resolvePreviousCompletedLessonPlanId(payload)

  if (
    payload.previous_lesson_plan_id !== undefined &&
    payload.previous_lesson_plan_id !== authoritativePreviousPlanId
  ) {
    throw new Error(
      'lessonRepository: previous lesson lineage did not match completed teaching history.',
    )
  }

  const normalizedPayload = {
    ...payload,
    previous_lesson_plan_id: authoritativePreviousPlanId,
  }

  const writeResult = planId
    ? await supabase
        .from('lesson_plans')
        .update(normalizedPayload)
        .eq('id', planId)
        .select(
          'id, curriculum_id, strand_id, scheme_id, previous_lesson_plan_id',
        )
        .single()
    : await supabase
        .from('lesson_plans')
        .insert(normalizedPayload)
        .select(
          'id, curriculum_id, strand_id, scheme_id, previous_lesson_plan_id',
        )
        .single()

  if (writeResult.error) {
    throw writeResult.error
  }

  if (!writeResult.data) {
    throw new Error(
      'lessonRepository: lesson-plan persistence returned no row.',
    )
  }

  const saved = writeResult.data

  const identityMatches =
    (saved.curriculum_id ?? null) ===
      expectedIdentity.curriculumId &&
    (saved.strand_id ?? null) ===
      expectedIdentity.strandId &&
    (saved.scheme_id ?? null) ===
      expectedIdentity.schemeId

  if (!identityMatches) {
    throw new Error(
      'lessonRepository: saved curriculum identity did not match the selected source.',
    )
  }

  if (
    (saved.previous_lesson_plan_id ?? null) !==
    authoritativePreviousPlanId
  ) {
    throw new Error(
      'lessonRepository: saved previous lesson lineage did not match completed teaching history.',
    )
  }

  return saved
}

/**
 * Updates teacher-edited plan content without changing source or occurrence
 * identity.
 */
export async function updateLessonPlanBody({
  lessonPlanId,
  body,
  title,
}: {
  lessonPlanId: string
  body: string
  title: string
}): Promise<void> {
  const { error } = await supabase
    .from('lesson_plans')
    .update({
      body,
      title,
      updated_at: new Date().toISOString(),
    })
    .eq('id', lessonPlanId)

  if (error) {
    throw error
  }
}

/**
 * Changes only the publication state of an existing lesson plan.
 */
export async function updateLessonPlanStatus({
  lessonPlanId,
  status,
}: {
  lessonPlanId: string
  status: LessonPlanStatus
}): Promise<void> {
  const { error } = await supabase
    .from('lesson_plans')
    .update({ status })
    .eq('id', lessonPlanId)

  if (error) {
    throw error
  }
}
