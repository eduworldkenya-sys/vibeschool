import { createBrowserClient } from '@supabase/ssr'

export function createSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export const supabase = createSupabaseClient()

export async function getTeacherProfile(userId: string) {
  const { data: profile, error: profileErr } = await supabase
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
  const { data, error } = await supabase
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
