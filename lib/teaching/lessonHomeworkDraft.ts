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
  | { outcome: 'preserved_existing'; homeworkId: string; questionsCreated: number }

interface HomeworkIdRow { id: string }
interface HomeworkQuestionOrderRow { order_num: number }

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

/**
 * Repair-safe child synchronization for lesson-owned homework.
 *
 * Homework creation can succeed before its generated question insert fails.
 * Retrying must therefore fill only missing generated positions and preserve any
 * already-existing teacher work. The database unique index on
 * (homework_id, order_num) makes concurrent retries safe as well.
 */
async function ensureSuggestedQuestions(
  homeworkId: string,
  suggestedQuestions: string[],
): Promise<number> {
  if (suggestedQuestions.length === 0) return 0

  const db = getSupabaseClient()
  const existingResult = await db
    .from('homework_questions')
    .select('order_num')
    .eq('homework_id', homeworkId)

  if (existingResult.error) throw existingResult.error

  const existingOrders = new Set(
    ((existingResult.data ?? []) as HomeworkQuestionOrderRow[])
      .map(row => row.order_num),
  )

  const missingRows = suggestedQuestions.flatMap((question, index) => {
    const orderNum = index + 1
    return existingOrders.has(orderNum)
      ? []
      : [{ homework_id: homeworkId, question, order_num: orderNum }]
  })

  if (missingRows.length === 0) return 0

  const insertResult = await db
    .from('homework_questions')
    .upsert(missingRows, {
      onConflict: 'homework_id,order_num',
      ignoreDuplicates: true,
    })

  if (insertResult.error) throw insertResult.error
  return missingRows.length
}

export async function ensureLessonHomeworkDraft(input: EnsureLessonHomeworkDraftInput): Promise<EnsureLessonHomeworkDraftResult> {
  const db = getSupabaseClient()
  const lessonPlanId = requireText(input.lessonPlanId, 'lessonPlanId')
  const teacherId = requireText(input.teacherId, 'teacherId')
  const schoolId = requireText(input.schoolId, 'schoolId')
  const title = requireText(input.title, 'title')
  const instructions = requireText(input.instructions, 'instructions')
  const suggestedDueDate = requireText(input.suggestedDueDate, 'suggestedDueDate')
  const suggestedQuestions = extractSuggestedQuestions(instructions)

  const existingResult = await db.from('homework').select('id').eq('lesson_plan_id', lessonPlanId).maybeSingle()
  if (existingResult.error) throw existingResult.error
  const existing = existingResult.data as HomeworkIdRow | null
  if (existing?.id) {
    const questionsCreated = await ensureSuggestedQuestions(existing.id, suggestedQuestions)
    return {
      outcome: 'preserved_existing',
      homeworkId: existing.id,
      questionsCreated,
    }
  }

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
      const questionsCreated = await ensureSuggestedQuestions(raced.id, suggestedQuestions)
      return {
        outcome: 'preserved_existing',
        homeworkId: raced.id,
        questionsCreated,
      }
    }
    throw insertResult.error
  }

  const created = insertResult.data as HomeworkIdRow
  const questionsCreated = await ensureSuggestedQuestions(created.id, suggestedQuestions)
  return { outcome: 'created', homeworkId: created.id, questionsCreated }
}
