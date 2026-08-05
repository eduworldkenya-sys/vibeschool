import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'

export interface AssessmentAnalyticsSummary {
  assignmentId: string
  assessmentId: string
  title: string
  assessmentType: string
  classId: string
  className: string
  classStream: string | null
  assignedAt: string | null
  closesAt: string | null
  eligibleLearners: number
  submittedCount: number
  reviewPendingCount: number
  releasedCount: number
  averagePercentage: number | null
  highestPercentage: number | null
  lowestPercentage: number | null
}

export interface AssessmentLearnerAnalytics {
  studentId: string
  studentName: string
  admissionNumber: string | null
  attemptId: string | null
  attemptStatus: string | null
  score: number | null
  maxScore: number | null
  percentage: number | null
  submittedAt: string | null
}

export interface AssessmentQuestionAnalytics {
  assessmentItemId: string
  orderNum: number
  prompt: string
  questionType: string
  maxScore: number
  responseCount: number
  averageScore: number | null
  averagePercentage: number | null
  zeroScoreCount: number
}

export interface AssessmentAnalyticsDetail {
  assignmentId: string
  assessmentId: string
  title: string
  assessmentType: string
  className: string
  classStream: string | null
  eligibleLearners: number
  submittedCount: number
  submissionRate: number
  averagePercentage: number | null
  highestPercentage: number | null
  lowestPercentage: number | null
  learners: AssessmentLearnerAnalytics[]
  questions: AssessmentQuestionAnalytics[]
}

type RpcResult<T> = { data: T | null; error: { message?: string } | null }
type Rpc = <T>(name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult<T>>
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Assessment Analytics returned an invalid payload.')
  }
  return value as Record<string, unknown>
}

function text(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const result = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(result) ? result : null
}

export async function listTeacherAssessmentAnalytics(): Promise<AssessmentAnalyticsSummary[]> {
  const { data, error } = await rpc<Json>('exq_list_teacher_assessment_analytics')
  if (error) throw new Error(error.message || 'Could not load assessment analytics.')

  const payload = record(data)
  const assessments = Array.isArray(payload.assessments) ? payload.assessments : []

  return assessments.map(value => {
    const item = record(value)
    const assignmentId = text(item.assignment_id)
    const assessmentId = text(item.assessment_id)
    const title = text(item.title)
    const classId = text(item.class_id)
    if (!assignmentId || !assessmentId || !title || !classId) {
      throw new Error('Assessment Analytics returned incomplete summary data.')
    }

    return {
      assignmentId,
      assessmentId,
      title,
      assessmentType: text(item.assessment_type) ?? 'assessment',
      classId,
      className: text(item.class_name) ?? 'Class',
      classStream: text(item.class_stream),
      assignedAt: text(item.assigned_at),
      closesAt: text(item.closes_at),
      eligibleLearners: numberOrNull(item.eligible_learners) ?? 0,
      submittedCount: numberOrNull(item.submitted_count) ?? 0,
      reviewPendingCount: numberOrNull(item.review_pending_count) ?? 0,
      releasedCount: numberOrNull(item.released_count) ?? 0,
      averagePercentage: numberOrNull(item.average_percentage),
      highestPercentage: numberOrNull(item.highest_percentage),
      lowestPercentage: numberOrNull(item.lowest_percentage),
    }
  })
}

export async function getAssignmentAnalytics(
  assignmentId: string,
): Promise<AssessmentAnalyticsDetail> {
  const { data, error } = await rpc<Json>('exq_get_assignment_analytics', {
    p_assignment_id: assignmentId,
  })
  if (error) throw new Error(error.message || 'Could not load assignment analytics.')

  const payload = record(data)
  const learners = Array.isArray(payload.learners) ? payload.learners : []
  const questions = Array.isArray(payload.questions) ? payload.questions : []

  return {
    assignmentId: text(payload.assignment_id) ?? assignmentId,
    assessmentId: text(payload.assessment_id) ?? '',
    title: text(payload.title) ?? 'Assessment',
    assessmentType: text(payload.assessment_type) ?? 'assessment',
    className: text(payload.class_name) ?? 'Class',
    classStream: text(payload.class_stream),
    eligibleLearners: numberOrNull(payload.eligible_learners) ?? 0,
    submittedCount: numberOrNull(payload.submitted_count) ?? 0,
    submissionRate: numberOrNull(payload.submission_rate) ?? 0,
    averagePercentage: numberOrNull(payload.average_percentage),
    highestPercentage: numberOrNull(payload.highest_percentage),
    lowestPercentage: numberOrNull(payload.lowest_percentage),
    learners: learners.map(value => {
      const item = record(value)
      return {
        studentId: text(item.student_id) ?? '',
        studentName: text(item.student_name) ?? 'Learner',
        admissionNumber: text(item.admission_number),
        attemptId: text(item.attempt_id),
        attemptStatus: text(item.attempt_status),
        score: numberOrNull(item.score),
        maxScore: numberOrNull(item.max_score),
        percentage: numberOrNull(item.percentage),
        submittedAt: text(item.submitted_at),
      }
    }),
    questions: questions.map(value => {
      const item = record(value)
      return {
        assessmentItemId: text(item.assessment_item_id) ?? '',
        orderNum: numberOrNull(item.order_num) ?? 0,
        prompt: text(item.prompt) ?? '',
        questionType: text(item.question_type) ?? 'question',
        maxScore: numberOrNull(item.max_score) ?? 0,
        responseCount: numberOrNull(item.response_count) ?? 0,
        averageScore: numberOrNull(item.average_score),
        averagePercentage: numberOrNull(item.average_percentage),
        zeroScoreCount: numberOrNull(item.zero_score_count) ?? 0,
      }
    }),
  }
}
