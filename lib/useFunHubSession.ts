import { supabase } from '@/lib/supabase'

export interface FunHubSessionParams {
  game_slug: string
  subject: string
  grade: number
  score: number
  xp_earned: number
  correct: number
  total: number
  duration_secs?: number
  streak_max?: number
  /** Stable key for one logical game completion. Reuse it when retrying. */
  idempotency_key?: string
}

export interface FunHubSessionResult {
  session_id: string
  xp_earned: number
  total_xp: number
  level: number
  weekly_xp: number
  monthly_xp: number
  current_streak: number
  longest_streak: number
  idempotent_replay?: boolean
}

function isFunHubSessionResult(value: unknown): value is FunHubSessionResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const row = value as Record<string, unknown>
  return (
    typeof row.session_id === 'string' &&
    typeof row.xp_earned === 'number' &&
    typeof row.total_xp === 'number' &&
    typeof row.level === 'number' &&
    typeof row.weekly_xp === 'number' &&
    typeof row.monthly_xp === 'number' &&
    typeof row.current_streak === 'number' &&
    typeof row.longest_streak === 'number' &&
    (row.idempotent_replay === undefined || typeof row.idempotent_replay === 'boolean')
  )
}

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function pendingKeyStorageKey(gameSlug: string): string {
  return `vibeschool:funhub:pending-session:${gameSlug}`
}

function getOrCreatePendingKey(gameSlug: string): string {
  if (typeof window === 'undefined') return newIdempotencyKey()
  const storageKey = pendingKeyStorageKey(gameSlug)
  const existing = window.sessionStorage.getItem(storageKey)
  if (existing) return existing
  const created = newIdempotencyKey()
  window.sessionStorage.setItem(storageKey, created)
  return created
}

function clearPendingKey(gameSlug: string, key: string): void {
  if (typeof window === 'undefined') return
  const storageKey = pendingKeyStorageKey(gameSlug)
  if (window.sessionStorage.getItem(storageKey) === key) {
    window.sessionStorage.removeItem(storageKey)
  }
}

function isRetryableRpcError(error: unknown): boolean {
  const status =
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as { status?: unknown }).status === 'number'
      ? (error as { status: number }).status
      : null

  return status == null || status === 408 || status === 429 || status >= 500
}

async function callSaveSession(params: FunHubSessionParams, idempotencyKey: string) {
  return supabase.rpc('funhub_save_session', {
    p_game_slug: params.game_slug,
    p_subject: params.subject,
    p_grade: params.grade,
    p_score: params.score,
    p_xp_earned: params.xp_earned,
    p_correct: params.correct,
    p_total: params.total,
    p_duration_secs: params.duration_secs ?? 0,
    p_streak_max: params.streak_max ?? 0,
    p_idempotency_key: idempotencyKey,
  })
}

export async function saveFunHubSession(
  params: FunHubSessionParams
): Promise<FunHubSessionResult | null> {
  const explicitKey = params.idempotency_key?.trim()
  const idempotencyKey = explicitKey || getOrCreatePendingKey(params.game_slug)

  try {
    let { data, error } = await callSaveSession(params, idempotencyKey)

    // A response can be lost after the database commits. Retry the exact same
    // logical operation once so the server returns the existing session rather
    // than awarding XP or streak progress a second time.
    if (error && isRetryableRpcError(error)) {
      const retry = await callSaveSession(params, idempotencyKey)
      data = retry.data
      error = retry.error
    }

    if (error) {
      console.error('[FunHub] save_session error:', error)
      return null
    }

    if (!isFunHubSessionResult(data)) {
      console.error('[FunHub] Invalid save_session response:', data)
      return null
    }

    // Only clear the pending key after the server has confirmed the logical
    // completion. If the browser dies before this point, the next attempt
    // reuses the same key and is therefore safely idempotent.
    if (!explicitKey) clearPendingKey(params.game_slug, idempotencyKey)

    return data
  } catch (e) {
    console.error('[FunHub] save_session exception:', e)
    return null
  }
}
