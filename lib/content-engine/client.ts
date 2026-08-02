import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../database.types'

export type ContentEngineClient = SupabaseClient<Database>

export function requireContentEngineClient(
  client: ContentEngineClient | null | undefined,
): ContentEngineClient {
  if (!client) {
    throw new Error('A typed Supabase client is required.')
  }

  return client
}
