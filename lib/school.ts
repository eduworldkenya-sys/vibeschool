import { supabase } from './supabase'

/** Resolve the teacher's active school from server-authoritative membership context. */
export async function resolveSchoolId(_userId?: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_my_teacher_school_context')
  if (error) return null
  return (data as { active_school_id?: string | null } | null)?.active_school_id ?? null
}
