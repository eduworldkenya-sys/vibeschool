import type { SupabaseClient } from '@supabase/supabase-js'

export type PilotFailureClass =
  | 'authentication' | 'authorization' | 'identity' | 'database' | 'rpc'
  | 'network' | 'content' | 'validation' | 'application' | 'external_integration' | 'unknown'
export type PilotOutcome = 'attempted' | 'succeeded' | 'failed' | 'denied' | 'cancelled'
export type PilotNetworkClass = 'online' | 'slow' | 'timeout' | 'offline' | 'unknown'

export const PILOT_EVENTS = {
  loginStarted: 'auth.login_started',
  loginSucceeded: 'auth.login_succeeded',
  loginFailed: 'auth.login_failed',
  identityResolved: 'auth.identity_resolved',
  identityFailed: 'auth.identity_failed',
  onboardingResolved: 'auth.onboarding_resolved',
  dashboardReached: 'auth.dashboard_reached',
  vibeLearnRequested: 'vibelearn.content_requested',
  vibeLearnOpened: 'vibelearn.content_opened',
  vibeLearnRenderFailed: 'vibelearn.render_failed',
} as const

export type PilotEventName = typeof PILOT_EVENTS[keyof typeof PILOT_EVENTS]

export function pilotCorrelationId(): string {
  if (typeof window === 'undefined') return crypto.randomUUID()
  const key = 'vibeschool:pilot-correlation'
  const existing = window.sessionStorage.getItem(key)
  if (existing) return existing
  const id = crypto.randomUUID()
  window.sessionStorage.setItem(key, id)
  return id
}

export function classifyNetworkFailure(error: unknown): { failureClass: PilotFailureClass; networkClass: PilotNetworkClass } {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { failureClass: 'network', networkClass: 'offline' }
  const message = error instanceof Error ? error.message.toLowerCase() : String(error ?? '').toLowerCase()
  if (message.includes('timeout') || message.includes('timed out') || message.includes('abort')) return { failureClass: 'network', networkClass: 'timeout' }
  if (message.includes('network') || message.includes('fetch')) return { failureClass: 'network', networkClass: 'unknown' }
  return { failureClass: 'unknown', networkClass: 'online' }
}

export async function recordPilotEvent(
  supabase: SupabaseClient,
  input: {
    eventName: PilotEventName | string
    surface: string
    outcome: PilotOutcome
    correlationId?: string
    sessionId?: string
    failureClass?: PilotFailureClass
    errorCode?: string
    latencyMs?: number
    networkClass?: PilotNetworkClass
    appVersion?: string
    metadata?: Record<string, string | number | boolean | null>
    idempotencyKey?: string
  }
): Promise<void> {
  const { error } = await supabase.rpc('pilot_record_event', {
    p_event_name: input.eventName,
    p_surface: input.surface,
    p_outcome: input.outcome,
    p_correlation_id: input.correlationId ?? pilotCorrelationId(),
    p_session_id: input.sessionId ?? null,
    p_entity_type: 'application',
    p_entity_id: null,
    p_school_id: null,
    p_failure_class: input.failureClass ?? null,
    p_error_code: input.errorCode?.slice(0, 80) ?? null,
    p_latency_ms: input.latencyMs == null ? null : Math.max(0, Math.min(Math.round(input.latencyMs), 3_600_000)),
    p_network_class: input.networkClass ?? (typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'online'),
    p_app_version: input.appVersion ?? process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 40) ?? null,
    p_metadata: input.metadata ?? {},
    p_idempotency_key: input.idempotencyKey ?? null,
  })

  // Telemetry is non-blocking: an observability failure must never break the user journey.
  if (error && process.env.NODE_ENV !== 'production') console.warn('pilot telemetry rejected', error.code)
}
