import { supabase } from '@/lib/supabase'

interface StrandOption { id: string; name: string }

interface GetStrandsParams {
  schoolId:     string // not yet a column on cbc_strands — kept for future scoping, unused in query below
  subjectId:    string
  subjectLabel: string
  grade:        string
}

export async function getStrandsForSubject({
  subjectId,
  grade,
}: GetStrandsParams): Promise<StrandOption[]> {
  const { data, error } = await supabase
    .from('cbc_strands')
    .select('id, name')
    .eq('subject_id', subjectId)
    .ilike('grade', grade)
    .order('name')

  if (error || !data) return []
  return data as StrandOption[]
}
