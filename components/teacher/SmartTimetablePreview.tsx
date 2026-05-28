'use client'

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Card, SectionLabel, C } from '@/components/teacher/ui'

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

function minutesUntil(start: string, curMin: number): number {
  return timeToMin(start) - curMin
}

function formatCountdown(mins: number): string {
  const safe = Math.max(0, mins)
  if (safe <= 0) return 'Now'
  if (safe < 60) return `${safe}m`
  return `${Math.floor(safe / 60)}h ${safe % 60}m`
}

const SlotCardPreview = React.memo(function SlotCardPreview({
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
  onTap:  () => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onTap}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onTap() }}
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          12,
        padding:      '13px 14px',
        borderRadius: 14,
        background:   isNow ? '#f0fdf4' : '#ffffff',
        border:       isNow
          ? `2px solid ${C.accent}`
          : isNext
            ? `1.5px dashed ${C.accent}`
            : `1px solid ${C.border}`,
        cursor:   'pointer',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {isNow && (
        <div style={{
          position:     'absolute',
          left: 0, top: 0, bottom: 0,
          width:        4,
          background:   C.accent,
          borderRadius: '14px 0 0 14px',
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

export default function SmartTimetablePreview() {
  const router    = useRouter()
  const isMounted = useRef(true)

  useEffect(() => { return () => { isMounted.current = false } }, [])

  const todayDow = new Date().getDay() === 0 ? 7 : new Date().getDay()

  const [allSlots, setAllSlots] = useState<Slot[]>([])
  const [loading,  setLoading]  = useState(true)
  const [curMin,   setCurMin]   = useState<number>(currentTimeMin())

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

  const goToTimetable = () => router.push('/teacher/timetable')

  const DAYS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div style={{ marginBottom: 24 }}>
      <Card>
        <SectionLabel>{DAYS[todayDow]} — TODAY</SectionLabel>
        {loading ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
            Loading…
          </div>
        ) : todaySlots.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
            No lessons today
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {todaySlots.map(slot => (
              <SlotCardPreview
                key={slot.id}
                slot={slot}
                isNow={slot.id === nowSlot?.id}
                isNext={slot.id === nextSlot?.id && !nowSlot}
                curMin={curMin}
                onTap={goToTimetable}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
