import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'

export interface OutcomeIntelligence {
  outcomeId: string
  outcomeCode: string | null
  outcomeText: string
  bloomLevel: string | null
  difficulty: string | null
  competencyTags: string[]
  responseCount: number
  averagePercentage: number | null
  learnersBelow50: number
  masteryBand: string
}

export interface InterventionSignal {
  studentId: string
  studentName: string
  outcomeId: string
  outcomeCode: string | null
  outcomeText: string
  masteryScore: number
  masteryLevel: string
  recommendedAction: string
}

export interface CurriculumIntelligence {
  assignmentId: string
  outcomes: OutcomeIntelligence[]
  interventions: InterventionSignal[]
}

type RpcResult<T> = { data: T | null; error: { message?: string } | null }
type Rpc = <T>(name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult<T>>
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Curriculum Intelligence returned an invalid payload.')
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

export async function linkAssessmentItemOutcome(input: {
  assessmentItemId: string
  outcomeId: string
  weight?: number
}): Promise<void> {
  const { error } = await rpc<Json>('exq_link_item_outcome', {
    p_assessment_item_id: input.assessmentItemId,
    p_outcome_id: input.outcomeId,
    p_weight: input.weight ?? 1,
  })
  if (error) throw new Error(error.message || 'Outcome could not be linked.')
}

export async function syncAttemptOutcomeEvidence(attemptId: string): Promise<void> {
  const { error } = await rpc<Json>('exq_sync_attempt_outcome_evidence', {
    p_attempt_id: attemptId,
  })
  if (error) throw new Error(error.message || 'Outcome evidence could not be synchronized.')
}

export async function getCurriculumIntelligence(
  assignmentId: string,
): Promise<CurriculumIntelligence> {
  const { data, error } = await rpc<Json>('exq_get_curriculum_intelligence', {
    p_assignment_id: assignmentId,
  })
  if (error) throw new Error(error.message || 'Could not load curriculum intelligence.')

  const payload = record(data)
  const outcomes = Array.isArray(payload.outcomes) ? payload.outcomes : []
  const interventions = Array.isArray(payload.interventions) ? payload.interventions : []

  return {
    assignmentId: text(payload.assignment_id) ?? assignmentId,
    outcomes: outcomes.map(value => {
      const item = record(value)
      return {
        outcomeId: text(item.outcome_id) ?? '',
        outcomeCode: text(item.outcome_code),
        outcomeText: text(item.outcome_text) ?? 'Learning outcome',
        bloomLevel: text(item.bloom_level),
        difficulty: text(item.difficulty),
        competencyTags: Array.isArray(item.competency_tags)
          ? item.competency_tags.filter((tag): tag is string => typeof tag === 'string')
          : [],
        responseCount: numberOrNull(item.response_count) ?? 0,
        averagePercentage: numberOrNull(item.average_percentage),
        learnersBelow50: numberOrNull(item.learners_below_50) ?? 0,
        masteryBand: text(item.mastery_band) ?? 'not_assessed',
      }
    }),
    interventions: interventions.map(value => {
      const item = record(value)
      return {
        studentId: text(item.student_id) ?? '',
        studentName: text(item.student_name) ?? 'Learner',
        outcomeId: text(item.outcome_id) ?? '',
        outcomeCode: text(item.outcome_code),
        outcomeText: text(item.outcome_text) ?? 'Learning outcome',
        masteryScore: numberOrNull(item.mastery_score) ?? 0,
        masteryLevel: text(item.mastery_level) ?? 'beginning',
        recommendedAction: text(item.recommended_action) ?? 'guided_practice',
      }
    }),
  }
}
