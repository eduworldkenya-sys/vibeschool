import { supabase } from '@/lib/supabase'

// cbc_strands is anchored to the national CBC subject taxonomy — 12
// `subjects` rows with school_id IS NULL, seeded once (2026-06-26) as
// the master reference. Each school also has its own local `subjects`
// copy used for teacher_classes/scheduling. Any cbc_strands query must
// resolve through the global row by name first — using a school's own
// local subject_id directly will only ever hit sparse per-school rows.
export async function resolveGlobalSubjectId(subjectName: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('subjects')
    .select('id')
    .is('school_id', null)
    .ilike('name', subjectName)
    .maybeSingle()

  if (error || !data) return null
  return data.id
}
