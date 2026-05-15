import { createBrowserClient } from '@supabase/ssr'

export function createSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export const supabase = createSupabaseClient()

export async function upsertTeacherProfile(userId: string, email: string) {
  const initials = email.slice(0, 2).toUpperCase()
  const { data, error } = await supabase
    .from('teachers')
    .upsert(
      { user_id: userId, initials, name: '', school: '', subject: '', class: '' },
      { onConflict: 'user_id', ignoreDuplicates: true }
    )
    .select()
    .single()
  if (error) console.error('upsertTeacherProfile error:', error)
  return data
}

export async function getTeacherProfile(userId: string) {
  const { data, error } = await supabase
    .from('teachers')
    .select('*')
    .eq('user_id', userId)
    .single()
  if (error) console.error('getTeacherProfile error:', error)
  return data
}

export async function updateTeacherProfile(userId: string, updates: {
  name?: string
  school?: string
  subject?: string
  class?: string
  phone?: string
  initials?: string
}) {
  const { data, error } = await supabase
    .from('teachers')
    .update(updates)
    .eq('user_id', userId)
    .select()
    .single()
  if (error) console.error('updateTeacherProfile error:', error)
  return data
}