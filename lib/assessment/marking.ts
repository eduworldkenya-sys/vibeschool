import { readProgressPages } from '@/lib/learner-intelligence/progress-data'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'
import { propagateReleasedAttempt } from '@/lib/assessment/integration'

export interface MarkingQueueItem {
  attemptId: string
  assignmentId: string
  studentId: string
  assessmentTitle: string
  assessmentType: string
  className: string
  classStream: string | null
  studentName: string
  admissionNumber: string | null
  attemptStatus: string
  resultStatus: string
  score: number | null
  maxScore: number | null
  percentage: number | null
  submittedAt: string | null
  teacherReviewedAt: string | null
  unresolvedItems: number
  markedItems: number
  totalItems: number
}

export interface MarkingResponse {
  responseId: string
  assessmentItemId: string
  orderNum: number
  questionType: string
  prompt: string
  responseText: string | null
  responseValue: Json
  autoScore: number | null
  teacherScore: number | null
  finalScore: number | null
  maxScore: number
  teacherFeedback: string | null
  status: string
  markingGuide: Json
  correctAnswer: Json
}

export interface MarkingAttempt {
  attemptId: string
  assessmentTitle: string
  studentName: string
  attemptStatus: string
  resultStatus: string
  score: number | null
  maxScore: number | null
  percentage: number | null
  feedback: string | null
  pendingResponseIds: string[]
  responses: MarkingResponse[]
}

type RpcResult<T> = { data: T | null; error: { message?: string } | null }
type Rpc = <T>(name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult<T>>
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc

function rec(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Marking Engine returned an invalid payload.')
  }
  return value as Record<string, unknown>
}
function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}
function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const resolved = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(resolved) ? resolved : null
}

export async function listMarkingQueue(): Promise<MarkingQueueItem[]> {
  const { data, error } = await rpc<Json>('exq_list_marking_queue')
  if (error) throw new Error(error.message || 'Could not load marking queue.')
  const payload = rec(data)
  if (!Array.isArray(payload.attempts))
    throw new Error('The marking queue returned an incomplete payload.')
  const attempts = Array.isArray(payload.attempts) ? payload.attempts : []

  return attempts.map((value) => {
    const item = rec(value)
    const attemptId = str(item.attempt_id)
    const assessmentTitle = str(item.assessment_title)
    const studentName = str(item.student_name)
    if (
      !attemptId ||
      !str(item.assignment_id) ||
      !str(item.student_id) ||
      !assessmentTitle ||
      !studentName
    )
      throw new Error('Marking queue returned incomplete data.')

    return {
      attemptId,
      assignmentId: str(item.assignment_id) ?? '',
      studentId: str(item.student_id) ?? '',
      assessmentTitle,
      assessmentType: str(item.assessment_type) ?? 'assessment',
      className: str(item.class_name) ?? 'Class',
      classStream: str(item.class_stream),
      studentName,
      admissionNumber: str(item.admission_number),
      attemptStatus: str(item.attempt_status) ?? 'teacher_review',
      resultStatus: str(item.result_status) ?? 'partially_marked',
      score: num(item.score),
      maxScore: num(item.max_score),
      percentage: num(item.percentage),
      submittedAt: str(item.submitted_at),
      teacherReviewedAt: str(item.teacher_reviewed_at),
      unresolvedItems: num(item.unresolved_items) ?? 0,
      markedItems: num(item.marked_items) ?? 0,
      totalItems: num(item.total_items) ?? 0,
    }
  })
}

export async function getMarkingAttempt(attemptId: string): Promise<MarkingAttempt> {
  const { data, error } = await rpc<Json>('exq_get_marking_attempt', {
    p_attempt_id: attemptId,
  })
  if (error) throw new Error(error.message || 'Could not load learner responses.')
  const payload = rec(data)
  if (str(payload.attempt_id) !== attemptId)
    throw new Error('The requested submission could not be confirmed.')
  if (!Array.isArray(payload.responses))
    throw new Error('Submission answers could not be confirmed.')
  const responses = Array.isArray(payload.responses) ? payload.responses : []

  const pending = await readProgressPages((from, to) =>
    supabase
      .from('assessment_moderation_requests')
      .select('response_id')
      .eq('attempt_id', attemptId)
      .eq('status', 'pending')
      .order('id')
      .range(from, to),
  )
  return {
    pendingResponseIds: pending.map((value) => {
      const id = str(rec(value).response_id)
      if (!id) throw new Error('Pending mark reviews could not be confirmed.')
      return id
    }),
    attemptId: str(payload.attempt_id) ?? attemptId,
    assessmentTitle: str(payload.assessment_title) ?? 'Assessment',
    studentName: str(payload.student_name) ?? 'Learner',
    attemptStatus: str(payload.attempt_status) ?? 'teacher_review',
    resultStatus: str(payload.result_status) ?? 'partially_marked',
    score: num(payload.score),
    maxScore: num(payload.max_score),
    percentage: num(payload.percentage),
    feedback: str(payload.feedback),
    responses: responses.map((value) => {
      const item = rec(value)
      const responseId = str(item.response_id)
      const assessmentItemId = str(item.assessment_item_id)
      if (!responseId || !assessmentItemId || num(item.max_score) === null)
        throw new Error('Marking attempt returned incomplete response data.')
      return {
        responseId,
        assessmentItemId,
        orderNum: num(item.order_num) ?? 0,
        questionType: str(item.question_type) ?? 'response',
        prompt: str(item.prompt) ?? '',
        responseText: str(item.response_text),
        responseValue: (item.response_value ?? null) as Json,
        autoScore: num(item.auto_score),
        teacherScore: num(item.teacher_score),
        finalScore: num(item.final_score),
        maxScore: num(item.max_score) ?? 0,
        teacherFeedback: str(item.teacher_feedback),
        status: str(item.status) ?? 'teacher_review',
        markingGuide: (item.marking_guide ?? {}) as Json,
        correctAnswer: (item.correct_answer ?? null) as Json,
      }
    }),
  }
}

export async function markResponse(input: {
  responseId: string
  score: number
  feedback?: string | null
  overrideReason?: string | null
}): Promise<void> {
  const { error } = await rpc<Json>('exq_mark_response', {
    p_response_id: input.responseId,
    p_teacher_score: input.score,
    p_teacher_feedback: input.feedback ?? null,
    p_override_reason: input.overrideReason ?? null,
  })
  if (error) throw new Error(error.message || 'Response could not be marked.')
}

export async function finalizeAttempt(input: {
  attemptId: string
  feedback?: string | null
  release?: boolean
}): Promise<void> {
  const { error } = await rpc<Json>('exq_finalize_attempt', {
    p_attempt_id: input.attemptId,
    p_feedback: input.feedback ?? null,
    p_release: input.release ?? false,
  })
  if (error) throw new Error(error.message || 'Attempt could not be finalized.')

  if (input.release) {
    await propagateReleasedAttempt(input.attemptId)
  }
}
