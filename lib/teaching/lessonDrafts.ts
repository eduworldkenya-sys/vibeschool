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
    .select('id,school_id,teacher_id,class_id,subject_id,scheme_id,curriculum_id,strand_id,title,topic,body,duration_minutes,status,created_at,updated_at')
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
    .select('id,school_id,teacher_id,class_id,subject_id,scheme_id,curriculum_id,strand_id,title,topic,body,duration_minutes,status,created_at,updated_at')
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
