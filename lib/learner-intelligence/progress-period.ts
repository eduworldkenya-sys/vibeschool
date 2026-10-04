import type { ProgressEvidence } from './progress-record'
export type ProgressTerm = { id: string; name: string; start_date: string; end_date: string; term?: number; academic_year?: number }
export type ProgressPeriod = '30' | '90' | 'term' | 'all'

/** Nairobi calendar dates, including observations near UTC midnight. */
export function progressDate(value: string | Date): string | null {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const time = Date.parse(value)
    return Number.isFinite(time) && new Date(time).toISOString().slice(0,10) === value ? value : null
  }
  const time = value instanceof Date ? value.getTime() : Date.parse(value)
  return Number.isFinite(time) ? new Date(time + 10800000).toISOString().slice(0,10) : null
}

export function currentProgressTerm(terms: ProgressTerm[], now = new Date()): ProgressTerm | null {
  const today = progressDate(now)
  if (!today) return null
  const matches = terms.filter(term => progressDate(term.start_date) === term.start_date && progressDate(term.end_date) === term.end_date && term.start_date <= today && today <= term.end_date)
  // Overlapping terms need reconciliation, never arbitrary selection.
  return matches.length === 1 ? matches[0] : null
}

export function inProgressPeriod(observedAt: string, period: ProgressPeriod, term: ProgressTerm | null, now = new Date()): boolean {
  const date = progressDate(observedAt), today = progressDate(now)
  if (!date || !today || date > today) return false
  if (period === 'all') return true
  if (period === 'term') return Boolean(term && term.start_date <= date && date <= term.end_date)
  const start = new Date(`${today}T00:00:00Z`)
  start.setUTCDate(start.getUTCDate() - (period === '30' ? 29 : 89))
  return date >= start.toISOString().slice(0,10)
}

/** Explicit source term wins over data-entry and correction timestamps. */
export function evidenceInProgressPeriod(row: ProgressEvidence, period: ProgressPeriod, term: ProgressTerm | null, now = new Date()): boolean {
  if (!inProgressPeriod(row.observedAt,'all',null,now)) return false
  if (period==='term' && row.reportingTerm != null && row.reportingYear != null) return Boolean(term && term.term===row.reportingTerm && term.academic_year===row.reportingYear)
  return inProgressPeriod(row.observedAt,period,term,now)
}
