"use client";
// TBL-009B: teacher UX for the TBL-009A recovery writer.
// Two modes:
//   'schedule' — recover a missed lesson: suggestions are shown as
//     CANDIDATES only (free periods; availability is confirmed by the
//     writer's exclusion constraints at schedule time), with manual
//     date/time/room always available. Conflict errors are translated
//     and the sheet stays open so the teacher can pick again.
//     Success explicitly states a lesson plan is still required.
//   'cancel' — cancel a recovery still in planned/ready with a reason;
//     the original returns to missed.
// The sheet never talks to tables directly for writes — everything goes
// through scheduleRecoveryOccurrence / cancelRecoveryOccurrence.

import React, { useEffect, useState } from 'react'
import { Btn, C } from '@/components/teacher/ui'
import { nairobiDateStr, nairobiDateAdd } from '@/lib/time'
import {
  scheduleRecoveryOccurrence,
  cancelRecoveryOccurrence,
  suggestRecoverySlots,
  SlotRpcError,
} from '@/lib/teaching/slots'
import type { RecoverySuggestion } from '@/lib/teaching/types'

export interface RecoverySheetContext {
  mode: 'schedule' | 'cancel'
  /** For 'schedule': the MISSED original's occurrence id.
   *  For 'cancel': the RECOVERY occurrence's id. */
  occurrenceId: string
  classId: string
  subject: string
  /** The date being recovered (schedule) or the recovery's date (cancel). */
  dateLabel: string
}

function recoveryErrorMessage(err: unknown): string {
  const code = err instanceof SlotRpcError ? err.code : 'unknown'
  switch (code) {
    case 'teacher_conflict':
      return 'You already have a lesson at that time. Pick a different time.'
    case 'class_conflict':
      return 'This class has another lesson at that time. Pick a different time.'
    case 'room_conflict':
      return 'That room is booked at that time. Pick another room or time.'
    case 'invalid_recovery_date':
      return 'Pick a date between today and 14 days from now.'
    case 'invalid_time_range':
      return 'The end time must be after the start time.'
    case 'not_recoverable':
      return 'This lesson can no longer be recovered.'
    case 'not_cancellable':
      return 'This recovery has already started or finished, so it can no longer be cancelled.'
    case 'reason_required':
      return 'Please give a short reason for cancelling.'
    case 'occurrence_not_found':
    case 'occurrence_not_owned':
      return 'This lesson could not be found under your account.'
    case 'school_mismatch':
      return 'Your class assignment could not be verified. Please refresh and try again.'
    case 'not_authenticated':
      return 'Your session expired. Please sign in again.'
    default:
      return 'Something went wrong. Please try again.'
  }
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  border: `1px solid ${C.border}`, fontSize: 14, color: C.textPrimary,
  background: '#fff', boxSizing: 'border-box',
}

export default function RecoverySheet({
  ctx,
  onClose,
  onDone,
}: {
  ctx: RecoverySheetContext
  /** Dismiss without completing (state unchanged). */
  onClose: () => void
  /** Called after the teacher acknowledges a completed action. */
  onDone: () => void
}) {
  const today = nairobiDateStr()
  const maxDate = nairobiDateAdd(today, 14)

  const [suggestions, setSuggestions] = useState<RecoverySuggestion[] | null>(null)
  const [suggestionsFailed, setSuggestionsFailed] = useState(false)

  const [date, setDate] = useState(today)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [room, setRoom] = useState('')
  const [reason, setReason] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<null | { kind: 'scheduled' | 'cancelled'; detail: string }>(null)

  // Suggestions are candidates only: the RPC filter skips rooms and
  // weekends, and the timetable can change between suggesting and
  // scheduling. The writer is the sole authority on availability.
  useEffect(() => {
    if (ctx.mode !== 'schedule') return
    let cancelled = false
    suggestRecoverySlots(ctx.classId, 14)
      .then(rows => { if (!cancelled) setSuggestions(rows ?? []) })
      .catch(() => { if (!cancelled) { setSuggestions([]); setSuggestionsFailed(true) } })
    return () => { cancelled = true }
  }, [ctx.mode, ctx.classId])

  const applySuggestion = (s: RecoverySuggestion) => {
    setDate(s.suggest_date)
    setStartTime(s.start_time.slice(0, 5))
    setEndTime(s.end_time.slice(0, 5))
    setError(null)
  }

  const submitSchedule = async () => {
    if (submitting) return
    setError(null)
    if (!date || !startTime || !endTime) {
      setError('Choose a date, start time and end time.')
      return
    }
    setSubmitting(true)
    try {
      const result = await scheduleRecoveryOccurrence({
        occurrenceId: ctx.occurrenceId,
        recoveryDate: date,
        startTime,
        endTime,
        room: room.trim() === '' ? null : room.trim(),
      })
      // Original and recovery ids stay attached to the completed state so
      // navigation away and back never loses which lesson this recovered.
      setDone({
        kind: 'scheduled',
        detail: `Recovery scheduled for ${date}, ${startTime}\u2013${endTime}.`
          + ` It appears on your timetable on that date's weekday tab during its week.`
          + ` (recovery ${result.recovery_occurrence_id.slice(0, 8)}\u2026 for missed ${ctx.occurrenceId.slice(0, 8)}\u2026)`,
      })
    } catch (err) {
      // Conflicts and validation problems keep the sheet open for another pick.
      setError(recoveryErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const submitCancel = async () => {
    if (submitting) return
    setError(null)
    if (reason.trim() === '') {
      setError('Please give a short reason for cancelling.')
      return
    }
    setSubmitting(true)
    try {
      const result = await cancelRecoveryOccurrence(ctx.occurrenceId, reason.trim())
      setDone({
        kind: 'cancelled',
        detail: `Recovery cancelled. The original lesson (${result.original_occurrence_id.slice(0, 8)}\u2026) is marked missed again and can be recovered later.`,
      })
    } catch (err) {
      setError(recoveryErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div
        onClick={done ? onDone : onClose}
        // TBL-009C: the slot drawer sits at zIndex 800/810 — this sheet
        // must layer ABOVE it, not underneath.
        style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 900 }}
      />
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 910,
          background: '#fff', borderRadius: '18px 18px 0 0',
          padding: '18px 16px 24px', maxHeight: '85vh', overflowY: 'auto',
          boxShadow: '0 -8px 30px rgba(15,23,42,0.18)',
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 800, color: C.textPrimary, marginBottom: 2 }}>
          {ctx.mode === 'schedule' ? 'Recover Missed Lesson' : 'Cancel Recovery'}
        </div>
        <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 14 }}>
          {ctx.subject} · {ctx.mode === 'schedule'
            ? `missed on ${ctx.dateLabel}`
            : `recovery on ${ctx.dateLabel}`}
        </div>

        {done ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{
              padding: '12px 14px', borderRadius: 12,
              background: '#f0fdf4', border: '1px solid #86efac',
              fontSize: 13, fontWeight: 600, color: '#166534',
            }}>
              {done.detail}
            </div>
            {done.kind === 'scheduled' && (
              <div style={{
                padding: '12px 14px', borderRadius: 12,
                background: '#fffbeb', border: '1px solid #fcd34d',
                fontSize: 12, fontWeight: 600, color: '#92400e',
              }}>
                A lesson plan is still required before this recovery lesson can
                be started. Prepare it from the timetable on the recovery date.
              </div>
            )}
            <Btn style={{ width: '100%', justifyContent: 'center' }} onClick={onDone}>
              Done
            </Btn>
          </div>
        ) : ctx.mode === 'schedule' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.textPrimary, marginBottom: 6 }}>
                Suggested free periods
              </div>
              <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8 }}>
                Candidates only — availability is confirmed when you schedule.
              </div>
              {suggestions === null && (
                <div style={{ fontSize: 12, color: C.textMuted }}>Looking for free periods…</div>
              )}
              {suggestions !== null && suggestions.length === 0 && (
                <div style={{ fontSize: 12, color: C.textMuted }}>
                  {suggestionsFailed
                    ? 'Could not load suggestions \u2014 pick a time manually below.'
                    : 'No free weekday periods found \u2014 pick a time manually below.'}
                </div>
              )}
              {suggestions !== null && suggestions.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                  {suggestions.slice(0, 12).map((s, i) => {
                    const isPicked =
                      date === s.suggest_date &&
                      startTime === s.start_time.slice(0, 5) &&
                      endTime === s.end_time.slice(0, 5)
                    return (
                      <button
                        key={`${s.suggest_date}-${s.start_time}-${i}`}
                        onClick={() => applySuggestion(s)}
                        style={{
                          textAlign: 'left', padding: '10px 12px', borderRadius: 10,
                          border: `1px solid ${isPicked ? '#4f46e5' : C.border}`,
                          background: isPicked ? '#eef2ff' : '#fff',
                          fontSize: 13, fontWeight: 600, color: C.textPrimary, cursor: 'pointer',
                        }}
                      >
                        {s.suggest_date} · {s.period_label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, color: C.textPrimary }}>
              Or choose your own time
            </div>
            <input
              type="date" value={date} min={today} max={maxDate}
              onChange={e => { setDate(e.target.value); setError(null) }}
              style={inputStyle}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="time" value={startTime}
                onChange={e => { setStartTime(e.target.value); setError(null) }}
                style={{ ...inputStyle, flex: 1 }}
              />
              <input
                type="time" value={endTime}
                onChange={e => { setEndTime(e.target.value); setError(null) }}
                style={{ ...inputStyle, flex: 1 }}
              />
            </div>
            <input
              type="text" value={room} placeholder="Room (optional)"
              onChange={e => setRoom(e.target.value)}
              style={inputStyle}
            />

            {error && (
              <div style={{
                padding: '10px 12px', borderRadius: 10,
                background: '#fef2f2', border: '1px solid #fca5a5',
                fontSize: 12, fontWeight: 600, color: '#b91c1c',
              }}>
                ⚠ {error}
              </div>
            )}

            <Btn
              disabled={submitting}
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={submitSchedule}
            >
              {submitting ? 'Scheduling\u2026' : 'Schedule Recovery'}
            </Btn>
            <Btn variant="muted" style={{ width: '100%', justifyContent: 'center' }} onClick={onClose}>
              Back
            </Btn>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, color: C.textMuted }}>
              Cancelling returns the original lesson to missed so it can be
              recovered at a different time. Recoveries that have already
              started or finished cannot be cancelled.
            </div>
            <textarea
              value={reason}
              placeholder="Reason for cancelling"
              onChange={e => { setReason(e.target.value); setError(null) }}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
            {error && (
              <div style={{
                padding: '10px 12px', borderRadius: 10,
                background: '#fef2f2', border: '1px solid #fca5a5',
                fontSize: 12, fontWeight: 600, color: '#b91c1c',
              }}>
                ⚠ {error}
              </div>
            )}
            <Btn
              disabled={submitting}
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={submitCancel}
            >
              {submitting ? 'Cancelling\u2026' : 'Cancel Recovery'}
            </Btn>
            <Btn variant="muted" style={{ width: '100%', justifyContent: 'center' }} onClick={onClose}>
              Back
            </Btn>
          </div>
        )}
      </div>
    </>
  )
}
