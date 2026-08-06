import { supabase } from '@/lib/supabase'

export interface VibeLearnSubject {
  id: string
  name: string
  resourceCount: number
}

export interface ContinueLearningItem {
  publicationId: string
  chapterId: string | null
  title: string
  chapterTitle: string | null
  progressPercent: number
  lastReadAt: string | null
  actionUrl: string
}

export interface PracticeSubject {
  subject: string
  questionCount: number
  actionUrl: string
}

export interface AssignedAssessment {
  assignmentId: string
  title: string
  assessmentType: string
  subjectId: string | null
  subjectName: string | null
  closesAt: string | null
  actionUrl: string
}

export interface VibeLearnTutorPolicy {
  defaultMode: 'off'
  allowedActions: string[]
  blockedInTimedAssessment: boolean
  answerRevealRequiresEscalation: boolean
  aiShareTargetPercent: number
}

export interface VibeLearnWorkstation {
  studentId: string
  classId: string | null
  className: string | null
  subjects: VibeLearnSubject[]
  continueLearning: ContinueLearningItem[]
  practiceBySubject: PracticeSubject[]
  assignedAssessments: AssignedAssessment[]
  tutorPolicy: VibeLearnTutorPolicy
}

export interface ExamSubjectSignal {
  subjectId: string | null
  subjectName: string
  attempts: number
  averagePercentage: number
  signal: 'needs_attention' | 'developing' | 'strong'
}

export interface ExamRevisionPriority {
  subject: string
  topic: string
  availableQuestions: number
  actionUrl: string
  reason: string
}

export interface ExamReadinessBrief {
  studentId: string
  classId: string | null
  className: string | null
  examName: string
  examDate: string | null
  daysRemaining: number | null
  targetGrade: string | null
  dailyRevisionMinutes: number
  confidenceCheck: number | null
  attemptCount: number
  averagePercentage: number | null
  subjectSignals: ExamSubjectSignal[]
  revisionPriorities: ExamRevisionPriority[]
  psychologyHeadline: string
  comparisonRule: string
  predictionDisclaimer: string
}

type WorkstationRpcClient = {
  rpc(
    fn: 'student_get_vibelearn_workstation',
    args?: Record<string, never>
  ): Promise<{ data: unknown; error: { message: string } | null }>
}

type ReadinessRpcClient = {
  rpc(
    fn: 'student_get_exam_readiness_brief',
    args?: Record<string, never>
  ): Promise<{ data: unknown; error: { message: string } | null }>
  rpc(
    fn: 'student_update_exam_readiness',
    args: { p_exam_date: string | null; p_daily_revision_minutes: number; p_confidence_check: number | null }
  ): Promise<{ data: unknown; error: { message: string } | null }>
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export async function getVibeLearnWorkstation(): Promise<VibeLearnWorkstation> {
  const rpcClient = supabase as unknown as WorkstationRpcClient
  const { data, error } = await rpcClient.rpc('student_get_vibelearn_workstation')
  if (error) throw new Error(error.message)

  const row = asRecord(data)
  const subjects = Array.isArray(row.subjects) ? row.subjects : []
  const continueLearning = Array.isArray(row.continue_learning) ? row.continue_learning : []
  const practice = Array.isArray(row.practice_by_subject) ? row.practice_by_subject : []
  const assessments = Array.isArray(row.assigned_assessments) ? row.assigned_assessments : []
  const policy = asRecord(row.tutor_policy)

  const studentId = asString(row.student_id)
  if (!studentId) throw new Error('Student profile not found.')

  return {
    studentId,
    classId: asString(row.class_id),
    className: asString(row.class_name),
    subjects: subjects.flatMap(value => {
      const item = asRecord(value)
      const id = asString(item.id)
      const name = asString(item.name)
      return id && name ? [{ id, name, resourceCount: asNumber(item.resource_count) }] : []
    }),
    continueLearning: continueLearning.flatMap(value => {
      const item = asRecord(value)
      const publicationId = asString(item.publication_id)
      const title = asString(item.title)
      const actionUrl = asString(item.action_url)
      return publicationId && title && actionUrl ? [{
        publicationId,
        chapterId: asString(item.chapter_id),
        title,
        chapterTitle: asString(item.chapter_title),
        progressPercent: asNumber(item.progress_percent),
        lastReadAt: asString(item.last_read_at),
        actionUrl,
      }] : []
    }),
    practiceBySubject: practice.flatMap(value => {
      const item = asRecord(value)
      const subject = asString(item.subject)
      const actionUrl = asString(item.action_url)
      return subject && actionUrl ? [{ subject, questionCount: asNumber(item.question_count), actionUrl }] : []
    }),
    assignedAssessments: assessments.flatMap(value => {
      const item = asRecord(value)
      const assignmentId = asString(item.assignment_id)
      const title = asString(item.title)
      const actionUrl = asString(item.action_url)
      return assignmentId && title && actionUrl ? [{
        assignmentId,
        title,
        assessmentType: asString(item.assessment_type) ?? 'assessment',
        subjectId: asString(item.subject_id),
        subjectName: asString(item.subject_name),
        closesAt: asString(item.closes_at),
        actionUrl,
      }] : []
    }),
    tutorPolicy: {
      defaultMode: 'off',
      allowedActions: Array.isArray(policy.allowed_actions)
        ? policy.allowed_actions.filter((value): value is string => typeof value === 'string')
        : [],
      blockedInTimedAssessment: policy.blocked_in_timed_assessment !== false,
      answerRevealRequiresEscalation: policy.answer_reveal_requires_escalation !== false,
      aiShareTargetPercent: asNumber(policy.ai_share_target_percent) || 10,
    },
  }
}

export async function getExamReadinessBrief(): Promise<ExamReadinessBrief> {
  const rpcClient = supabase as unknown as ReadinessRpcClient
  const { data, error } = await rpcClient.rpc('student_get_exam_readiness_brief')
  if (error) throw new Error(error.message)

  const row = asRecord(data)
  const evidence = asRecord(row.evidence)
  const psychology = asRecord(row.psychology)
  const subjectSignals = Array.isArray(row.subject_signals) ? row.subject_signals : []
  const priorities = Array.isArray(row.revision_priorities) ? row.revision_priorities : []
  const studentId = asString(row.student_id)
  if (!studentId) throw new Error('Student profile not found.')

  return {
    studentId,
    classId: asString(row.class_id),
    className: asString(row.class_name),
    examName: asString(row.exam_name) ?? 'KCSE',
    examDate: asString(row.exam_date),
    daysRemaining: asNullableNumber(row.days_remaining),
    targetGrade: asString(row.target_grade),
    dailyRevisionMinutes: asNumber(row.daily_revision_minutes) || 90,
    confidenceCheck: asNullableNumber(row.confidence_check),
    attemptCount: asNumber(evidence.attempt_count),
    averagePercentage: asNullableNumber(evidence.average_percentage),
    subjectSignals: subjectSignals.flatMap(value => {
      const item = asRecord(value)
      const subjectName = asString(item.subject_name)
      const signal = asString(item.signal)
      if (!subjectName || !['needs_attention', 'developing', 'strong'].includes(signal ?? '')) return []
      return [{
        subjectId: asString(item.subject_id),
        subjectName,
        attempts: asNumber(item.attempts),
        averagePercentage: asNumber(item.average_percentage),
        signal: signal as ExamSubjectSignal['signal'],
      }]
    }),
    revisionPriorities: priorities.flatMap(value => {
      const item = asRecord(value)
      const subject = asString(item.subject)
      const topic = asString(item.topic)
      const actionUrl = asString(item.action_url)
      if (!subject || !topic || !actionUrl) return []
      return [{
        subject,
        topic,
        availableQuestions: asNumber(item.available_questions),
        actionUrl,
        reason: asString(item.reason) ?? 'Exam practice available',
      }]
    }),
    psychologyHeadline: asString(psychology.headline) ?? 'Build confidence through focused daily practice.',
    comparisonRule: asString(psychology.comparison_rule) ?? 'Compete with your previous performance, not public rankings.',
    predictionDisclaimer: asString(psychology.prediction_disclaimer) ?? 'Readiness is not an official KCSE prediction.',
  }
}

export async function updateExamReadiness(input: {
  examDate: string | null
  dailyRevisionMinutes: number
  confidenceCheck: number | null
}): Promise<void> {
  const rpcClient = supabase as unknown as ReadinessRpcClient
  const { error } = await rpcClient.rpc('student_update_exam_readiness', {
    p_exam_date: input.examDate,
    p_daily_revision_minutes: input.dailyRevisionMinutes,
    p_confidence_check: input.confidenceCheck,
  })
  if (error) throw new Error(error.message)
}
