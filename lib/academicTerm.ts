import { supabase } from '@/lib/supabase'
import { nairobiDateStr } from '@/lib/time'

export interface ActiveTerm {
  id:            string
  term:          number
  academic_year: number
  start_date:    string
  end_date:      string
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS

function parseIsoDateUtc(value: string): number | null {
  if (!ISO_DATE.test(value)) return null
  const parsed = Date.parse(`${value}T00:00:00Z`)
  return Number.isNaN(parsed) ? null : parsed
}

export function schoolWeekOf(term: ActiveTerm, occurrenceDate: string): number | null {
  const start = parseIsoDateUtc(term.start_date)
  const end = parseIsoDateUtc(term.end_date)
  const occurrence = parseIsoDateUtc(occurrenceDate)
  if (start === null || end === null || occurrence === null) return null
  if (occurrence < start || occurrence > end) return null
  const startDay = new Date(start).getUTCDay()
  const daysToNextMonday = startDay === 1 ? 7 : (8 - startDay) % 7
  const weekTwoStart = start + daysToNextMonday * DAY_MS
  if (occurrence < weekTwoStart) return 1
  return 2 + Math.floor((occurrence - weekTwoStart) / WEEK_MS)
}

export function totalWeeksOf(term: ActiveTerm): number { return schoolWeekOf(term, term.end_date) ?? 13 }
export function currentWeekOf(term: ActiveTerm): number {
  const today = nairobiDateStr()
  const resolved = schoolWeekOf(term, today)
  if (resolved !== null) return resolved
  const start = parseIsoDateUtc(term.start_date)
  const todayMs = parseIsoDateUtc(today)
  if (start === null || todayMs === null || todayMs < start) return 1
  return totalWeeksOf(term)
}
export async function getTermForDate(schoolId: string, occurrenceDate: string): Promise<ActiveTerm | null> {
  if (!ISO_DATE.test(occurrenceDate)) throw new Error('academicTerm: occurrenceDate must be YYYY-MM-DD.')
  const { data, error } = await supabase.from('academic_terms').select('id,term,academic_year,start_date,end_date').eq('school_id', schoolId).lte('start_date', occurrenceDate).gte('end_date', occurrenceDate).order('start_date', { ascending: false }).limit(2)
  if (error) throw error
  const rows = (data ?? []) as ActiveTerm[]
  if (rows.length > 1) throw new Error(`academicTerm: multiple terms contain ${occurrenceDate}; calendar data must be repaired.`)
  return rows[0] ?? null
}
export async function getActiveTerm(schoolId: string): Promise<ActiveTerm | null> { return getTermForDate(schoolId, nairobiDateStr()) }
