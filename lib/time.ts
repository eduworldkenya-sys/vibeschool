// G2: single source of truth for date/day — Africa/Nairobi (UTC+3, no DST)
// Never use toISOString().slice/split for "today" — that returns the UTC
// date, which is wrong for roughly the last 3 hours of each Nairobi day.

export function nairobiDateStr(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d)
}

export function nairobiDayOfWeek(d: Date = new Date()): number {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Nairobi', weekday: 'short',
  }).format(d)
  const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }
  return map[weekday] ?? 1
}

// Adds `days` (positive or negative) to a Nairobi calendar date string and
// returns the resulting Nairobi calendar date string. Anchoring at noon UTC
// avoids any DST/midnight edge cases (Nairobi has no DST, fixed UTC+3).
export function nairobiDateAdd(dateStr: string, days: number): string {
  const anchor = new Date(`${dateStr}T12:00:00Z`)
  anchor.setUTCDate(anchor.getUTCDate() + days)
  return nairobiDateStr(anchor)
}

export function nairobiWeekStart(date = new Date()): string {
  const dow = nairobiDayOfWeek(date)
  const today = nairobiDateStr(date)
  return nairobiDateAdd(today, -(dow - 1))
}

export async function getServerWeek(): Promise<{ weekStart: string; dayOfWeek: number }> {
  const dow = nairobiDayOfWeek()
  const anchor = new Date(`${nairobiDateStr()}T12:00:00Z`)
  const monday = new Date(anchor)
  monday.setUTCDate(monday.getUTCDate() - (dow - 1))
  return { weekStart: nairobiDateStr(monday), dayOfWeek: dow }
}
