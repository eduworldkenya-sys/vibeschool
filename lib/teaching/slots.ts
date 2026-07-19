import { supabase } from '@/lib/supabase'
import type {
  RecoverySuggestion,
  SchemePacingRow,
  TimetableQualityFlag,
  UpdateSlotParams,
} from '@/lib/teaching/types'

// ── Fix 20-27: timetable slot editing, periods, generation, recovery,
//    pacing, quality, analytics, and snapshot RPC contracts ────────────────

/** Every stable error code the Fix 20-27 RPCs can raise — matched verbatim. */
export type SlotRpcErrorCode =
  | 'not_authenticated' | 'slot_not_found' | 'slot_not_owned'
  | 'invalid_time' | 'invalid_date_range' | 'invalid_date'
  | 'occurrence_history_exists' | 'occurrence_outside_window'
  | 'occurrences_exist' | 'slot_referenced' | 'future_revision_exists'
  | 'periods_already_exist' | 'school_not_found' | 'assignment_not_found'
  | 'label_required' | 'nothing_to_snapshot' | 'snapshot_not_found'
  | 'snapshot_not_owned' | 'future_slot_has_occurrences'
  | 'TEACHER_CONFLICT' | 'CLASS_CONFLICT' | 'ROOM_CONFLICT'
  | 'SCHEDULE_CONFLICT' | 'DUPLICATE_SLOT'
  | 'unknown'

const SLOT_RPC_ERROR_CODES: ReadonlyArray<Exclude<SlotRpcErrorCode, 'unknown'>> = [
  'not_authenticated', 'slot_not_found', 'slot_not_owned',
  'invalid_time', 'invalid_date_range', 'invalid_date',
  'occurrence_history_exists', 'occurrence_outside_window',
  'occurrences_exist', 'slot_referenced', 'future_revision_exists',
  'periods_already_exist', 'school_not_found', 'assignment_not_found',
  'label_required', 'nothing_to_snapshot', 'snapshot_not_found',
  'snapshot_not_owned', 'future_slot_has_occurrences',
  'TEACHER_CONFLICT', 'CLASS_CONFLICT', 'ROOM_CONFLICT',
  'SCHEDULE_CONFLICT', 'DUPLICATE_SLOT',
]

export class SlotRpcError extends Error {
  code: SlotRpcErrorCode
  cause?: unknown
  constructor(code: SlotRpcErrorCode, message: string, cause?: unknown) {
    super(message)
    this.name = 'SlotRpcError'
    this.code = code
    this.cause = cause
  }
}

function normalizeError(error: { message?: string | null } | null | undefined): SlotRpcError {
  const raw = (error?.message ?? '').trim()
  const exact = SLOT_RPC_ERROR_CODES.find(code => code === raw)
  const code = exact ?? SLOT_RPC_ERROR_CODES.find(c => raw.includes(c))
  return new SlotRpcError(code ?? 'unknown', raw || 'Timetable operation failed.', error)
}

async function callRpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw normalizeError(error)
  return data as T
}

// ── Fix 20: editing ────────────────────────────────────────────────────────

export async function updateTimetableSlot(slotId: string, params: UpdateSlotParams) {
  return callRpc('update_timetable_slot', {
    p_slot_id: slotId,
    p_day_of_week: params.dayOfWeek ?? null,
    p_start_time: params.startTime ?? null,
    p_end_time: params.endTime ?? null,
    p_room: params.room ?? null,
    p_clear_room: params.clearRoom ?? false,
    p_effective_from: params.effectiveFrom ?? null,
    p_effective_until: params.effectiveUntil ?? null,
    p_clear_effective_until: params.clearEffectiveUntil ?? false,
  })
}

export async function expireTimetableSlot(slotId: string, effectiveUntil?: string) {
  return callRpc('expire_timetable_slot', {
    p_slot_id: slotId,
    p_effective_until: effectiveUntil ?? null,
  })
}

export async function deleteTimetableSlot(slotId: string): Promise<void> {
  await callRpc('delete_timetable_slot', { p_slot_id: slotId })
}

/** Roll the current active timetable into a new revision starting p_effective_from. */
export async function duplicateActiveTimetable(effectiveFrom: string): Promise<number> {
  return callRpc<number>('duplicate_active_timetable', { p_effective_from: effectiveFrom })
}

// ── Fix 21: periods ────────────────────────────────────────────────────────

export async function seedDefaultSchoolPeriods(): Promise<number> {
  return callRpc<number>('seed_default_school_periods', {})
}

// ── Fix 22: occurrence pre-generation + missed sweep ───────────────────────

export async function generateDailyOccurrences(date?: string) {
  return callRpc<Array<{ generated: number; marked_missed: number }>>(
    'generate_daily_occurrences', { p_date: date ?? null },
  )
}

// ── Fix 23: recovery suggestions ───────────────────────────────────────────

export async function suggestRecoverySlots(classId: string, daysAhead = 7) {
  return callRpc<RecoverySuggestion[]>('suggest_recovery_slots', {
    p_class_id: classId,
    p_days_ahead: daysAhead,
  })
}

// ── Fix 24: scheme pacing ──────────────────────────────────────────────────

export async function schemePacingStatus() {
  return callRpc<SchemePacingRow[]>('scheme_pacing_status', {})
}

// ── Fix 25: quality flags ──────────────────────────────────────────────────

export async function timetableQualityReport() {
  return callRpc<TimetableQualityFlag[]>('timetable_quality_report', {})
}

// ── Fix 26: analytics ──────────────────────────────────────────────────────

export async function getTimetableAnalytics() {
  return callRpc<Record<string, unknown>>('get_timetable_analytics', {})
}

// ── Fix 27: snapshots / versioning ─────────────────────────────────────────

export async function snapshotTimetable(label: string): Promise<string> {
  return callRpc<string>('snapshot_timetable', { p_label: label })
}

export async function restoreTimetableSnapshot(snapshotId: string, effectiveFrom: string): Promise<number> {
  return callRpc<number>('restore_timetable_snapshot', {
    p_snapshot_id: snapshotId,
    p_effective_from: effectiveFrom,
  })
}
