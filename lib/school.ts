import { supabase } from './supabase'

export async function resolveSchoolId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('school_members')
    .select('school_id')
    .eq('profile_id', userId)
    .eq('role', 'teacher')
    .maybeSingle()

  // Legacy profile fields are context only and cannot establish school scope.
  return data?.school_id ?? null
}
