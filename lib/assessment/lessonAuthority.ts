import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'

export type LessonAssessmentType =
  | 'exercise'
  | 'homework'
  | 'quiz'
  | 'test'
  | 'exam'

export type LessonAssessmentGenerationStatus =
  | 'not_requested'
  | 'queued'
  | 'generating'
  | 'generated'
  | 'failed'
  | 'cancelled'

export interface LessonAssessmentSummary {
  id: string
  assessmentType: LessonAssessmentType
  title: string
  status: string
  generationSource: string
  generationStatus: LessonAssessmentGenerationStatus
  generationRequestKey: string | null
  generationAttempt: number
  generationErrorCode: string | null
  totalMarks: number
  estimatedMinutes: number | null
  createdAt: string
  updatedAt: string
}

export interface LessonAssessmentList {
  lessonPlanId: string
  lessonStatus: string
  assessments: LessonAssessmentSummary[]
}

export interface RequestLessonAssessmentInput {
  lessonPlanId: string
  assessmentType: LessonAssessmentType
  requestKey: string
  title?: string | null
  generationMetadata?: Json
}

export interface RequestLessonAssessmentResult {
  created: boolean
  assessmentId: string
  status: string
  generationStatus: LessonAssessmentGenerationStatus
}

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

function numberValue(value: unknown, label: string): number {
  const resolved = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(resolved)) throw new Error(`${label} was not numeric.`)
  return resolved
}

function nullableText(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function rpcFailure(action: string, error: RpcError | null): Error {
  return new Error(error?.message || `Lesson assessment ${action} failed.`)
}

function parseSummary(value: unknown): LessonAssessmentSummary {
  const item = record(value, 'Lesson assessment')
  return {
    id: text(item.id, 'Assessment ID'),
    assessmentType: text(item.assessment_type, 'Assessment type') as LessonAssessmentType,
    title: text(item.title, 'Assessment title'),
    status: text(item.status, 'Assessment status'),
    generationSource: text(item.generation_source, 'Generation source'),
    generationStatus: text(item.generation_status, 'Generation status') as LessonAssessmentGenerationStatus,
    generationRequestKey: nullableText(item.generation_request_key),
    generationAttempt: numberValue(item.generation_attempt, 'Generation attempt'),
    generationErrorCode: nullableText(item.generation_error_code),
    totalMarks: numberValue(item.total_marks, 'Total marks'),
    estimatedMinutes:
      item.estimated_minutes === null || item.estimated_minutes === undefined
        ? null
        : numberValue(item.estimated_minutes, 'Estimated minutes'),
    createdAt: text(item.created_at, 'Created timestamp'),
    updatedAt: text(item.updated_at, 'Updated timestamp'),
  }
}

export async function listLessonAssessments(
  lessonPlanId: string,
): Promise<LessonAssessmentList> {
  const { data, error } = await rpc<Json>('exq_list_lesson_assessments', {
    p_lesson_plan_id: lessonPlanId,
  })

  if (error) throw rpcFailure('listing', error)
  const payload = record(data, 'Lesson assessments')
  const assessments = Array.isArray(payload.assessments)
    ? payload.assessments.map(parseSummary)
    : []

  return {
    lessonPlanId: text(payload.lesson_plan_id, 'Lesson plan ID'),
    lessonStatus: text(payload.lesson_status, 'Lesson status'),
    assessments,
  }
}

export async function requestLessonAssessment(
  input: RequestLessonAssessmentInput,
): Promise<RequestLessonAssessmentResult> {
  if (!input.requestKey.trim()) {
    throw new Error('A stable assessment generation request key is required.')
  }

  const { data, error } = await rpc<Json>('exq_request_lesson_assessment', {
    p_lesson_plan_id: input.lessonPlanId,
    p_assessment_type: input.assessmentType,
    p_request_key: input.requestKey,
    p_title: input.title ?? null,
    p_generation_metadata: input.generationMetadata ?? {},
  })

  if (error) throw rpcFailure('request', error)
  const payload = record(data, 'Lesson assessment request')

  return {
    created: payload.created === true,
    assessmentId: text(payload.assessment_id, 'Assessment ID'),
    status: text(payload.status, 'Assessment status'),
    generationStatus: text(
      payload.generation_status,
      'Assessment generation status',
    ) as LessonAssessmentGenerationStatus,
  }
}
