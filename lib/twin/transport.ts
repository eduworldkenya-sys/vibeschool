import { supabase } from '@/lib/supabase'
import { hqSupabase } from '@/lib/hq/supabase'
import type { TwinRole } from './core'
import type { Json } from '@/lib/database.types'

export const twinRecord = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}

// Untyped RPC transport matches forward-compatible schema deployment. Every response
// is decoded before use; clients carry their own auth, and RPCs enforce authority.
export async function twinRpc(role: TwinRole, name: string, args: Record<string, Json | undefined> = {}): Promise<unknown> {
  const client = role === 'hq' ? hqSupabase : supabase
  const call = client.rpc.bind(client) as unknown as (name: string, args: Record<string, Json | undefined>) => PromiseLike<{data: unknown; error: {message: string} | null}>
  const { data, error } = await call(name, args)
  if (error) throw new Error(error.message)
  return data
}

