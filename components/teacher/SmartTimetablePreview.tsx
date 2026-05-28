'use client'

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

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

function formatCountdown(mins: number): string {
  const safe = Math.max(0, mins)
  if (safe <= 0) return 'Now'
  if (safe < 60) return `${safe}m`
  return `${Math.floor(safe / 60)}h ${safe % 60}m`
}

function StatRow({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.08)',
    }}>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 800, color: accent ?? '#fff' }}>{value}</span>
    </div>
  )
}

export default function SmartTimetablePreview() {
  const router    = useRouter()
  const isMounted = useRef(true)
  const slideRef  = useRef<HTMLDivElement>(null)

  useEffect(() => { return () => { isMounted.current = false } }, [])

  const todayDow = new Date().getDay() === 0 ? 7 : new Date().getDay()
  const DAYS     = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const DAYS_S   = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  const [allSlots,    setAllSlots]    = useState<Slot[]>([])
  const [loading,     setLoading]     = useState(true)
  const [curMin,      setCurMin]      = useState<number>(currentTimeMin())
  const [activeSlide, setActiveSlide] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setCurMin(currentTimeMin()), 60_000)
    return () => clearInterval(id)
  }, [])

  const load = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !isMounted.current) return

      const { data: slots } = await supabase
        .from('timetable_slots')
        .select('id, day_of_week, start_time, end_time, room, subject_id, class_id')
        .eq('teacher_id', user.id)
        .order('start_time', { ascending: true })

      if (!slots || !isMounted.current) return

      const subjectIds = Array.from(new Set(slots.map((s: { subject_id: string }) => s.subject_id).filter(Boolean)))
      const classIds   = Array.from(new Set(slots.map((s: { class_id: string }) => s.class_id).filter(Boolean)))

      const [subjectsRes, classesRes] = await Promise.all([
        subjectIds.length > 0
          ? supabase.from('subjects').select('id, name').in('id', subjectIds)
          : Promise.resolve({ data: [] }),
        classIds.length > 0
          ? supabase.from('classes').select('id, name, stream').in('id', classIds)
          : Promise.resolve({ data: [] }),
      ])

      const subjectMap: Record<string, string> = {}
      ;(subjectsRes.data ?? []).forEach((s: { id: string; name: string }) => { subjectMap[s.id] = s.name })

      const classMap: Record<string, string> = {}
      ;(classesRes.data ?? []).forEach((c: { id: string; name: string; stream: string | null }) => {
        classMap[c.id] = c.name + (c.stream ? ` ${c.stream}` : '')
      })

      const mapped: Slot[] = slots.map((s: {
        id: string; subject_id: string; class_id: string
        room: string; start_time: string; end_time: string; day_of_week: number
      }) => ({
        id:        s.id,
        classId:   s.class_id,
        subjectId: s.subject_id,
        subject:   subjectMap[s.subject_id] ?? 'Unknown',
        className: classMap[s.class_id] ?? '',
        room:      s.room ?? '',
        startTime: s.start_time,
        endTime:   s.end_time,
        dayOfWeek: s.day_of_week,
      }))

      if (isMounted.current) setAllSlots(mapped)
    } finally {
      if (isMounted.current) setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const todaySlots = useMemo(
    () => allSlots.filter(s => s.dayOfWeek === todayDow),
    [allSlots, todayDow]
  )

  const nowSlot = useMemo(
    () => todaySlots.find(s => timeToMin(s.startTime) <= curMin && timeToMin(s.endTime) > curMin),
    [todaySlots, curMin]
  )

  const nextSlot = useMemo(
    () => todaySlots.find(s => timeToMin(s.startTime) > curMin && s.id !== nowSlot?.id),
    [todaySlots, curMin, nowSlot]
  )

  const tomorrowDow   = todayDow >= 5 ? 1 : todayDow + 1
  const tomorrowSlots = useMemo(
    () => allSlots.filter(s => s.dayOfWeek === tomorrowDow).sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime)),
    [allSlots, tomorrowDow]
  )

  const doneLessons    = todaySlots.filter(s => timeToMin(s.endTime) <= curMin).length
  const pendingLessons = todaySlots.filter(s => timeToMin(s.endTime) > curMin).length
  const totalWeek      = allSlots.length

  const daysLeft = (() => {
    const remaining = [1,2,3,4,5].filter(d => d > todayDow)
    return remaining.filter(d => allSlots.some(s => s.dayOfWeek === d)).length
  })()

  const firstTomorrow = tomorrowSlots[0]

  function onScroll() {
    if (!slideRef.current) return
    const el    = slideRef.current
    const index = Math.round(el.scrollLeft / el.offsetWidth)
    setActiveSlide(index)
  }

  const slides = [
    {
      id:         'morning',
      label:      '🌅 Morning Brief',
      gradient:   'linear-gradient(135deg, #1e3a5f 0%, #1e4d6b 50%, #0f2d40 100%)',
      accent:     '#60c8f5',
      accentDim:  'rgba(96,200,245,0.15)',
      content: () => {
        const firstLesson = todaySlots.length > 0
          ? todaySlots.reduce((a, b) => timeToMin(a.startTime) < timeToMin(b.startTime) ? a : b)
          : null
        return (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
                {todaySlots.length > 0
                  ? `${todaySlots.length} lesson${todaySlots.length !== 1 ? 's' : ''} today`
                  : 'Free day'}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
                {DAYS[todayDow]}
              </div>
            </div>
            <StatRow
              label="First lesson"
              value={firstLesson ? `${firstLesson.subject} · ${formatTime(firstLesson.startTime)}` : '—'}
              accent="#60c8f5"
            />
            <StatRow
              label="Lessons remaining"
              value={pendingLessons > 0 ? `${pendingLessons} to go` : doneLessons > 0 ? 'All done ✓' : '—'}
              accent={pendingLessons === 0 && doneLessons > 0 ? '#34d399' : '#fff'}
            />
            <StatRow
              label="This week"
              value={`${totalWeek} total`}
            />
            <button
              onClick={() => router.push('/teacher/timetable')}
              style={{
                marginTop: 14, width: '100%', padding: '10px 0', borderRadius: 12,
                border: '1.5px solid rgba(96,200,245,0.4)',
                background: 'rgba(96,200,245,0.1)', color: '#60c8f5',
                fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              View Full Timetable →
            </button>
          </>
        )
      },
    },
    {
      id:        'class',
      label:     '📋 Class Pulse',
      gradient:  'linear-gradient(135deg, #1a3a2a 0%, #064e3b 50%, #022c22 100%)',
      accent:    '#34d399',
      accentDim: 'rgba(52,211,153,0.15)',
      content: () => {
        const liveLabel = nowSlot
          ? `${nowSlot.subject} · ${nowSlot.className}`
          : nextSlot
            ? `${nextSlot.subject} in ${formatCountdown(timeToMin(nextSlot.startTime) - curMin)}`
            : doneLessons > 0
              ? 'All classes done'
              : 'No class now'
        const liveAccent = nowSlot ? '#34d399' : nextSlot ? '#fbbf24' : 'rgba(255,255,255,0.4)'
        return (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
                {nowSlot ? 'In session' : nextSlot ? 'Up next' : 'Between classes'}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
                Live class status
              </div>
            </div>
            <StatRow label="Now" value={liveLabel} accent={liveAccent} />
            <StatRow
              label="Lessons done today"
              value={`${doneLessons} of ${todaySlots.length}`}
              accent={doneLessons === todaySlots.length && todaySlots.length > 0 ? '#34d399' : '#fff'}
            />
            <StatRow
              label="Attendance"
              value={pendingLessons > 0 ? `${pendingLessons} pending` : doneLessons > 0 ? 'All marked ✓' : '—'}
              accent={pendingLessons > 0 ? '#fbbf24' : '#34d399'}
            />
            <button
              onClick={() => router.push('/teacher/attendance')}
              style={{
                marginTop: 14, width: '100%', padding: '10px 0', borderRadius: 12,
                border: '1.5px solid rgba(52,211,153,0.4)',
                background: 'rgba(52,211,153,0.1)', color: '#34d399',
                fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Mark Attendance →
            </button>
          </>
        )
      },
    },
    {
      id:        'wrap',
      label:     '🌙 Day Wrap',
      gradient:  'linear-gradient(135deg, #2d1b4e 0%, #3b1f6b 50%, #1a0f2e 100%)',
      accent:    '#a78bfa',
      accentDim: 'rgba(167,139,250,0.15)',
      content: () => {
        return (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
                {doneLessons > 0
                  ? `${doneLessons} lesson${doneLessons !== 1 ? 's' : ''} delivered`
                  : "Tomorrow's plan"}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
                End of day summary
              </div>
            </div>
            <StatRow
              label="Today complete"
              value={pendingLessons === 0 && todaySlots.length > 0 ? 'Yes ✓' : pendingLessons > 0 ? `${pendingLessons} remaining` : '—'}
              accent={pendingLessons === 0 && todaySlots.length > 0 ? '#34d399' : '#fbbf24'}
            />
            <StatRow
              label="Tomorrow"
              value={firstTomorrow
                ? `${firstTomorrow.subject} · ${formatTime(firstTomorrow.startTime)}`
                : 'No lessons'}
              accent="#a78bfa"
            />
            <StatRow
              label="Days left this week"
              value={daysLeft > 0 ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''}` : "Last day ✓"}
              accent={daysLeft === 0 ? '#34d399' : '#fff'}
            />
            <button
              onClick={() => router.push('/teacher/lessonplan')}
              style={{
                marginTop: 14, width: '100%', padding: '10px 0', borderRadius: 12,
                border: '1.5px solid rgba(167,139,250,0.4)',
                background: 'rgba(167,139,250,0.1)', color: '#a78bfa',
                fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Prep Tomorrow →
            </button>
          </>
        )
      },
    },
  ]

  if (loading) {
    return (
      <div style={{ marginBottom: 24 }}>
        <div style={{
          height: 200, borderRadius: 20,
          background: 'linear-gradient(135deg, #1e3a5f, #1a3a2a)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>Loading…</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <style>{`
        .insight-slides::-webkit-scrollbar { display: none; }
        .insight-slides { scrollbar-width: none; -ms-overflow-style: none; }
        .slide-btn:active { opacity: 0.75; transform: scale(0.97); }
      `}</style>

      {/* Slides */}
      <div
        ref={slideRef}
        className="insight-slides"
        onScroll={onScroll}
        style={{
          display:                'flex',
          overflowX:              'auto',
          scrollSnapType:         'x mandatory',
          WebkitOverflowScrolling: 'touch',
          gap:                    12,
          paddingBottom:          4,
        }}
      >
        {slides.map(slide => (
          <div
            key={slide.id}
            style={{
              scrollSnapAlign: 'start',
              flexShrink:      0,
              width:           '100%',
              background:      slide.gradient,
              borderRadius:    20,
              padding:         '22px 20px 18px',
              boxShadow:       '0 8px 32px rgba(0,0,0,0.18)',
              position:        'relative',
              overflow:        'hidden',
            }}
          >
            {/* Decorative orb */}
            <div style={{
              position:     'absolute',
              bottom:       -50, right: -30,
              width:        160, height: 160,
              borderRadius: '50%',
              background:   slide.accentDim,
              pointerEvents: 'none',
            }} />

            {/* Label pill */}
            <div style={{
              display:      'inline-flex',
              alignItems:   'center',
              padding:      '4px 10px',
              borderRadius: 20,
              background:   slide.accentDim,
              border:       `1px solid ${slide.accent}30`,
              marginBottom: 14,
            }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: slide.accent, letterSpacing: 0.8 }}>
                {slide.label}
              </span>
            </div>

            {slide.content()}
          </div>
        ))}
      </div>

      {/* Dot indicators */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 10 }}>
        {slides.map((_, i) => (
          <div
            key={i}
            style={{
              width:        i === activeSlide ? 20 : 6,
              height:       6,
              borderRadius: 3,
              background:   i === activeSlide ? '#1e1b4b' : '#e5e7eb',
              transition:   'all 0.25s ease',
            }}
          />
        ))}
      </div>
    </div>
  )
}
