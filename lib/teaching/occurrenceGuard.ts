// TBL-008: shared client entry point for occurrence generation.
//
// generate_daily_occurrences (Fix 22) is teacher-scoped via auth.uid() and
// idempotent at the database level through the occurrence identity
// UNIQUE (timetable_slot_id, occurrence_date) + ON CONFLICT DO NOTHING,
// and its missed sweep marks stale planned/ready occurrences as 'missed'.
// This guard adds the client-session invariants on top:
//   - at most one in-flight call per session (concurrent callers share it)
//   - at most one successful run per Nairobi calendar day per session
//   - failures never throw: callers always proceed (timetable and Pulse
//     must load whether or not generation worked), the failure is
//     observable in the returned result and logged, and it is retryable
//     because failures are never cached.
// Two tabs are two sessions: cross-tab safety is the database's
// idempotency, not this guard.

import { nairobiDateStr } from '@/lib/time'
import { generateDailyOccurrences } from '@/lib/teaching/slots'

export type OccurrenceGenerationResult =
  | { status: 'generated'; generated: number; markedMissed: number }
  | { status: 'already_ran' }
  | { status: 'failed'; message: string }

let inFlight: Promise<OccurrenceGenerationResult> | null = null
let lastSuccessNairobiDate: string | null = null

export async function ensureDailyOccurrences(): Promise<OccurrenceGenerationResult> {
  const today = nairobiDateStr()

  if (lastSuccessNairobiDate === today) {
    return { status: 'already_ran' }
  }

  if (inFlight) {
    return inFlight
  }

  inFlight = (async (): Promise<OccurrenceGenerationResult> => {
    try {
      const rows = await generateDailyOccurrences()
      const row = Array.isArray(rows) ? rows[0] : rows
      lastSuccessNairobiDate = today
      return {
        status: 'generated',
        generated: row?.generated ?? 0,
        markedMissed: row?.marked_missed ?? 0,
      }
    } catch (err) {
      console.error('[OccurrenceGuard] generate_daily_occurrences failed:', err)
      return {
        status: 'failed',
        message: err instanceof Error ? err.message : 'unknown_error',
      }
    } finally {
      inFlight = null
    }
  })()

  return inFlight
}

export function resetOccurrenceGuard(): void {
  inFlight = null
  lastSuccessNairobiDate = null
}
