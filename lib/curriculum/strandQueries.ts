import { supabase } from '@/lib/supabase'

interface StrandOption { id: string; name: string }

interface GetStrandsParams {
  schoolId:     string
  subjectId:    string
  subjectLabel: string
  grade:        string
}

export async function getStrandsForSubject({
  schoolId,
  subjectId,
  grade,
}: GetStrandsParams): Promise<StrandOption[]> {
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
