import { createBrowserClient } from '@supabase/ssr'

export function createSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Safe singleton — only created once on client side
let client: ReturnType<typeof createBrowserClient> | null = null

export function getSupabaseClient() {
  if (!client) {
    client = createSupabaseClient()
  }
  return client
}

// Keep named export for backward compat but route through safe getter
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
    name:   profile?.full_name ?? '',
    school: (profile?.schools as unknown as { name: string } | null)?.name ?? '',
    phone:  profile?.phone ?? '',
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
      phone:     updates.phone,
    })
    .eq('id', userId)
    .select()
    .single()
  if (error) console.error('updateTeacherProfile error:', error)
  return data
}

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
