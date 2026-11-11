import { supabase } from '@/lib/supabase'

export type LessonDraftStatus = 'draft' | 'ready' | 'archived'

export interface LessonPlanDraft {
  id: string
  school_id: string
  teacher_id: string
  class_id: string | null
  subject_id: string
  scheme_id: string | null
  curriculum_id: string | null
  strand_id: string | null
  curriculum_outcome_id: string | null
  title: string | null
  topic: string | null
  body: string | null
  duration_minutes: number | null
  status: LessonDraftStatus
  created_at: string
  updated_at: string
}

export interface SaveLessonPlanDraftInput {
  id?: string | null
  schoolId: string
  teacherId: string
  classId?: string | null
  subjectId: string
  title: string
  topic?: string
  body: string
  durationMinutes?: number | null
  schemeId?: string | null
  curriculumId?: string | null
  strandId?: string | null
  curriculumOutcomeId?: string | null
  status?: Exclude<LessonDraftStatus, 'archived'>
}

function assertNoError(error: { message?: string } | null, fallback: string) {
  if (error) throw new Error(error.message || fallback)
}

export async function loadLessonPlanDrafts(
  teacherId: string,
  schoolId: string,
): Promise<LessonPlanDraft[]> {
  const { data, error } = await supabase
    .from('lesson_plan_drafts')
    .select('id,school_id,teacher_id,class_id,subject_id,scheme_id,curriculum_id,strand_id,curriculum_outcome_id,title,topic,body,duration_minutes,status,created_at,updated_at')
    .eq('teacher_id', teacherId)
    .eq('school_id', schoolId)
    .neq('status', 'archived')
    .order('updated_at', { ascending: false })

  assertNoError(error, 'Could not load prepared lesson drafts.')
  return (data ?? []) as LessonPlanDraft[]
}

export async function saveLessonPlanDraft(
  input: SaveLessonPlanDraftInput,
): Promise<LessonPlanDraft> {
  const payload = {
    school_id: input.schoolId,
    teacher_id: input.teacherId,
    class_id: input.classId ?? null,
    subject_id: input.subjectId,
    scheme_id: input.schemeId ?? null,
    curriculum_id: input.curriculumId ?? null,
    strand_id: input.strandId ?? null,
    curriculum_outcome_id: input.curriculumOutcomeId ?? null,
    title: input.title.trim() || null,
    topic: input.topic?.trim() || null,
    body: input.body.trim() || null,
    duration_minutes: input.durationMinutes ?? null,
    status: input.status ?? 'draft',
    updated_at: new Date().toISOString(),
  }

  const query = input.id
    ? supabase
        .from('lesson_plan_drafts')
        .update(payload)
        .eq('id', input.id)
        .eq('teacher_id', input.teacherId)
    : supabase
        .from('lesson_plan_drafts')
        .insert(payload)

  const { data, error } = await query
    .select('id,school_id,teacher_id,class_id,subject_id,scheme_id,curriculum_id,strand_id,curriculum_outcome_id,title,topic,body,duration_minutes,status,created_at,updated_at')
    .single()

  assertNoError(error, 'Could not save prepared lesson draft.')
  if (!data) throw new Error('Prepared lesson draft was not returned after save.')
  return data as LessonPlanDraft
}

export async function archiveLessonPlanDraft(
  draftId: string,
  teacherId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('lesson_plan_drafts')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', draftId)
    .eq('teacher_id', teacherId)
    .select('id')
    .maybeSingle()

  assertNoError(error, 'Could not archive prepared lesson draft.')
  if (!data) throw new Error('Prepared lesson draft was not found.')
}

export async function attachLessonPlanDraftToOccurrence(input: {
  draftId: string
  timetableSlotId: string
  taughtDate: string
}): Promise<string> {
  const { data, error } = await supabase.rpc(
    'attach_lesson_plan_draft_to_occurrence',
    {
      p_draft_id: input.draftId,
      p_timetable_slot_id: input.timetableSlotId,
      p_taught_date: input.taughtDate,
    },
  )

  assertNoError(error, 'Could not attach the prepared lesson to this timetable lesson.')
  if (typeof data !== 'string' || !data) {
    throw new Error('Lesson attachment did not return a lesson plan id.')
  }
  return data
}


/**
 * Attach an unscheduled draft only when a scheduled occurrence has exactly
 * one Scheme match in its authoritative school term and instructional week.
 * No topic/title string matching, no cross-week guessing, no writes when
 * candidates are ambiguous. The database RPC rechecks scope and exact week.
 */
export async function attachMatchingPreparedDraftToOccurrence(input: {
  teacherId: string
  schoolId: string
  classId: string
  subjectId: string
  timetableSlotId: string
  taughtDate: string
}): Promise<string | null> {
  const drafts = (await loadLessonPlanDrafts(input.teacherId, input.schoolId))
    .filter(draft =>
      draft.class_id === input.classId &&
      draft.subject_id === input.subjectId &&
      Boolean(draft.scheme_id))
  if (drafts.length === 0) return null

  const { data: instructional, error: weekError } = await supabase.rpc(
    'resolve_instructional_week_for_date',
    { p_school_id: input.schoolId, p_date: input.taughtDate },
  )
  assertNoError(weekError, 'Could not determine the scheduled instructional week.')
  const week = Array.isArray(instructional) ? instructional[0] : null
  if (!week || typeof week.term_id !== 'string' || !Number.isInteger(week.week_number)) {
    return null
  }

  const { data: schemeRows, error: schemeError } = await supabase
    .from('scheme_of_work')
    .select('id,academic_term_id,week,teacher_id,school_id,class_id,subject_id,curriculum_outcome_id')
    .in('id', drafts.map(draft => draft.scheme_id as string))
    .eq('school_id', input.schoolId)
    .eq('teacher_id', input.teacherId)
    .eq('class_id', input.classId)
    .eq('subject_id', input.subjectId)
  assertNoError(schemeError, 'Could not confirm prepared Scheme identity.')

  const matchingIds = new Set((schemeRows ?? [])
    .filter(row =>
      row.academic_term_id === week.term_id &&
      row.week === week.week_number &&
      typeof row.curriculum_outcome_id === 'string')
    .map(row => row.id))
  const matchingDrafts = drafts.filter(draft =>
    draft.scheme_id !== null && matchingIds.has(draft.scheme_id))
  // A school week may contain several Scheme lessons for the same subject.
  // Do not arbitrarily attach a draft to the wrong period.
  if (matchingDrafts.length !== 1) return null

  return attachLessonPlanDraftToOccurrence({
    draftId: matchingDrafts[0].id,
    timetableSlotId: input.timetableSlotId,
    taughtDate: input.taughtDate,
  })
}
