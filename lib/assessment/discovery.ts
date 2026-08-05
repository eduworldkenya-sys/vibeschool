import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'

export type LearnerAssignmentAvailability =
  | 'upcoming'
  | 'closed'
  | 'in_progress'
  | 'attempts_exhausted'
  | 'available'

export interface LearnerAssessmentAssignment {
  assignmentId: string
  assessmentId: string
  title: string
  assessmentType: string
  instructions: string | null
  assignmentStatus: string
  opensAt: string | null
  closesAt: string | null
  timeLimitMinutes: number | null
  maxAttempts: number
  showScorePolicy: string
  attemptId: string | null
  attemptNumber: number | null
  attemptStatus: string | null
  attemptExpiresAt: string | null
  resultStatus: string | null
  score: number | null
  maxScore: number | null
  percentage: number | null
  submittedAt: string | null
  canStart: boolean
  availability: LearnerAssignmentAvailability
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Assessment discovery returned an invalid payload.')
  return value as Record<string, unknown>
}
function text(value: unknown): string | null { return typeof value === 'string' ? value : null }
function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const result = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(result) ? result : null
}

export async function listMyAssessmentAssignments(): Promise<LearnerAssessmentAssignment[]> {
  const { data, error } = await supabase.rpc('exq_list_my_assignments' as never)
  if (error) throw new Error(error.message || 'Could not load assessments.')

  const payload = record(data as Json)
  const assignments = Array.isArray(payload.assignments) ? payload.assignments : []

  return assignments.map(value => {
    const item = record(value)
    const assignmentId = text(item.assignment_id)
    const assessmentId = text(item.assessment_id)
    const title = text(item.title)
    if (!assignmentId || !assessmentId || !title) throw new Error('Assessment discovery returned incomplete assignment data.')

    return {
      assignmentId,
      assessmentId,
      title,
      assessmentType: text(item.assessment_type) ?? 'assessment',
      instructions: text(item.instructions),
      assignmentStatus: text(item.assignment_status) ?? 'assigned',
      opensAt: text(item.opens_at),
      closesAt: text(item.closes_at),
      timeLimitMinutes: numberOrNull(item.time_limit_minutes),
      maxAttempts: numberOrNull(item.max_attempts) ?? 1,
      showScorePolicy: text(item.show_score_policy) ?? 'after_review',
      attemptId: text(item.attempt_id),
      attemptNumber: numberOrNull(item.attempt_number),
      attemptStatus: text(item.attempt_status),
      attemptExpiresAt: text(item.attempt_expires_at),
      resultStatus: text(item.result_status),
      score: numberOrNull(item.score),
      maxScore: numberOrNull(item.max_score),
      percentage: numberOrNull(item.percentage),
      submittedAt: text(item.submitted_at),
      canStart: item.can_start === true,
      availability: (text(item.availability) ?? 'available') as LearnerAssignmentAvailability,
    }
  })
}
