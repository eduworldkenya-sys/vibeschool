import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'

type RpcResult<T> = { data: T | null; error: { message?: string } | null }
type Rpc = <T>(name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult<T>>
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc

function rec(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Moderation Engine returned an invalid payload.')
  return value as Record<string, unknown>
}
function str(value: unknown): string | null { return typeof value === 'string' ? value : null }
function num(value: unknown): number {
  const resolved = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(resolved)) throw new Error('Moderation Engine returned an invalid number.')
  return resolved
}

export interface ModerationQueueItem {
  requestId: string
  responseId: string
  attemptId: string
  assessmentTitle: string
  studentName: string
  teacherName: string
  prompt: string
  currentScore: number | null
  requestedScore: number
  maxScore: number
  requestReason: string
  createdAt: string
}

export interface ScoreAuditEvent {
  eventId: string
  eventType: string
  previousScore: number | null
  newScore: number | null
  previousFeedback: string | null
  newFeedback: string | null
  reason: string | null
  actorId: string
  createdAt: string
  metadata: Json
}

export async function requestModeration(input: {
  responseId: string
  requestedScore: number
  reason: string
}): Promise<string> {
  const { data, error } = await rpc<Json>('exq_request_moderation', {
    p_response_id: input.responseId,
    p_requested_score: input.requestedScore,
    p_reason: input.reason,
  })
  if (error) throw new Error(error.message || 'Moderation request could not be created.')
  const payload = rec(data)
  const requestId = str(payload.request_id)
  if (!requestId) throw new Error('Moderation request ID was not returned.')
  return requestId
}

export async function listModerationQueue(): Promise<ModerationQueueItem[]> {
  const { data, error } = await rpc<Json>('exq_list_moderation_queue')
  if (error) throw new Error(error.message || 'Moderation queue could not be loaded.')
  const payload = rec(data)
  const requests = Array.isArray(payload.requests) ? payload.requests : []
  return requests.map(value => {
    const item = rec(value)
    return {
      requestId: str(item.request_id) ?? '',
      responseId: str(item.response_id) ?? '',
      attemptId: str(item.attempt_id) ?? '',
      assessmentTitle: str(item.assessment_title) ?? 'Assessment',
      studentName: str(item.student_name) ?? 'Learner',
      teacherName: str(item.teacher_name) ?? 'Teacher',
      prompt: str(item.prompt) ?? '',
      currentScore: item.current_score === null ? null : num(item.current_score),
      requestedScore: num(item.requested_score),
      maxScore: num(item.max_score),
      requestReason: str(item.request_reason) ?? '',
      createdAt: str(item.created_at) ?? '',
    }
  })
}

export async function reviewModeration(input: {
  requestId: string
  decision: 'approved' | 'rejected'
  reason: string
}): Promise<void> {
  const { error } = await rpc<Json>('exq_review_moderation', {
    p_request_id: input.requestId,
    p_decision: input.decision,
    p_review_reason: input.reason,
  })
  if (error) throw new Error(error.message || 'Moderation decision could not be saved.')
}

export async function getScoreAudit(responseId: string): Promise<ScoreAuditEvent[]> {
  const { data, error } = await rpc<Json>('exq_get_score_audit', { p_response_id: responseId })
  if (error) throw new Error(error.message || 'Score history could not be loaded.')
  const payload = rec(data)
  const events = Array.isArray(payload.events) ? payload.events : []
  return events.map(value => {
    const item = rec(value)
    return {
      eventId: str(item.event_id) ?? '',
      eventType: str(item.event_type) ?? 'event',
      previousScore: item.previous_score === null ? null : num(item.previous_score),
      newScore: item.new_score === null ? null : num(item.new_score),
      previousFeedback: str(item.previous_feedback),
      newFeedback: str(item.new_feedback),
      reason: str(item.reason),
      actorId: str(item.actor_id) ?? '',
      createdAt: str(item.created_at) ?? '',
      metadata: (item.metadata ?? {}) as Json,
    }
  })
}
