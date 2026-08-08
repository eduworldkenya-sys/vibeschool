import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'
import type { LearningRepresentation, LearningRepresentationRecommendation, LearningSourceType } from '@/lib/student/learningTransform'

export interface MultimodalTeachingStage {
  stage: number
  representation: LearningRepresentation
  intent: string
}

export interface MultimodalTeachingSequence {
  policy: string
  sourceType: LearningSourceType
  sourceId: string
  learnerChoiceAllowed: boolean
  masteryWriteAllowed: boolean
  recommendation: LearningRepresentationRecommendation | null
  stages: MultimodalTeachingStage[]
}

type RpcResult<T> = { data: T | null; error: { message?: string } | null }
type Rpc = <T>(name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult<T>>
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
function text(value: unknown): string { return typeof value === 'string' ? value : '' }
function number(value: unknown): number { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0 }
function nullableNumber(value: unknown): number | null { if (value === null || value === undefined || value === '') return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null }

const allowed = new Set<LearningRepresentation>(['immersive','simplify','mind_map','flashcards','quiz','audio_lesson','revision_sheet','worked_examples','visual_explainer','story_mode'])

export async function getMultimodalTeachingSequence(sourceType: LearningSourceType, sourceId: string): Promise<MultimodalTeachingSequence> {
  const { data, error } = await rpc<Json>('student_get_multimodal_teaching_sequence', { p_source_type: sourceType, p_source_id: sourceId })
  if (error) throw new Error(error.message || 'Twin could not prepare a multimodal teaching path.')
  const row = record(data)
  const recommendationRaw = record(row.recommendation)
  const recommendationRep = text(recommendationRaw.representation) as LearningRepresentation
  const recommendation: LearningRepresentationRecommendation | null = allowed.has(recommendationRep) ? {
    representation: recommendationRep,
    outcomeId: text(recommendationRaw.outcome_id) || null,
    reason: text(recommendationRaw.reason),
    policy: text(recommendationRaw.policy),
    effectivenessScore: nullableNumber(recommendationRaw.effectiveness_score),
    effectivenessAttempts: nullableNumber(recommendationRaw.effectiveness_attempts),
    effectivenessConfidence: nullableNumber(recommendationRaw.effectiveness_confidence),
    behavioralScore: nullableNumber(recommendationRaw.behavioral_score),
  } : null
  const stages = (Array.isArray(row.stages) ? row.stages : []).map(item => {
    const stage = record(item)
    const representation = text(stage.representation) as LearningRepresentation
    return { stage: number(stage.stage), representation, intent: text(stage.intent) }
  }).filter(stage => stage.stage > 0 && allowed.has(stage.representation))

  return {
    policy: text(row.policy),
    sourceType,
    sourceId,
    learnerChoiceAllowed: row.learner_choice_allowed !== false,
    masteryWriteAllowed: row.mastery_write_allowed === true,
    recommendation,
    stages,
  }
}
