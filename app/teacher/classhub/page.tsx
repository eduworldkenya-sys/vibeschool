'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'

import styles from './classhub.module.css'
import ClassCard  from '@/components/teacher/classhub/ClassCard'
import BottomNav  from '@/components/teacher/BottomNav'
import Header     from '@/components/teacher/Header'
import OfflineBar from '@/components/teacher/OfflineBar'

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ClassItem {
  id:               string
  name:             string
  stream:           string | null
  subject:          string
  lessonTime:       string
  studentCount:     number
  attendancePct:    number
  attendanceMarked: boolean
  unreadAlerts:     number
  nextAssessment:   string | null
}

type SyncStatus = 'synced' | 'offline' | 'failed'
type DarkMode   = 'sun' | 'light' | 'dark'

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
}

function todayRange() {
  const now   = new Date()
  const start = new Date(now); start.setHours(0, 0, 0, 0)
  const end   = new Date(now); end.setHours(23, 59, 59, 999)
  return { start: start.toISOString(), end: end.toISOString() }
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ClassHubPage() {
  const supabase = createClientComponentClient()
  const router   = useRouter()

  const [classes,     setClasses]     = useState<ClassItem[]>([])
  const [loading,     setLoading]     = useState(true)
  const [syncStatus,  setSyncStatus]  = useState<SyncStatus>('synced')
  const [darkMode,    setDarkMode]    = useState<DarkMode>('sun')
  const [teacherName, setTeacherName] = useState('')
  const [notifCount,  setNotifCount]  = useState(0)

  const isDark =
    darkMode === 'dark' ||
    (darkMode === 'sun' && new Date().getHours() >= 18)

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
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/academy/signin'); return }

      const uid = user.id

      // Database Identity Law: profiles.id = auth.uid()
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, school_id')
        .eq('id', uid)
        .single()

      if (!profile) return
      setTeacherName(profile.name ?? '')

      const sid      = profile.school_id
      const todayDow = new Date().getDay()

      // Sunday — no classes
      if (todayDow === 0) { setLoading(false); return }

      // School Scope Law: every query includes school_id
      const { data: slots } = await supabase
        .from('timetable_slots')
        .select(`
          id,
          subject,
          start_time,
          end_time,
          class_id,
          classes ( id, grade_name, stream )
        `)
        .eq('teacher_id', uid)
        .eq('school_id', sid)
        .eq('day_of_week', todayDow)
        .order('start_time', { ascending: true })

      if (!slots || slots.length === 0) { setLoading(false); return }

      const { start: dayStart, end: dayEnd } = todayRange()

      const items: ClassItem[] = await Promise.all(
        slots.map(async (slot) => {
          const cls = slot.classes as {
            id: string; grade_name: string; stream: string | null
          }

          // Student count — School Scope Law
          const { count: studentCount } = await supabase
            .from('students')
            .select('id', { count: 'exact', head: true })
            .eq('class_id', slot.class_id)
            .eq('school_id', sid)

          // Attendance — Bible Law: timestamp range NOT .eq('date', today)
          const { data: att } = await supabase
            .from('attendance')
            .select('status')
            .eq('class_id', slot.class_id)
            .eq('school_id', sid)
            .gte('timestamp', dayStart)
            .lte('timestamp', dayEnd)

          const total        = studentCount ?? 0
          const presentCount = att?.filter(r => r.status === 'present').length ?? 0
          const pct          = total > 0 ? Math.round((presentCount / total) * 100) : 0
          const marked       = (att?.length ?? 0) > 0

          // Unread alerts
          const { count: alerts } = await supabase
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('class_id', slot.class_id)
            .eq('school_id', sid)
            .eq('read', false)

          // Next assessment
          const { data: assessments } = await supabase
            .from('assessments')
            .select('title, date')
            .eq('class_id', slot.class_id)
            .eq('school_id', sid)
            .gte('date', new Date().toISOString())
            .order('date', { ascending: true })
            .limit(1)

          let nextAssessment: string | null = null
          if (assessments?.length) {
            const a   = assessments[0]
            const day = new Date(a.date).toLocaleDateString('en-KE', { weekday: 'short' })
            nextAssessment = `${a.title} — ${day}`
          }

          return {
            id:               cls.id,
            name:             cls.grade_name + (cls.stream ? ` ${cls.stream}` : ''),
            stream:           cls.stream,
            subject:          slot.subject,
            lessonTime:       `${formatTime(slot.start_time)} – ${formatTime(slot.end_time)}`,
            studentCount:     total,
            attendancePct:    pct,
            attendanceMarked: marked,
            unreadAlerts:     alerts ?? 0,
            nextAssessment,
          }
        })
      )

      setClasses(items)

      // Header notif count
      const { count: notifs } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', uid)
        .eq('school_id', sid)
        .eq('read', false)

      setNotifCount(notifs ?? 0)
      setLoading(false)
    }

    load()
  }, [])

  const rootClass = [styles.root, isDark ? styles.rootDark : ''].filter(Boolean).join(' ')

  if (loading) {
    return (
      <div className={rootClass}>
        <div className={styles.loadingState}>Loading your classes…</div>
      </div>
    )
  }

  return (
    <div className={rootClass}>
      <OfflineBar status={syncStatus} isDark={isDark} />

      <Header
        teacherInitials={teacherName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
        notifCount={notifCount}
        isDark={isDark}
        darkMode={darkMode}
        onDarkModeToggle={() =>
          setDarkMode(d => d === 'sun' ? 'light' : d === 'light' ? 'dark' : 'sun')
        }
        onNotifPress={() => {}}
      />

      <div className={styles.scroll}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>ClassHub</h1>
          <p className={styles.pageSubtitle}>
            {classes.length} {classes.length === 1 ? 'class' : 'classes'} today
          </p>
        </div>

        {classes.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>📚</span>
            <p className={styles.emptyText}>No classes scheduled today</p>
          </div>
        ) : (
          <div className={styles.cardList}>
            {classes.map(cls => (
              <ClassCard
                key={cls.id}
                data={cls}
                isDark={isDark}
                onTap={() => router.push(`/teacher/classhub/${cls.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      <BottomNav
        activeTab="classhub"
        isDark={isDark}
        connecthubBadge={0}
        onTabChange={(tab) => {
          if (tab === 'home')       router.push('/teacher')
          if (tab === 'twin')       router.push('/teacher/twin')
          if (tab === 'connecthub') router.push('/teacher/connecthub')
          if (tab === 'profile')    router.push('/teacher/profile')
        }}
      />
    </div>
  )
}