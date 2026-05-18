'use client'

import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Card, SectionLabel, Btn, C } from '@/components/teacher/ui'
import AddSlotModal from '@/components/teacher/AddSlotModal'

// ── Types ──────────────────────────────────────────────────────────────────
interface Slot {
  id:        string
  subject:   string
  className: string
  room:      string
  start:     string
  end:       string
  dayOfWeek: number
}

// ── Helpers ────────────────────────────────────────────────────────────────
function timeToMin(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
function currentTimeMin() {
  const n = new Date()
  return n.getHours() * 60 + n.getMinutes()
}
function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
}
function minutesUntil(start: string) {
  return timeToMin(start) - currentTimeMin()
}
function formatCountdown(mins: number) {
  if (mins <= 0) return 'Now'
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

const DAYS = [
  { label: 'Mon', dow: 1 },
  { label: 'Tue', dow: 2 },
  { label: 'Wed', dow: 3 },
  { label: 'Thu', dow: 4 },
  { label: 'Fri', dow: 5 },
]

// ── Skeleton ───────────────────────────────────────────────────────────────
function Skeleton({ h = 64 }: { h?: number }) {
  return (
    <div style={{
      height: h, borderRadius: 12,
      background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

// ── Slot card ──────────────────────────────────────────────────────────────
function SlotCard({ slot, isNow, isNext, onTap }: {
  slot:   Slot
  isNow:  boolean
  isNext: boolean
  onTap:  (s: Slot) => void
}) {
  return (
    <div
      onClick={() => onTap(slot)}
      style={{
        display:       'flex',
        alignItems:    'center',
        gap:           12,
        padding:       '13px 14px',
        borderRadius:  14,
        background:    isNow ? '#f0fdf4' : C.surface,
        border:        isNow
          ? `2px solid ${C.accent}`
          : isNext
          ? `1.5px dashed ${C.accent}`
          : `1px solid ${C.border}`,
        cursor:        'pointer',
        transition:    'box-shadow 0.15s',
        position:      'relative',
        overflow:      'hidden',
      }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
    >
      {/* Live pulse bar */}
      {isNow && (
        <div style={{
          position:   'absolute',
          left:       0, top: 0, bottom: 0,
          width:      4,
          background: C.accent,
          borderRadius: '14px 0 0 14px',
          animation:  'pulse 2s ease-in-out infinite',
        }} />
      )}

      {/* Time column */}
      <div style={{ width: 48, flexShrink: 0, textAlign: 'center', paddingLeft: isNow ? 4 : 0 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: C.textPrimary }}>
          {formatTime(slot.start)}
        </div>
        <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>
          {formatTime(slot.end)}
        </div>
      </div>

      {/* Detail */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>
          {slot.subject}
          {slot.className ? (
            <span style={{ color: C.textMuted, fontWeight: 500 }}> · {slot.className}</span>
          ) : null}
        </div>
        {slot.room ? (
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{slot.room}</div>
        ) : null}
      </div>

      {/* Badge */}
      {isNow && (
        <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 20, background: C.accent, color: '#fff', flexShrink: 0 }}>
          NOW
        </span>
      )}
      {!isNow && isNext && (
        <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 20, background: '#fef3c7', color: '#92400e', flexShrink: 0 }}>
          in {formatCountdown(minutesUntil(slot.start))}
        </span>
      )}
      {!isNow && !isNext && (
        <span style={{ fontSize: 16, color: C.textMuted }}>›</span>
      )}
    </div>
  )
}

// ── Detail drawer ──────────────────────────────────────────────────────────
function SlotDrawer({ slot, onClose }: { slot: Slot | null; onClose: () => void }) {
  const router = useRouter()
  if (!slot) return null
  const isNow  = timeToMin(slot.start) <= currentTimeMin() && timeToMin(slot.end) > currentTimeMin()
  const isNext = !isNow && timeToMin(slot.start) > currentTimeMin()

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 800, background: 'rgba(0,0,0,0.3)' }}
      />
      <div style={{
        position:     'fixed',
        bottom:       0, left: 0, right: 0,
        zIndex:       810,
        background:   '#fff',
        borderRadius: '20px 20px 0 0',
        padding:      '24px 20px 36px',
        boxShadow:    '0 -8px 40px rgba(0,0,0,0.15)',
        animation:    'slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        {/* Handle */}
        <div style={{ width: 40, height: 4, borderRadius: 2, background: C.border, margin: '0 auto 20px' }} />

        {/* Status badge */}
        {isNow && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, background: C.accentLight, marginBottom: 14 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.accent, animation: 'pulse 1.5s infinite' }} />
            <span style={{ fontSize: 11, fontWeight: 800, color: '#065f46' }}>In progress</span>
          </div>
        )}
        {isNext && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, background: '#fef3c7', marginBottom: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#92400e' }}>
              Starting in {formatCountdown(minutesUntil(slot.start))}
            </span>
          </div>
        )}

        <div style={{ fontSize: 22, fontWeight: 800, color: C.textPrimary, marginBottom: 4 }}>
          {slot.subject}
        </div>
        <div style={{ fontSize: 14, color: C.textMuted, marginBottom: 20 }}>
          {slot.className}{slot.room ? ` · ${slot.room}` : ''}
        </div>

        {/* Time row */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Start',    value: formatTime(slot.start) },
            { label: 'End',      value: formatTime(slot.end)   },
            { label: 'Duration', value: (() => {
              const mins = timeToMin(slot.end) - timeToMin(slot.start)
              return `${mins} min`
            })() },
          ].map(r => (
            <div key={r.label} style={{ flex: 1, background: C.surface, borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.textPrimary }}>{r.value}</div>
              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{r.label}</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Btn
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => router.push('/teacher/attendance')}
          >
            Mark Attendance
          </Btn>
          <Btn
            variant="ghost"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => router.push('/teacher/lessonplan')}
          >
            View Lesson Plan
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

// ── Page ───────────────────────────────────────────────────────────────────
export default function TimetablePage() {
  const todayDow = new Date().getDay() // 0 Sun … 6 Sat
  const startDow = DAYS.find(d => d.dow === todayDow) ? todayDow : 1

  const [activeDow,  setActiveDow]  = useState(startDow)
  const [allSlots,   setAllSlots]   = useState<Slot[]>([])
  const [loading,    setLoading]    = useState(true)
  const [selected,   setSelected]   = useState<Slot | null>(null)
  const [showAddSlot, setShowAddSlot] = useState(false)
  const [teacherSchoolId, setTeacherSchoolId] = useState<string | null>(null)
  const [teacherId, setTeacherId] = useState<string | null>(null)

  // ── Load all week slots once ─────────────────────────────────────────
  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setTeacherId(user.id)

    const { data } = await supabase
      .from('timetable_slots')
      .select(`
        id, day_of_week, start_time, end_time, room,
        subjects ( name ),
        classes  ( name, stream )
      `)
      .eq('teacher_id', user.id)
      .order('day_of_week', { ascending: true })
      .order('start_time',  { ascending: true })

    const mapped: Slot[] = (data ?? []).map((s) => {
      const sub = (s.subjects as unknown as { name: string } | null)?.name ?? 'Unknown'
      const cls = s.classes as unknown as { name: string; stream: string | null } | null
      const className = cls ? cls.name + (cls.stream ? ` ${cls.stream}` : '') : ''
      return {
        id:        s.id,
        subject:   sub,
        className,
        room:      s.room ?? '',
        start:     s.start_time,
        end:       s.end_time,
        dayOfWeek: s.day_of_week,
      }
    })

    setAllSlots(mapped)

    // Get school_id for the modal
    const { data: memberData } = await supabase
      .from('school_members')
      .select('school_id')
      .eq('profile_id', user.id)
      .maybeSingle()

    setTeacherSchoolId(memberData?.school_id ?? null)

    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const daySlots  = allSlots.filter(s => s.dayOfWeek === activeDow)
  const cur       = currentTimeMin()
  const nowSlot   = daySlots.find(s => timeToMin(s.start) <= cur && timeToMin(s.end) > cur)
  const nextSlot  = daySlots.find(s => timeToMin(s.start) > cur)
  const isToday   = activeDow === todayDow

  // Week summary counts
  const totalLessons = allSlots.length
  const uniqueClasses = new Set(allSlots.map(s => s.className)).size

  return (
    <>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
      `}</style>

      {/* Hero */}
      <div style={{
        background:    'linear-gradient(135deg, #065f46 0%, #10b981 100%)',
        borderRadius:  20,
        padding:       '20px',
        marginBottom:  14,
        color:         '#fff',
      }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
          SmartTimetable
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>
          My Weekly Schedule
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 6 }}>
          {loading ? 'Loading…' : `${totalLessons} lessons · ${uniqueClasses} classes this week`}
        </div>

        <div style={{ marginTop: 14 }}>
          <button
            onClick={() => setShowAddSlot(true)}
            style={{
              padding: '8px 18px', borderRadius: 20, border: 'none',
              cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
              background: 'rgba(255,255,255,0.2)', color: '#fff',
            }}
          >
            + Add Slot
          </button>
        </div>

        {/* Today next-up strip */}
        {isToday && !loading && nextSlot && (
          <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(255,255,255,0.12)', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                {nowSlot ? 'Now' : 'Next'}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginTop: 2 }}>
                {nextSlot.subject} · {nextSlot.className}
              </div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.85)' }}>
              {nowSlot ? formatTime(nowSlot.end) : formatCountdown(minutesUntil(nextSlot.start))}
            </div>
          </div>
        )}
      </div>

      {/* Day tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, overflowX: 'auto', paddingBottom: 4 }}>
        {DAYS.map(d => {
          const count    = allSlots.filter(s => s.dayOfWeek === d.dow).length
          const isActive = activeDow === d.dow
          const isTdy    = d.dow === todayDow
          return (
            <button
              key={d.dow}
              onClick={() => setActiveDow(d.dow)}
              style={{
                padding:      '8px 16px',
                borderRadius: 20,
                border:       isTdy && !isActive ? `1.5px solid ${C.accent}` : 'none',
                cursor:       'pointer',
                fontFamily:   'inherit',
                fontSize:     13,
                fontWeight:   700,
                flexShrink:   0,
                background:   isActive ? C.accent : C.surface,
                color:        isActive ? '#fff' : isTdy ? C.accent : C.textMuted,
                position:     'relative',
              }}
            >
              {d.label}
              {count > 0 && (
                <span style={{
                  marginLeft:  6,
                  fontSize:    10,
                  fontWeight:  800,
                  padding:     '1px 6px',
                  borderRadius: 10,
                  background:  isActive ? 'rgba(255,255,255,0.25)' : C.accentLight,
                  color:       isActive ? '#fff' : C.accent,
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
                isNow={isToday && slot.id === nowSlot?.id}
                isNext={isToday && slot.id === nextSlot?.id && !nowSlot}
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
            { label: 'Today',         value: allSlots.filter(s => s.dayOfWeek === todayDow).length },
          ].map(r => (
            <div
              key={r.label}
              style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${C.border}` }}
            >
              <span style={{ fontSize: 13, color: C.textMuted }}>{r.label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>{r.value}</span>
            </div>
          ))}
        </Card>
      )}

      {/* Slot detail drawer */}
      <SlotDrawer slot={selected} onClose={() => setSelected(null)} />

      {showAddSlot && teacherId && teacherSchoolId && (
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