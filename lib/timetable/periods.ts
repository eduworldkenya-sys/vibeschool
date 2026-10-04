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
