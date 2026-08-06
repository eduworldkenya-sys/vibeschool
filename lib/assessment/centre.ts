import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'

export interface MarkingCentreCounts {
  submittedAttempts: number
  partiallyMarkedAttempts: number
  markedAttempts: number
  releasedAttempts: number
  pendingModerations: number
}

export interface MarkingCentreWorkload {
  assignmentId: string
  assessmentId: string
  assessmentTitle: string
  assessmentType: string
  classId: string
  className: string
  classStream: string | null
  submittedCount: number
  unresolvedAttempts: number
  markedCount: number
  releasedCount: number
  averageTurnaroundHours: number | null
  oldestUnmarkedAt: string | null
}

export interface MarkingCentreSummary {
  counts: MarkingCentreCounts
  workload: MarkingCentreWorkload[]
}

export interface TeacherAssessmentIntelligenceSummary {
  assessmentCount: number
  releasedAttemptCount: number
  averagePercentage: number | null
  activeInterventions: number
  highPriorityInterventions: number
  averageMasteryChange: number | null
}

export interface TeacherWeakQuestion {
  assessmentItemId: string
  prompt: string
  questionType: string
  difficulty: string
  bloomLevel: string
  responseCount: number
  averagePercentage: number | null
  zeroScoreCount: number
  below50Count: number
}

export interface TeacherOutcomeIntelligence {
  outcomeId: string
  outcomeCode: string | null
  outcomeText: string
  responseCount: number
  averagePercentage: number | null
  learnersBelow50: number
}

export interface TeacherAssessmentTrend {
  assignmentId: string
  title: string
  assessmentType: string
  classId: string
  releasedCount: number
  averagePercentage: number | null
  highestPercentage: number | null
  lowestPercentage: number | null
}

export interface TeacherAssessmentIntelligence {
  summary: TeacherAssessmentIntelligenceSummary
  weakQuestions: TeacherWeakQuestion[]
  outcomes: TeacherOutcomeIntelligence[]
  assessmentTrends: TeacherAssessmentTrend[]
}

type RpcResult<T> = { data: T | null; error: { message?: string } | null }
type Rpc = <T>(name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult<T>>
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Assessment Centre returned an invalid payload.')
  return value as Record<string, unknown>
}
function text(value: unknown): string | null { return typeof value === 'string' ? value : null }
function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const resolved = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(resolved) ? resolved : null
}

export async function getMarkingCentreSummary(): Promise<MarkingCentreSummary> {
  const { data, error } = await rpc<Json>('exq_get_marking_centre_summary')
  if (error) throw new Error(error.message || 'Could not load marking centre summary.')
  const payload = record(data)
  const counts = record(payload.counts ?? {})
  const workload = Array.isArray(payload.workload) ? payload.workload : []
  return {
    counts: {
      submittedAttempts: numberOrNull(counts.submitted_attempts) ?? 0,
      partiallyMarkedAttempts: numberOrNull(counts.partially_marked_attempts) ?? 0,
      markedAttempts: numberOrNull(counts.marked_attempts) ?? 0,
      releasedAttempts: numberOrNull(counts.released_attempts) ?? 0,
      pendingModerations: numberOrNull(counts.pending_moderations) ?? 0,
    },
    workload: workload.map(value => {
      const item = record(value)
      return {
        assignmentId: text(item.assignment_id) ?? '',
        assessmentId: text(item.assessment_id) ?? '',
        assessmentTitle: text(item.assessment_title) ?? 'Assessment',
        assessmentType: text(item.assessment_type) ?? 'assessment',
        classId: text(item.class_id) ?? '',
        className: text(item.class_name) ?? 'Class',
        classStream: text(item.class_stream),
        submittedCount: numberOrNull(item.submitted_count) ?? 0,
        unresolvedAttempts: numberOrNull(item.unresolved_attempts) ?? 0,
        markedCount: numberOrNull(item.marked_count) ?? 0,
        releasedCount: numberOrNull(item.released_count) ?? 0,
        averageTurnaroundHours: numberOrNull(item.average_turnaround_hours),
        oldestUnmarkedAt: text(item.oldest_unmarked_at),
      }
    }),
  }
}

export async function getTeacherAssessmentIntelligence(): Promise<TeacherAssessmentIntelligence> {
  const { data, error } = await rpc<Json>('exq_get_teacher_assessment_intelligence')
  if (error) throw new Error(error.message || 'Could not load assessment intelligence.')
  const payload = record(data)
  const summary = record(payload.summary ?? {})
  const weakQuestions = Array.isArray(payload.weak_questions) ? payload.weak_questions : []
  const outcomes = Array.isArray(payload.outcomes) ? payload.outcomes : []
  const assessmentTrends = Array.isArray(payload.assessment_trends) ? payload.assessment_trends : []
  return {
    summary: {
      assessmentCount: numberOrNull(summary.assessment_count) ?? 0,
      releasedAttemptCount: numberOrNull(summary.released_attempt_count) ?? 0,
      averagePercentage: numberOrNull(summary.average_percentage),
      activeInterventions: numberOrNull(summary.active_interventions) ?? 0,
      highPriorityInterventions: numberOrNull(summary.high_priority_interventions) ?? 0,
      averageMasteryChange: numberOrNull(summary.average_mastery_change),
    },
    weakQuestions: weakQuestions.map(value => {
      const item = record(value)
      return {
        assessmentItemId: text(item.assessment_item_id) ?? '',
        prompt: text(item.prompt) ?? '',
        questionType: text(item.question_type) ?? 'question',
        difficulty: text(item.difficulty) ?? 'medium',
        bloomLevel: text(item.bloom_level) ?? 'understand',
        responseCount: numberOrNull(item.response_count) ?? 0,
        averagePercentage: numberOrNull(item.average_percentage),
        zeroScoreCount: numberOrNull(item.zero_score_count) ?? 0,
        below50Count: numberOrNull(item.below_50_count) ?? 0,
      }
    }),
    outcomes: outcomes.map(value => {
      const item = record(value)
      return {
        outcomeId: text(item.outcome_id) ?? '',
        outcomeCode: text(item.outcome_code),
        outcomeText: text(item.outcome_text) ?? '',
        responseCount: numberOrNull(item.response_count) ?? 0,
        averagePercentage: numberOrNull(item.average_percentage),
        learnersBelow50: numberOrNull(item.learners_below_50) ?? 0,
      }
    }),
    assessmentTrends: assessmentTrends.map(value => {
      const item = record(value)
      return {
        assignmentId: text(item.assignment_id) ?? '',
        title: text(item.title) ?? 'Assessment',
        assessmentType: text(item.assessment_type) ?? 'assessment',
        classId: text(item.class_id) ?? '',
        releasedCount: numberOrNull(item.released_count) ?? 0,
        averagePercentage: numberOrNull(item.average_percentage),
        highestPercentage: numberOrNull(item.highest_percentage),
        lowestPercentage: numberOrNull(item.lowest_percentage),
      }
    }),
  }
}
