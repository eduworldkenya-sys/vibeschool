export type TimetableRecurrencePattern = 'EVERY_WEEK';

export type TeachingOccurrenceLifecycle =
  | 'planned' | 'ready' | 'in_progress' | 'completed'
  | 'missed' | 'cancelled' | 'rescheduled';

export interface TeachingAllocation {
  schoolId: string;
  classId: string;
  subjectId: string;
  teacherId: string | null;
  academicTermId: string;
  requiredUnitsPerWeek: number | null;
}

export interface RecurringTimetablePattern {
  id: string;
  schoolId: string;
  teacherId: string | null;
  classId: string;
  subjectId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
  periodId: string | null;
  allocationUnits: number;
  recurrencePattern: TimetableRecurrencePattern;
  effectiveFrom: string;
  effectiveUntil: string | null;
}

export interface DatedTeachingOccurrence {
  id: string;
  timetableSlotId: string;
  occurrenceDate: string;
  schoolId: string;
  teacherId: string;
  classId: string;
  subjectId: string;
  lifecycle: TeachingOccurrenceLifecycle;
  startedAt: string | null;
  completedAt: string | null;
  cancelledReason: string | null;
  rescheduledToSlotId: string | null;
  rescheduledToDate: string | null;
  recoveredFromId: string | null;
}

export interface TimetableAllocationHealth {
  subjectId: string;
  subjectName: string;
  expectedUnits: number | null;
  scheduledUnits: number;
  missingUnits: number | null;
  excessUnits: number | null;
  status:
    | 'ALLOCATION_UNKNOWN' | 'UNSCHEDULED' | 'UNDER_ALLOCATED'
    | 'OVER_ALLOCATED' | 'TEACHER_UNASSIGNED' | 'OVERRIDE' | 'COMPLETE';
}

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function isTimetableDay(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 7;
}
