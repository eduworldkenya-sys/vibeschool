import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'

type RpcResult<T> = { data: T | null; error: { message?: string } | null }
type Rpc = <T>(name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult<T>>
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Assessment Intelligence returned an invalid payload.')
  return value as Record<string, unknown>
}
function text(value: unknown): string | null { return typeof value === 'string' ? value : null }
function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const result = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(result) ? result : null
}

export interface IntelligenceBand {
  label: string
  responseCount: number
  averagePercentage: number | null
  learnersBelow50: number
}
export interface QuestionIntelligence {
  assessmentItemId: string
  orderNum: number
  prompt: string
  questionType: string
  difficulty: string
  bloomLevel: string
  responseCount: number
  averagePercentage: number | null
  zeroScoreCount: number
  fullScoreCount: number
  performanceBand: string
}
export interface OutcomeIntelligence {
  outcomeId: string
  outcomeCode: string | null
  outcomeText: string
  responseCount: number
  averagePercentage: number | null
  learnersBelow50: number
  masteryBand: string
}
export interface MisconceptionSignal {
  assessmentItemId: string
  orderNum: number
  prompt: string
  averagePercentage: number | null
  zeroScoreCount: number
  affectedLearners: number
  signal: string
  recommendedAction: string
}
export interface AssignmentIntelligence {
  assignmentId: string
  questions: QuestionIntelligence[]
  difficulty: IntelligenceBand[]
  bloom: IntelligenceBand[]
  outcomes: OutcomeIntelligence[]
  misconceptions: MisconceptionSignal[]
}

export async function getAssignmentIntelligence(assignmentId: string): Promise<AssignmentIntelligence> {
  const { data, error } = await rpc<Json>('exq_get_assignment_intelligence', { p_assignment_id: assignmentId })
  if (error) throw new Error(error.message || 'Could not load assessment intelligence.')
  const payload = record(data)
  const list = (value: unknown) => Array.isArray(value) ? value : []
  const band = (value: unknown, key: string): IntelligenceBand => {
    const item = record(value)
    return {
      label: text(item[key]) ?? 'unclassified',
      responseCount: numberOrNull(item.response_count) ?? 0,
      averagePercentage: numberOrNull(item.average_percentage),
      learnersBelow50: numberOrNull(item.learners_below_50) ?? 0,
    }
  }
  return {
    assignmentId: text(payload.assignment_id) ?? assignmentId,
    questions: list(payload.questions).map(value => {
      const item = record(value)
      return {
        assessmentItemId: text(item.assessment_item_id) ?? '',
        orderNum: numberOrNull(item.order_num) ?? 0,
        prompt: text(item.prompt) ?? '',
        questionType: text(item.question_type) ?? 'question',
        difficulty: text(item.difficulty) ?? 'unclassified',
        bloomLevel: text(item.bloom_level) ?? 'unclassified',
        responseCount: numberOrNull(item.response_count) ?? 0,
        averagePercentage: numberOrNull(item.average_percentage),
        zeroScoreCount: numberOrNull(item.zero_score_count) ?? 0,
        fullScoreCount: numberOrNull(item.full_score_count) ?? 0,
        performanceBand: text(item.performance_band) ?? 'not_assessed',
      }
    }),
    difficulty: list(payload.difficulty).map(value => band(value, 'difficulty')),
    bloom: list(payload.bloom).map(value => band(value, 'bloom_level')),
    outcomes: list(payload.outcomes).map(value => {
      const item = record(value)
      return {
        outcomeId: text(item.outcome_id) ?? '',
        outcomeCode: text(item.outcome_code),
        outcomeText: text(item.outcome_text) ?? '',
        responseCount: numberOrNull(item.response_count) ?? 0,
        averagePercentage: numberOrNull(item.average_percentage),
        learnersBelow50: numberOrNull(item.learners_below_50) ?? 0,
        masteryBand: text(item.mastery_band) ?? 'not_assessed',
      }
    }),
    misconceptions: list(payload.misconceptions).map(value => {
      const item = record(value)
      return {
        assessmentItemId: text(item.assessment_item_id) ?? '',
        orderNum: numberOrNull(item.order_num) ?? 0,
        prompt: text(item.prompt) ?? '',
        averagePercentage: numberOrNull(item.average_percentage),
        zeroScoreCount: numberOrNull(item.zero_score_count) ?? 0,
        affectedLearners: numberOrNull(item.affected_learners) ?? 0,
        signal: text(item.signal) ?? 'monitor',
        recommendedAction: text(item.recommended_action) ?? 'review_examples_and_monitor',
      }
    }),
  }
}
