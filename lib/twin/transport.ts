import { supabase } from '@/lib/supabase'
import { hqSupabase } from '@/lib/hq/supabase'
import type { TwinRole } from './core'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/database.types'

export const twinRecord = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}

type TwinRpcDatabase = Database & { public: Database['public'] & { Functions: Record<string, { Args: Record<string, Json | undefined>; Returns: Json }> } }

// Forward-compatible RPC schema boundary. Every response
// is decoded before use; clients carry their own auth, and RPCs enforce authority.
export async function twinRpc(role: TwinRole, name: string, args: Record<string, Json | undefined> = {}): Promise<unknown> {
  const client: SupabaseClient<TwinRpcDatabase> = role === 'hq' ? hqSupabase : supabase
  const { data, error } = await client.rpc(name, args)
  if (error) throw new Error(error.message)
  return data
}

