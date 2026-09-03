import { getSupabaseClient, supabase } from '@/lib/supabase'
import type { OccurrenceKey, Lifecycle, TeachingOccurrence } from '@/lib/teaching/types'

export type StartOccurrenceErrorCode =
  | 'not_authenticated'
  | 'slot_not_found'
  | 'slot_not_owned'
  | 'invalid_occurrence_date'
  | 'lesson_plan_required'
  | 'occurrence_completed'
  | 'occurrence_cancelled'
  | 'occurrence_rescheduled'
  | 'unknown'

const START_OCCURRENCE_ERROR_CODES: ReadonlyArray<Exclude<StartOccurrenceErrorCode, 'unknown'>> = [
  'not_authenticated',
  'slot_not_found',
  'slot_not_owned',
  'invalid_occurrence_date',
  'lesson_plan_required',
  'occurrence_completed',
  'occurrence_cancelled',
  'occurrence_rescheduled',
]

export class StartOccurrenceError extends Error {
  code: StartOccurrenceErrorCode
  cause?: unknown

  constructor(code: StartOccurrenceErrorCode, message: string, cause?: unknown) {
    super(message)
    this.name = 'StartOccurrenceError'
    this.code = code
    this.cause = cause
  }
}

export interface TeachingOccurrenceRow {
  id: string
  timetable_slot_id: string
  occurrence_date: string
  school_id: string
  teacher_id: string
  class_id: string
  subject_id: string
  lifecycle: Lifecycle
  started_at: string | null
  started_by: string | null
  completed_at: string | null
  cancelled_at: string | null
  cancelled_reason: string | null
  rescheduled_to_slot_id: string | null
  rescheduled_to_date: string | null
  created_at: string
  updated_at: string
}

function normalizeStartError(error: { message?: string | null } | null | undefined): StartOccurrenceError {
  const raw = (error?.message ?? '').trim()
  const exact = START_OCCURRENCE_ERROR_CODES.find(code => code === raw)
  const code = exact ?? START_OCCURRENCE_ERROR_CODES.find(item => raw.includes(item))
  return new StartOccurrenceError(code ?? 'unknown', raw || 'Failed to start lesson.', error)
}

const LIFECYCLES: ReadonlySet<string> = new Set([
  'planned',
  'ready',
  'in_progress',
  'completed',
  'missed',
  'cancelled',
  'rescheduled',
])

function isTeachingOccurrenceRow(value: unknown): value is TeachingOccurrenceRow {
  if (!value || typeof value !== 'object') return false
  const row = value as Partial<TeachingOccurrenceRow>
  return typeof row.id === 'string'
    && typeof row.timetable_slot_id === 'string'
    && typeof row.occurrence_date === 'string'
    && typeof row.lifecycle === 'string'
    && LIFECYCLES.has(row.lifecycle)
}

export async function startTeachingOccurrence(key: OccurrenceKey): Promise<TeachingOccurrenceRow> {
  const { data, error } = await supabase.rpc('start_teaching_occurrence', {
    p_timetable_slot_id: key.timetableSlotId,
    p_occurrence_date: key.occurrenceDate,
  })
  if (error) throw normalizeStartError(error)
  if (!isTeachingOccurrenceRow(data)) {
    throw new StartOccurrenceError('unknown', 'start_teaching_occurrence returned an invalid row.')
  }
  return data
}

export type CompleteOccurrenceErrorCode =
  | 'not_authenticated'
  | 'slot_not_found'
  | 'slot_not_owned'
  | 'occurrence_not_found'
  | 'occurrence_not_started'
  | 'occurrence_cancelled'
  | 'occurrence_rescheduled'
  | 'invalid_occurrence_date'
  | 'unknown'

const COMPLETE_OCCURRENCE_ERROR_CODES: ReadonlyArray<Exclude<CompleteOccurrenceErrorCode, 'unknown'>> = [
  'not_authenticated',
  'slot_not_found',
  'slot_not_owned',
  'occurrence_not_found',
  'occurrence_not_started',
  'occurrence_cancelled',
  'occurrence_rescheduled',
  'invalid_occurrence_date',
]

export class CompleteOccurrenceError extends Error {
  code: CompleteOccurrenceErrorCode
  cause?: unknown

  constructor(code: CompleteOccurrenceErrorCode, message: string, cause?: unknown) {
    super(message)
    this.name = 'CompleteOccurrenceError'
    this.code = code
    this.cause = cause
  }
}

function normalizeCompleteError(error: { message?: string | null } | null | undefined): CompleteOccurrenceError {
  const raw = (error?.message ?? '').trim()
  const exact = COMPLETE_OCCURRENCE_ERROR_CODES.find(code => code === raw)
  const code = exact ?? COMPLETE_OCCURRENCE_ERROR_CODES.find(item => raw.includes(item))
  return new CompleteOccurrenceError(code ?? 'unknown', raw || 'Failed to complete lesson.', error)
}

export async function completeTeachingOccurrence(key: OccurrenceKey): Promise<TeachingOccurrenceRow> {
  const { data, error } = await supabase.rpc('complete_teaching_occurrence', {
    p_timetable_slot_id: key.timetableSlotId,
    p_occurrence_date: key.occurrenceDate,
  })
  if (error) throw normalizeCompleteError(error)
  if (!isTeachingOccurrenceRow(data)) {
    throw new CompleteOccurrenceError('unknown', 'complete_teaching_occurrence returned an invalid row.')
  }
  return data
}

export type MarkCoveredErrorCode =
  | 'not_authenticated'
  | 'occurrence_not_found'
  | 'occurrence_not_owned'
  | 'occurrence_not_completed'
  | 'lesson_plan_not_found'
  | 'scheme_item_not_found'
  | 'scheme_item_not_ready'
  | 'unknown'

const MARK_COVERED_ERROR_CODES: ReadonlyArray<Exclude<MarkCoveredErrorCode, 'unknown'>> = [
  'not_authenticated',
  'occurrence_not_found',
  'occurrence_not_owned',
  'occurrence_not_completed',
  'lesson_plan_not_found',
  'scheme_item_not_found',
  'scheme_item_not_ready',
]

export class MarkSchemeCoveredError extends Error {
  code: MarkCoveredErrorCode
  cause?: unknown

  constructor(code: MarkCoveredErrorCode, message: string, cause?: unknown) {
    super(message)
    this.name = 'MarkSchemeCoveredError'
    this.code = code
    this.cause = cause
  }
}

function normalizeMarkCoveredError(error: { message?: string | null } | null | undefined): MarkSchemeCoveredError {
  const raw = (error?.message ?? '').trim()
  const exact = MARK_COVERED_ERROR_CODES.find(code => code === raw)
  const code = exact ?? MARK_COVERED_ERROR_CODES.find(item => raw.includes(item))
  return new MarkSchemeCoveredError(code ?? 'unknown', raw || 'Failed to mark scheme item covered.', error)
}

export interface MarkCoveredResult {
  scheme_id: string
  status: 'done'
}

function isMarkCoveredResult(value: unknown): value is MarkCoveredResult {
  if (!value || typeof value !== 'object') return false
  const row = value as Partial<MarkCoveredResult>
  return typeof row.scheme_id === 'string' && row.status === 'done'
}

export async function markSchemeItemCovered(occurrenceId: string): Promise<MarkCoveredResult> {
  const { data, error } = await supabase.rpc('mark_scheme_item_covered', {
    p_occurrence_id: occurrenceId,
  })
  if (error) throw normalizeMarkCoveredError(error)
  const row = Array.isArray(data) ? data[0] : data
  if (!isMarkCoveredResult(row)) {
    throw new MarkSchemeCoveredError('unknown', 'mark_scheme_item_covered returned an invalid result.')
  }
  return row
}

function isLifecycle(value: unknown): value is Lifecycle {
  return typeof value === 'string' && LIFECYCLES.has(value)
}

export async function fetchOccurrenceLifecycle(key: OccurrenceKey): Promise<Lifecycle | null> {
  const { data, error } = await supabase
    .from('teaching_occurrences')
    .select('lifecycle')
    .eq('timetable_slot_id', key.timetableSlotId)
    .eq('occurrence_date', key.occurrenceDate)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  if (!isLifecycle(data.lifecycle)) {
    throw new Error('teaching_occurrences returned an invalid lifecycle.')
  }
  return data.lifecycle
}

function deriveLifecycle(
  persisted: { lifecycle: Lifecycle } | null,
  lessonPlanId: string | null,
  slotEndTime: string,
  occurrenceDate: string,
): Lifecycle {
  if (persisted && ['in_progress', 'completed', 'cancelled', 'rescheduled'].includes(persisted.lifecycle)) {
    return persisted.lifecycle
  }
  if (lessonPlanId) return 'ready'

  // Timetable dates/times are Kenya school time. Parse them with an explicit
  // Africa/Nairobi offset so lifecycle truth is independent of the browser or
  // device timezone. Nairobi is UTC+03:00 year-round (no DST).
  const slotEnd = new Date(`${occurrenceDate}T${slotEndTime}+03:00`)
  if (!Number.isNaN(slotEnd.getTime()) && Date.now() > slotEnd.getTime()) {
    return 'missed'
  }
  return 'planned'
}

export async function resolveOccurrence(key: OccurrenceKey): Promise<TeachingOccurrence | null> {
  const { data: slot, error: slotErr } = await supabase
    .from('timetable_slots')
    .select('id, school_id, teacher_id, class_id, subject_id, day_of_week, start_time, end_time, effective_from, effective_until')
    .eq('id', key.timetableSlotId)
    .maybeSingle()

  if (slotErr) throw slotErr
  if (!slot) return null
  if (slot.effective_from && key.occurrenceDate < slot.effective_from) return null
  if (slot.effective_until && key.occurrenceDate > slot.effective_until) return null

  const [lessonPlanRes, occurrenceRes, expectedEnrollmentRes] = await Promise.all([
    supabase.from('lesson_plans')
      .select('id')
      .eq('timetable_slot_id', key.timetableSlotId)
      .eq('taught_date', key.occurrenceDate)
      .maybeSingle(),
    supabase.from('teaching_occurrences')
      .select('id, lifecycle')
      .eq('timetable_slot_id', key.timetableSlotId)
      .eq('occurrence_date', key.occurrenceDate)
      .maybeSingle(),
    // student_classes is the enrollment authority. students.class_id is a
    // legacy convenience pointer and must not drive attendance completeness.
    supabase.from('student_classes')
      .select('student_id,students!inner(id,deleted_at)')
      .eq('school_id', slot.school_id)
      .eq('class_id', slot.class_id)
      .eq('is_current', true)
      .is('students.deleted_at', null),
  ])

  const firstReadError = lessonPlanRes.error ?? occurrenceRes.error ?? expectedEnrollmentRes.error
  if (firstReadError) throw firstReadError

  const lessonPlanId = lessonPlanRes.data?.id ?? null
  const persistedOccurrence = occurrenceRes.data as { id: string; lifecycle: Lifecycle } | null
  const typedSupabase = getSupabaseClient()

  const progressQuery = persistedOccurrence
    ? typedSupabase
        .from('progress_records')
        .select('id, teacher_remarks, next_steps')
        .eq('teaching_occurrence_id', persistedOccurrence.id)
        .maybeSingle()
    : lessonPlanId
      ? typedSupabase
          .from('progress_records')
          .select('id, teacher_remarks, next_steps')
          .eq('lesson_plan_id', lessonPlanId)
          .maybeSingle()
      : Promise.resolve({
          data: null as { id: string; teacher_remarks: string | null; next_steps: string | null } | null,
          error: null,
        })

  const [attendanceRes, evidenceRes, homeworkRes, assessmentRes, reflectionRes, progressRes] = await Promise.all([
    supabase.from('attendance')
      .select('student_id')
      .eq('timetable_slot_id', key.timetableSlotId)
      .eq('date', key.occurrenceDate),
    persistedOccurrence
      ? supabase.from('lesson_evidence')
          .select('id, created_at')
          .eq('teaching_occurrence_id', persistedOccurrence.id)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as { id: string; created_at: string }[], error: null }),
    lessonPlanId
      ? supabase.from('homework').select('id').eq('lesson_plan_id', lessonPlanId).maybeSingle()
      : Promise.resolve({ data: null as { id: string } | null, error: null }),
    lessonPlanId
      ? supabase.from('cbc_assessments')
          .select('id, student_id, created_at')
          .eq('lesson_plan_id', lessonPlanId)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as { id: string; student_id: string; created_at: string }[], error: null }),
    lessonPlanId
      ? supabase.from('lesson_reflections')
          .select('id, what_worked, what_didnt, next_steps')
          .eq('lesson_plan_id', lessonPlanId)
          .maybeSingle()
      : Promise.resolve({
          data: null as { id: string; what_worked: string | null; what_didnt: string | null; next_steps: string | null } | null,
          error: null,
        }),
    progressQuery,
  ])

  const secondReadError = attendanceRes.error
    ?? evidenceRes.error
    ?? homeworkRes.error
    ?? assessmentRes.error
    ?? reflectionRes.error
    ?? progressRes.error
  if (secondReadError) throw secondReadError

  const markedCount = attendanceRes.data?.length ?? 0
  const expectedCount = expectedEnrollmentRes.data?.length ?? 0
  const attendanceState = markedCount === 0
    ? 'not_started'
    : markedCount < expectedCount
      ? 'partial'
      : 'complete'

  const evidenceRows = evidenceRes.data ?? []
  const assessmentRows = assessmentRes.data ?? []
  const assessedLearnerIds = new Set(assessmentRows.map(row => row.student_id))
  const reflection = reflectionRes.data
  const reflectionCompleted = Boolean(
    reflection && (reflection.what_worked || reflection.what_didnt || reflection.next_steps),
  )
  const progress = progressRes.data

  return {
    key,
    occurrenceId: persistedOccurrence?.id ?? null,
    schoolId: slot.school_id,
    teacherId: slot.teacher_id,
    classId: slot.class_id,
    subjectId: slot.subject_id,
    dayOfWeek: slot.day_of_week,
    startTime: slot.start_time,
    endTime: slot.end_time,
    lessonPlanId,
    attendance: {
      state: attendanceState,
      markedCount,
      expectedCount,
    },
    evidence: {
      count: evidenceRows.length,
      latestEvidenceId: evidenceRows[0]?.id ?? null,
    },
    homework: {
      homeworkId: homeworkRes.data?.id ?? null,
      issued: Boolean(homeworkRes.data),
    },
    assessment: {
      count: assessmentRows.length,
      learnerCount: assessedLearnerIds.size,
      latestAssessmentId: assessmentRows[0]?.id ?? null,
    },
    reflection: {
      reflectionId: reflection?.id ?? null,
      completed: reflectionCompleted,
    },
    progress: {
      progressRecordId: progress?.id ?? null,
      recorded: Boolean(progress),
      teacherRemarks: progress?.teacher_remarks ?? null,
      nextSteps: progress?.next_steps ?? null,
    },
    lifecycle: deriveLifecycle(
      persistedOccurrence,
      lessonPlanId,
      slot.end_time,
      key.occurrenceDate,
    ),
  }
}