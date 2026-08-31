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
  generated_by: string | null
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
  }
  expectedIdentity: LessonPlanSourceIdentity
}

export interface SavedLessonPlanIdentity {
  id: string
  curriculum_id: string | null
  strand_id: string | null
  scheme_id: string | null
  generated_by: string | null
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
      'id, title, body, topic, status, curriculum_id, strand_id, scheme_id, generated_by',
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
 * Persists the normal Lesson Workspace builder as deterministic provenance.
 * The current caller never invokes a model provider; historical/explicit AI
 * paths do not use this repository seam and retain their own provenance.
 */
export async function saveGeneratedLessonPlan({
  planId,
  payload,
  expectedIdentity,
}: SaveGeneratedLessonPlanInput): Promise<SavedLessonPlanIdentity> {
  const deterministicPayload = {
    ...payload,
    generated_by: 'deterministic',
  }

  const writeResult = planId
    ? await supabase
        .from('lesson_plans')
        .update(deterministicPayload)
        .eq('id', planId)
        .select(
          'id, curriculum_id, strand_id, scheme_id, generated_by',
        )
        .single()
    : await supabase
        .from('lesson_plans')
        .insert(deterministicPayload)
        .select(
          'id, curriculum_id, strand_id, scheme_id, generated_by',
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
    (saved.curriculum_id ?? null) === expectedIdentity.curriculumId &&
    (saved.strand_id ?? null) === expectedIdentity.strandId &&
    (saved.scheme_id ?? null) === expectedIdentity.schemeId

  if (!identityMatches) {
    throw new Error(
      'lessonRepository: saved curriculum identity did not match the selected source.',
    )
  }

  if (saved.generated_by !== 'deterministic') {
    throw new Error(
      'lessonRepository: deterministic lesson provenance was not persisted.',
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
