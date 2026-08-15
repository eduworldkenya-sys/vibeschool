import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
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
type DynamicQueryClient = SupabaseClient<any>
type DynamicFromResult = ReturnType<DynamicQueryClient['from']>

type ApplicationQueryMethods = {
  // PostgREST cannot infer many-to-one cardinality from an untyped schema for
  // this embedded relation, so leave this one legacy relation dynamic and let
  // the feature's explicit Profile contract own the narrowing.
  from(relation: 'meeting_attendees'): any
  from(relation: string): DynamicFromResult

  // RPC builders are PromiseLike rather than native Promise. Several existing
  // orchestration helpers intentionally accept native-Promise callbacks, so the
  // compatibility boundary remains dynamic for RPCs while runtime behavior is
  // unchanged.
  rpc(fn: string, args?: object): any
}

// Keep auth/storage/realtime from the canonical typed browser client, but use
// a bounded application query surface for PostgREST calls. This avoids expanding
// the full generated relationship graph at every query site.
type ApplicationSupabaseClient = Omit<TypedBrowserClient, 'from' | 'rpc'> &
  ApplicationQueryMethods

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