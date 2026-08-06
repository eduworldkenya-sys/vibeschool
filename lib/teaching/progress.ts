import { supabase } from '@/lib/supabase'

export interface TeachingProgressInput {
  occurrenceId: string
  whatWasTaught: string
  participationScore?: number | null
  challenges?: string | null
  homeworkSet?: string | null
  teacherRemarks?: string | null
  nextSteps?: string | null
}

export interface TeachingProgressRecord {
  id: string
  teaching_occurrence_id: string
  lesson_plan_id: string
  taught_date: string
  what_was_taught: string
  participation_score: number | null
  challenges: string | null
  homework_set: string | null
  teacher_remarks: string | null
  next_steps: string | null
}

export type TeachingProgressErrorCode =
  | 'not_authenticated'
  | 'occurrence_required'
  | 'what_was_taught_required'
  | 'invalid_participation_score'
  | 'occurrence_not_found'
  | 'occurrence_not_owned'
  | 'occurrence_not_completed'
  | 'lesson_plan_not_found'
  | 'unknown'

const ERROR_CODES: ReadonlyArray<Exclude<TeachingProgressErrorCode, 'unknown'>> = [
  'not_authenticated',
  'occurrence_required',
  'what_was_taught_required',
  'invalid_participation_score',
  'occurrence_not_found',
  'occurrence_not_owned',
  'occurrence_not_completed',
  'lesson_plan_not_found',
]

export class TeachingProgressError extends Error {
  constructor(
    public readonly code: TeachingProgressErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'TeachingProgressError'
  }
}

function normalizeError(error: { message?: string | null } | null | undefined) {
  const message = (error?.message ?? '').trim()
  const code = ERROR_CODES.find(item => item === message)
    ?? ERROR_CODES.find(item => message.includes(item))
    ?? 'unknown'

  return new TeachingProgressError(
    code,
    message || 'Failed to save the record of progress.',
    error,
  )
}

function isProgressRecord(value: unknown): value is TeachingProgressRecord {
  if (!value || typeof value !== 'object') return false
  const row = value as Partial<TeachingProgressRecord>
  return typeof row.id === 'string'
    && typeof row.teaching_occurrence_id === 'string'
    && typeof row.lesson_plan_id === 'string'
    && typeof row.taught_date === 'string'
    && typeof row.what_was_taught === 'string'
}

export async function saveTeachingProgressRecord(
  input: TeachingProgressInput,
): Promise<TeachingProgressRecord> {
  const { data, error } = await supabase.rpc('save_teaching_progress_record', {
    p_occurrence_id: input.occurrenceId,
    p_what_was_taught: input.whatWasTaught,
    p_participation_score: input.participationScore ?? null,
    p_challenges: input.challenges ?? null,
    p_homework_set: input.homeworkSet ?? null,
    p_teacher_remarks: input.teacherRemarks ?? null,
    p_next_steps: input.nextSteps ?? null,
  })

  if (error) throw normalizeError(error)

  const row = Array.isArray(data) ? data[0] : data
  if (!isProgressRecord(row)) {
    throw new TeachingProgressError(
      'unknown',
      'save_teaching_progress_record returned an invalid result.',
    )
  }

  return row
}
