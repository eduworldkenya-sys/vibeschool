import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../database.types'

type TypedContentEngineClient = SupabaseClient<Database>
export type ContentEngineClient = TypedContentEngineClient & {
  rpc(fn: string, args?: Record<string, unknown>): any
}

export function requireContentEngineClient(
  client: ContentEngineClient | null | undefined,
): ContentEngineClient {
  if (!client) {
    throw new Error('A Supabase content-engine client is required.')
  }

  return client
}
