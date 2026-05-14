'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

import styles from './classhub.module.css'
import BottomNav  from '@/components/teacher/BottomNav'
import Header     from '@/components/teacher/Header'
import OfflineBar from '@/components/teacher/OfflineBar'

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
type TabKey     = 'home' | 'classhub' | 'twin' | 'connecthub' | 'profile'

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
}

export default function ClassHubPage() {
  const router = useRouter()

  const [classes,    setClasses]    = useState<ClassItem[]>([])
  const [loading,    setLoading]    = useState(true)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced')
  const [darkMode,   setDarkMode]   = useState<DarkMode>('sun')
  const [initials,   setInitials]   = useState('')
  const [activeTab,  setActiveTab]  = useState<TabKey>('classhub')

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
      if (!user) { router.push('/academy/signin?role=teacher'); return }

      const uid      = user.id
      const todayDow = new Date().getDay()
      const today    = new Date().toISOString().split('T')[0]

      // 1. Profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', uid)
        .single()

      if (profile?.full_name) {
        const parts = profile.full_name.trim().split(' ').filter(Boolean)
        setInitials(parts.slice(0, 2).map((w: string) => w[0].toUpperCase()).join(''))
      }

      // Sunday — no classes
      if (todayDow === 0) { setLoading(false); return }

      // 2. Timetable slots
      const { data: slots } = await supabase
        .from('timetable_slots')
        .select(`
          id,
          subject_id,
          start_time,
          end_time,
          class_id,
          subjects ( name ),
          classes ( id, grade_name, stream )
        `)
        .eq('teacher_id', uid)
        .eq('day_of_week', todayDow)
        .order('start_time', { ascending: true })

      if (!slots || slots.length === 0) { setLoading(false); return }

      const items: ClassItem[] = await Promise.all(
        slots.map(async (slot) => {
          const cls = (slot.classes as unknown) as {
            id: string
            grade_name: string
            stream: string | null
          }

          const subject =
            ((slot.subjects as unknown) as { name: string } | null)?.name ?? 'Unknown'

          // Student count
          const { count: studentCount } = await supabase
            .from('students')
            .select('id', { count: 'exact', head: true })
            .eq('class_id', slot.class_id)

          // Attendance
          const { data: att } = await supabase
            .from('attendance')
            .select('status')
            .eq('timetable_slot_id', slot.id)
            .eq('date', today)

          const total        = studentCount ?? 0
          const presentCount = att?.filter(r => r.status === 'present').length ?? 0
          const pct          = total > 0 ? Math.round((presentCount / total) * 100) : 0
          const marked       = (att?.length ?? 0) > 0

          // Unread alerts
          const { count: alerts } = await supabase
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', uid)
            .eq('read', false)

          return {
            id:               cls.id,
            name:             cls.grade_name + (cls.stream ? ` ${cls.stream}` : ''),
            stream:           cls.stream,
            subject,
            lessonTime:       `${formatTime(slot.start_time)} – ${formatTime(slot.end_time)}`,
            studentCount:     total,
            attendancePct:    pct,
            attendanceMarked: marked,
            unreadAlerts:     alerts ?? 0,
            nextAssessment:   null,
          }
        })
      )

      setClasses(items)
      setLoading(false)
    }

    load()
  }, [])

  const rootClass = [styles.root, isDark ? styles.rootDark : ''].filter(Boolean).join(' ')

  if (loading) {
    return (
      <div className={rootClass}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100vh', fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontSize: 13, color: '#6b7280'
        }}>
          Loading your classes…
        </div>
      </div>
    )
  }

  return (
    <div className={rootClass}>
      <OfflineBar />

      <Header
        isOnline={syncStatus === 'synced'}
        teacherInitials={initials || '??'}
        darkMode={darkMode}
        onDarkModeChange={setDarkMode}
      />

      <div style={{ paddingBottom: 80 }}>
        <div style={{ padding: '20px 16px 8px' }}>
          <div style={{
            fontFamily: 'Bricolage Grotesque, sans-serif',
            fontSize: 22, fontWeight: 800,
            color: isDark ? '#F0EDE8' : '#111827'
          }}>
            ClassHub
          </div>
          <div style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 13, color: '#6b7280', marginTop: 4
          }}>
            {classes.length} {classes.length === 1 ? 'class' : 'classes'} today
          </div>
        </div>

        {classes.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', padding: '60px 16px', gap: 12
          }}>
            <span style={{ fontSize: 32 }}>📚</span>
            <p style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: 14, color: '#6b7280', textAlign: 'center'
            }}>
              No classes scheduled today
            </p>
          </div>
        ) : (
          <div style={{
            padding: '0 16px',
            display: 'flex', flexDirection: 'column', gap: 12
          }}>
            {classes.map(cls => (
              <div
                key={cls.id}
                onClick={() => router.push(`/teacher/classhub/${cls.id}`)}
                style={{
                  background:   isDark ? '#1A1D22' : '#ffffff',
                  border:       `1px solid ${isDark ? '#2A2D31' : '#E5E7EB'}`,
                  borderRadius: 16,
                  padding:      16,
                  cursor:       'pointer',
                  boxShadow:    '0 1px 3px rgba(0,0,0,0.07)',
                }}
              >
                <div style={{
                  display: 'flex', justifyContent: 'space-between', marginBottom: 8
                }}>
                  <div>
                    <div style={{
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                      fontSize: 16, fontWeight: 700,
                      color: isDark ? '#F0EDE8' : '#111827'
                    }}>
                      {cls.name}
                    </div>
                    <div style={{
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                      fontSize: 12, color: '#6b7280', marginTop: 2
                    }}>
                      {cls.subject}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                      fontSize: 12, fontWeight: 600,
                      color: isDark ? '#F0EDE8' : '#111827'
                    }}>
                      {cls.lessonTime}
                    </div>
                    <div style={{
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                      fontSize: 11, color: '#6b7280', marginTop: 2
                    }}>
                      {cls.studentCount} students
                    </div>
                  </div>
                </div>

                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginTop: 10
                }}>
                  <div style={{
                    flex: 1, height: 4, borderRadius: 4,
                    background: isDark ? '#2A2D31' : '#F3F4F6',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width:      `${cls.attendancePct}%`,
                      height:     '100%',
                      background: cls.attendanceMarked ? '#10B981' : '#E5E7EB',
                      borderRadius: 4,
                      transition: 'width 400ms ease',
                    }} />
                  </div>
                  <span style={{
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    fontSize: 11, fontWeight: 600,
                    color: cls.attendanceMarked ? '#10B981' : '#6b7280'
                  }}>
                    {cls.attendanceMarked ? `${cls.attendancePct}%` : 'Not marked'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav
        active={activeTab}
        onChange={(tab) => {
          setActiveTab(tab)
          if (tab === 'home')    router.push('/teacher')
          if (tab === 'twin')    router.push('/teacher/twin')
          if (tab === 'profile') router.push('/teacher/profile')
        }}
      />
    </div>
  )
}