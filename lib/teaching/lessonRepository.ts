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
}

interface TimetableWriteAuthority {
  id: string
  school_id: string
  teacher_id: string
  class_id: string
  subject_id: string
  day_of_week: number
  effective_from: string
  effective_until: string | null
}

function isoDayOfWeek(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const [year, month, day] = date.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (Number.isNaN(parsed.getTime())) return null
  const jsDay = parsed.getUTCDay()
  return jsDay === 0 ? 7 : jsDay
}

async function resolveWriteAuthority(
  payload: SaveGeneratedLessonPlanInput['payload'],
): Promise<TimetableWriteAuthority> {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!user || user.id !== payload.teacher_id) {
    throw new Error('lessonRepository: authenticated teacher does not match lesson-plan teacher.')
  }

  const { data, error } = await supabase
    .from('timetable_slots')
    .select('id,school_id,teacher_id,class_id,subject_id,day_of_week,effective_from,effective_until')
    .eq('id', payload.timetable_slot_id)
    .maybeSingle()

  if (error) throw error
  if (!data) {
    throw new Error('lessonRepository: timetable occurrence no longer exists.')
  }

  const slot = data as TimetableWriteAuthority
  const dayOfWeek = isoDayOfWeek(payload.taught_date)
  const occurrenceMatches =
    slot.teacher_id === user.id &&
    slot.class_id === payload.class_id &&
    slot.subject_id === payload.subject_id &&
    slot.day_of_week === payload.day_of_week &&
    dayOfWeek === slot.day_of_week &&
    slot.effective_from <= payload.taught_date &&
    (slot.effective_until === null || slot.effective_until >= payload.taught_date)

  if (!occurrenceMatches) {
    throw new Error('lessonRepository: lesson-plan occurrence does not match the authoritative timetable assignment.')
  }

  return slot
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
      'id, title, body, topic, status, curriculum_id, strand_id, scheme_id',
    )
    .eq('teacher_id', teacherId)
    .eq('timetable_slot_id', timetableSlotId)
    .eq('taught_date', taughtDate)
    .maybeSingle()

  if (error) throw error
  return data as ExistingLessonPlan | null
}

/**
 * Inserts or updates one exact timetable occurrence. The timetable slot is the
 * write authority for school/teacher/class/subject/date identity; client state
 * cannot move a plan to another assignment. The persisted source identity is
 * then checked again before success is reported.
 */
export async function saveGeneratedLessonPlan({
  planId,
  payload,
  expectedIdentity,
}: SaveGeneratedLessonPlanInput): Promise<SavedLessonPlanIdentity> {
  const slot = await resolveWriteAuthority(payload)
  const authoritativePayload = {
    ...payload,
    school_id: slot.school_id,
    teacher_id: slot.teacher_id,
    class_id: slot.class_id,
    subject_id: slot.subject_id,
    day_of_week: slot.day_of_week,
  }

  const selectColumns =
    'id,curriculum_id,strand_id,scheme_id,school_id,teacher_id,class_id,subject_id,timetable_slot_id,taught_date'

  const writeResult = planId
    ? await supabase
        .from('lesson_plans')
        .update(authoritativePayload)
        .eq('id', planId)
        .eq('teacher_id', slot.teacher_id)
        .eq('timetable_slot_id', slot.id)
        .eq('taught_date', payload.taught_date)
        .select(selectColumns)
        .single()
    : await supabase
        .from('lesson_plans')
        .insert(authoritativePayload)
        .select(selectColumns)
        .single()

  if (writeResult.error) throw writeResult.error
  if (!writeResult.data) {
    throw new Error('lessonRepository: lesson-plan persistence returned no row.')
  }

  const saved = writeResult.data
  const occurrenceMatches =
    saved.school_id === slot.school_id &&
    saved.teacher_id === slot.teacher_id &&
    saved.class_id === slot.class_id &&
    saved.subject_id === slot.subject_id &&
    saved.timetable_slot_id === slot.id &&
    saved.taught_date === payload.taught_date

  if (!occurrenceMatches) {
    throw new Error('lessonRepository: persisted occurrence identity changed during save.')
  }

  const identityMatches =
    (saved.curriculum_id ?? null) === expectedIdentity.curriculumId &&
    (saved.strand_id ?? null) === expectedIdentity.strandId &&
    (saved.scheme_id ?? null) === expectedIdentity.schemeId

  if (!identityMatches) {
    throw new Error('lessonRepository: saved curriculum identity did not match the selected source.')
  }

  return {
    id: saved.id,
    curriculum_id: saved.curriculum_id ?? null,
    strand_id: saved.strand_id ?? null,
    scheme_id: saved.scheme_id ?? null,
  }
}

/** Updates teacher-edited text without changing source or occurrence identity. */
export async function updateLessonPlanBody({
  lessonPlanId,
  body,
  title,
}: {
  lessonPlanId: string
  body: string
  title: string
}): Promise<void> {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!user) throw new Error('lessonRepository: not authenticated.')

  const { data, error } = await supabase
    .from('lesson_plans')
    .update({
      body,
      title,
      updated_at: new Date().toISOString(),
    })
    .eq('id', lessonPlanId)
    .eq('teacher_id', user.id)
    .select('id')
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('lessonRepository: lesson plan was not found for this teacher.')
}

/** Changes only the publication state of an owned lesson plan. */
export async function updateLessonPlanStatus({
  lessonPlanId,
  status,
}: {
  lessonPlanId: string
  status: LessonPlanStatus
}): Promise<void> {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!user) throw new Error('lessonRepository: not authenticated.')

  const { data, error } = await supabase
    .from('lesson_plans')
    .update({ status })
    .eq('id', lessonPlanId)
    .eq('teacher_id', user.id)
    .select('id')
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('lessonRepository: lesson plan was not found for this teacher.')
}
