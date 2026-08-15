import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'

export function createSupabaseClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        maxAge: 60 * 60 * 24 * 7,
      },
      cookieEncoding: "raw",
    }
  )
}

type TypedBrowserClient = ReturnType<typeof createBrowserClient<Database>>

// Keep the generated Database contract authoritative while placing a bounded
// compiler-complexity boundary around the shared application client. Without
// these fallback overloads, Supabase/PostgREST relationship inference expands
// the full generated relationship graph at every shared-client call site and
// makes project-wide TypeScript validation non-terminating in CI.
//
// Known generated relations/RPCs still retain the TypedBrowserClient overloads;
// the string fallbacks exist only as the compatibility/performance boundary.
type ApplicationSupabaseClient = TypedBrowserClient & {
  from(relation: string): any
  rpc(fn: string, args?: Record<string, unknown>): any
}

// Safe singleton — only created once on client side
let client: TypedBrowserClient | null = null

export function getSupabaseClient() {
  if (!client) {
    client = createSupabaseClient()
  }
  return client
}

export const supabase = getSupabaseClient() as ApplicationSupabaseClient

export async function getTeacherProfile(userId: string) {
  const sb = getSupabaseClient()
  const { data: profile, error: profileErr } = await sb
    .from('profiles')
    .select('full_name, phone, school_id, schools(name)')
    .eq('id', userId)
    .single()
  if (profileErr) { console.error('getTeacherProfile error:', profileErr); return null }

  return {
    name: profile?.full_name ?? '',
    school: (profile?.schools as unknown as { name: string } | null)?.name ?? '',
    phone: profile?.phone ?? '',
  }
}

export async function updateTeacherProfile(userId: string, updates: {
  name?: string
  phone?: string
}) {
  const sb = getSupabaseClient()
  const { data, error } = await sb
    .from('profiles')
    .update({
      full_name: updates.name,
      phone: updates.phone,
    })
    .eq('id', userId)
    .select()
    .single()
  if (error) console.error('updateTeacherProfile error:', error)
  return data
}

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!