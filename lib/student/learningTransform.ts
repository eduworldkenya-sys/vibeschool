import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'

export type LearningSourceType = 'chapter' | 'homework' | 'teacher_content' | 'vibelearn_content' | 'resource'
export type LearningRepresentation = 'immersive' | 'simplify' | 'mind_map' | 'flashcards' | 'quiz' | 'audio_lesson' | 'revision_sheet' | 'worked_examples' | 'visual_explainer' | 'story_mode'
export type LearningGeneratedAssetType = 'diagram' | 'audio' | 'simulation' | 'timeline' | 'formula_visual'

export interface LearningTransformSource {
  sourceType: LearningSourceType
  sourceId: string
  title: string
  subtitle: string | null
  touchedAt: string | null
  priority: number
}
export interface LearningRepresentationRecommendation {
  representation: LearningRepresentation
  outcomeId: string | null
  reason: string
  policy: string
  effectivenessScore: number | null
  effectivenessAttempts: number | null
  effectivenessConfidence: number | null
  behavioralScore: number | null
}
export interface LearningTransformSection { heading?: string; body?: string; bullets?: string[]; check?: { question?: string; answer?: string } }
export interface LearningTransformCard { front: string; back: string }
export interface LearningTransformNode { label: string; children?: LearningTransformNode[] }
export interface LearningTransformQuestion { prompt: string; options: string[]; correctIndex: number; explanation?: string }
export interface LearningTransformScriptLine { speaker: string; text: string }
export interface LearningTransformWorkedExample { problem: string; steps: string[]; answer: string }
export interface LearningTransformVisualStep { label: string; description: string }
export interface LearningTransformPayload {
  title?: string
  intro?: string
  sections?: LearningTransformSection[]
  takeaways?: string[]
  cards?: LearningTransformCard[]
  nodes?: LearningTransformNode[]
  questions?: LearningTransformQuestion[]
  script?: LearningTransformScriptLine[]
  workedExamples?: LearningTransformWorkedExample[]
  visualSteps?: LearningTransformVisualStep[]
  story?: { setting?: string; narrative?: string; learningLink?: string }
  degraded?: boolean
  sourceGrounded?: boolean
  source?: Record<string, unknown>
}
export interface LearningTransformation {
  id: string
  sourceType: LearningSourceType
  sourceId: string
  representation: LearningRepresentation
  payload: LearningTransformPayload
  cached: boolean
  model: string | null
  quality: Record<string, unknown>
}
export interface LearningGeneratedAsset {
  id: string
  assetType: LearningGeneratedAssetType
  status: 'ready' | 'degraded' | 'failed'
  payload: Record<string, unknown>
  sourceVersion: string
  generator: string
  model: string | null
  quality: Record<string, unknown>
  createdAt: string
  expiresAt: string
}

type RpcResult<T> = { data: T | null; error: { message?: string } | null }
type Rpc = <T>(name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult<T>>
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc

function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {} }
function text(value: unknown): string { return typeof value === 'string' ? value : '' }
function number(value: unknown): number { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0 }
function nullableNumber(value: unknown): number | null { if (value === null || value === undefined || value === '') return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [] }
function sections(value: unknown): LearningTransformSection[] {
  return Array.isArray(value) ? value.map(item => {
    const row = record(item); const check = record(row.check)
    return { heading: text(row.heading) || undefined, body: text(row.body) || undefined, bullets: strings(row.bullets), check: text(check.question) || text(check.answer) ? { question: text(check.question) || undefined, answer: text(check.answer) || undefined } : undefined }
  }) : []
}
function nodes(value: unknown): LearningTransformNode[] {
  return Array.isArray(value) ? value.map(item => { const row = record(item); return { label: text(row.label), children: nodes(row.children) } }).filter(item => item.label) : []
}
function objectArray(value: unknown): Record<string, unknown>[] { return Array.isArray(value) ? value.map(record) : [] }
function parsePayload(value: unknown): LearningTransformPayload {
  const row = record(value); const story = record(row.story)
  const workedRaw = row.workedExamples ?? row.worked_examples
  const visualRaw = row.visualSteps ?? row.visual_steps
  return {
    title: text(row.title) || undefined,
    intro: text(row.intro) || undefined,
    sections: sections(row.sections),
    takeaways: strings(row.takeaways),
    cards: objectArray(row.cards).map(item => ({ front: text(item.front), back: text(item.back) })).filter(item => item.front && item.back),
    nodes: nodes(row.nodes),
    questions: objectArray(row.questions).map(item => ({ prompt: text(item.prompt), options: strings(item.options), correctIndex: number(item.correctIndex ?? item.correct_index), explanation: text(item.explanation) || undefined })).filter(item => item.prompt && item.options.length >= 2 && Number.isInteger(item.correctIndex)),
    script: objectArray(row.script).map(item => ({ speaker: text(item.speaker) || 'Tutor', text: text(item.text) })).filter(item => item.text),
    workedExamples: objectArray(workedRaw).map(item => ({ problem: text(item.problem), steps: strings(item.steps), answer: text(item.answer) })).filter(item => item.problem),
    visualSteps: objectArray(visualRaw).map(item => ({ label: text(item.label), description: text(item.description) })).filter(item => item.label || item.description),
    story: text(story.narrative) ? { setting: text(story.setting) || undefined, narrative: text(story.narrative), learningLink: text(story.learningLink ?? story.learning_link) || undefined } : undefined,
    degraded: row.degraded === true,
    sourceGrounded: row.sourceGrounded === true || row.source_grounded === true,
    source: record(row.source),
  }
}

export async function listLearningTransformSources(limit = 30): Promise<LearningTransformSource[]> {
  const { data, error } = await rpc<Json>('student_list_learning_transform_sources', { p_limit: limit })
  if (error) throw new Error(error.message || 'Learning sources could not be loaded.')
  const payload = record(data)
  return (Array.isArray(payload.sources) ? payload.sources : []).map(item => {
    const row = record(item)
    return { sourceType: text(row.source_type) as LearningSourceType, sourceId: text(row.source_id), title: text(row.title) || 'Learning material', subtitle: text(row.subtitle) || null, touchedAt: text(row.touched_at) || null, priority: number(row.priority) }
  }).filter(item => item.sourceId && ['chapter','homework','teacher_content','vibelearn_content','resource'].includes(item.sourceType))
}

export async function getRecommendedLearningRepresentation(sourceType: LearningSourceType, sourceId: string): Promise<LearningRepresentationRecommendation> {
  const { data, error } = await rpc<Json>('student_recommend_learning_representation', { p_source_type: sourceType, p_source_id: sourceId })
  if (error) throw new Error(error.message || 'Twin could not choose a learning format.')
  const row = record(data)
  const representation = text(row.representation) as LearningRepresentation
  const allowed: LearningRepresentation[] = ['immersive','simplify','mind_map','flashcards','quiz','audio_lesson','revision_sheet','worked_examples','visual_explainer','story_mode']
  return {
    representation: allowed.includes(representation) ? representation : 'immersive',
    outcomeId: text(row.outcome_id) || null,
    reason: text(row.reason) || 'safe_default',
    policy: text(row.policy) || 'verified_effectiveness_then_behavioral_preference_then_safe_default',
    effectivenessScore: nullableNumber(row.effectiveness_score),
    effectivenessAttempts: nullableNumber(row.effectiveness_attempts),
    effectivenessConfidence: nullableNumber(row.effectiveness_confidence),
    behavioralScore: nullableNumber(row.behavioral_score),
  }
}

export async function getLearningTransformation(sourceType: LearningSourceType, sourceId: string, representation: LearningRepresentation): Promise<LearningTransformation> {
  const { data, error } = await supabase.functions.invoke('learning-transform', { body: { sourceType, sourceId, representation } })
  if (error) throw new Error(error.message || 'This learning view could not be prepared.')
  const row = record(data)
  if (text(row.error)) throw new Error(text(row.error))
  const id = text(row.id)
  if (!id) throw new Error('The learning transformation did not return a valid record.')
  return { id, sourceType, sourceId, representation, payload: parsePayload(row.payload), cached: row.cached === true, model: text(row.model) || null, quality: record(row.quality) }
}

export async function recordLearningTransformationEvent(transformationId: string, eventType: 'viewed' | 'completed' | 'helpful' | 'not_helpful', metadata: Json = {}): Promise<void> {
  const { error } = await rpc<Json>('student_record_learning_transformation_event', { p_transformation_id: transformationId, p_event_type: eventType, p_metadata: metadata })
  if (error) throw new Error(error.message || 'Learning feedback could not be recorded.')
}

export async function getLearningGeneratedAssets(transformationId: string): Promise<LearningGeneratedAsset[]> {
  const { data, error } = await rpc<Json>('student_get_learning_generated_assets', { p_transformation_id: transformationId })
  if (error) throw new Error(error.message || 'Rich learning assets could not be loaded.')
  const payload = record(data)
  return objectArray(payload.assets).map(item => ({
    id: text(item.id),
    assetType: text(item.asset_type) as LearningGeneratedAssetType,
    status: (['ready','degraded','failed'].includes(text(item.status)) ? text(item.status) : 'failed') as LearningGeneratedAsset['status'],
    payload: record(item.payload),
    sourceVersion: text(item.source_version),
    generator: text(item.generator),
    model: text(item.model) || null,
    quality: record(item.quality),
    createdAt: text(item.created_at),
    expiresAt: text(item.expires_at),
  })).filter(item => item.id && ['diagram','audio','simulation','timeline','formula_visual'].includes(item.assetType))
}

export async function upsertLearningGeneratedAsset(
  transformationId: string,
  assetType: LearningGeneratedAssetType,
  payload: Json,
  options: { status?: LearningGeneratedAsset['status']; generator?: string; model?: string | null; quality?: Json } = {},
): Promise<void> {
  const { error } = await rpc<Json>('student_upsert_learning_generated_asset', {
    p_transformation_id: transformationId,
    p_asset_type: assetType,
    p_payload: payload,
    p_status: options.status ?? 'ready',
    p_generator: options.generator ?? 'deterministic_rich_media_v1',
    p_model: options.model ?? null,
    p_quality: options.quality ?? {},
  })
  if (error) throw new Error(error.message || 'Rich learning asset could not be saved.')
}
