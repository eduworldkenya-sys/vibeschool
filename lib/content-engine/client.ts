import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../database.types'

type TypedContentEngineClient = SupabaseClient<Database>

// Content-engine helpers use only the authenticated identity plus PostgREST
// relation/RPC methods. Keep this structural instead of requiring the concrete
// SupabaseClient class so the application query-compatibility boundary can be
// passed without re-enabling the generated-schema inference explosion.
export type ContentEngineClient = Pick<TypedContentEngineClient, 'auth'> & {
  from(relation: string): any
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
