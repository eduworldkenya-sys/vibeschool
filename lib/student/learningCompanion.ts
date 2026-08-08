import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'

type RpcResult<T> = { data: T | null; error: { message?: string } | null }
type Rpc = <T>(name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult<T>>
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc

function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {} }
function text(value: unknown): string { return typeof value === 'string' ? value : '' }
function number(value: unknown): number { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0 }
function list(value: unknown): Record<string, unknown>[] { return Array.isArray(value) ? value.map(record) : [] }

export interface LearningCompanionSnapshot {
  whatMattersNow: Record<string, unknown> | null
  resumeSession: Record<string, unknown> | null
  todayRevision: Record<string, unknown>[]
  memories: Record<string, unknown>[]
  recentChanges: Record<string, unknown>[]
  confidence: number
  verifiedEvidenceCount: number
  verifiedCalibrationCount: number
  examContextValid: boolean
}

export async function getLearningCompanionSnapshot(): Promise<LearningCompanionSnapshot> {
  const { data, error } = await rpc<Json>('student_get_learning_companion_snapshot')
  if (error) throw new Error(error.message || 'Your learning companion could not be loaded.')
  const row = record(data)
  return {
    whatMattersNow: Object.keys(record(row.what_matters_now)).length ? record(row.what_matters_now) : null,
    resumeSession: Object.keys(record(row.resume_session)).length ? record(row.resume_session) : null,
    todayRevision: list(row.today_revision),
    memories: list(row.what_twin_remembers),
    recentChanges: list(row.recent_changes),
    confidence: number(row.confidence),
    verifiedEvidenceCount: number(row.verified_evidence_count),
    verifiedCalibrationCount: number(row.verified_calibration_count),
    examContextValid: row.exam_context_valid === true,
  }
}

export function companionText(value: unknown): string { return text(value) }
