import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'

type RpcError = { message?: string }
type RpcResult<T> = { data: T | null; error: RpcError | null }
type AssessmentRpc = <T>(
  functionName: string,
  args: Record<string, unknown>,
) => PromiseLike<RpcResult<T>>

const rpc = supabase.rpc.bind(supabase) as unknown as AssessmentRpc

function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} returned an invalid payload.`)
  }
  return value as Record<string, unknown>
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} was not returned.`)
  }
  return value
}

function rpcFailure(action: string, error: RpcError | null): Error {
  return new Error(error?.message || `Question bank ${action} failed.`)
}

export async function promoteAssessmentItemToQuestionBank(input: {
  assessmentItemId: string
  learningOutcomeId?: string | null
  competencyTag?: string | null
}): Promise<{ questionId: string; created: boolean }> {
  const { data, error } = await rpc<Json>('exq_promote_assessment_item_to_question_bank', {
    p_assessment_item_id: input.assessmentItemId,
    p_learning_outcome_id: input.learningOutcomeId ?? null,
    p_competency_tag: input.competencyTag ?? null,
  })

  if (error) throw rpcFailure('promotion', error)
  const payload = record(data, 'Question bank promotion')

  return {
    questionId: text(payload.question_id, 'Question ID'),
    created: payload.created === true,
  }
}

export async function approveQuestionBankItem(
  questionId: string,
): Promise<void> {
  const { error } = await rpc<Json>('exq_approve_question_bank_item', {
    p_question_id: questionId,
  })

  if (error) throw rpcFailure('approval', error)
}

export async function addQuestionBankItemToAssessment(input: {
  questionId: string
  assessmentId: string
  orderNum: number
}): Promise<string> {
  const { data, error } = await rpc<Json>('exq_add_question_bank_item_to_assessment', {
    p_question_id: input.questionId,
    p_assessment_id: input.assessmentId,
    p_order_num: input.orderNum,
  })

  if (error) throw rpcFailure('reuse', error)
  const payload = record(data, 'Question bank reuse')
  return text(payload.assessment_item_id, 'Assessment item ID')
}
