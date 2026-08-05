import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'

type RpcError = { message?: string }
type RpcResult<T> = { data: T | null; error: RpcError | null }
type AssessmentRpc = <T>(
  functionName: string,
  args: Record<string, unknown>,
) => PromiseLike<RpcResult<T>>

const rpc = supabase.rpc.bind(supabase) as unknown as AssessmentRpc

function rpcFailure(action: string, error: RpcError | null): Error {
  return new Error(error?.message || `Lesson assessment ${action} failed.`)
}

export async function completeLessonAssessmentGeneration(input: {
  assessmentId: string
  itemCount: number
  totalMarks: number
  estimatedMinutes?: number | null
  generationMetadata?: Json
}): Promise<void> {
  const { error } = await rpc<Json>('exq_complete_lesson_assessment_generation', {
    p_assessment_id: input.assessmentId,
    p_item_count: input.itemCount,
    p_total_marks: input.totalMarks,
    p_estimated_minutes: input.estimatedMinutes ?? null,
    p_generation_metadata: input.generationMetadata ?? {},
  })

  if (error) throw rpcFailure('completion', error)
}

export async function failLessonAssessmentGeneration(input: {
  assessmentId: string
  errorCode: string
  errorMessage?: string | null
}): Promise<void> {
  const { error } = await rpc<Json>('exq_fail_lesson_assessment_generation', {
    p_assessment_id: input.assessmentId,
    p_error_code: input.errorCode,
    p_error_message: input.errorMessage ?? null,
  })

  if (error) throw rpcFailure('failure recording', error)
}
