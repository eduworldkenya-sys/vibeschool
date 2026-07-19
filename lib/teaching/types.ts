export type OccurrenceKey = {
  timetableSlotId: string
  occurrenceDate:  string
}

export type Lifecycle =
  | 'planned' | 'ready' | 'in_progress' | 'completed'
  | 'missed'  | 'cancelled' | 'rescheduled'

export interface TeachingOccurrence {
  key: OccurrenceKey

  schoolId:  string
  teacherId: string
  classId:   string
  subjectId: string

  dayOfWeek: number
  startTime: string
  endTime:   string

  lessonPlanId: string | null

  attendance: {
    state:         'not_started' | 'partial' | 'complete'
    markedCount:   number
    expectedCount: number
  }

  evidence: {
    count:            number
    latestEvidenceId: string | null
  }

  homework: {
    homeworkId: string | null
    issued:     boolean
  }

  reflection: {
    reflectionId: string | null
    completed:    boolean
  }

  lifecycle: Lifecycle
}

// ── Fix 20-27: slot editing, recovery, pacing, quality types ────────────────

export interface UpdateSlotParams {
  dayOfWeek?: number
  startTime?: string
  endTime?: string
  room?: string
  clearRoom?: boolean
  effectiveFrom?: string
  effectiveUntil?: string
  clearEffectiveUntil?: boolean
}

export interface RecoverySuggestion {
  suggest_date: string
  day_of_week: number
  start_time: string
  end_time: string
  period_label: string
}

export interface SchemePacingRow {
  class_id: string
  subject_id: string
  term: number
  current_week: number
  behind_count: number
  earliest_behind_week: number | null
  missed_occurrences: number
}

export interface TimetableQualityFlag {
  class_id: string
  flag: 'empty_monday' | 'friday_overload' | 'unbalanced_week' | 'subject_bunching' | 'double_lesson'
  severity: 'warn' | 'info'
  detail: string
}

// ── Fix 20-27: slot editing, recovery, pacing, quality types ────────────────

export interface UpdateSlotParams {
  dayOfWeek?: number
  startTime?: string
  endTime?: string
  room?: string
  clearRoom?: boolean
  effectiveFrom?: string
  effectiveUntil?: string
  clearEffectiveUntil?: boolean
}

export interface RecoverySuggestion {
  suggest_date: string
  day_of_week: number
  start_time: string
  end_time: string
  period_label: string
}

export interface SchemePacingRow {
  class_id: string
  subject_id: string
  term: number
  current_week: number
  behind_count: number
  earliest_behind_week: number | null
  missed_occurrences: number
}

export interface TimetableQualityFlag {
  class_id: string
  flag: 'empty_monday' | 'friday_overload' | 'unbalanced_week' | 'subject_bunching' | 'double_lesson'
  severity: 'warn' | 'info'
  detail: string
}
