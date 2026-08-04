"use client";
export const dynamic = "force-dynamic";

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Card, SectionLabel, Btn, C } from '@/components/teacher/ui'
import AddSlotModal from '@/components/teacher/AddSlotModal'
import RecoverySheet, { type RecoverySheetContext } from '@/components/teacher/RecoverySheet'
import { nairobiDateStr, nairobiDateAdd, nairobiDayOfWeek, nairobiWeekStart } from '@/lib/time'
import { loadTeacherTimetableForRange } from '@/lib/timetable/engine'
import { ensureDailyOccurrences } from '@/lib/teaching/occurrenceGuard'
import { resolveOccurrence, startTeachingOccurrence, StartOccurrenceError } from '@/lib/teaching/occurrence'
import type { StartOccurrenceErrorCode } from '@/lib/teaching/occurrence'
import { deriveTeachingWorkspace } from '@/lib/teaching/workspace'
import type { TeachingOccurrence, EditableSlot } from '@/lib/teaching/types'

// Fix 18C: human-facing text for each stable RPC error code. Kept next to
// the CTA that renders it since these are UI strings, not data-layer concerns.
function startErrorMessage(code: StartOccurrenceErrorCode): string {
  switch (code) {
    case 'not_authenticated':
      return 'Your session expired. Please sign in again.'
    case 'slot_not_found':
      return 'This lesson slot no longer exists.'
    case 'slot_not_owned':
      return 'This lesson belongs to a different teacher.'
    case 'invalid_occurrence_date':
      return 'This date no longer matches the lesson schedule.'
    case 'occurrence_completed':
      return 'This lesson was already completed.'
    case 'occurrence_cancelled':
      return 'This lesson was cancelled.'
    case 'occurrence_rescheduled':
      return 'This lesson was rescheduled.'
    case 'lesson_plan_required':
      // Handled by redirect before this ever renders — kept for completeness.
      return 'A lesson plan is required before starting this lesson.'
    default:
      return 'Could not start the lesson. Please try again.'
  }
}

// ── Types ──────────────────────────────────────────────────────────────────
interface Slot {
  id:        string
  classId:   string
  subjectId: string
  subject:   string
  className: string
  grade:     string
  room:      string
  startTime: string
  endTime:   string
  dayOfWeek: number
  // TBL-009C: effective range carried onto the view model so day filtering
  // can be DATE-aware, not merely weekday-aware — a one-day recovery slot
  // must appear only on its own date.
  effectiveFrom:  string
  effectiveUntil: string | null
}

interface WeeklyLoadRow {
  classId:         string
  subjectId:       string
  className:       string
  stream:          string
  subjectName:     string
  grade:           string
  lessonsPerWeek:  number | null
  scheduledCount:  number
  status:          'ZERO' | 'UNDER' | 'OK' | 'OVER' | 'NO_TARGET'
}

// ── Helpers ────────────────────────────────────────────────────────────────
function timeToMin(t: string): number {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function currentTimeMin(): number {
  const n = new Date()
  return n.getHours() * 60 + n.getMinutes()
}

function formatTime(t: string): string {
  if (!t) return '--'
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
}

function minutesUntil(start: string, curMin: number): number {
  return timeToMin(start) - curMin
}

function formatCountdown(mins: number): string {
  const safe = Math.max(0, mins)
  if (safe <= 0) return 'Now'
  if (safe < 60) return `${safe}m`
  return `${Math.floor(safe / 60)}h ${safe % 60}m`
}

function localDateStr(): string {
  const d   = new Date()
  const y   = d.getFullYear()
  const m   = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const DAYS = [
  { label: 'Mon', dow: 1, weekend: false },
  { label: 'Tue', dow: 2, weekend: false },
  { label: 'Wed', dow: 3, weekend: false },
  { label: 'Thu', dow: 4, weekend: false },
  { label: 'Fri', dow: 5, weekend: false },
  { label: 'Sat', dow: 6, weekend: true  },
  { label: 'Sun', dow: 7, weekend: true  },
]

// ── Skeleton ───────────────────────────────────────────────────────────────
function Skeleton({ h = 64 }: { h?: number }) {
  return (
    <div
      className="skeleton-shimmer"
      style={{
        height: h,
        borderRadius: 12,
        background: 'var(--skeleton-bg, linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%))',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s infinite',
      }}
    />
  )
}

// ── Slot card ──────────────────────────────────────────────────────────────
const SlotCard = React.memo(function SlotCard({
  slot,
  isNow,
  isNext,
  curMin,
  onTap,
}: {
  slot:   Slot
  isNow:  boolean
  isNext: boolean
  curMin: number
  onTap:  (s: Slot) => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${slot.subject} ${slot.className} at ${formatTime(slot.startTime)}`}
      onClick={() => onTap(slot)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onTap(slot) }}
      className="slot-card"
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          12,
        padding:      '13px 14px',
        borderRadius: 14,
        background:   isNow
          ? 'var(--slot-now-bg, #f0fdf4)'
          : 'var(--surface, #ffffff)',
        border: isNow
          ? `2px solid ${C.accent}`
          : isNext
          ? `1.5px dashed ${C.accent}`
          : `1px solid var(--border, ${C.border})`,
        cursor:   'pointer',
        position: 'relative',
        overflow: 'hidden',
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
    >
      {isNow && (
        <div style={{
          position:     'absolute',
          left: 0, top: 0, bottom: 0,
          width:        4,
          background:   C.accent,
          borderRadius: '14px 0 0 14px',
          animation:    'pulse 2s ease-in-out infinite',
        }} />
      )}

      <div style={{ width: 48, flexShrink: 0, textAlign: 'center', paddingLeft: isNow ? 4 : 0 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: C.textPrimary }}>
          {formatTime(slot.startTime)}
        </div>
        <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>
          {formatTime(slot.endTime)}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>
          {slot.subject}
          {slot.className
            ? <span style={{ color: C.textMuted, fontWeight: 500 }}> · {slot.className}</span>
            : null}
        </div>
        {slot.room
          ? <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{slot.room}</div>
          : null}
      </div>

      {isNow && (
        <span style={{
          fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 20,
          background: C.accent, color: '#fff', flexShrink: 0,
        }}>
          NOW
        </span>
      )}
      {!isNow && isNext && (
        <span style={{
          fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 20,
          background: '#fef3c7', color: '#92400e', flexShrink: 0,
        }}>
          in {formatCountdown(minutesUntil(slot.startTime, curMin))}
        </span>
      )}
      {!isNow && !isNext && (
        <span style={{ fontSize: 16, color: C.textMuted }}>›</span>
      )}
    </div>
  )
})

// ── Detail drawer ──────────────────────────────────────────────────────────
function SlotDrawer({
  slot,
  curMin,
  occurrenceDate,
  onClose,
  onNavigate,
  onRecover,
  onCancelRecovery,
  onEdit,
}: {
  slot:           Slot | null
  curMin:         number
  occurrenceDate: string
  onClose:        () => void
  onNavigate:     (url: string) => void
  onRecover:        (ctx: RecoverySheetContext) => void
  onCancelRecovery: (ctx: RecoverySheetContext) => void
  onEdit:           (slot: Slot) => void
}) {
  // FIX [FATAL-03]: removed useRouter() from here — navigation lifted to page via onNavigate prop

  const touchStartY = useRef<number>(0)

  const [occurrence, setOccurrence] = useState<TeachingOccurrence | null>(null)
  const [occLoading, setOccLoading] = useState(false)
  const [occError, setOccError] = useState<string | null>(null)

  // TBL-009B: the composite occurrence carries no row id and no ancestry,
  // so the recovery actions need one targeted read of the persisted row.
  // occRowId is the occurrence uuid the writer RPCs take; recoveredFromId
  // being set marks this occurrence as a recovery (cancellable while
  // planned/ready). Read-only; all writes stay behind the TBL-009A RPCs.
  const [occRowId, setOccRowId] = useState<string | null>(null)
  const [recoveredFromId, setRecoveredFromId] = useState<string | null>(null)

  // Fix 18C: separate from occError — occError means "couldn't resolve this
  // occurrence at all"; startError means "resolved fine, but the start
  // mutation itself failed". Conflating them would blank a good CTA state.
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  // TBL-008: ensure today's occurrences exist (and stale ones are swept to
  // 'missed') when the timetable initializes. Fire-and-forget: generation
  // failure must never block the timetable from loading, and the guard
  // makes the call retryable and session-deduplicated.
  useEffect(() => {
    void ensureDailyOccurrences()
  }, [])

  useEffect(() => {
    if (!slot) {
      setOccurrence(null)
      setOccError(null)
      setStarting(false)
      setStartError(null)
      setOccRowId(null)
      setRecoveredFromId(null)
      return
    }

    let cancelled = false

    setOccurrence(null)
    setOccError(null)
    setStarting(false)
    setStartError(null)
    setOccRowId(null)
    setRecoveredFromId(null)
    setOccLoading(true)

    resolveOccurrence({ timetableSlotId: slot.id, occurrenceDate })
      .then(result => {
        if (cancelled) return
        if (!result) {
          setOccError('This lesson occurrence could not be resolved.')
          return
        }
        setOccurrence(result)
        // TBL-009B: fetch the persisted row's uuid and recovery ancestry.
        // A derived occurrence with no row yet simply leaves both null,
        // which correctly hides the recovery actions.
        supabase
          .from('teaching_occurrences')
          .select('id, recovered_from_id')
          .eq('timetable_slot_id', slot.id)
          .eq('occurrence_date', occurrenceDate)
          .maybeSingle()
          .then(({ data }) => {
            if (cancelled || !data) return
            setOccRowId(data.id ?? null)
            setRecoveredFromId(data.recovered_from_id ?? null)
          })
      })
      .catch(() => {
        if (!cancelled) setOccError('This lesson occurrence could not be loaded.')
      })
      .finally(() => {
        if (!cancelled) setOccLoading(false)
      })

    return () => { cancelled = true }
  }, [slot?.id, occurrenceDate])

  if (!slot) return null

  // TOS-005: clock-only comparisons are valid only for today's
  // occurrence. A past Monday slot viewed after midnight must not be labelled
  // "Starting in..." merely because its clock time is later than the current
  // Tuesday clock time. Lifecycle remains authoritative for past/future dates.
  const isTodayOccurrence = occurrenceDate === nairobiDateStr()
  const isNow =
    isTodayOccurrence &&
    timeToMin(slot.startTime) <= curMin &&
    timeToMin(slot.endTime) > curMin
  const isNext =
    isTodayOccurrence &&
    !isNow &&
    timeToMin(slot.startTime) > curMin

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    const delta = e.changedTouches[0].clientY - touchStartY.current
    if (delta > 120) onClose()  // FIX [UI-06]: increased threshold from 80 to 120px
  }

  const attendanceUrl =
    `/teacher/attendance?mode=lesson` +
    `&classId=${encodeURIComponent(slot.classId)}` +
    `&timetableSlotId=${encodeURIComponent(slot.id)}` +
    `&date=${encodeURIComponent(occurrenceDate)}` +
    `&subject=${encodeURIComponent(slot.subject)}`
  // TBL-010C: identity in the URL, not a display name — subjectId is
  // the school subject's real id, already on the Slot view model.
  // TOS-001: preserve the exact scheduled occurrence. Class and subject
  // identify the teaching assignment, but only slot + date identify the
  // lesson-plan row and teaching occurrence selected by the teacher.
  const lessonUrl =
    `/teacher/lessonplan?` +
    `timetableSlotId=${encodeURIComponent(slot.id)}` +
    `&date=${encodeURIComponent(occurrenceDate)}` +
    `&subjectId=${encodeURIComponent(slot.subjectId)}` +
    `&classId=${encodeURIComponent(slot.classId)}`;
  const homeworkUrl = `/teacher/classhub/${slot.classId}/homework`;

  // TOS-006: the drawer consumes the shared Teaching Workspace contract.
  // It no longer owns a private lifecycle-to-action engine.
  const workspace = occurrence
    ? deriveTeachingWorkspace(occurrence)
    : null

  const primaryAction = workspace
    ? {
        prepare_lesson: {
          label: 'Prepare Lesson',
          url: lessonUrl,
        },
        start_lesson: {
          label: 'Start Lesson',
          url: lessonUrl,
        },
        continue_lesson: {
          label: 'Continue Lesson',
          url: lessonUrl,
        },
        review_lesson: {
          label: 'Review Lesson',
          url: lessonUrl,
        },
        recover_lesson: null,
        none: null,
      }[workspace.primaryAction]
    : null

  const statusText =
    workspace?.lifecycle === 'cancelled'
      ? 'This lesson was cancelled.'
      : workspace?.lifecycle === 'rescheduled'
        ? 'This lesson was rescheduled.'
        : null

  // Starting remains an RPC mutation. Preparing/reviewing only navigates.
  // An in-progress occurrence is idempotently confirmed by the same RPC
  // before opening the exact workspace.
  const needsStartMutation =
    workspace?.canStart === true ||
    workspace?.primaryAction === 'continue_lesson'

  async function handlePrimaryAction() {
    if (!primaryAction || !occurrence || !slot) return
    if (starting) return // guards rapid repeat taps beyond the disabled attribute

    if (!needsStartMutation) {
      onNavigate(primaryAction.url)
      return
    }

    setStarting(true)
    setStartError(null)

    try {
      const row = await startTeachingOccurrence({
        timetableSlotId: slot.id,
        occurrenceDate,
      })
      // Update local state from the authoritative row rather than assuming
      // success — merge lifecycle only, everything else (attendance,
      // evidence, etc.) is still whatever resolveOccurrence last loaded.
      setOccurrence(prev => (prev ? { ...prev, lifecycle: row.lifecycle } : prev))
      onNavigate(primaryAction.url)
    } catch (err) {
      const code = err instanceof StartOccurrenceError ? err.code : 'unknown'

      // lesson_plan_required is a guided redirect, not a failure state —
      // the teacher just needs to create the plan first.
      if (code === 'lesson_plan_required') {
        onNavigate(lessonUrl)
        return
      }

      // Every other code: stay put, restore the button, surface the reason.
      setStartError(startErrorMessage(code))
    } finally {
      setStarting(false)
    }
  }

  return (
    <>
      <div
        className="no-print"
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 800, background: 'rgba(0,0,0,0.3)' }}
      />
      <div
        className="no-print"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={e => e.stopPropagation()}  // FIX [UI-02]: prevent bubble closing drawer
        data-slot-drawer
        style={{
          position:     'fixed',
          bottom: 0, left: 0, right: 0,
          zIndex:       810,
          background:   'var(--sheet-bg, #ffffff)',
          borderRadius: '20px 20px 0 0',
          padding:      '24px 20px 36px',
          boxShadow:    '0 -8px 40px rgba(0,0,0,0.15)',
          animation:    'slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        <div style={{
          width: 40, height: 4, borderRadius: 2,
          background: 'var(--border-color, #e5e7eb)',
          margin: '0 auto 20px',
        }} />

        {isNow && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 12px', borderRadius: 20,
            background: C.accentLight, marginBottom: 14,
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: C.accent, animation: 'pulse 1.5s infinite',
            }} />
            <span style={{ fontSize: 11, fontWeight: 800, color: '#065f46' }}>In progress</span>
          </div>
        )}
        {isNext && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 12px', borderRadius: 20,
            background: '#fef3c7', marginBottom: 14,
          }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#92400e' }}>
              Starting in {formatCountdown(minutesUntil(slot.startTime, curMin))}
            </span>
          </div>
        )}

        <div style={{ fontSize: 22, fontWeight: 800, color: C.textPrimary, marginBottom: 4 }}>
          {slot.subject}
        </div>
        <div style={{ fontSize: 14, color: C.textMuted, marginBottom: 20 }}>
          {slot.className}{slot.room ? ` · ${slot.room}` : ''}
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Start',    value: formatTime(slot.startTime) },
            { label: 'End',      value: formatTime(slot.endTime)   },
            { label: 'Duration', value: `${timeToMin(slot.endTime) - timeToMin(slot.startTime)} min` },
          ].map(r => (
            <div
              key={r.label}
              style={{
                flex: 1, borderRadius: 12,
                background: 'var(--surface-raised, #f9fafb)',
                padding: '12px 14px', textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 800, color: C.textPrimary }}>{r.value}</div>
              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{r.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {occError && (
            <div style={{
              padding: '10px 12px', borderRadius: 10,
              background: '#fef2f2', border: '1px solid #fca5a5',
              fontSize: 12, fontWeight: 600, color: '#b91c1c',
            }}>
              ⚠ {occError}
            </div>
          )}
          {!occError && startError && (
            <div style={{
              padding: '10px 12px', borderRadius: 10,
              background: '#fef2f2', border: '1px solid #fca5a5',
              fontSize: 12, fontWeight: 600, color: '#b91c1c',
            }}>
              ⚠ {startError}
            </div>
          )}
          {!occError && !startError && statusText && (
            <div style={{
              padding: '10px 12px', borderRadius: 10,
              background: 'var(--surface-raised, #f9fafb)',
              fontSize: 12, fontWeight: 600, color: C.textMuted,
            }}>
              {statusText}
            </div>
          )}
          {!occError && !startError && workspace?.lifecycle === 'missed' && (
            <div style={{
              display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 6,
              padding: '5px 10px', borderRadius: 999,
              background: '#fffbeb', border: '1px solid #fcd34d',
              fontSize: 11, fontWeight: 700, color: '#92400e',
            }}>
              ⏱ Missed lesson
            </div>
          )}
          <button
            onClick={() => { onEdit(slot); onClose(); }}
            style={{
              width: '100%', padding: '12px', borderRadius: 10,
              border: `1.5px solid ${C.border}`, background: 'none',
              fontSize: 13, fontWeight: 700, color: C.textPrimary,
              cursor: 'pointer', marginBottom: 8,
            }}
          >
            Edit Slot
          </button>

          {/* TBL-009B: recover a missed lesson through the TBL-009A writer. */}
          {!occError && workspace?.canRecover && occRowId && (
            <Btn
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => onRecover({
                mode: 'schedule',
                occurrenceId: occRowId,
                classId: slot.classId,
                subject: slot.subject,
                dateLabel: occurrenceDate,
              })}
            >
              Recover Lesson
            </Btn>
          )}
          {/* TBL-009B: a recovery still in planned/ready can be cancelled;
              the original returns to missed. Later lifecycles are real
              teaching history and the writer refuses them. */}
          {!occError && occRowId && recoveredFromId
            && (workspace?.lifecycle === 'planned' || workspace?.lifecycle === 'ready') && (
            <Btn
              variant="ghost"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => onCancelRecovery({
                mode: 'cancel',
                occurrenceId: occRowId,
                classId: slot.classId,
                subject: slot.subject,
                dateLabel: occurrenceDate,
              })}
            >
              Cancel Recovery
            </Btn>
          )}
          {!occError && (occLoading || primaryAction) && (
            <Btn
              disabled={occLoading || starting || !primaryAction}
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={handlePrimaryAction}
            >
              {occLoading ? 'Loading lesson…' : starting ? 'Starting lesson…' : primaryAction?.label}
            </Btn>
          )}
          <Btn
            variant="ghost"
            disabled={!workspace?.canCaptureAttendance}
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => onNavigate(attendanceUrl)}
          >
            {workspace?.attendanceComplete
              ? 'Review Attendance'
              : 'Mark Attendance'}
          </Btn>
          <Btn
            variant="ghost"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => onNavigate(lessonUrl)}
          >
            View Lesson Plan
          </Btn>
          <Btn
            variant="ghost"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => onNavigate(homeworkUrl)}
          >
            Assign Homework
          </Btn>
          <Btn
            variant="muted"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={onClose}
          >
            Close
          </Btn>
        </div>
      </div>
    </>
  )
}

// ── Error banner ────────────────────────────────────────────────────────────
function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      className="no-print"  // FIX [UI-04]: error banners must not appear in print
      style={{
        background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12,
        padding: '12px 16px', marginBottom: 14,
        fontSize: 13, color: '#b91c1c', fontWeight: 600,
      }}
    >
      ⚠ {message}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function TimetablePage() {  // FIX [TYPE-04]: removed `: JSX.Element` — deprecated in React 18
  const router = useRouter()

  // FIX [LOGIC-02]: todayDow in state so it updates after midnight
  // TBL-009C: weekday is Nairobi-anchored so the day tabs and the dates
  // derived from them can never disagree across a timezone/midnight boundary.
  const [todayDow, setTodayDow] = useState<number>(() => nairobiDayOfWeek())
  // TBL-009D: the WEEK is the source of truth for every date the page
  // renders. Held in state and resynced by the minute timer so the
  // Sunday->Monday rollover swaps the whole dataset: dateForDow moves AND
  // load() reruns (weekStart is in its deps), pulling the new week's
  // bounded slots — e.g. recovery slots — that the old range never held.
  const [weekStart, setWeekStart] = useState<string>(() => nairobiWeekStart())

  const isWeekend    = todayDow === 6 || todayDow === 7
  const effectiveDow = todayDow

  const [activeDow,       setActiveDow]       = useState(effectiveDow)

  // TBL-009C: explicit visible-week date model. Every day tab maps to a
  // concrete Nairobi date in the CURRENT week (Monday-anchored), and every
  // per-day slot filter checks the slot's effective range against that
  // date. This is what makes one-day recovery slots appear on exactly
  // their own date and nowhere else.
  const dateForDow = useCallback(
    (dow: number) => nairobiDateAdd(weekStart, dow - 1),
    [weekStart]
  )
  const slotActiveOn = useCallback(
    (s: Slot, date: string) =>
      s.effectiveFrom <= date && (s.effectiveUntil === null || s.effectiveUntil >= date),
    []
  )
  const [allSlots,        setAllSlots]         = useState<Slot[]>([])
  const [loading,         setLoading]          = useState(true)
  const [loadError,       setLoadError]        = useState<string | null>(null)
  const [schoolError,     setSchoolError]      = useState<string | null>(null)
  const [selected,        setSelected]         = useState<Slot | null>(null)
  const [showAddSlot,     setShowAddSlot]      = useState(false)
  const [editSlot,        setEditSlot]         = useState<Slot | null>(null)
  // TBL-009B: non-null while the recovery sheet is open; carries the
  // occurrence/class/subject identity so it survives sheet navigation.
  const [recoveryCtx,     setRecoveryCtx]      = useState<RecoverySheetContext | null>(null)
  const [teacherId,       setTeacherId]        = useState<string | null>(null)
  const [weeklyLoadRows,  setWeeklyLoadRows]   = useState<WeeklyLoadRow[]>([])
  const [showLoadCheck,   setShowLoadCheck]    = useState(false)

  // FIX [FATAL-02]: isMounted ref — prevents setState on unmounted component
  const isMounted = useRef(true)
  useEffect(() => {
    return () => { isMounted.current = false }
  }, [])

  // Live clock — updates every 60s
  // FIX [LOGIC-02]: also refreshes todayDow so day rolls over correctly after midnight
  const [curMin, setCurMin] = useState<number>(currentTimeMin())
  useEffect(() => {
    const id = setInterval(() => {
      setCurMin(currentTimeMin())
      setTodayDow(nairobiDayOfWeek())  // FIX [LOGIC-02] + TBL-009C: keep day current, Nairobi-anchored
      const nextWeekStart = nairobiWeekStart()  // TBL-009D: week rollover triggers reload via load()'s deps
      setWeekStart(current => current === nextWeekStart ? current : nextWeekStart)
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  // FIX [LOGIC-07]: resync activeDow with todayDow on midnight rollover,
  // but only if the user was viewing "today" (not a manually picked day)
  const prevTodayDow = useRef(todayDow)
  useEffect(() => {
    if (todayDow !== prevTodayDow.current) {
      setActiveDow(curr => curr === prevTodayDow.current ? todayDow : curr)
      prevTodayDow.current = todayDow
    }
  }, [todayDow])

  // FIX [FATAL-03]: single router instance at page level — passed down as onNavigate prop
  const handleNavigate = useCallback((url: string) => {
    router.push(url)
  }, [router])

  const load = useCallback(async (): Promise<void> => {
    if (!isMounted.current) return
    setLoadError(null)
    setSchoolError(null)
    setLoading(true)

    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser()

      if (authErr || !user) {
        router.replace('/login')
        return
      }

      if (!isMounted.current) return  // FIX [FATAL-02]: guard after async
      setTeacherId(user.id)

      const todayStr = nairobiDateStr()

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('school_id')
        .eq('id', user.id)
        .single()

      if (!isMounted.current) return

      if (profileError) {
        console.error('[Timetable] failed to resolve teacher school', profileError)
        setSchoolError('Could not determine your school. Please refresh.')
        return
      }

      const schoolId = profile?.school_id

      if (!schoolId) {
        setSchoolError('Your teacher profile is not connected to a school.')
        return
      }

      // TBL-009C: load every slot whose effective range overlaps the
      // visible week, not just slots active today — otherwise a recovery
      // scheduled for later this week is invisible until its date arrives.
      // Per the engine contract, per-date effectiveness is validated at
      // render time via slotActiveOn.
      const slots = await loadTeacherTimetableForRange({
        teacherId: user.id,
        schoolId,
        rangeStart: weekStart,
        rangeEnd: nairobiDateAdd(weekStart, 6),
      })

      if (!isMounted.current) return

      // Fetch subject and class names separately
      const subjectIds = Array.from(new Set(slots.map((s: {subject_id: string}) => s.subject_id).filter(Boolean)))
      const classIds   = Array.from(new Set(slots.map((s: {class_id: string}) => s.class_id).filter(Boolean)))

      const [subjectsRes, classesRes] = await Promise.all([
        subjectIds.length > 0
          ? supabase.from('subjects').select('id, name').in('id', subjectIds)
          : Promise.resolve({ data: [] }),
        classIds.length > 0
          ? supabase.from('classes').select('id, name, stream').in('id', classIds)
          : Promise.resolve({ data: [] }),
      ])

      const subjectMap: Record<string, string> = {}
      ;(subjectsRes.data ?? []).forEach((s: {id: string, name: string}) => { subjectMap[s.id] = s.name })

      const classMap: Record<string, string> = {}
      const gradeMap: Record<string, string> = {}
      ;(classesRes.data ?? []).forEach((c: {id: string, name: string, stream: string|null}) => {
        classMap[c.id] = c.name + (c.stream ? ` ${c.stream}` : '')
        gradeMap[c.id] = c.name
      })

      const mapped: Slot[] = slots.map((s) => {
        return {
          id:        s.id,
          classId:   s.class_id,
          subjectId: s.subject_id,
          subject:   subjectMap[s.subject_id] ?? 'Unknown',
          className: classMap[s.class_id] ?? '',
          grade:     gradeMap[s.class_id] ?? '',
          room:      s.room ?? '',
          startTime: s.start_time,
          endTime:   s.end_time,
          dayOfWeek: s.day_of_week,
          effectiveFrom:  s.effective_from,
          effectiveUntil: s.effective_until,
        }
      })

      setAllSlots(mapped)


    } catch (err) {
      if (isMounted.current) {
        setLoadError('Unexpected error loading timetable. Please refresh.')
      }
    } finally {
      if (isMounted.current) {
        setLoading(false)  // FIX [FATAL-02]: always runs, but only if still mounted
      }
    }
  }, [router, weekStart])

  useEffect(() => {
    load()
  }, [load])

  const daySlots = useMemo(
    () => allSlots.filter(s => s.dayOfWeek === activeDow && slotActiveOn(s, dateForDow(activeDow))),
    [allSlots, activeDow, slotActiveOn, dateForDow]
  )

  const isToday = activeDow === todayDow

  const nowSlot = useMemo(
    () => isToday
      ? daySlots.find(s => timeToMin(s.startTime) <= curMin && timeToMin(s.endTime) > curMin)
      : undefined,
    [daySlots, isToday, curMin]
  )

  const nextSlot = useMemo(
    () => isToday
      ? daySlots.find(s => timeToMin(s.startTime) > curMin && s.id !== nowSlot?.id)
      : undefined,
    [daySlots, isToday, curMin, nowSlot]
  )

  // TBL-009D: the range loader returns timetable DEFINITIONS overlapping
  // the week; what the teacher sees is the per-date filtered set. The hero
  // and Week Summary must count rendered lessons, not definitions — two
  // revisions of the same weekday overlapping different halves of the week
  // are one lesson per date, not two.
  const renderedWeekSlots = useMemo(
    () => DAYS.flatMap(day =>
      allSlots.filter(s => s.dayOfWeek === day.dow && slotActiveOn(s, dateForDow(day.dow)))
    ),
    [allSlots, slotActiveOn, dateForDow]
  )
  const totalLessons  = renderedWeekSlots.length
  const uniqueClasses = useMemo(
    () => new Set(renderedWeekSlots.map(s => s.className)).size,
    [renderedWeekSlots]
  )

  // Fetch this teacher's weekly timetable load via RPC — server-side join
  // across teacher_classes, classes, subjects, subject_weekly_allocations,
  // and timetable_slots. Replaces client-side grouping (Fix 13).
  useEffect(() => {
    let cancelled = false
    supabase.rpc('get_teacher_weekly_timetable_load').then(({ data, error }) => {
      if (cancelled) return
      if (error) { console.error('[Timetable] weekly load RPC failed:', error); return }
      const rows: WeeklyLoadRow[] = (data ?? []).map((r: any) => ({
        classId:        r.class_id,
        subjectId:      r.subject_id,
        className:      r.class_name,
        stream:         r.stream ?? '',
        subjectName:    r.subject_name,
        grade:          r.grade,
        lessonsPerWeek: r.lessons_per_week,
        scheduledCount: r.scheduled_count,
        status:         r.status,
      }))
      setWeeklyLoadRows(rows)
    })
    return () => { cancelled = true }
  }, [teacherId])

  // Only non-OK rows are actionable — OK stays silent, same rule as before.
  const loadMismatches = useMemo(
    () => weeklyLoadRows.filter(r => r.status !== 'OK'),
    [weeklyLoadRows]
  )

  // FIX [LOGIC-06]: on weekends show Monday count, not 0
  const todayCount = useMemo(
    () => {
      const dow = isWeekend ? 1 : todayDow
      const date = dateForDow(dow)
      return allSlots.filter(s => s.dayOfWeek === dow && slotActiveOn(s, date)).length
    },
    [allSlots, todayDow, isWeekend, slotActiveOn, dateForDow]
  )

  
  const canAddSlot = !loading && teacherId !== null

  return (
    <>
      <style>{`
        @keyframes shimmer  { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes slideUp  { from{transform:translateY(100%)} to{transform:translateY(0)} }

        :root {
          --surface:        #ffffff;
          --surface-raised: #f9fafb;
          --sheet-bg:       #ffffff;
          --border-color:   #e5e7eb;
          --slot-now-bg:    #f0fdf4;
          --skeleton-bg:    linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%);
        }
        [data-theme="amoled"] {
          --surface:        #09090b;
          --surface-raised: #111113;
          --sheet-bg:       #09090b;
          --border-color:   #27272a;
          --slot-now-bg:    #052e16;
          --skeleton-bg:    linear-gradient(90deg,#1c1c1e 25%,#2c2c2e 50%,#1c1c1e 75%);
        }

        .day-tabs::-webkit-scrollbar { display: none; }
        .day-tabs { scrollbar-width: none; -ms-overflow-style: none; }

        @media print {
          .no-print { display: none !important; }

          body {
            background: #ffffff !important;
            color: #000000 !important;
            font-size: 11pt;
          }

          .print-hero {
            background: none !important;
            border-bottom: 2px solid #000;
            padding: 8pt 0 6pt !important;
            color: #000 !important;
            border-radius: 0 !important;
            margin-bottom: 8pt !important;
          }
          .print-hero * { color: #000 !important; }

          .slot-card {
            border: 1px solid #ccc !important;
            border-radius: 4px !important;
            box-shadow: none !important;
            background: #fff !important;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .skeleton-shimmer { display: none !important; }
          [style*="position: fixed"] { display: none !important; }
        }
      `}</style>

      {loadError  && <ErrorBanner message={loadError} />}
      {schoolError && <ErrorBanner message={schoolError} />}

      {!loading && (
        <div style={{
          background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12,
          padding: '10px 16px', marginBottom: 14,
        }}>
          <div style={{ fontSize: 11, color: '#92400e', fontWeight: 700, marginBottom: 4 }}>
            {isWeekend ? (todayDow === 7 ? 'Sunday' : 'Saturday') : 'School Day'}
          </div>
          <div style={{ fontSize: 12, color: '#78350f', fontStyle: 'italic' }}>
            {['Every student can learn, just not on the same day.',
              'Education is not filling a bucket but lighting a fire.',
              'A good teacher can inspire hope and ignite the imagination.',
              'Teaching is the greatest act of optimism.',
              'One child, one teacher, one book can change the world.',
              'The best teachers teach from the heart, not from the book.',
              'The art of teaching is the art of assisting discovery.',
            ][new Date().getDay()]}
          </div>
        </div>
      )}

      {/* Hero */}
      <div
        className="print-hero"
        style={{
          background:   'linear-gradient(135deg, #065f46 0%, #10b981 100%)',
          borderRadius: 20,
          padding:      '20px',
          marginBottom: 14,
          color:        '#fff',
        }}
      >
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
          SmartTimetable
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>
          My Weekly Schedule
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 6 }}>
          {loading ? 'Loading…' : `${totalLessons} lessons · ${uniqueClasses} classes this week`}
        </div>

        <div className="no-print" style={{ marginTop: 14 }}>
          <button
            type="button"
            onClick={() => canAddSlot && setShowAddSlot(true)}
            disabled={!canAddSlot}  
            style={{
              padding: '8px 18px', borderRadius: 20, border: 'none',
              cursor:     canAddSlot ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
              background: 'rgba(255,255,255,0.2)', color: '#fff',
              opacity:    canAddSlot ? 1 : 0.45,
              transition: 'opacity 0.2s',
            }}
          >
            + Add Lesson
          </button>
        </div>

        {/* FIX [UI-07]: separate NOW and NEXT rows for clarity */}
        {isToday && !loading && (nowSlot || nextSlot) && (
          <div style={{
            marginTop: 14, padding: '10px 14px',
            background: 'rgba(255,255,255,0.12)',
            borderRadius: 12,
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            {nowSlot && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Now
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginTop: 2 }}>
                    {nowSlot.subject} · {nowSlot.className}
                  </div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.75)' }}>
                  ends {formatTime(nowSlot.endTime)}
                </div>
              </div>
            )}
            {nextSlot && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Next
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginTop: 2 }}>
                    {nextSlot.subject} · {nextSlot.className}
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.85)' }}>
                  {formatCountdown(minutesUntil(nextSlot.startTime, curMin))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Weekly Load Check — only visible when a class+subject combo is
          off the KICD allocation target, unscheduled, or missing a target.
          Silent otherwise, same rule as the scheme page's coverage indicators. */}
      {!loading && loadMismatches.length > 0 && (
        <div
          className="no-print"
          style={{
            marginBottom: 14, borderRadius: 14, border: `1px solid ${C.border}`,
            background: C.surface, overflow: 'hidden',
          }}
        >
          <button
            onClick={() => setShowLoadCheck(v => !v)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>
              ⚠️ {loadMismatches.length} subject{loadMismatches.length !== 1 ? 's' : ''} off weekly allocation
            </span>
            <span style={{ fontSize: 12, color: C.textMuted }}>{showLoadCheck ? 'Hide' : 'Show'}</span>
          </button>
          {showLoadCheck && (
            <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {loadMismatches.map(m => {
                const label =
                  m.status === 'ZERO'      ? 'not scheduled' :
                  m.status === 'UNDER'     ? 'under allocation' :
                  m.status === 'OVER'      ? 'over allocation' :
                  'no KICD target set'
                const color =
                  m.status === 'NO_TARGET' ? C.textMuted :
                  m.status === 'OVER'      ? '#dc2626' :
                  '#d97706'
                return (
                  <div key={`${m.classId}::${m.subjectId}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: C.textPrimary, fontWeight: 600 }}>
                      {m.subjectName} · {m.className}{m.stream ? ' ' + m.stream : ''}
                    </span>
                    <span style={{ color, fontWeight: 700 }}>
                      {m.lessonsPerWeek === null ? `${m.scheduledCount} scheduled` : `${m.scheduledCount} of ${m.lessonsPerWeek}`} · {label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Day tabs */}
      <div
        className="day-tabs no-print"
        style={{ display: 'flex', gap: 8, marginBottom: 14, overflowX: 'auto', paddingBottom: 4 }}
      >
        {DAYS.map(d => {
          const count    = allSlots.filter(s => s.dayOfWeek === d.dow && slotActiveOn(s, dateForDow(d.dow))).length
          const isActive = activeDow === d.dow
          const isTdy    = d.dow === todayDow
          const wknd     = d.weekend
          const activeBg = wknd ? '#d97706' : C.accent
          const border   = isTdy && !isActive ? `1.5px solid ${wknd ? '#d97706' : C.accent}` : wknd && !isActive ? '1.5px dashed #d97706' : 'none'
          return (
            <button
              type="button"
              key={d.dow}
              onClick={() => setActiveDow(d.dow)}
              style={{
                padding:      '8px 16px',
                borderRadius: 20,
                border,
                cursor:       'pointer',
                fontFamily:   'inherit',
                fontSize:     13,
                fontWeight:   700,
                flexShrink:   0,
                background:   isActive ? activeBg : wknd ? '#fffbeb' : 'var(--surface-raised, #f9fafb)',
                color:        isActive ? '#fff' : wknd ? '#d97706' : isTdy ? C.accent : C.textMuted,
              }}
            >
              {d.label}
              {wknd && !isActive && <span style={{ fontSize: 9, marginLeft: 3 }}>✦</span>}
              {count > 0 && (
                <span style={{
                  marginLeft: 6, fontSize: 10, fontWeight: 800,
                  padding: '1px 6px', borderRadius: 10,
                  background: isActive ? 'rgba(255,255,255,0.25)' : wknd ? '#fef3c7' : C.accentLight,
                  color:      isActive ? '#fff' : wknd ? '#d97706' : C.accent,
                }}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Slot list */}
      <Card>
        <SectionLabel>
          {DAYS.find(d => d.dow === activeDow)?.label ?? ''}{isToday ? ' — Today' : ''}
        </SectionLabel>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3].map(i => <Skeleton key={i} h={68} />)}
          </div>
        ) : loadError ? null : daySlots.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: C.textMuted, fontSize: 13 }}>
            No lessons scheduled
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {daySlots.map(slot => (
              <SlotCard
                key={slot.id}
                slot={slot}
                isNow={isToday  && slot.id === nowSlot?.id}
                isNext={isToday && slot.id === nextSlot?.id && !nowSlot}
                curMin={curMin}
                onTap={setSelected}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Week summary */}
      {!loading && (
        <Card>
          <SectionLabel>Week Summary</SectionLabel>
          {[
            { label: 'Total Lessons', value: totalLessons },
            { label: 'Classes',       value: uniqueClasses },
            { label: "Today's Lessons", value: todayCount },
          ].map(r => (
            <div
              key={r.label}
              style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '10px 0',
                borderBottom: `1px solid var(--border-color, ${C.border})`,
              }}
            >
              <span style={{ fontSize: 13, color: C.textMuted }}>{r.label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>{r.value}</span>
            </div>
          ))}
        </Card>
      )}

      {/* Slot detail drawer */}
      <SlotDrawer
        slot={selected}
        curMin={curMin}
        occurrenceDate={dateForDow(activeDow)}
        onClose={() => setSelected(null)}
        onNavigate={handleNavigate}  // FIX [FATAL-03]: single router instance passed down
        onRecover={ctx => setRecoveryCtx(ctx)}
        onCancelRecovery={ctx => setRecoveryCtx(ctx)}
        onEdit={s => setEditSlot(s)}
      />

      {/* TBL-009B: recovery sheet — schedule a recovery for a missed lesson
          or cancel one still in planned/ready. onDone reloads the timetable
          so the one-day recovery slot appears (or disappears) immediately,
          and closes the drawer whose occurrence state is now stale. */}
      {recoveryCtx && (
        <RecoverySheet
          ctx={recoveryCtx}
          onClose={() => setRecoveryCtx(null)}
          onDone={() => { setRecoveryCtx(null); setSelected(null); load() }}
        />
      )}

      {/* Add / edit slot modal — only when school confirmed */}
      {(showAddSlot || editSlot) && teacherId != null && (
        <AddSlotModal
          teacherId={teacherId}
          editSlot={editSlot ? {
            id:             editSlot.id,
            className:      editSlot.className,
            subjectName:    editSlot.subject,
            dayOfWeek:      editSlot.dayOfWeek,
            startTime:      editSlot.startTime,
            endTime:        editSlot.endTime,
            room:           editSlot.room,
            effectiveFrom:  editSlot.effectiveFrom,
            effectiveUntil: editSlot.effectiveUntil,
          } as EditableSlot : undefined}
          onClose={() => { setShowAddSlot(false); setEditSlot(null) }}
          onSaved={() => { setShowAddSlot(false); setEditSlot(null); load() }}
        />
      )}


    </>
  )
}
