import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'

type RpcResult<T> = { data: T | null; error: { message?: string } | null }
type Rpc = <T>(name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult<T>>
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Pathways returned an invalid payload.')
  return value as Record<string, unknown>
}
function text(value: unknown): string | null { return typeof value === 'string' ? value : null }

export interface PathwayPassport {
  studentId: string
  pathwayId: string
  pathwaySlug: string
  pathwayName: string
  summary: string
  evidenceType: string
  evidenceSnapshot: Json
  ruleVersion: string
  adoptedAt: string
  reviewedAt: string | null
  updatedAt: string
}

export interface AdoptQuickCheckInput {
  pathwaySlug: string
  answers: Record<string, number>
  scores: Record<string, number>
  ruleVersion: string
  idempotencyKey: string
}

export async function adoptQuickCheck(input: AdoptQuickCheckInput): Promise<{ pathwayName: string; pathwaySlug: string; savedAt: string }> {
  const { data, error } = await rpc<Json>('student_adopt_pathway_quick_check', {
    p_pathway_slug: input.pathwaySlug,
    p_answers: input.answers,
    p_scores: input.scores,
    p_rule_version: input.ruleVersion,
    p_idempotency_key: input.idempotencyKey,
  })
  if (error) throw new Error(error.message || 'Your pathway could not be saved.')
  const payload = record(data)
  return {
    pathwayName: text(payload.pathway_name) ?? 'Pathway',
    pathwaySlug: text(payload.pathway_slug) ?? input.pathwaySlug,
    savedAt: text(payload.saved_at) ?? new Date().toISOString(),
  }
}

export async function getPathwayPassport(): Promise<PathwayPassport | null> {
  const { data, error } = await rpc<Json>('student_get_pathway_passport')
  if (error) throw new Error(error.message || 'Your Pathway Passport could not be loaded.')
  if (data === null) return null
  const payload = record(data)
  const pathwayId = text(payload.pathway_id)
  if (!pathwayId) return null
  return {
    studentId: text(payload.student_id) ?? '',
    pathwayId,
    pathwaySlug: text(payload.pathway_slug) ?? '',
    pathwayName: text(payload.pathway_name) ?? 'Pathway',
    summary: text(payload.summary) ?? '',
    evidenceType: text(payload.evidence_type) ?? 'quick_check',
    evidenceSnapshot: (payload.evidence_snapshot ?? {}) as Json,
    ruleVersion: text(payload.rule_version) ?? '',
    adoptedAt: text(payload.adopted_at) ?? '',
    reviewedAt: text(payload.reviewed_at),
    updatedAt: text(payload.updated_at) ?? '',
  }
}
