import { supabase } from '@/lib/supabase'

/** Resolve active school only when backed by school_members teacher authority. */
export async function getSchoolId(_uid?: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_my_teacher_school_context')
  if (error) return null
  return (data as { active_school_id?: string | null } | null)?.active_school_id ?? null
}
