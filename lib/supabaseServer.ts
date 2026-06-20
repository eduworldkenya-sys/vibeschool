import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// ── Server-side Supabase client — SERVICE ROLE key, bypasses RLS ────────────
// ⚠️  NEVER import this file from a "use client" component.
// Only use inside API routes (app/api/**/route.ts) and other server-only code.
//
// This is intentionally separate from lib/supabase.ts, which is the
// browser client used by client components with the anon key.

// NOTE: explicitly typed as SupabaseClient<any> due to an unresolved
// generic-inference issue between our Database type and the installed
// @supabase/postgrest-js (2.105.4) GenericSchema constraints — confirmed
// via isolated test files that Database itself is structurally correct,
// but createClient<Database>() still resolves Functions/Tables to never.
// This keeps runtime behavior unaffected (RPC calls work fine; only
// compile-time typing is loosened here). Revisit on supabase-js upgrade.
import type { SupabaseClient } from '@supabase/supabase-js'
let serverClient: SupabaseClient<any> | null = null

export function getSupabaseServerClient() {
  if (!serverClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !serviceKey) {
      throw new Error(
        'Missing Supabase server credentials. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.'
      )
    }

    serverClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return serverClient
}
