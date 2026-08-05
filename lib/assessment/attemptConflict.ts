import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'

type RpcError = { message?: string }
type RpcResult<T> = { data: T | null; error: RpcError | null }
type AssessmentRpc = <T>(name: string, args: Record<string, unknown>) => PromiseLike<RpcResult<T>>
const rpc = supabase.rpc.bind(supabase) as unknown as AssessmentRpc

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} returned an invalid payload.`)
  return value as Record<string, unknown>
}
function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} was not returned.`)
  return value
}
function numberValue(value: unknown, label: string): number {
  const resolved = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(resolved)) throw new Error(`${label} was not numeric.`)
  return resolved
}
function rpcFailure(action: string, error: RpcError | null): Error {
  return new Error(error?.message || `Attempt ${action} failed.`)
}

export interface AttemptClientClaim {
  ok: boolean
  conflict: boolean
  activeElsewhere: boolean
  leaseExpiresAt: string | null
}

export async function claimAttemptClient(input: {
  attemptId: string
  clientId: string
  force?: boolean
}): Promise<AttemptClientClaim> {
  const { data, error } = await rpc<Json>('exq_claim_attempt_client', {
    p_attempt_id: input.attemptId,
    p_client_id: input.clientId,
    p_force: input.force ?? false,
  })
  if (error) throw rpcFailure('claim', error)
  const payload = record(data, 'Attempt claim')
  return {
    ok: payload.ok === true,
    conflict: payload.conflict === true,
    activeElsewhere: payload.active_elsewhere === true,
    leaseExpiresAt: typeof payload.lease_expires_at === 'string' ? payload.lease_expires_at : null,
  }
}

export async function releaseAttemptClient(attemptId: string, clientId: string): Promise<void> {
  const { error } = await rpc<Json>('exq_release_attempt_client', {
    p_attempt_id: attemptId,
    p_client_id: clientId,
  })
  if (error) throw rpcFailure('release', error)
}

export type RevisionSaveResult =
  | { ok: true; conflict: false; revision: number; savedAt: string; expiresAt: string | null }
  | { ok: false; conflict: true; revision: number; responseValue: Json; responseText: string | null; savedAt: string | null; clientUpdatedAt: string | null }

export async function saveResponseWithRevision(input: {
  attemptId: string
  assessmentItemId: string
  clientId: string
  expectedRevision: number | null
  responseValue?: unknown
  responseText?: string | null
  clientUpdatedAt?: string | null
}): Promise<RevisionSaveResult> {
  const { data, error } = await rpc<Json>('exq_save_response_v2', {
    p_attempt_id: input.attemptId,
    p_assessment_item_id: input.assessmentItemId,
    p_client_id: input.clientId,
    p_expected_revision: input.expectedRevision,
    p_response_value: input.responseValue ?? null,
    p_response_text: input.responseText ?? null,
    p_client_updated_at: input.clientUpdatedAt ?? new Date().toISOString(),
  })
  if (error) throw rpcFailure('revision save', error)
  const payload = record(data, 'Revision save')

  if (payload.conflict === true) {
    return {
      ok: false,
      conflict: true,
      revision: numberValue(payload.revision, 'Current revision'),
      responseValue: (payload.response_value ?? null) as Json,
      responseText: typeof payload.response_text === 'string' ? payload.response_text : null,
      savedAt: typeof payload.saved_at === 'string' ? payload.saved_at : null,
      clientUpdatedAt: typeof payload.client_updated_at === 'string' ? payload.client_updated_at : null,
    }
  }

  return {
    ok: true,
    conflict: false,
    revision: numberValue(payload.revision, 'Saved revision'),
    savedAt: text(payload.saved_at, 'Save timestamp'),
    expiresAt: typeof payload.expires_at === 'string' ? payload.expires_at : null,
  }
}
