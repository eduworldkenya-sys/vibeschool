import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'

type RpcResult<T> = { data: T | null; error: { message?: string } | null }
type Rpc = <T>(name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult<T>>
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
function text(value: unknown): string | null { return typeof value === 'string' ? value : null }
function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const result = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(result) ? result : null
}
function boolean(value: unknown): boolean { return value === true }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [] }

export interface TwinMasteryOutcome {
  outcomeId: string
  outcomeCode: string | null
  outcomeText: string
  masteryLevel: string
  masteryScore: number | null
  effectiveMastery: number
  evidenceCount: number
  lastEvidenceAt: string | null
  daysSinceEvidence: number | null
  forgettingRisk: number
  confidence: number
}

export interface TwinSubjectMastery {
  subjectId: string
  subjectName: string
  completedTasks: number
  totalTasks: number
  averageScore: number | null
  masteryPercentage: number | null
  confidence: number
}

export interface TwinDecision {
  decisionType: 'task' | 'intervention' | 'recommendation' | string
  taskId: string | null
  title: string
  subject: string | null
  reason: string | null
  reasonChain: string[]
  actionUrl: string | null
  actionLabel: string | null
  raw: Json
}

export interface TwinCalibrationEvent {
  id: string
  predictionType: string
  predictedValue: number | null
  actualValue: number | null
  confidence: number
  absoluteError: number | null
  authoritative: boolean
  sourceType: string
  predictedAt: string | null
  resolvedAt: string | null
}

export interface LearnerTwinState {
  studentId: string
  generatedAt: string
  confidence: number
  mastery: { outcomes: TwinMasteryOutcome[]; subjects: TwinSubjectMastery[] }
  prediction: { averageEffectiveMastery: number | null; averageForgettingRisk: number; confidence: number; disclaimer: string | null }
  decision: { now: TwinDecision | null; next: TwinDecision[]; later: TwinDecision[]; rule: string | null }
  evidence: {
    competencyEvidenceCount: number
    learningEventCount: number
    taskReceiptCount: number
    calibrationCount: number
    verifiedCalibrationCount: number
    meanAbsoluteError: number | null
    latestEvidenceAt: string | null
    snapshotGeneratedAt: string | null
    stateConfidence: number
    recentCalibrations: TwinCalibrationEvent[]
  }
  exam: { examName: string; examDate: string | null; daysRemaining: number | null; dailyRevisionMinutes: number; confidenceCheck: number | null; targetGrade: string | null }
  streak: { current: number; longest: number; graceTokens: number }
  studyTime: { weeklyMinutes: number; sessionMinutes: number; preferredTime: string }
  tutor: Json
}

export interface LearnerTwinChatMessage {
  role: 'user' | 'assistant'
  content: string
}

function parseDecision(value: unknown): TwinDecision | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const item = record(value)
  return {
    decisionType: text(item.decision_type) ?? 'task',
    taskId: text(item.task_id),
    title: text(item.title) ?? 'Learning focus',
    subject: text(item.subject),
    reason: text(item.reason),
    reasonChain: strings(item.reason_chain),
    actionUrl: text(item.action_url),
    actionLabel: text(item.action_label),
    raw: item as Json,
  }
}

function parseMasteryOutcomes(value: unknown): TwinMasteryOutcome[] {
  return (Array.isArray(value) ? value : []).map(item => {
    const row = record(item)
    return {
      outcomeId: text(row.outcome_id) ?? '',
      outcomeCode: text(row.outcome_code),
      outcomeText: text(row.outcome_text) ?? 'Learning outcome',
      masteryLevel: text(row.mastery_level) ?? 'not_started',
      masteryScore: numberOrNull(row.mastery_score),
      effectiveMastery: numberOrNull(row.effective_mastery) ?? numberOrNull(row.mastery_score) ?? 0,
      evidenceCount: numberOrNull(row.evidence_count) ?? 0,
      lastEvidenceAt: text(row.last_evidence_at),
      daysSinceEvidence: numberOrNull(row.days_since_evidence),
      forgettingRisk: numberOrNull(row.forgetting_risk) ?? 0,
      confidence: numberOrNull(row.confidence) ?? 0,
    }
  })
}

function parseSubjects(value: unknown): TwinSubjectMastery[] {
  return (Array.isArray(value) ? value : []).map(item => {
    const row = record(item)
    return {
      subjectId: text(row.subject_id) ?? '',
      subjectName: text(row.subject_name) ?? 'Subject',
      completedTasks: numberOrNull(row.completed_tasks) ?? 0,
      totalTasks: numberOrNull(row.total_tasks) ?? 0,
      averageScore: numberOrNull(row.average_score),
      masteryPercentage: numberOrNull(row.mastery_percentage),
      confidence: numberOrNull(row.confidence) ?? 0,
    }
  })
}

function parseCalibrations(value: unknown): TwinCalibrationEvent[] {
  return (Array.isArray(value) ? value : []).map(item => {
    const row = record(item)
    return {
      id: text(row.id) ?? '',
      predictionType: text(row.prediction_type) ?? 'prediction',
      predictedValue: numberOrNull(row.predicted_value),
      actualValue: numberOrNull(row.actual_value),
      confidence: numberOrNull(row.confidence) ?? 0,
      absoluteError: numberOrNull(row.absolute_error),
      authoritative: boolean(row.authoritative),
      sourceType: text(row.source_type) ?? 'evidence',
      predictedAt: text(row.predicted_at),
      resolvedAt: text(row.resolved_at),
    }
  })
}

export async function getLearnerTwinState(): Promise<LearnerTwinState> {
  const { data, error } = await rpc<Json>('student_get_twin_brain')
  if (error) throw new Error(error.message || 'Your learning state could not be loaded.')

  const state = record(data)
  const mastery = record(state.mastery)
  const prediction = record(state.prediction)
  const priority = record(state.decision)
  const evidence = record(state.evidence)
  const exam = record(state.exam)
  const streak = record(state.streak)
  const studyTime = record(state.study_time)
  const next = Array.isArray(priority.next) ? priority.next : []
  const later = Array.isArray(priority.later) ? priority.later : []

  return {
    studentId: text(state.student_id) ?? text(mastery.student_id) ?? '',
    generatedAt: text(state.generated_at) ?? new Date().toISOString(),
    confidence: numberOrNull(state.confidence) ?? 0,
    mastery: { outcomes: parseMasteryOutcomes(mastery.outcomes), subjects: parseSubjects(mastery.subjects) },
    prediction: {
      averageEffectiveMastery: numberOrNull(prediction.average_effective_mastery),
      averageForgettingRisk: numberOrNull(prediction.average_forgetting_risk) ?? 0,
      confidence: numberOrNull(prediction.confidence) ?? 0,
      disclaimer: text(prediction.disclaimer),
    },
    decision: {
      now: parseDecision(priority.now),
      next: next.map(parseDecision).filter((item): item is TwinDecision => item !== null),
      later: later.map(parseDecision).filter((item): item is TwinDecision => item !== null),
      rule: text(priority.rule),
    },
    evidence: {
      competencyEvidenceCount: numberOrNull(evidence.competency_evidence_count) ?? 0,
      learningEventCount: numberOrNull(evidence.learning_event_count) ?? 0,
      taskReceiptCount: numberOrNull(evidence.task_receipt_count) ?? 0,
      calibrationCount: numberOrNull(evidence.calibration_count) ?? 0,
      verifiedCalibrationCount: numberOrNull(evidence.verified_calibration_count) ?? 0,
      meanAbsoluteError: numberOrNull(evidence.mean_absolute_error),
      latestEvidenceAt: text(evidence.latest_evidence_at),
      snapshotGeneratedAt: text(evidence.snapshot_generated_at),
      stateConfidence: numberOrNull(evidence.state_confidence) ?? numberOrNull(state.confidence) ?? 0,
      recentCalibrations: parseCalibrations(evidence.recent_calibrations),
    },
    exam: {
      examName: text(exam.exam_name) ?? 'KCSE',
      examDate: text(exam.exam_date),
      daysRemaining: numberOrNull(exam.days_remaining),
      dailyRevisionMinutes: numberOrNull(exam.daily_revision_minutes) ?? 90,
      confidenceCheck: numberOrNull(exam.confidence_check),
      targetGrade: text(exam.target_grade),
    },
    streak: { current: numberOrNull(streak.current) ?? 0, longest: numberOrNull(streak.longest) ?? 0, graceTokens: numberOrNull(streak.grace_tokens) ?? 0 },
    studyTime: { weeklyMinutes: numberOrNull(studyTime.weekly_minutes) ?? 300, sessionMinutes: numberOrNull(studyTime.session_minutes) ?? 25, preferredTime: text(studyTime.preferred_time) ?? 'evening' },
    tutor: (state.tutor ?? {}) as Json,
  }
}

export async function getLearnerTutorContext(): Promise<Json> {
  const { data, error } = await rpc<Json>('student_get_twin_tutor_context')
  if (error) throw new Error(error.message || 'Tutor context could not be loaded.')
  return data ?? {}
}

export async function askLearnerTwin(input: { messages: LearnerTwinChatMessage[]; firstName: string }): Promise<string> {
  const { data, error } = await supabase.functions.invoke('twin-chat', {
    body: { role: 'student', firstName: input.firstName, messages: input.messages.slice(-10) },
  })
  if (error) throw new Error(error.message || 'Your Twin could not respond.')
  const payload = record(data)
  const reply = text(payload.reply)
  if (!reply) throw new Error(text(payload.error) || 'Your Twin could not respond.')
  return reply
}
