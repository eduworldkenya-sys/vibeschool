import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import type { SupabaseClient } from '@supabase/supabase-js'

// ── Server-side Supabase client — SERVICE ROLE key, bypasses RLS ────────────
// ⚠️  NEVER import this file from a "use client" component.
// Only use inside API routes (app/api/**/route.ts) and other server-only code.
//
// This is intentionally separate from lib/supabase.ts, which is the
// browser client used by client components with the anon key.

type TypedServerClient = SupabaseClient<Database>
type DynamicQueryClient = SupabaseClient<any>

// Preserve the typed server client outside PostgREST querying, while using
// Supabase's schema-agnostic query-builder signatures for from/rpc. This keeps
// server query chains useful to TypeScript without expanding the full canonical
// relationship graph across every call site.
type ApplicationServerClient = Omit<TypedServerClient, 'from' | 'rpc'> &
  Pick<DynamicQueryClient, 'from' | 'rpc'>

let serverClient: TypedServerClient | null = null

export function getSupabaseServerClient(): ApplicationServerClient {
  if (!serverClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !serviceKey) {
      throw new Error(
        'Missing Supabase server credentials. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.'
      )
    }

    serverClient = createClient<Database>(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return serverClient as ApplicationServerClient
}
