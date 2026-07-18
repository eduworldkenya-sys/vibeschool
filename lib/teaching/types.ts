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
