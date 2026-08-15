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

// The generated Database type is the canonical migration/rebuild contract.
// Production still contains legacy objects that predate reconstructable migration
// history. Keep that drift quarantined at this application boundary instead of
// corrupting generated types or teaching unrelated UI code to lie with casts.
// Known canonical relations/RPCs retain TypedBrowserClient overloads; the broad
// overloads preserve compatibility for legacy-production objects until their
// migrations are reconciled into the canonical rebuild.
type ApplicationSupabaseClient = TypedBrowserClient & {
  from(relation: string): any
  rpc(fn: string, args?: Record<string, unknown>): any
}

// Safe singleton — only created once on client side
let client: TypedBrowserClient | null = null

export function getSupabaseClient(): ApplicationSupabaseClient {
  if (!client) {
    client = createSupabaseClient()
  }
  return client as ApplicationSupabaseClient
}

export const supabase = getSupabaseClient()

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