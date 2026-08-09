import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'

type RpcResult<T> = { data: T | null; error: { message?: string } | null }
type Rpc = <T>(name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult<T>>
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc

export type TwinPolicyState = {
  enabled: boolean
  dailyLimit: number
  usedToday: number
  remaining: number
  source: 'live' | 'last_known_good'
}

type StoredTwinPolicy = Omit<TwinPolicyState, 'source'> & { savedAt: number }
const CACHE_KEY = 'vibeschool:twin-policy:lkg:v1'
const MAX_LKG_AGE_MS = 24 * 60 * 60 * 1000

function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {} }
function num(value: unknown, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback }
function readLkg(): TwinPolicyState | null {
  if (typeof window === 'undefined') return null
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? 'null') as StoredTwinPolicy | null
    if (!parsed || Date.now() - parsed.savedAt > MAX_LKG_AGE_MS) return null
    return { enabled: parsed.enabled === true, dailyLimit: num(parsed.dailyLimit, 5), usedToday: num(parsed.usedToday, 0), remaining: num(parsed.remaining, 0), source: 'last_known_good' }
  } catch { return null }
}
function writeLkg(state: Omit<TwinPolicyState, 'source'>) {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(CACHE_KEY, JSON.stringify({ ...state, savedAt: Date.now() })) } catch {}
}

export async function getTwinPolicyState(): Promise<TwinPolicyState> {
  const { data, error } = await rpc<Json>('student_twin_policy_state')
  if (error) {
    const cached = readLkg()
    if (cached) return cached
    throw new Error(error.message || 'Twin policy could not be verified.')
  }
  const row = record(data)
  const state = { enabled: row.enabled === true, dailyLimit: num(row.daily_limit, 5), usedToday: num(row.used_today, 0), remaining: num(row.remaining, 0) }
  writeLkg(state)
  return { ...state, source: 'live' }
}

export async function consumeTwinSession(sessionId: string): Promise<TwinPolicyState> {
  const key = sessionId.trim()
  if (!key) throw new Error('Twin session identity is required.')
  const { data, error } = await rpc<Json>('student_consume_twin_session', { p_session_key: key })
  if (error) throw new Error(error.message || 'Twin session could not be authorized.')
  const row = record(data)
  const state = { enabled: true, dailyLimit: num(row.daily_limit, 5), usedToday: num(row.used_today, 0), remaining: num(row.remaining, 0) }
  writeLkg(state)
  return { ...state, source: 'live' }
}
