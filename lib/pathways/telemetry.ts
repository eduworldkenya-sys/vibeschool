import { supabase } from '@/lib/supabase'

type RpcResult<T> = { data: T | null; error: { message?: string } | null }
type Rpc = <T>(name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult<T>>
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc

export type PathwaysEvent =
  | 'pathways_landing_viewed'
  | 'pathways_started'
  | 'pathways_meaningful_progress'
  | 'pathways_preliminary_result_viewed'
  | 'pathways_auth_prompt_viewed'
  | 'pathways_auth_started'
  | 'pathways_auth_completed'
  | 'pathways_state_restored'
  | 'pathways_full_result_viewed'
  | 'pathways_saved_or_adopted'
  | 'pathways_next_action_completed'
  | 'pathways_shared'
  | 'pathways_returned'

const SESSION_KEY = 'vs_pathways_anon_session_v1'

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `00000000-0000-4000-8000-${Math.random().toString(16).slice(2).padEnd(12,'0').slice(0,12)}`
}

export function getPathwaysAnonymousSessionId(): string {
  if (typeof window === 'undefined') return '00000000-0000-4000-8000-000000000000'
  let value = window.localStorage.getItem(SESSION_KEY)
  if (!value) { value = uuid(); window.localStorage.setItem(SESSION_KEY, value) }
  return value
}

export async function recordPathwaysEvent(event: PathwaysEvent, input: {
  route?: string
  source?: string
  campaign?: string
  variant?: string
  action?: string
  onceKey?: string
} = {}): Promise<void> {
  if (typeof window === 'undefined') return
  const sessionId = getPathwaysAnonymousSessionId()
  const onceKey = input.onceKey ?? `${event}:${input.route ?? location.pathname}:${input.action ?? ''}`
  const idempotencyKey = `pathways:${sessionId}:${onceKey}`.slice(0,160)
  const { error } = await rpc<string>('pathways_record_funnel_event', {
    p_anonymous_session_id: sessionId,
    p_event_type: event,
    p_route: input.route ?? location.pathname,
    p_source: input.source ?? null,
    p_campaign: input.campaign ?? null,
    p_variant: input.variant ?? null,
    p_action: input.action ?? null,
    p_idempotency_key: idempotencyKey,
  })
  if (error && process.env.NODE_ENV !== 'production') console.warn('Pathways telemetry:', error.message)
}
