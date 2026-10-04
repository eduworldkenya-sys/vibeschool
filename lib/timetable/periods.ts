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
