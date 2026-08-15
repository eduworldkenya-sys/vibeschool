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

// The generated Database type remains canonical for migration/rebuild truth.
// Production also contains legacy tables/RPCs that predate complete migration
// reconstruction. Quarantine that compatibility here rather than mutating the
// generated contract or scattering unsafe casts through server routes.
type ApplicationServerClient = TypedServerClient & {
  from(relation: string): any
  rpc(fn: string, args?: Record<string, unknown>): any
}

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
