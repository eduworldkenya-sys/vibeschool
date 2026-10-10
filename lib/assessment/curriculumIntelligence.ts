import { supabase } from '@/lib/supabase'

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
  masteryScore: number | null
  masteryLevel: string
  recommendedAction: string
}

export interface CurriculumIntelligence {
  assignmentId: string
  outcomes: OutcomeIntelligence[]
  interventions: InterventionSignal[]
}

async function rpc(name: string, args?: Record<string, unknown>): Promise<{ data: unknown; error: { message?: string } | null }> {
  const { data, error } = await supabase.rpc(name, args)
  return { data, error }
}

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
  if (value === null || value === undefined || value === '') return null
  const result = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(result) ? result : null
}

export async function linkAssessmentItemOutcome(input: {
  assessmentItemId: string
  outcomeId: string
  weight?: number
}): Promise<void> {
  const { error } = await rpc('exq_link_item_outcome', {
    p_assessment_item_id: input.assessmentItemId,
    p_outcome_id: input.outcomeId,
    p_weight: input.weight ?? 1,
  })
  if (error) throw new Error(error.message || 'Outcome could not be linked.')
}

export async function syncAttemptOutcomeEvidence(attemptId: string): Promise<void> {
  const { error } = await rpc('exq_sync_attempt_outcome_evidence', {
    p_attempt_id: attemptId,
  })
  if (error) throw new Error(error.message || 'Outcome evidence could not be synchronized.')
}

export async function getCurriculumIntelligence(
  assignmentId: string,
): Promise<CurriculumIntelligence> {
  const { data, error } = await rpc('exq_get_curriculum_intelligence', {
    p_assignment_id: assignmentId,
  })
  if (error) throw new Error(error.message || 'Could not load curriculum intelligence.')

  const payload = record(data)
  if (
    text(payload.assignment_id) !== assignmentId ||
    !Array.isArray(payload.outcomes) ||
    !Array.isArray(payload.interventions)
  )
    throw new Error(
      'Learning outcome evidence returned an incomplete payload. Retry before drawing conclusions.',
    )
  const outcomes = Array.isArray(payload.outcomes) ? payload.outcomes : []
  const interventions = Array.isArray(payload.interventions) ? payload.interventions : []

  return {
    assignmentId: text(payload.assignment_id) ?? assignmentId,
    outcomes: outcomes.map((value) => {
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
    interventions: interventions.map((value) => {
      const item = record(value)
      return {
        studentId: text(item.student_id) ?? '',
        studentName: text(item.student_name) ?? 'Learner',
        outcomeId: text(item.outcome_id) ?? '',
        outcomeCode: text(item.outcome_code),
        outcomeText: text(item.outcome_text) ?? 'Learning outcome',
        masteryScore: numberOrNull(item.mastery_score),
        masteryLevel: text(item.mastery_level) ?? 'not_assessed',
        recommendedAction: text(item.recommended_action) ?? 'guided_practice',
      }
    }),
  }
}
