import { supabase } from '@/lib/supabase'

export interface ActiveTerm {
  id:            string
  term:          number
  academic_year: number
  start_date:    string
  end_date:      string
}

export function totalWeeksOf(term: ActiveTerm): number {
  const start = new Date(term.start_date)
  const end   = new Date(term.end_date)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 13
  const weeks = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7))
  return Math.max(1, weeks)
}

export function currentWeekOf(term: ActiveTerm): number {
  const start = new Date(term.start_date)
  if (isNaN(start.getTime())) return 1
  const now = Date.now()
  if (now < start.getTime()) return 1
  const diff = Math.floor((now - start.getTime()) / (1000 * 60 * 60 * 24 * 7))
  return Math.max(1, Math.min(diff + 1, totalWeeksOf(term)))
}

export async function getActiveTerm(schoolId: string): Promise<ActiveTerm | null> {
  const { data } = await supabase
    .from('academic_terms')
    .select('id,term,academic_year,start_date,end_date,status')
    .eq('school_id', schoolId)
    .eq('status', 'active')
    .single()
  return (data as ActiveTerm) ?? null
}
