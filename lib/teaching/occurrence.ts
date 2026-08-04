import { supabase } from '@/lib/supabase'
import type { OccurrenceKey, Lifecycle, TeachingOccurrence } from '@/lib/teaching/types'

// ── Fix 18C: start_teaching_occurrence RPC contract ─────────────────────────

/**
 * Every stable error code the start_teaching_occurrence RPC can raise.
 * These are raw `raise exception 'code'` messages from Postgres — matched
 * verbatim, not parsed or guessed at. Anything else collapses to 'unknown'
 * rather than being silently treated as a specific known case.
 */
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

/**
 * The raw persisted row shape returned by start_teaching_occurrence.
 * Deliberately distinct from TeachingOccurrence (the derived/joined view
 * resolveOccurrence produces) — this is exactly what the table + RPC hand back.
 */
export interface TeachingOccurrenceRow {
  id:                       string
  timetable_slot_id:        string
  occurrence_date:          string
  school_id:                string
  teacher_id:               string
  class_id:                 string
  subject_id:               string
  lifecycle:                Lifecycle
  started_at:               string | null
  started_by:               string | null
  completed_at:             string | null
  cancelled_at:             string | null
  cancelled_reason:         string | null
  rescheduled_to_slot_id:   string | null
  rescheduled_to_date:      string | null
  created_at:               string
  updated_at:               string
}

function normalizeStartError(error: { message?: string | null } | null | undefined): StartOccurrenceError {
  const raw = (error?.message ?? '').trim()
  // Postgres raise exception messages come through verbatim in .message —
  // match exactly first; fall back to substring only because some clients
  // wrap it (e.g. "new row violates ... : lesson_plan_required").
  const exact = START_OCCURRENCE_ERROR_CODES.find(code => code === raw)
  const code  = exact ?? START_OCCURRENCE_ERROR_CODES.find(c => raw.includes(c))
  return new StartOccurrenceError(code ?? 'unknown', raw || 'Failed to start lesson.', error)
}

/**
 * Mirrors the Lifecycle union in types.ts. Kept as a runtime Set (rather than
 * trusting the type-level union alone) because this guard's whole purpose is
 * to catch a payload that doesn't actually match the type it's cast to —
 * checking against the type wouldn't catch anything a bad payload couldn't
 * already lie its way past.
 */
const LIFECYCLES: ReadonlySet<string> = new Set([
  'planned',
  'ready',
  'in_progress',
  'completed',
  'missed',
  'cancelled',
  'rescheduled',
])

/**
 * Runtime guard for the RPC's return value. Checked before the caller ever
 * trusts the row — catches an unexpectedly-shaped payload (e.g. PostgREST
 * wrapping the result in an array) instead of letting a bad shape flow
 * silently into UI state as if it were a valid TeachingOccurrenceRow.
 */
function isTeachingOccurrenceRow(value: unknown): value is TeachingOccurrenceRow {
  if (!value || typeof value !== 'object') return false

  const row = value as Partial<TeachingOccurrenceRow>

  return (
    typeof row.id === 'string' &&
    typeof row.timetable_slot_id === 'string' &&
    typeof row.occurrence_date === 'string' &&
    typeof row.lifecycle === 'string' &&
    LIFECYCLES.has(row.lifecycle)
  )
}

/**
 * Calls the start_teaching_occurrence RPC to transition (or idempotently
 * confirm) a lesson into in_progress. Never swallows a failure: on any
 * database error this throws a StartOccurrenceError with a stable .code,
 * so callers can branch on it instead of parsing free-text messages.
 */
export async function startTeachingOccurrence(key: OccurrenceKey): Promise<TeachingOccurrenceRow> {
  const { data, error } = await supabase.rpc('start_teaching_occurrence', {
    p_timetable_slot_id: key.timetableSlotId,
    p_occurrence_date:   key.occurrenceDate,
  })

  if (error) throw normalizeStartError(error)

  if (!isTeachingOccurrenceRow(data)) {
    throw new StartOccurrenceError('unknown', 'start_teaching_occurrence returned an invalid row.')
  }

  return data
}

// ── Fix 18D: complete_teaching_occurrence RPC contract ──────────────────────

/**
 * Every stable error code the complete_teaching_occurrence RPC can raise.
 * Distinct from StartOccurrenceErrorCode on purpose — completion has its own
 * precondition ('occurrence_not_started' has no equivalent on the start
 * side, and 'lesson_plan_required' has no equivalent here, since a plan is
 * already guaranteed to exist by the time an occurrence reached in_progress).
 */
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
  const code  = exact ?? COMPLETE_OCCURRENCE_ERROR_CODES.find(c => raw.includes(c))
  return new CompleteOccurrenceError(code ?? 'unknown', raw || 'Failed to complete lesson.', error)
}

/**
 * Calls the complete_teaching_occurrence RPC to transition (or idempotently
 * confirm) a lesson into completed. Only in_progress -> completed and
 * completed -> completed (idempotent) succeed; every other lifecycle raises
 * occurrence_not_started, occurrence_cancelled, or occurrence_rescheduled.
 *
 * Deliberately does not touch scheme_of_work / curriculum progress — the
 * standing product rule is that completing a lesson occurrence is not the
 * same event as advancing scheme progress, which happens through its own
 * explicit rule elsewhere. Callers must not infer scheme completion from
 * this resolving successfully.
 */
export async function completeTeachingOccurrence(key: OccurrenceKey): Promise<TeachingOccurrenceRow> {
  const { data, error } = await supabase.rpc('complete_teaching_occurrence', {
    p_timetable_slot_id: key.timetableSlotId,
    p_occurrence_date:   key.occurrenceDate,
  })

  if (error) throw normalizeCompleteError(error)

  if (!isTeachingOccurrenceRow(data)) {
    throw new CompleteOccurrenceError('unknown', 'complete_teaching_occurrence returned an invalid row.')
  }

  return data
}

// ── Fix 18E-D: mark_scheme_item_covered RPC contract ────────────────────────

/**
 * Every stable error code the mark_scheme_item_covered RPC can raise.
 * Distinct from Start/CompleteOccurrenceErrorCode — this RPC's preconditions
 * are about the occurrence's completion state and the scheme item's own
 * status, not slot ownership or occurrence-date validity.
 */
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
  const code  = exact ?? MARK_COVERED_ERROR_CODES.find(c => raw.includes(c))
  return new MarkSchemeCoveredError(code ?? 'unknown', raw || 'Failed to mark scheme item covered.', error)
}

/**
 * The minimal result shape returned by mark_scheme_item_covered. The RPC
 * returns table (scheme_id uuid, status text) — only the fields the
 * client actually relies on, not the full scheme_of_work row.
 */
export interface MarkCoveredResult {
  scheme_id: string
  status:    'done'
}

function isMarkCoveredResult(value: unknown): value is MarkCoveredResult {
  if (!value || typeof value !== 'object') return false

  const row = value as Partial<MarkCoveredResult>

  return typeof row.scheme_id === 'string' && row.status === 'done'
}

/**
 * Calls the mark_scheme_item_covered RPC to advance the scheme item linked
 * to a completed occurrence's lesson plan from 'teaching' to 'done'.
 *
 * Guarded occurrence-based path: never call
 * `.from('scheme_of_work').update({ status: 'done' })` directly from the
 * client for this flow — the RPC enforces ownership, that the occurrence
 * is actually completed, and that the scheme item is currently 'teaching'
 * (never downgrades 'done', never touches 'planned' or any other status).
 * The Scheme page's manual updateStatus(...) remains a separate valid
 * path for teachers to change status directly.
 *
 * Idempotent: calling this again on an already-'done' item returns the
 * result unchanged rather than erroring, so a duplicate tap/retry is
 * always safe.
 *
 * Supabase RPCs declared `returns table (...)` come back as an array —
 * normalize to a single row before validating.
 */
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

/**
 * Reuses the existing LIFECYCLES set (defined above for
 * isTeachingOccurrenceRow) rather than declaring a second one — one source
 * of truth for which strings are valid Lifecycle values.
 */
function isLifecycle(value: unknown): value is Lifecycle {
  return typeof value === 'string' && LIFECYCLES.has(value)
}

/**
 * Lightweight lifecycle lookup for callers (e.g. the lesson workspace) that
 * only need the persisted lifecycle to decide which CTA to show — not the
 * full attendance/evidence/homework/reflection join resolveOccurrence does.
 * Returns null if no teaching_occurrences row exists yet for this key (i.e.
 * the occurrence was never started). Validates the fetched value rather
 * than asserting it, since this reads directly off the table with no
 * RPC-level shape guarantee.
 */
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
  // Persisted rows own in_progress / completed / cancelled / rescheduled outright —
  // the resolver never invents or overrides those.
  if (persisted && ['in_progress', 'completed', 'cancelled', 'rescheduled'].includes(persisted.lifecycle)) {
    return persisted.lifecycle
  }

  if (lessonPlanId) return 'ready'

  const slotEnd = new Date(`${occurrenceDate}T${slotEndTime}`)
  const gracePeriodMs = 3 * 60 * 60 * 1000 // 3h grace before treating an unplanned slot as missed
  if (Date.now() > slotEnd.getTime() + gracePeriodMs) return 'missed'

  return 'planned'
}

/**
 * Resolves the full teaching context for one timetable slot occurrence.
 * Batches every read via Promise.all per standing convention — never sequential awaits.
 *
 * Fix 18B: every query in both batches is checked for .error before any state
 * is derived. A failed read throws rather than silently degrading into an
 * empty/false state (e.g. a failed attendance query must never read as
 * "not_started" — it must surface as a failure to the caller).
 */
export async function resolveOccurrence(key: OccurrenceKey): Promise<TeachingOccurrence | null> {
  const { data: slot, error: slotErr } = await supabase
    .from('timetable_slots')
    .select('id, school_id, teacher_id, class_id, subject_id, day_of_week, start_time, end_time, effective_from, effective_until')
    .eq('id', key.timetableSlotId)
    .maybeSingle()

  if (slotErr) throw slotErr
  if (!slot) return null

  // occurrence date must fall within the slot's effective range
  if (slot.effective_from && key.occurrenceDate < slot.effective_from) return null
  if (slot.effective_until && key.occurrenceDate > slot.effective_until) return null

  const [
    lessonPlanRes,
    occurrenceRes,
    expectedCountRes,
  ] = await Promise.all([
    supabase.from('lesson_plans')
      .select('id')
      .eq('timetable_slot_id', key.timetableSlotId)
      .eq('taught_date', key.occurrenceDate)
      .maybeSingle(),
    supabase.from('teaching_occurrences')
      .select('lifecycle')
      .eq('timetable_slot_id', key.timetableSlotId)
      .eq('occurrence_date', key.occurrenceDate)
      .maybeSingle(),
    supabase.from('students')
      .select('id', { count: 'exact', head: true })
      .eq('class_id', slot.class_id)
      .is('deleted_at', null),
  ])

  const firstReadError = lessonPlanRes.error ?? occurrenceRes.error ?? expectedCountRes.error
  if (firstReadError) throw firstReadError

  const lessonPlanId = lessonPlanRes.data?.id ?? null

  const [
    attendanceRes,
    evidenceRes,
    homeworkRes,
    assessmentRes,
    reflectionRes,
  ] = await Promise.all([
    supabase.from('attendance')
      .select('student_id')
      .eq('timetable_slot_id', key.timetableSlotId)
      .eq('date', key.occurrenceDate),
    lessonPlanId
      ? supabase.from('lesson_evidence')
          .select('id, created_at')
          .eq('lesson_id', lessonPlanId)
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
      : Promise.resolve({
          data: [] as {
            id: string
            student_id: string
            created_at: string
          }[],
          error: null,
        }),
    lessonPlanId
      ? supabase.from('lesson_reflections')
          .select('id, what_worked, what_didnt, next_steps')
          .eq('lesson_plan_id', lessonPlanId)
          .maybeSingle()
      : Promise.resolve({ data: null as { id: string; what_worked: string | null; what_didnt: string | null; next_steps: string | null } | null, error: null }),
  ])

  const secondReadError =
    attendanceRes.error ??
    evidenceRes.error ??
    homeworkRes.error ??
    assessmentRes.error ??
    reflectionRes.error
  if (secondReadError) throw secondReadError

  const markedCount   = attendanceRes.data?.length ?? 0
  const expectedCount = expectedCountRes.count ?? 0
  const attendanceState =
    markedCount === 0 ? 'not_started' :
    markedCount < expectedCount ? 'partial' : 'complete'

  const evidenceRows = evidenceRes.data ?? []
  const assessmentRows = assessmentRes.data ?? []
  const assessedLearnerIds = new Set(
    assessmentRows.map(row => row.student_id),
  )

  const reflection = reflectionRes.data
  const reflectionCompleted = !!reflection && !!(reflection.what_worked || reflection.what_didnt || reflection.next_steps)

  const lifecycle = deriveLifecycle(
    occurrenceRes.data as { lifecycle: Lifecycle } | null,
    lessonPlanId,
    slot.end_time,
    key.occurrenceDate,
  )

  return {
    key,
    schoolId:  slot.school_id,
    teacherId: slot.teacher_id,
    classId:   slot.class_id,
    subjectId: slot.subject_id,
    dayOfWeek: slot.day_of_week,
    startTime: slot.start_time,
    endTime:   slot.end_time,

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
      issued: !!homeworkRes.data,
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

    lifecycle,
  }
}
