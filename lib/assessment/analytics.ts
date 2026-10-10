import { readProgressPages } from '@/lib/learner-intelligence/progress-data'
import { supabase } from '@/lib/supabase'

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
  resultStatus: string | null
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

async function rpc(name: string, args?: Record<string, unknown>): Promise<{ data: unknown; error: { message?: string } | null }> {
  const { data, error } = await supabase.rpc(name, args)
  return { data, error }
}

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
  if (value === null || value === undefined || value === '') return null
  const result = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(result) ? result : null
}

export async function listTeacherAssessmentAnalytics(): Promise<AssessmentAnalyticsSummary[]> {
  const { data, error } = await rpc('exq_list_teacher_assessment_analytics')
  if (error) throw new Error(error.message || 'Could not load assessment analytics.')

  const payload = record(data)
  const assessments = Array.isArray(payload.assessments) ? payload.assessments : []

  return assessments.map((value) => {
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
  const { data, error } = await rpc('exq_get_assignment_analytics', {
    p_assignment_id: assignmentId,
  })
  if (error) throw new Error(error.message || 'Could not load assignment analytics.')

  const payload = record(data)
  if (text(payload.assignment_id) !== assignmentId)
    throw new Error('The requested assessment results could not be confirmed.')
  if (!Array.isArray(payload.learners) || !Array.isArray(payload.questions))
    throw new Error('Assessment results returned an incomplete payload.')
  const learners = Array.isArray(payload.learners) ? payload.learners : []
  const questions = Array.isArray(payload.questions) ? payload.questions : []

  const learnerIds = learners.map((value) => text(record(value).student_id))
  if (learnerIds.some((id) => !id) || new Set(learnerIds).size !== learnerIds.length)
    throw new Error(
      'The learner roster needs identity reconciliation. No partial results are shown.',
    )
  const attemptIds = learners
    .map((value) => text(record(value).attempt_id))
    .filter((id): id is string => Boolean(id))
  const attempts = attemptIds.length
    ? await readProgressPages((from, to) =>
        supabase
          .from('assessment_attempts')
          .select('id,student_id,status,result_status,score,max_score,submitted_at')
          .eq('assignment_id', assignmentId)
          .in('id', attemptIds)
          .order('id')
          .range(from, to),
      )
    : []
  const verified = new Map(
    attempts.map((value) => {
      const row = record(value)
      return [text(row.id), row]
    }),
  )
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
    learners: learners.map((value) => {
      const item = record(value),
        attemptId = text(item.attempt_id),
        current = attemptId ? verified.get(attemptId) : null
      if (attemptId && (!current || current.student_id !== item.student_id))
        throw new Error('A learner result could not be confirmed. No partial results are shown.')
      const score = numberOrNull(current?.score),
        max = numberOrNull(current?.max_score)
      if (score !== null && (max === null || max < 0 || score < 0 || score > max))
        throw new Error(
          'A learner result needs score reconciliation. No partial results are shown.',
        )
      return {
        studentId: text(item.student_id) ?? '',
        studentName: text(item.student_name) ?? 'Learner',
        admissionNumber: text(item.admission_number),
        attemptId: text(item.attempt_id),
        attemptStatus: text(current?.status),
        resultStatus: text(current?.result_status),
        score,
        maxScore: max,
        percentage: score !== null && max !== null && max > 0 ? (100 * score) / max : null,
        submittedAt: text(current?.submitted_at),
      }
    }),
    questions: questions.map((value) => {
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
