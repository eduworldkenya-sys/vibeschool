export const EXAM_RESULT_STATES = [
  'entered',
  'absent',
  'not_assessed',
  'exempt',
  'pending',
  'incomplete',
  'late',
  'transferred',
  'awaiting_marking',
] as const

export type ExamResultState = typeof EXAM_RESULT_STATES[number]

export type CanonicalExamResult = {
  id: string
  student_id: string
  marks: number | null
  max_marks: number
  percentage: number | null
  result_state: ExamResultState
  is_absent: boolean
  updated_at: string
}

export type ExamSubjectPolicy = {
  exam_id: string
  school_id: string
  subject_id: string
  pass_mark: number
  max_marks: number
  pass_percentage: number
  configured: boolean
  is_locked: boolean
}

const LABELS: Record<ExamResultState, string> = {
  entered: 'Score entered',
  absent: 'Absent',
  not_assessed: 'Not assessed',
  exempt: 'Exempt',
  pending: 'Pending',
  incomplete: 'Incomplete',
  late: 'Late',
  transferred: 'Transferred',
  awaiting_marking: 'Awaiting marking',
}

export function examResultStateLabel(state: ExamResultState): string {
  return LABELS[state]
}

export function examResultPercentage(marks: number | null, maxMarks: number): number | null {
  if (marks == null || !Number.isFinite(marks) || !Number.isFinite(maxMarks) || maxMarks <= 0 || marks < 0 || marks > maxMarks) return null
  return Math.round((marks / maxMarks) * 1000) / 10
}

export function isScoredExamResult(state: ExamResultState): boolean {
  return state === 'entered'
}

export function normalizeExamResultState(value: unknown, isAbsent = false): ExamResultState {
  if (isAbsent) return 'absent'
  return EXAM_RESULT_STATES.includes(value as ExamResultState) ? value as ExamResultState : 'entered'
}
