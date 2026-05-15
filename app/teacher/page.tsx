'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

// ── Types ──────────────────────────────────────────────────────────────────
interface Slot {
  id:               string
  subject:          string
  class:            string
  room:             string
  start:            string
  end:              string
  planStatus:       string
  attendanceMarked: boolean
}

interface Flag {
  id:       string
  severity: string
  message:  string
  student:  string | null
  type:     string
}

interface DashboardData {
  fullName:      string
  initials:      string
  school:        string
  lessonsToday:  number
  unreadFlags:   number
  attendancePct: number
  nextLesson:    Slot | null
  currentLesson: Slot | null
  flags:         Flag[]
  slots:         Slot[]
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
function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}
function minutesUntil(start: string) {
  return timeToMin(start) - currentTimeMin()
}
function formatCountdown(mins: number) {
  if (mins <= 0) return 'Now'
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

const QUICK_ACTIONS = [
  { id: 'classhub',    label: 'ClassHub',    icon: '🏫', color: '#dbeafe', iconColor: '#1d4ed8', route: '/teacher/classhub'   },
  { id: 'timetable',  label: 'Timetable',   icon: '🗓️', color: '#d1fae5', iconColor: '#065f46', route: '/teacher/timetable'  },
  { id: 'lessonplan', label: 'Lesson Plans', icon: '📖', color: '#ede9fe', iconColor: '#6d28d9', route: '/teacher/lessonplan' },
  { id: 'attendance', label: 'Attendance',  icon: '✅', color: '#dcfce7', iconColor: '#166534', route: '/teacher/attendance' },
  { id: 'subjecthub', label: 'SubjectHub',  icon: '🔬', color: '#e0f2fe', iconColor: '#075985', route: '/teacher/subjecthub' },
  { id: 'vibelearn',  label: 'VibeLearn',   icon: '🎓', color: '#fef9c3', iconColor: '#854d0e', route: '/teacher/vibelearn'  },
  { id: 'assessment', label: 'Assessment',  icon: '📊', color: '#fef3c7', iconColor: '#92400e', route: '/teacher/assessment' },
  { id: 'schoolhub',  label: 'SchoolHub',   icon: '🏛️', color: '#f3e8ff', iconColor: '#7e22ce', route: '/teacher/schoolhub'  },
]

// ── Skeleton ───────────────────────────────────────────────────────────────
function Skeleton({ w = '100%', h = 16, radius = 8 }: { w?: string | number; h?: number; radius?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: radius,
      background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
      flexShrink: 0,
    }} />
  )
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function TeacherHomePage() {
  const router = useRouter()

  const [data,    setData]    = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const cardBg     = '#ffffff'
  const cardBorder = '#e5e7eb'
  const textMuted  = '#6b7280'
  const textMain   = '#111827'
  const accent     = '#10b981'
  const dark       = '#1e1b4b'

  useEffect(() => {
    async function load() {
      // ── 1. Auth ────────────────────────────────────────────────────────
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/academy/signin?role=teacher'); return }

      const uid   = user.id
      const today = new Date().toISOString().split('T')[0]
      const dow   = new Date().getDay()

      // ── 2. Fire independent queries in parallel ────────────────────────
      const [profileRes, slotsRes, homeClassRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('full_name, school_id')
          .eq('id', uid)
          .single(),

        supabase
          .from('timetable_slots')
          .select(`
            id, start_time, end_time, room,
            subjects ( name ),
            classes ( grade_name, stream )
          `)
          .eq('teacher_id', uid)
          .eq('day_of_week', dow)
          .order('start_time', { ascending: true }),

        supabase
          .from('teacher_classes')
          .select('class_id')
          .eq('teacher_id', uid)
          .eq('is_class_teacher', true)
          .maybeSingle(),
      ])

      // ── 3. Profile ────────────────────────────────────────────────────
      const fullName = profileRes.data?.full_name ?? ''
      const parts    = fullName.trim().split(' ').filter(Boolean)
      const initials = parts.slice(0, 2).map((w: string) => w[0].toUpperCase()).join('')
      const schoolId = profileRes.data?.school_id ?? null

      // ── 4. School name (parallel with attendance batch) ───────────────
      const classTeacherId = homeClassRes.data?.class_id ?? null

      const slotIds = (slotsRes.data ?? []).map(s => s.id)

      const [schoolRes, attBatchRes, studentCountRes, attTodayRes] = await Promise.all([
        schoolId
          ? supabase.from('schools').select('name').eq('id', schoolId).single()
          : Promise.resolve({ data: null }),

        slotIds.length > 0
          ? supabase
              .from('attendance')
              .select('timetable_slot_id')
              .in('timetable_slot_id', slotIds)
              .eq('date', today)
          : Promise.resolve({ data: [] }),

        classTeacherId
          ? supabase
              .from('students')
              .select('id', { count: 'exact', head: true })
              .eq('class_id', classTeacherId)
          : Promise.resolve({ count: 0, data: null }),

        classTeacherId
          ? supabase
              .from('attendance')
              .select('status')
              .eq('class_id', classTeacherId)
              .eq('date', today)
          : Promise.resolve({ data: [] }),
      ])

      // ── 5. Build marked-slot set (O(1) lookup) ────────────────────────
      const markedSlotIds = new Set(
        (attBatchRes.data ?? []).map((r: { timetable_slot_id: string }) => r.timetable_slot_id)
      )

      // ── 6. Map slots ──────────────────────────────────────────────────
      const mappedSlots: Slot[] = (slotsRes.data ?? []).map((slot) => {
        const cls       = slot.classes as unknown as { grade_name: string; stream: string | null } | null
        const subject   = (slot.subjects as unknown as { name: string } | null)?.name ?? 'Unknown'
        const className = cls ? cls.grade_name + (cls.stream ? ` ${cls.stream}` : '') : ''
        return {
          id:               slot.id,
          subject,
          class:            className,
          room:             slot.room ?? '',
          start:            slot.start_time,
          end:              slot.end_time,
          planStatus:       'green',
          attendanceMarked: markedSlotIds.has(slot.id),
        }
      })

      // ── 7. Attendance % ───────────────────────────────────────────────
      const total   = studentCountRes.count ?? 0
      const present = (attTodayRes.data ?? []).filter((r: { status: string }) => r.status === 'present').length
      const attendancePct = total > 0 ? Math.round((present / total) * 100) : 0

      // ── 8. Current / next lesson ──────────────────────────────────────
      const cur           = currentTimeMin()
      const currentLesson = mappedSlots.find(s => timeToMin(s.start) <= cur && timeToMin(s.end) > cur) ?? null
      const nextLesson    = mappedSlots.find(s => timeToMin(s.start) > cur) ?? null

      setData({
        fullName,
        initials,
        school:        (schoolRes.data as { name: string } | null)?.name ?? '',
        lessonsToday:  mappedSlots.length,
        unreadFlags:   0,
        attendancePct,
        nextLesson,
        currentLesson,
        flags:         [],
        slots:         mappedSlots,
      })

      setLoading(false)
    }

    load()
  }, [])

  // ── Render: skeleton ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ animation: 'fadeIn 0.2s ease' }}>
        <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>

        {/* Hero skeleton */}
        <div style={{ background: `linear-gradient(135deg, ${dark} 0%, #312e81 100%)`, borderRadius: 20, padding: '22px 22px 20px', marginBottom: 14 }}>
          <Skeleton w={120} h={12} />
          <div style={{ marginTop: 10 }}><Skeleton w={200} h={22} /></div>
          <div style={{ marginTop: 8 }}><Skeleton w={160} h={13} /></div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 12px', textAlign: 'center' }}>
                <Skeleton w="60%" h={20} />
                <div style={{ marginTop: 6 }}><Skeleton w="80%" h={10} /></div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions skeleton */}
        <div style={{ background: cardBg, borderRadius: 16, border: `1px solid ${cardBorder}`, padding: 18, marginBottom: 14 }}>
          <Skeleton w={100} h={10} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 12 }}>
            {[1,2,3,4,5,6,7,8].map(i => <Skeleton key={i} h={64} radius={14} />)}
          </div>
        </div>

        {/* Timetable skeleton */}
        <div style={{ background: cardBg, borderRadius: 16, border: `1px solid ${cardBorder}`, padding: 18, marginBottom: 14 }}>
          <Skeleton w={120} h={10} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {[1,2,3].map(i => <Skeleton key={i} h={56} radius={12} />)}
          </div>
        </div>
      </div>
    )
  }

  if (!data) return null

  const firstName = data.fullName.split(' ')[0] || 'Teacher'

  // ── Render: loaded ─────────────────────────────────────────────────────
  return (
    <div style={{ animation: 'slideIn 0.22s ease' }}>

      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg, ${dark} 0%, #312e81 100%)`, borderRadius: 20, padding: '22px 22px 20px', marginBottom: 14, color: '#fff' }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 600, marginBottom: 4 }}>
          {new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
          {greeting()}, {firstName} 👋
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{data.school}</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          {[
            { label: 'Lessons Today', value: data.lessonsToday },
            { label: 'Flags',         value: data.unreadFlags  },
            { label: 'Attendance',    value: `${data.attendancePct}%` },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Next Up / Now */}
      {(data.currentLesson || data.nextLesson) && (() => {
        const slot  = data.currentLesson || data.nextLesson!
        const isNow = !!data.currentLesson
        return (
          <div style={{ background: isNow ? '#d1fae5' : '#fef3c7', borderRadius: 14, padding: '12px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: `1px solid ${isNow ? '#a7f3d0' : '#fde68a'}` }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: isNow ? '#065f46' : '#92400e', letterSpacing: 1, textTransform: 'uppercase' }}>
                {isNow ? '● Now' : 'Next Up'}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: textMain, marginTop: 2 }}>
                {slot.subject} · {slot.class} · {slot.room}
              </div>
              <div style={{ fontSize: 12, color: textMuted }}>
                {formatTime(slot.start)}–{formatTime(slot.end)}
                {!isNow ? ` · in ${formatCountdown(minutesUntil(slot.start))}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => router.push('/teacher/lessonplan')} style={{ padding: '6px 12px', borderRadius: 10, border: `1.5px solid ${accent}`, background: 'transparent', color: accent, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Plan</button>
              <button onClick={() => router.push('/teacher/attendance')} style={{ padding: '6px 12px', borderRadius: 10, border: 'none', background: accent, color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Attend</button>
            </div>
          </div>
        )
      })()}

      {/* Quick Actions */}
      <div style={{ background: cardBg, borderRadius: 16, border: `1px solid ${cardBorder}`, padding: 18, marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: textMuted, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 12 }}>Quick Actions</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {QUICK_ACTIONS.map(qa => (
            <button key={qa.id} onClick={() => router.push(qa.route)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 4px', borderRadius: 14, border: 'none', cursor: 'pointer', background: qa.color, fontFamily: 'inherit' }}>
              <span style={{ fontSize: 22 }}>{qa.icon}</span>
              <span style={{ fontSize: 9, fontWeight: 800, color: qa.iconColor, textAlign: 'center', lineHeight: 1.3 }}>{qa.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Today's Timetable */}
      <div style={{ background: cardBg, borderRadius: 16, border: `1px solid ${cardBorder}`, padding: 18, marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: textMuted, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 12 }}>
          "Today's Timetable"
        </div>
        {data.slots.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 13, color: textMuted }}>No classes scheduled today</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.slots.map(s => (
              <div key={s.id} style={{ padding: '12px 14px', borderRadius: 12, background: '#f8f9fa', border: `1px solid ${cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: textMain }}>{s.subject} · {s.class}</div>
                  <div style={{ fontSize: 12, color: textMuted }}>{formatTime(s.start)}–{formatTime(s.end)} · {s.room}</div>
                </div>
                {!s.attendanceMarked && (
                  <button onClick={() => router.push('/teacher/attendance')} style={{ padding: '5px 10px', borderRadius: 8, border: 'none', background: accent, color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Attend</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}