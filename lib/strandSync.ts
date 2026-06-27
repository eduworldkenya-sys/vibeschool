import { supabase } from '@/lib/supabase'

interface StrandOption { id: string; name: string }

interface EnsureStrandsParams {
  schoolId:     string
  subjectId:    string
  subjectLabel: string
  grade:        string
}

export async function ensureStrandsForSubject({
  schoolId,
  subjectId,
  grade,
}: EnsureStrandsParams): Promise<StrandOption[]> {
  const { data, error } = await supabase
    .from('cbc_strands')
    .select('id, name')
    .eq('school_id', schoolId)
    .eq('subject_id', subjectId)
    .ilike('grade', grade)
    .order('name')

  if (error || !data) return []
  return data as StrandOption[]
}
