import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'
import { parseSelfReviewItems, type SelfReviewItem, type SavedSelfReview } from './self-review-criteria'
export type { SelfReviewCriterion, SelfReviewItem, SavedSelfReview } from './self-review-criteria'
export { parseSelfReviewItems } from './self-review-criteria'

type RpcResult<T> = { data: T | null; error: { message?: string } | null }
type Rpc = <T>(name: string, args: Record<string, unknown>) => PromiseLike<RpcResult<T>>
const rpc = supabase.rpc.bind(supabase) as Rpc

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null
}

export async function getMySelfReview(attemptId: string): Promise<SelfReviewItem[]> {
  const { data, error } = await rpc<Json>('exq_get_my_self_review', { p_attempt_id: attemptId })
  if (error) throw new Error(error.message || 'Self-review is not available.')
  return parseSelfReviewItems(data)
}

export async function saveMySelfReview(input: {
  attemptId: string
  assessmentItemId: string
  selectedIds: string[]
  unsure: boolean
}): Promise<SavedSelfReview> {
  const { data, error } = await rpc<Json>('exq_set_my_self_review', {
    p_attempt_id: input.attemptId,
    p_assessment_item_id: input.assessmentItemId,
    p_selected_ids: input.selectedIds,
    p_unsure: input.unsure,
  })
  if (error) throw new Error(error.message || 'Your self-review could not be saved.')
  const payload = record(data)
  if (!payload || payload.ok !== true
    || payload.assessment_item_id !== input.assessmentItemId
    || payload.score_authority !== 'learner_self_assessed_not_verified') {
    throw new Error('Self-review save returned an invalid receipt.')
  }
  return {
    assessmentItemId: payload.assessment_item_id as string,
    selfReviewScore: typeof payload.self_review_score === 'number'
      ? payload.self_review_score : null,
    selectedIds: Array.isArray(payload.selected_ids)
      ? payload.selected_ids.filter((id): id is string => typeof id === 'string') : [],
    unsure: payload.unsure === true,
    maxScore: Number(payload.max_score),
    scoreAuthority: 'learner_self_assessed_not_verified',
  }
}


export interface ImmediatePracticeReviewItem {
  assessmentItemId: string
  orderNum: number
  prompt: string
  questionType: string
  responseText: string | null
  responseValue: Json
  autoScore: number | null
  maxScore: number
  correctAnswer: Json
  explanation: string | null
  workedSolution: string | null
}
export interface ImmediatePracticeReview {
  attemptId: string
  title: string
  verifiedScore: number
  verifiedMax: number
  writtenMax: number
  items: ImmediatePracticeReviewItem[]
  reviews: SelfReviewItem[]
}

function finiteNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error('Practice review returned an invalid score.')
  }
  return value
}

export async function getMyPracticeReview(attemptId: string): Promise<ImmediatePracticeReview> {
  const { data, error } = await rpc<Json>('exq_get_my_practice_self_review', { p_attempt_id: attemptId })
  if (error) throw new Error(error.message || 'Practice review is not available.')
  const value = record(data)
  if (!value || value.ok !== true || value.assessment_type !== 'practice'
    || value.score_authority !== 'mixed_auto_and_self_assessed'
    || value.attempt_id !== attemptId || typeof value.title !== 'string'
    || !Array.isArray(value.items) || !Array.isArray(value.reviews)) {
    throw new Error('Practice review returned an invalid response.')
  }
  const items = value.items.map(raw => {
    const item = record(raw)
    if (!item || typeof item.assessment_item_id !== 'string'
      || typeof item.order_num !== 'number' || typeof item.prompt !== 'string'
      || typeof item.question_type !== 'string') {
      throw new Error('Practice review contains an invalid question.')
    }
    return {
      assessmentItemId: item.assessment_item_id,
      orderNum: item.order_num,
      prompt: item.prompt,
      questionType: item.question_type,
      responseText: typeof item.response_text === 'string' ? item.response_text : null,
      responseValue: (item.response_value ?? null) as Json,
      autoScore: typeof item.auto_score === 'number' ? finiteNumber(item.auto_score) : null,
      maxScore: finiteNumber(item.max_score),
      correctAnswer: (item.correct_answer ?? null) as Json,
      explanation: typeof item.explanation === 'string' ? item.explanation : null,
      workedSolution: typeof item.worked_solution === 'string' ? item.worked_solution : null,
    } satisfies ImmediatePracticeReviewItem
  })
  return {
    attemptId,
    title: value.title,
    verifiedScore: finiteNumber(value.verified_score),
    verifiedMax: finiteNumber(value.verified_max),
    writtenMax: finiteNumber(value.written_max),
    items,
    reviews: parseSelfReviewItems({ ok: true, items: value.reviews }),
  }
}
