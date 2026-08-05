import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'

export interface BuilderItemDetail {
  id: string
  assessmentId: string
  sectionId: string | null
  questionType: string
  prompt: string
  options: Json
  acceptedAnswers: Json
  correctAnswer: Json
  markingGuide: Json
  workedSolution: string | null
  explanation: string | null
  hint: string | null
  teacherNotes: string | null
  marks: number
  difficulty: string | null
  bloomLevel: string | null
  autoMarkingMode: string
  orderNum: number
  status: string
}

export interface AssessmentValidationIssue {
  code: string
  message: string
  unlinkedCount?: number
}

export interface AssessmentValidationResult {
  assessmentId: string
  valid: boolean
  issues: AssessmentValidationIssue[]
  itemCount: number
  totalMarks: number
}

type RpcResult<T> = { data: T | null; error: { message?: string } | null }
type Rpc = <T>(name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult<T>>
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Assessment Authoring returned an invalid payload.')
  }
  return value as Record<string, unknown>
}

function text(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function numberValue(value: unknown): number {
  const resolved = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(resolved)) throw new Error('Assessment Authoring returned an invalid number.')
  return resolved
}

export async function getBuilderItem(itemId: string): Promise<BuilderItemDetail> {
  const { data, error } = await rpc<Json>('exq_get_builder_item', {
    p_assessment_item_id: itemId,
  })
  if (error) throw new Error(error.message || 'Could not load question.')
  const payload = record(data)
  const item = record(payload.item)
  return {
    id: text(item.id) ?? itemId,
    assessmentId: text(item.assessment_id) ?? '',
    sectionId: text(item.section_id),
    questionType: text(item.question_type) ?? 'short_answer',
    prompt: text(item.prompt) ?? '',
    options: (item.options ?? []) as Json,
    acceptedAnswers: (item.accepted_answers ?? []) as Json,
    correctAnswer: (item.correct_answer ?? null) as Json,
    markingGuide: (item.marking_guide ?? {}) as Json,
    workedSolution: text(item.worked_solution),
    explanation: text(item.explanation),
    hint: text(item.hint),
    teacherNotes: text(item.teacher_notes),
    marks: numberValue(item.marks),
    difficulty: text(item.difficulty),
    bloomLevel: text(item.bloom_level),
    autoMarkingMode: text(item.auto_marking_mode) ?? 'none',
    orderNum: numberValue(item.order_num),
    status: text(item.status) ?? 'draft',
  }
}

export async function updateBuilderItem(input: {
  itemId: string
  questionType: string
  prompt: string
  marks: number
  options?: Json
  acceptedAnswers?: Json
  correctAnswer?: Json
  markingGuide?: Json
  autoMarkingMode?: string
  difficulty?: string | null
  bloomLevel?: string | null
  explanation?: string | null
  hint?: string | null
  workedSolution?: string | null
  teacherNotes?: string | null
}): Promise<void> {
  const { error } = await rpc<Json>('exq_update_draft_item', {
    p_assessment_item_id: input.itemId,
    p_question_type: input.questionType,
    p_prompt: input.prompt,
    p_marks: input.marks,
    p_options: input.options ?? [],
    p_accepted_answers: input.acceptedAnswers ?? [],
    p_correct_answer: input.correctAnswer ?? null,
    p_marking_guide: input.markingGuide ?? {},
    p_auto_marking_mode: input.autoMarkingMode ?? 'none',
    p_difficulty: input.difficulty ?? null,
    p_bloom_level: input.bloomLevel ?? null,
    p_explanation: input.explanation ?? null,
    p_hint: input.hint ?? null,
    p_worked_solution: input.workedSolution ?? null,
    p_teacher_notes: input.teacherNotes ?? null,
  })
  if (error) throw new Error(error.message || 'Question could not be saved.')
}

export async function validateAssessment(assessmentId: string): Promise<AssessmentValidationResult> {
  const { data, error } = await rpc<Json>('exq_validate_assessment', {
    p_assessment_id: assessmentId,
  })
  if (error) throw new Error(error.message || 'Assessment could not be validated.')
  const payload = record(data)
  const issues = Array.isArray(payload.issues) ? payload.issues : []
  return {
    assessmentId: text(payload.assessment_id) ?? assessmentId,
    valid: payload.valid === true,
    issues: issues.map(value => {
      const item = record(value)
      return {
        code: text(item.code) ?? 'validation_error',
        message: text(item.message) ?? 'Assessment validation failed.',
        unlinkedCount: item.unlinked_count === undefined ? undefined : numberValue(item.unlinked_count),
      }
    }),
    itemCount: numberValue(payload.item_count ?? 0),
    totalMarks: numberValue(payload.total_marks ?? 0),
  }
}

export async function publishAssessment(assessmentId: string): Promise<void> {
  const { error } = await rpc<Json>('exq_publish_assessment', {
    p_assessment_id: assessmentId,
  })
  if (error) throw new Error(error.message || 'Assessment could not be published.')
}
