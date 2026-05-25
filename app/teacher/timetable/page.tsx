'use client'

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Card, SectionLabel, Btn, C } from '@/components/teacher/ui'
import AddSlotModal from '@/components/teacher/AddSlotModal'

// ── Types ──────────────────────────────────────────────────────────────────
interface Slot {
  id:        string
  classId:   string
  subjectId: string
  subject:   string
  className: string
  room:      string
  startTime: string
  endTime:   string
  dayOfWeek: number
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
  onClose,
  onNavigate,
}: {
  slot:       Slot | null
  curMin:     number
  onClose:    () => void
  onNavigate: (url: string) => void
}) {
  // FIX [FATAL-03]: removed useRouter() from here — navigation lifted to page via onNavigate prop

  const touchStartY = useRef<number>(0)

  if (!slot) return null

  const isNow  = timeToMin(slot.startTime) <= curMin && timeToMin(slot.endTime) > curMin
  const isNext = !isNow && timeToMin(slot.startTime) > curMin

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    const delta = e.changedTouches[0].clientY - touchStartY.current
    if (delta > 120) onClose()  // FIX [UI-06]: increased threshold from 80 to 120px
  }

  const today         = new Date().toISOString().slice(0, 10)
  const attendanceUrl = `/teacher/attendance?classId=${encodeURIComponent(slot.classId)}&date=${today}&subject=${encodeURIComponent(slot.subject)}`
  const lessonUrl = `/teacher/lessonplan?subject=${encodeURIComponent(slot.subject)}&classId=${slot.classId}`;
  const homeworkUrl = `/teacher/classhub/${slot.classId}/homework`;

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
          <Btn
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => onNavigate(attendanceUrl)}
          >
            Mark Attendance
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
  const [todayDow, setTodayDow] = useState<number>((() => { const d = new Date().getDay(); return d === 0 ? 7 : d })())

  const isWeekend    = todayDow === 6 || todayDow === 7
  const effectiveDow = todayDow

  const [activeDow,       setActiveDow]       = useState(effectiveDow)
  const [allSlots,        setAllSlots]         = useState<Slot[]>([])
  const [loading,         setLoading]          = useState(true)
  const [loadError,       setLoadError]        = useState<string | null>(null)
  const [schoolError,     setSchoolError]      = useState<string | null>(null)
  const [selected,        setSelected]         = useState<Slot | null>(null)
  const [showAddSlot,     setShowAddSlot]      = useState(false)
  const [teacherSchoolId, setTeacherSchoolId]  = useState<string | null>(null)
  const [teacherId,       setTeacherId]        = useState<string | null>(null)

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
      const rd = new Date().getDay(); setTodayDow(rd === 0 ? 7 : rd)  // FIX [LOGIC-02]: keep day current
    }, 60_000)
    return () => clearInterval(id)
  }, [])

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

      const [slotsResult, memberResult] = await Promise.all([
        supabase
          .from('timetable_slots')
          .select('id, day_of_week, start_time, end_time, room, subject_id, class_id')
          .eq('teacher_id', user.id)
          .order('day_of_week', { ascending: true })
          .order('start_time',  { ascending: true }),


        supabase
          .from('profiles')
          .select('school_id')
          .eq('id', user.id)
          .single(),
      ])

      if (!isMounted.current) return  // FIX [FATAL-02]: guard after async

      if (slotsResult.error) {
        setLoadError('Could not load your timetable. Please refresh.')
        return
      }

      const slots = slotsResult.data ?? []

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
      ;(classesRes.data ?? []).forEach((c: {id: string, name: string, stream: string|null}) => {
        classMap[c.id] = c.name + (c.stream ? ` ${c.stream}` : '')
      })

      const mapped: Slot[] = slots.map((s: {id: string, subject_id: string, class_id: string, room: string, start_time: string, end_time: string, day_of_week: number}) => {
        return {
          id:        s.id,
          classId:   s.class_id,
          subjectId: s.subject_id,
          subject:   subjectMap[s.subject_id] ?? 'Unknown',
          className: classMap[s.class_id] ?? '',
          room:      s.room ?? '',
          startTime: s.start_time,
          endTime:   s.end_time,
          dayOfWeek: s.day_of_week,
        }
      })

      setAllSlots(mapped)

      setTeacherSchoolId(memberResult.data?.school_id ?? null)

    } catch (err) {
      if (isMounted.current) {
        setLoadError('Unexpected error loading timetable. Please refresh.')
      }
    } finally {
      if (isMounted.current) {
        setLoading(false)  // FIX [FATAL-02]: always runs, but only if still mounted
      }
    }
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  const daySlots = useMemo(
    () => allSlots.filter(s => s.dayOfWeek === activeDow),
    [allSlots, activeDow]
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

  const totalLessons  = allSlots.length
  const uniqueClasses = useMemo(
    () => new Set(allSlots.map(s => s.className)).size,
    [allSlots]
  )

  // FIX [LOGIC-06]: on weekends show Monday count, not 0
  const todayCount = useMemo(
    () => allSlots.filter(s => s.dayOfWeek === (isWeekend ? 1 : todayDow)).length,
    [allSlots, todayDow, isWeekend]
  )

  // FIX [FATAL-01]: disable Add Slot button during load to prevent race on teacherSchoolId
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
            disabled={!canAddSlot}  // FIX [FATAL-01]: disabled during load — prevents race on teacherSchoolId
            style={{
              padding: '8px 18px', borderRadius: 20, border: 'none',
              cursor:     canAddSlot ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
              background: 'rgba(255,255,255,0.2)', color: '#fff',
              opacity:    canAddSlot ? 1 : 0.45,
              transition: 'opacity 0.2s',
            }}
          >
            + Add Slot
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

      {/* Day tabs */}
      <div
        className="day-tabs no-print"
        style={{ display: 'flex', gap: 8, marginBottom: 14, overflowX: 'auto', paddingBottom: 4 }}
      >
        {DAYS.map(d => {
          const count    = allSlots.filter(s => s.dayOfWeek === d.dow).length
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
        ) : daySlots.length === 0 ? (
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
            { label: "Today's Lessons", value: allSlots.filter(s => s.dayOfWeek === todayDow).length },
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
        onClose={() => setSelected(null)}
        onNavigate={handleNavigate}  // FIX [FATAL-03]: single router instance passed down
      />

      {/* Add slot modal — only when school confirmed */}
      {showAddSlot && teacherId != null && (
        <AddSlotModal
          teacherId={teacherId}
          schoolId={teacherSchoolId}
          onClose={() => setShowAddSlot(false)}
          onSaved={() => { setShowAddSlot(false); load() }}
        />
      )}


    </>
  )
}