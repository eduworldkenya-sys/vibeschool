import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'

type RpcResult<T> = { data: T | null; error: { message?: string } | null }
type Rpc = <T>(name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult<T>>
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Pathways support returned an invalid payload.')
  return value as Record<string, unknown>
}
function text(value: unknown): string | null { return typeof value === 'string' ? value : null }

export interface SupportedPathwayPassport {
  studentId: string
  pathwayId: string
  pathwaySlug: string
  pathwayName: string
  summary: string
  evidenceType: string
  ruleVersion: string
  adoptedAt: string
  reviewedAt: string | null
  updatedAt: string
  supportNotice: string
}

export async function getSupportedPathwayPassport(studentId: string): Promise<SupportedPathwayPassport | null> {
  const { data, error } = await rpc<Json>('pathways_get_supported_learner_passport', { p_student_id: studentId })
  if (error) throw new Error(error.message || 'This learner pathway could not be loaded.')
  if (data === null) return null
  const payload = record(data)
  const pathwayId = text(payload.pathway_id)
  if (!pathwayId) return null
  return {
    studentId: text(payload.student_id) ?? studentId,
    pathwayId,
    pathwaySlug: text(payload.pathway_slug) ?? '',
    pathwayName: text(payload.pathway_name) ?? 'Pathway',
    summary: text(payload.summary) ?? '',
    evidenceType: text(payload.evidence_type) ?? '',
    ruleVersion: text(payload.rule_version) ?? '',
    adoptedAt: text(payload.adopted_at) ?? '',
    reviewedAt: text(payload.reviewed_at),
    updatedAt: text(payload.updated_at) ?? '',
    supportNotice: text(payload.support_notice) ?? 'Learner-owned guidance; support access is read-only.',
  }
}
