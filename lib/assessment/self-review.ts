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
