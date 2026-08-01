import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// ── Server-side Supabase client — SERVICE ROLE key, bypasses RLS ────────────
// ⚠️  NEVER import this file from a "use client" component.
// Only use inside API routes (app/api/**/route.ts) and other server-only code.
//
// This is intentionally separate from lib/supabase.ts, which is the
// browser client used by client components with the anon key.

// CE-FE-001: lib/database.types.ts is now generated from the live schema
// (previously a 2-table hand-written stub). Attempting real typing here.
// If `npm run typecheck` still resolves Functions/Tables to never on this
// supabase-js/postgrest-js version, revert this hunk from the backup in
// .ce_fe_001_backups/ — it is a compile-time-only fallback, not a runtime bug.
import type { SupabaseClient } from '@supabase/supabase-js'
let serverClient: SupabaseClient<Database> | null = null

export function getSupabaseServerClient() {
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
  return serverClient
}
