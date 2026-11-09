export interface SchoolPeriod {
  id: string; school_id: string; schedule_day: number; period_number: number;
  label: string; start_time: string; end_time: string; kind: string; protected: boolean;
}
export function periodsForDay(periods: SchoolPeriod[], schoolId: string, day: number) {
  return periods.filter(p => p.school_id === schoolId && (p.schedule_day === 0 || p.schedule_day === day))
    .sort((a,b) => a.start_time.localeCompare(b.start_time));
}
export function teachingBlock(periods: SchoolPeriod[], firstId: string, units: number): SchoolPeriod[] | null {
  if (!Number.isInteger(units) || units < 1 || units > 3) return null;
  const start = periods.findIndex(p => p.id === firstId);
  if (start < 0) return null;
  const block = periods.slice(start, start + units);
  if (block.length !== units || block.some(p => p.kind !== 'lesson')) return null;
  if (block.some((p,i) => i > 0 && block[i-1].end_time.slice(0,5) !== p.start_time.slice(0,5))) return null;
  return block;
}
export function protectedBlockConflict(periods: SchoolPeriod[], start: string, end: string) {
  return periods.find(p => p.protected && p.kind !== 'lesson' && p.start_time.slice(0,5) < end && p.end_time.slice(0,5) > start);
}

/** One-date placement must never fall back to the RPC's weekly defaults. */
export function singleDateSchedule(date: string): { dayOfWeek: number; effectiveFrom: string; effectiveUntil: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [year,month,day]=date.split('-').map(Number);
  const parsed=new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.getUTCFullYear()!==year || parsed.getUTCMonth()+1!==month || parsed.getUTCDate()!==day) return null;
  return {dayOfWeek:parsed.getUTCDay() || 7,effectiveFrom:date,effectiveUntil:date};
}

// Ministry of Education CBE Timetabling Guidelines, section 2.3 and appendix 3.
const UPPER_PRIMARY_PERIODS = [
  ['08:20', '08:55'], ['08:55', '09:30'], ['09:50', '10:25'],
  ['10:25', '11:00'], ['11:30', '12:05'], ['12:05', '12:40'],
  ['14:00', '14:35'],
] as const

export function isUpperPrimary(grade: string) {
  return /^grade [456]$/i.test(grade.trim())
}

export function upperPrimaryPeriods(schoolId: string, day: number): SchoolPeriod[] {
  if (day < 1 || day > 5) return []
  return UPPER_PRIMARY_PERIODS.map(([start_time, end_time], index) => ({
    id: `upper-primary-${index + 1}`,
    school_id: schoolId,
    schedule_day: day,
    period_number: index + 1,
    label: `Period ${index + 1}`,
    start_time,
    end_time,
    kind: 'lesson',
    protected: false,
  }))
}

export function isUpperPrimaryPeriod(day: number, start: string, end: string) {
  return upperPrimaryPeriods('', day).some(period =>
    period.start_time === start.slice(0, 5) && period.end_time === end.slice(0, 5)
  )
}
