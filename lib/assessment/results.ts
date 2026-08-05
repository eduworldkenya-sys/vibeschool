import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'

export interface LearnerResultSummary {
  attemptId: string
  title: string
  assessmentType: string
  score: number
  maxScore: number
  percentage: number
  feedback: string | null
  submittedAt: string | null
  releasedAt: string | null
  attemptNumber: number
}

export interface LearnerResultItem {
  assessmentItemId: string
  orderNum: number
  questionType: string
  prompt: string
  responseText: string | null
  responseValue: Json
  finalScore: number
  maxScore: number
  teacherFeedback: string | null
  explanation: string | null
  workedSolution: string | null
  correctAnswer: Json
}

export interface LearnerResultDetail extends LearnerResultSummary {
  canRetry: boolean
  items: LearnerResultItem[]
}

type RpcResult<T> = { data: T | null; error: { message?: string } | null }
type Rpc = <T>(name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult<T>>
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc

function rec(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Results Engine returned an invalid payload.')
  }
  return value as Record<string, unknown>
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function num(value: unknown): number {
  const resolved = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(resolved)) throw new Error('Results Engine returned an invalid score.')
  return resolved
}

export async function listMyResults(): Promise<LearnerResultSummary[]> {
  const { data, error } = await rpc<Json>('exq_list_my_results')
  if (error) throw new Error(error.message || 'Could not load results.')
  const payload = rec(data)
  const results = Array.isArray(payload.results) ? payload.results : []

  return results.map(value => {
    const item = rec(value)
    const attemptId = str(item.attempt_id)
    const title = str(item.title)
    if (!attemptId || !title) throw new Error('Results Engine returned incomplete result data.')
    return {
      attemptId,
      title,
      assessmentType: str(item.assessment_type) ?? 'assessment',
      score: num(item.score),
      maxScore: num(item.max_score),
      percentage: num(item.percentage),
      feedback: str(item.feedback),
      submittedAt: str(item.submitted_at),
      releasedAt: str(item.released_at),
      attemptNumber: num(item.attempt_number),
    }
  })
}

export async function getMyResult(attemptId: string): Promise<LearnerResultDetail> {
  const { data, error } = await rpc<Json>('exq_get_my_result', { p_attempt_id: attemptId })
  if (error) throw new Error(error.message || 'Could not load result details.')
  const payload = rec(data)
  const items = Array.isArray(payload.items) ? payload.items : []
  const title = str(payload.title)
  if (!title) throw new Error('Results Engine returned incomplete result details.')

  return {
    attemptId: str(payload.attempt_id) ?? attemptId,
    title,
    assessmentType: str(payload.assessment_type) ?? 'assessment',
    score: num(payload.score),
    maxScore: num(payload.max_score),
    percentage: num(payload.percentage),
    feedback: str(payload.feedback),
    submittedAt: str(payload.submitted_at),
    releasedAt: str(payload.released_at),
    attemptNumber: num(payload.attempt_number),
    canRetry: payload.can_retry === true,
    items: items.map(value => {
      const item = rec(value)
      return {
        assessmentItemId: str(item.assessment_item_id) ?? '',
        orderNum: num(item.order_num),
        questionType: str(item.question_type) ?? 'response',
        prompt: str(item.prompt) ?? '',
        responseText: str(item.response_text),
        responseValue: (item.response_value ?? null) as Json,
        finalScore: num(item.final_score),
        maxScore: num(item.max_score),
        teacherFeedback: str(item.teacher_feedback),
        explanation: str(item.explanation),
        workedSolution: str(item.worked_solution),
        correctAnswer: (item.correct_answer ?? null) as Json,
      }
    }),
  }
}
