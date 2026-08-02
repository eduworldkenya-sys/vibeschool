import { supabase } from '@/lib/supabase'
import { nairobiDateStr, nairobiDateAdd, nairobiWeekStart } from '@/lib/time'
import type { AttendanceRange } from '@/lib/types'

export async function getRangeDates(
  range: AttendanceRange
): Promise<{ startDate: string; endDate: string }> {
  const today = nairobiDateStr()

  if (range === 'week') {
    return { startDate: nairobiWeekStart(), endDate: today }
  }

  if (range === 'month') {
    const [y, m] = today.split('-')
    return { startDate: `${y}-${m}-01`, endDate: today }
  }

  if (range === 'year') {
    const [y] = today.split('-')
    return { startDate: `${y}-01-01`, endDate: today }
  }

  // term — look up the real term dates; RLS scopes this to the caller's own school(s).
  const { data } = await supabase
    .from('academic_terms')
    .select('start_date, end_date')
    .lte('start_date', today)
    .gte('end_date', today)
    .order('start_date', { ascending: false })
    .limit(1)

  if (data && data.length > 0) {
    return { startDate: data[0].start_date, endDate: today }
  }

  // No active term row found — fall back to the last 90 days.
  return { startDate: nairobiDateAdd(today, -90), endDate: today }
}
