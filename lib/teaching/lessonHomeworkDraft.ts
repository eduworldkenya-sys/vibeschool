import { getSupabaseClient } from '@/lib/supabase'

export interface ContentProvenanceInput {
  sourcePublicationId?: string | null
  sourceChapterId?: string | null
  sourceResourceId?: string | null
  sourceBlockId?: string | null
  sourceOutcomeId?: string | null
}

export interface EnsureLessonHomeworkDraftInput extends ContentProvenanceInput {
  lessonPlanId: string
  classId: string | null
  teacherId: string
  schoolId: string
  subject: string
  title: string
  instructions: string
  suggestedDueDate: string
}

export type EnsureLessonHomeworkDraftResult =
  | { outcome: 'created'; homeworkId: string; questionsCreated: number }
  | { outcome: 'preserved_existing'; homeworkId: string; questionsCreated: 0 }

interface HomeworkIdRow { id: string }

function requireText(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized) throw new Error(`ensureLessonHomeworkDraft: ${field} is required.`)
  return normalized
}

function optionalId(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function extractSuggestedQuestions(instructions: string): string[] {
  const seen = new Set<string>()
  return instructions
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.endsWith('?') || /^\d+[.)]\s*/.test(line))
    .map(line => line.replace(/^\d+[.)]\s*/, '').trim())
    .filter(line => {
      if (!line || seen.has(line)) return false
      seen.add(line)
      return true
    })
    .slice(0, 5)
}

export async function ensureLessonHomeworkDraft(input: EnsureLessonHomeworkDraftInput): Promise<EnsureLessonHomeworkDraftResult> {
  const db = getSupabaseClient()
  const lessonPlanId = requireText(input.lessonPlanId, 'lessonPlanId')
  const teacherId = requireText(input.teacherId, 'teacherId')
  const schoolId = requireText(input.schoolId, 'schoolId')
  const title = requireText(input.title, 'title')
  const instructions = requireText(input.instructions, 'instructions')
  const suggestedDueDate = requireText(input.suggestedDueDate, 'suggestedDueDate')

  const existingResult = await db.from('homework').select('id').eq('lesson_plan_id', lessonPlanId).maybeSingle()
  if (existingResult.error) throw existingResult.error
  const existing = existingResult.data as HomeworkIdRow | null
  if (existing?.id) return { outcome: 'preserved_existing', homeworkId: existing.id, questionsCreated: 0 }

  const homeworkPayload = {
    class_id: input.classId,
    teacher_id: teacherId,
    school_id: schoolId,
    lesson_plan_id: lessonPlanId,
    title,
    subject: input.subject.trim(),
    instructions,
    type: 'written',
    due_date: suggestedDueDate,
    source_publication_id: optionalId(input.sourcePublicationId),
    source_chapter_id: optionalId(input.sourceChapterId),
    source_resource_id: optionalId(input.sourceResourceId),
    source_block_id: optionalId(input.sourceBlockId),
    source_outcome_id: optionalId(input.sourceOutcomeId),
  }

  const insertResult = await db
    .from('homework')
    .insert(homeworkPayload)
    .select('id')
    .single()

  if (insertResult.error) {
    if (insertResult.error.code === '23505') {
      const racedResult = await db.from('homework').select('id').eq('lesson_plan_id', lessonPlanId).single()
      if (racedResult.error) throw racedResult.error
      const raced = racedResult.data as HomeworkIdRow
      return { outcome: 'preserved_existing', homeworkId: raced.id, questionsCreated: 0 }
    }
    throw insertResult.error
  }

  const created = insertResult.data as HomeworkIdRow
  const suggestedQuestions = extractSuggestedQuestions(instructions)
  if (suggestedQuestions.length > 0) {
    const questionsResult = await db.from('homework_questions').insert(suggestedQuestions.map((question, index) => ({ homework_id: created.id, question, order_num: index + 1 })))
    if (questionsResult.error) throw questionsResult.error
  }
  return { outcome: 'created', homeworkId: created.id, questionsCreated: suggestedQuestions.length }
}