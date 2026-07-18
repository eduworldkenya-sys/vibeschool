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
export interface StartedOccurrenceRow {
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
 * Calls the start_teaching_occurrence RPC to transition (or idempotently
 * confirm) a lesson into in_progress. Never swallows a failure: on any
 * database error this throws a StartOccurrenceError with a stable .code,
 * so callers can branch on it instead of parsing free-text messages.
 */
export async function startTeachingOccurrence(key: OccurrenceKey): Promise<StartedOccurrenceRow> {
  const { data, error } = await supabase.rpc('start_teaching_occurrence', {
    p_timetable_slot_id: key.timetableSlotId,
    p_occurrence_date:   key.occurrenceDate,
  })

  if (error) throw normalizeStartError(error)
  if (!data) throw new StartOccurrenceError('unknown', 'start_teaching_occurrence returned no row.')

  return data as StartedOccurrenceRow
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
      ? supabase.from('lesson_reflections')
          .select('id, what_worked, what_didnt, next_steps')
          .eq('lesson_plan_id', lessonPlanId)
          .maybeSingle()
      : Promise.resolve({ data: null as { id: string; what_worked: string | null; what_didnt: string | null; next_steps: string | null } | null, error: null }),
  ])

  const secondReadError = attendanceRes.error ?? evidenceRes.error ?? homeworkRes.error ?? reflectionRes.error
  if (secondReadError) throw secondReadError

  const markedCount   = attendanceRes.data?.length ?? 0
  const expectedCount = expectedCountRes.count ?? 0
  const attendanceState =
    markedCount === 0 ? 'not_started' :
    markedCount < expectedCount ? 'partial' : 'complete'

  const evidenceRows = evidenceRes.data ?? []

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

    reflection: {
      reflectionId: reflection?.id ?? null,
      completed: reflectionCompleted,
    },

    lifecycle,
  }
}
