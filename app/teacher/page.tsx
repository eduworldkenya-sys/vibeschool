'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/teacher/BottomNav'
import Header from '@/components/teacher/Header'
import OfflineBar from '@/components/teacher/OfflineBar'
import TwinPill from '@/components/teacher/TwinPill'

type SyncStatus = 'synced' | 'offline' | 'failed'
type DarkMode   = 'sun' | 'light' | 'dark'
type TabKey     = 'home' | 'lessonplan' | 'vibeconnect' | 'more' | 'profile'

interface DashboardData {
  fullName:        string
  initials:        string
  school:          string
  className:       string
  subject:         string
  lessonsToday:    number
  unreadFlags:     number
  attendancePct:   number
  nextLesson:      { subject: string; class: string; room: string; start: string; end: string } | null
  currentLesson:   { subject: string; class: string; room: string; start: string; end: string } | null
  flags:           { id: string; severity: string; message: string; student: string | null; type: string }[]
  slots:           { id: string; subject: string; class: string; room: string; start: string; end: string; planStatus: string; attendanceMarked: boolean }[]
  curriculum:      { strand: string; topicsCovered: number; topicsTotal: number; weeksRemaining: number }
  announcements:   { id: string; title: string; body: string; pinned: boolean }[]
}

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
  { id: 'classhub',    label: 'ClassHub',      icon: '🏫', color: '#dbeafe', iconColor: '#1d4ed8', route: '/teacher/classhub' },
  { id: 'timetable',  label: 'Timetable',      icon: '🗓️', color: '#d1fae5', iconColor: '#065f46', route: '/teacher/timetable' },
  { id: 'lessonplan', label: 'Lesson Plans',   icon: '📖', color: '#ede9fe', iconColor: '#6d28d9', route: '/teacher/lessonplan' },
  { id: 'attendance', label: 'Attendance',     icon: '✅', color: '#dcfce7', iconColor: '#166534', route: '/teacher/attendance' },
  { id: 'subjecthub', label: 'SubjectHub',     icon: '🔬', color: '#e0f2fe', iconColor: '#075985', route: '/teacher/subjecthub' },
  { id: 'vibelearn',  label: 'VibeLearn',      icon: '🎓', color: '#fef9c3', iconColor: '#854d0e', route: '/teacher/vibelearn' },
  { id: 'assessment', label: 'Assessment',     icon: '📊', color: '#fef3c7', iconColor: '#92400e', route: '/teacher/assessment' },
  { id: 'schoolhub',  label: 'SchoolHub',      icon: '🏛️', color: '#f3e8ff', iconColor: '#7e22ce', route: '/teacher/schoolhub' },
]

export default function TeacherHomePage() {
  const router = useRouter()

  const [data,       setData]       = useState<DashboardData | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced')
  const [darkMode,   setDarkMode]   = useState<DarkMode>('sun')
  const [activeTab,  setActiveTab]  = useState<TabKey>('home')
  const [twinOpen,   setTwinOpen]   = useState(false)
  const [twinInput,  setTwinInput]  = useState('')
  const [twinMsgs,   setTwinMsgs]   = useState<{ role: 'twin' | 'user'; text: string }[]>([
    { role: 'twin', text: 'Good morning. I have reviewed your schedule. Tap any flag to act on it.' }
  ])
  const [twinThinking, setTwinThinking] = useState(false)
  const twinBottomRef = useRef<HTMLDivElement>(null)

  const isDark = darkMode === 'dark' || (darkMode === 'sun' && new Date().getHours() >= 18)

  const bg          = isDark ? '#0f1117' : '#f0f2f5'
  const cardBg      = isDark ? '#1a1d22' : '#ffffff'
  const cardBorder  = isDark ? '#2a2d31' : '#e5e7eb'
  const textPrimary = isDark ? '#f0ede8' : '#111827'
  const textMuted   = '#6b7280'
  const accent      = '#10b981'
  const dark        = '#1e1b4b'

  useEffect(() => {
    const goOnline  = () => setSyncStatus('synced')
    const goOffline = () => setSyncStatus('offline')
    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online',  goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  useEffect(() => {
    if (twinBottomRef.current) {
      twinBottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [twinMsgs, twinThinking, twinOpen])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/academy/signin?role=teacher'); return }

      const uid      = user.id
      const todayDow = new Date().getDay()
      const today    = new Date().toISOString().split('T')[0]

      // Profile + school
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, school_id, schools(name)')
        .eq('id', uid)
        .single()

      const fullName  = profile?.full_name ?? ''
      const parts     = fullName.trim().split(' ').filter(Boolean)
      const initials  = parts.slice(0, 2).map((w: string) => w[0].toUpperCase()).join('')
      const school    = (profile?.schools as unknown as { name: string } | null)?.name ?? ''

      // Timetable slots today
      const { data: slots } = await supabase
        .from('timetable_slots')
        .select(`
          id, start_time, end_time, room, class_id,
          subjects ( name ),
          classes ( id, grade_name, stream )
        `)
        .eq('teacher_id', uid)
        .eq('day_of_week', todayDow)
        .order('start_time', { ascending: true })

      const cur = currentTimeMin()

      const mappedSlots = await Promise.all((slots ?? []).map(async (slot) => {
        const cls     = (slot.classes as unknown) as { id: string; grade_name: string; stream: string | null }
        const subject = ((slot.subjects as unknown) as { name: string } | null)?.name ?? 'Unknown'
        const className = cls.grade_name + (cls.stream ? ` ${cls.stream}` : '')

        const { data: att } = await supabase
          .from('attendance')
          .select('id')
          .eq('timetable_slot_id', slot.id)
          .eq('date', today)
          .limit(1)

        return {
          id:               slot.id,
          subject,
          class:            className,
          room:             slot.room ?? '',
          start:            slot.start_time,
          end:              slot.end_time,
          planStatus:       'green',
          attendanceMarked: (att?.length ?? 0) > 0,
        }
      }))

      const currentLesson = mappedSlots.find(s =>
        timeToMin(s.start) <= cur && timeToMin(s.end) > cur
      ) ?? null

      const nextLesson = mappedSlots.find(s => timeToMin(s.start) > cur) ?? null

      // Attendance pct for home class
      const { data: homeClass } = await supabase
        .from('classes')
        .select('id')
        .eq('class_teacher_id', uid)
        .single()

      let attendancePct = 0
      if (homeClass) {
        const { count: total } = await supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('class_id', homeClass.id)

        const { data: attToday } = await supabase
          .from('attendance')
          .select('status')
          .eq('class_id', homeClass.id)
          .eq('date', today)

        const present = attToday?.filter(r => r.status === 'present').length ?? 0
        attendancePct = total && total > 0 ? Math.round((present / total) * 100) : 0
      }

      // Flags / notifications
      const { data: flagRows } = await supabase
        .from('notifications')
        .select('id, message, severity, type, student_name')
        .eq('user_id', uid)
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(5)

      const flags = (flagRows ?? []).map(f => ({
        id:       f.id,
        severity: f.severity ?? 'medium',
        message:  f.message,
        student:  f.student_name ?? null,
        type:     f.type ?? 'general',
      }))

      // Announcements
      const { data: annRows } = await supabase
        .from('announcements')
        .select('id, title, body, pinned')
        .eq('school_id', profile?.school_id)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(3)

      // Curriculum progress
      const { data: currRows } = await supabase
        .from('scheme_of_work')
        .select('id, completed')
        .eq('teacher_id', uid)

      const topicsTotal   = currRows?.length ?? 0
      const topicsCovered = currRows?.filter(r => r.completed).length ?? 0

      setData({
        fullName,
        initials,
        school,
        className:     homeClass ? 'Grade 6B' : '',
        subject:       mappedSlots[0]?.subject ?? '',
        lessonsToday:  mappedSlots.length,
        unreadFlags:   flags.length,
        attendancePct,
        nextLesson,
        currentLesson,
        flags,
        slots:         mappedSlots,
        curriculum:    { strand: 'Algebra', topicsCovered, topicsTotal, weeksRemaining: 4 },
        announcements: (annRows ?? []).map(a => ({ id: a.id, title: a.title, body: a.body, pinned: a.pinned })),
      })

      setLoading(false)
    }

    load()
  }, [])

  async function sendTwin() {
    if (!twinInput.trim()) return
    const userMsg = twinInput
    setTwinInput('')
    setTwinMsgs(m => [...m, { role: 'user', text: userMsg }])
    setTwinThinking(true)
    await new Promise(r => setTimeout(r, 1500))
    setTwinThinking(false)
    const replies = [
      'I have reviewed your class data. Two students need follow-up this week.',
      'Your Period 3 resource flag is about lab equipment. Mark it available or request a substitute.',
      'You are on track with the scheme of work. No action needed.',
      'I can draft a parent message. Just describe the situation.',
    ]
    setTwinMsgs(m => [...m, { role: 'twin', text: replies[Math.floor(Math.random() * replies.length)] }])
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: bg, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: textMuted }}>
        Loading your dashboard…
      </div>
    )
  }

  if (!data) return null

  const firstName = data.fullName.split(' ')[0] || 'Teacher'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,700;12..96,800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes slideIn { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
        @keyframes fadeIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes twinPulse { 0%,80%,100%{transform:scale(0.7);opacity:0.5} 40%{transform:scale(1);opacity:1} }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 10px; }
      `}</style>

      <div style={{ minHeight: '100vh', background: bg, fontFamily: 'Plus Jakarta Sans, sans-serif', paddingBottom: 145 }}>

        <OfflineBar />

        <Header
          isOnline={syncStatus === 'synced'}
          teacherInitials={data.initials || '??'}
          darkMode={darkMode}
          onDarkModeChange={setDarkMode}
        />

        <div style={{ maxWidth: 640, margin: '0 auto', padding: '16px 16px 0', animation: 'slideIn 0.22s ease' }}>

          {/* ── Hero ── */}
          <div style={{ background: `linear-gradient(135deg, ${dark} 0%, #312e81 100%)`, borderRadius: 20, padding: '22px 22px 20px', marginBottom: 14, color: '#fff' }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 600, marginBottom: 4 }}>
              {new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Bricolage Grotesque, sans-serif', marginBottom: 4 }}>
              {greeting()}, {firstName} 👋
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
              {data.school}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              {[
                { label: 'Lessons Today', value: data.lessonsToday },
                { label: 'Flags',         value: data.unreadFlags },
                { label: 'Attendance',    value: `${data.attendancePct}%` },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Next Up / Now ── */}
          {(data.currentLesson || data.nextLesson) && (() => {
            const slot  = data.currentLesson || data.nextLesson!
            const isNow = !!data.currentLesson
            return (
              <div style={{ background: isNow ? '#d1fae5' : '#fef3c7', borderRadius: 14, padding: '12px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: `1px solid ${isNow ? '#a7f3d0' : '#fde68a'}` }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: isNow ? '#065f46' : '#92400e', letterSpacing: 1, textTransform: 'uppercase' }}>
                    {isNow ? '● Now' : 'Next Up'}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginTop: 2 }}>
                    {slot.subject} · {slot.class} · {slot.room}
                  </div>
                  <div style={{ fontSize: 12, color: textMuted }}>
                    {formatTime(slot.start)}–{formatTime(slot.end)}
                    {!isNow ? ` · in ${formatCountdown(minutesUntil(slot.start))}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => router.push('/teacher/lessonplan')}
                    style={{ padding: '6px 12px', borderRadius: 10, border: `1.5px solid ${accent}`, background: 'transparent', color: accent, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                  >Plan</button>
                  <button
                    onClick={() => router.push('/teacher/attendance')}
                    style={{ padding: '6px 12px', borderRadius: 10, border: 'none', background: accent, color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                  >Attend</button>
                </div>
              </div>
            )
          })()}

          {/* ── Quick Actions ── */}
          <div style={{ background: cardBg, borderRadius: 16, border: `1px solid ${cardBorder}`, padding: '18px 18px', marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: textMuted, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 12 }}>Quick Actions</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {QUICK_ACTIONS.map(qa => (
                <button
                  key={qa.id}
                  onClick={() => router.push(qa.route)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 4px', borderRadius: 14, border: 'none', cursor: 'pointer', background: qa.color, fontFamily: 'inherit', transition: 'transform 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  <span style={{ fontSize: 22 }}>{qa.icon}</span>
                  <span style={{ fontSize: 9, fontWeight: 800, color: qa.iconColor, textAlign: 'center', lineHeight: 1.3 }}>{qa.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Flags ── */}
          {data.flags.length > 0 && (
            <div style={{ background: cardBg, borderRadius: 16, border: `1px solid ${cardBorder}`, padding: '18px 18px', marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: textMuted, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 12 }}>
                Early Warning Flags ({data.flags.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.flags.map(f => {
                  const sevColor = f.severity === 'high' ? { bg: '#fef3c7', color: '#92400e' } : f.severity === 'critical' ? { bg: '#fee2e2', color: '#991b1b' } : { bg: '#e0f2fe', color: '#075985' }
                  return (
                    <div key={f.id} style={{ padding: '12px 14px', borderRadius: 12, background: isDark ? '#12151a' : '#f8f9fa', border: `1px solid ${cardBorder}`, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: sevColor.bg, color: sevColor.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>{f.severity}</span>
                          {f.student && <span style={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>{f.student}</span>}
                        </div>
                        <div style={{ fontSize: 13, color: textMuted, lineHeight: 1.5 }}>{f.message}</div>
                      </div>
                      <button
                        onClick={() => router.push('/teacher/vibeconnect')}
                        style={{ padding: '6px 12px', borderRadius: 10, border: `1.5px solid ${accent}`, background: 'transparent', color: accent, fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
                      >Act</button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Today's Timetable ── */}
          <div style={{ background: cardBg, borderRadius: 16, border: `1px solid ${cardBorder}`, padding: '18px 18px', marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: textMuted, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 12 }}>Today's Timetable</div>
            {data.slots.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 13, color: textMuted }}>No classes today</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.slots.map(slot => {
                  const isNow = timeToMin(slot.start) <= currentTimeMin() && timeToMin(slot.end) > currentTimeMin()
                  const chipColor = slot.planStatus === 'green' ? { bg: '#d1fae5', color: '#065f46', label: 'Ready' } : slot.planStatus === 'amber' ? { bg: '#fef3c7', color: '#92400e', label: 'Resource' } : { bg: '#fee2e2', color: '#991b1b', label: 'No Plan' }
                  return (
                    <div key={slot.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', borderRadius: 12, background: isNow ? (isDark ? '#052e16' : '#f0fdf4') : (isDark ? '#12151a' : '#f8f9fa'), border: isNow ? `1.5px solid ${accent}` : `1px solid ${cardBorder}` }}>
                      <div style={{ width: 42, textAlign: 'center', flexShrink: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: textPrimary }}>{formatTime(slot.start)}</div>
                        <div style={{ fontSize: 10, color: textMuted }}>{formatTime(slot.end)}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>{slot.subject} · <span style={{ color: textMuted }}>{slot.class}</span></div>
                        <div style={{ fontSize: 11, color: textMuted }}>{slot.room}</div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 20, background: slot.attendanceMarked ? '#d1fae5' : chipColor.bg, color: slot.attendanceMarked ? '#065f46' : chipColor.color }}>
                        {slot.attendanceMarked ? 'Done' : chipColor.label}
                      </span>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button onClick={() => router.push('/teacher/lessonplan')} style={{ padding: '5px 10px', borderRadius: 8, border: `1.5px solid ${accent}`, background: 'transparent', color: accent, fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Plan</button>
                        <button onClick={() => router.push('/teacher/attendance')} style={{ padding: '5px 10px', borderRadius: 8, border: 'none', background: slot.attendanceMarked ? '#f3f4f6' : accent, color: slot.attendanceMarked ? textMuted : '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                          {slot.attendanceMarked ? '✓' : 'Mark'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Curriculum Progress ── */}
          {data.curriculum.topicsTotal > 0 && (
            <div style={{ background: cardBg, borderRadius: 16, border: `1px solid ${cardBorder}`, padding: '18px 18px', marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: textMuted, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 12 }}>Curriculum Progress</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <span style={{ padding: '5px 14px', borderRadius: 20, background: '#d1fae5', color: '#065f46', fontSize: 12, fontWeight: 700 }}>✓ On Track</span>
                <span style={{ fontSize: 12, color: textMuted }}>Strand: <strong style={{ color: textPrimary }}>{data.curriculum.strand}</strong> · {data.curriculum.weeksRemaining}w left</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, height: 8, background: isDark ? '#2a2d31' : '#e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 10, background: accent, width: `${data.curriculum.topicsTotal > 0 ? (data.curriculum.topicsCovered / data.curriculum.topicsTotal) * 100 : 0}%`, transition: 'width 0.6s ease' }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: textPrimary, flexShrink: 0 }}>{data.curriculum.topicsCovered}/{data.curriculum.topicsTotal}</span>
              </div>
            </div>
          )}

          {/* ── Announcements ── */}
          {data.announcements.length > 0 && (
            <div style={{ background: cardBg, borderRadius: 16, border: `1px solid ${cardBorder}`, padding: '18px 18px', marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: textMuted, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 12 }}>School Notices</div>
              {data.announcements.map(a => (
                <div key={a.id} style={{ padding: '10px 0', borderBottom: `1px solid ${cardBorder}` }}>
                  {a.pinned && <div style={{ fontSize: 9, fontWeight: 800, color: accent, textTransform: 'uppercase', marginBottom: 2 }}>📌 Pinned</div>}
                  <div style={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>{a.title}</div>
                  <div style={{ fontSize: 12, color: textMuted, marginTop: 2 }}>{a.body}</div>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* ── Twin Pill ── */}
        <TwinPill
          open={twinOpen}
          onOpen={() => setTwinOpen(true)}
          onClose={() => setTwinOpen(false)}
          messages={twinMsgs}
          thinking={twinThinking}
          input={twinInput}
          onInputChange={setTwinInput}
          onSend={sendTwin}
          bottomRef={twinBottomRef}
          isDark={isDark}
        />

        <BottomNav
          active={activeTab}
          onChange={(tab) => {
            setActiveTab(tab)
            if (tab === 'lessonplan')  router.push('/teacher/lessonplan')
            if (tab === 'vibeconnect') router.push('/teacher/vibeconnect')
            if (tab === 'more')        router.push('/teacher/more')
            if (tab === 'profile')     router.push('/teacher/profile')
          }}
        />
      </div>
    </>
  )
}