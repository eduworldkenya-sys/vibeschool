'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

import styles from './teacher-home.module.css'

import OfflineBar        from '@/components/teacher/OfflineBar'
import Header            from '@/components/teacher/Header'
import IntelligenceStrip from '@/components/teacher/IntelligenceStrip'
import PulseCard         from '@/components/teacher/PulseCard'
import TwinShortcut      from '@/components/teacher/TwinShortcut'
import ToolsGrid         from '@/components/teacher/ToolsGrid'
import IntelligenceCard  from '@/components/teacher/IntelligenceCard'
import RecentActivity    from '@/components/teacher/RecentActivity'
import BottomNav         from '@/components/teacher/BottomNav'

import type { Insight }      from '@/components/teacher/IntelligenceCard'
import type { ActivityItem } from '@/components/teacher/RecentActivity'

// ── Types ─────────────────────────────────────────────────────────────────────
type DarkMode = 'sun' | 'light' | 'dark'
type TabKey   = 'home' | 'attendance' | 'twin' | 'classes' | 'profile'
type ModeKey  = 'lesson_plan' | 'parent_message' | 'attendance' | 'advisory'
type ToolKey  = 'attendance' | 'timetable' | 'lessonplan' | 'gradebook' | 'connecthub' | 'twin'

interface ClassData {
  id:               string
  name:             string
  subject:          string
  time:             string
  room:             string
  students:         number
  attendanceMarked: boolean
  presentCount:     number
  absentCount:      number
  markedAt:         string
}

interface TeacherProfile {
  name:     string
  initials: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getInitials(fullName: string): string {
  return fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')
}

function startOfCurrentWeek(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

function formatTime(time: string): string {
  // Converts '08:00:00' → '8:00 AM'
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

function formatActivityTime(isoString: string): string {
  const date  = new Date(isoString)
  const now   = new Date()
  const today = now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)

  if (date.toDateString() === today) {
    return 'Today, ' + date.toLocaleTimeString('en-KE', { hour: 'numeric', minute: '2-digit' })
  }
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString('en-KE', { weekday: 'short' })
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TeacherHomePage() {
  const supabase = createClientComponentClient()

  const [darkMode,  setDarkMode]  = useState<DarkMode>('sun')
  const [activeTab, setActiveTab] = useState<TabKey>('home')

  // Data state
  const [teacher,   setTeacher]   = useState<TeacherProfile | null>(null)
  const [classData, setClassData] = useState<ClassData | null>(null)
  const [sessions,  setSessions]  = useState<{ task_type: string; minutes: number }[]>([])
  const [insights,  setInsights]  = useState<Insight[]>([])
  const [activity,  setActivity]  = useState<ActivityItem[]>([])
  const [classesTotal, setClassesTotal] = useState(0)
  const [loading,   setLoading]   = useState(true)

  const isDark =
    darkMode === 'dark' ||
    (darkMode === 'sun' && new Date().getHours() >= 18)

  // ── Load all data on mount ─────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      // 1. Auth user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const uid = user.id

      // 2. Teacher profile
      const { data: userData } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', uid)
        .single()

      if (userData) {
        setTeacher({
          name:     userData.full_name,
          initials: getInitials(userData.full_name),
        })
      }

      // 3. Today's first timetable slot (current class)
      const todayDow = new Date().getDay() // 0=Sun … 6=Sat
      const dowMapped = todayDow === 0 ? 5 : todayDow // treat Sun as Fri fallback

      const now = new Date()
      const nowTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:00`

      const { data: slots } = await supabase
        .from('timetable_slots')
        .select(`
          id,
          subject,
          start_time,
          end_time,
          room,
          day_of_week,
          class_id,
          classes ( grade_name, stream )
        `)
        .eq('teacher_id', uid)
        .eq('day_of_week', dowMapped)
        .lte('start_time', nowTime)
        .order('start_time', { ascending: false })
        .limit(1)

      if (slots && slots.length > 0) {
        const slot = slots[0]
        const cls  = slot.classes as { grade_name: string; stream: string | null }

        // Count students in this class
        const { count: studentCount } = await supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('class_id', slot.class_id)

        // Check if attendance already marked for this slot today
        const today = now.toISOString().split('T')[0]
        const { data: marked } = await supabase
          .from('attendance')
          .select('status')
          .eq('timetable_slot_id', slot.id)
          .eq('date', today)

        const presentCount = marked?.filter(r => r.status === 'present').length ?? 0
        const absentCount  = marked?.filter(r => r.status === 'absent').length  ?? 0
        const wasMarked    = (marked?.length ?? 0) > 0

        const className = cls.grade_name + (cls.stream ? ` ${cls.stream}` : '')

        setClassData({
          id:               slot.id,
          name:             className,
          subject:          slot.subject,
          time:             `${formatTime(slot.start_time)} – ${formatTime(slot.end_time)}`,
          room:             slot.room ?? 'TBA',
          students:         studentCount ?? 0,
          attendanceMarked: wasMarked,
          presentCount,
          absentCount,
          markedAt:         wasMarked ? 'earlier today' : '',
        })
      }

      // 4. Total classes today
      const { count: totalToday } = await supabase
        .from('timetable_slots')
        .select('id', { count: 'exact', head: true })
        .eq('teacher_id', uid)
        .eq('day_of_week', dowMapped)

      setClassesTotal(totalToday ?? 0)

      // 5. Twin sessions this week (for time saved)
      const weekStart = startOfCurrentWeek()
      const { data: sessionData } = await supabase
        .from('twin_sessions')
        .select('task_type, minutes')
        .eq('teacher_id', uid)
        .gte('created_at', weekStart)

      setSessions(sessionData ?? [])

      // 6. Intelligence insights
      const { data: insightRows } = await supabase
        .from('teacher_insights')
        .select('*')
        .eq('teacher_id', uid)
        .limit(5)

      if (insightRows) {
        setInsights(
          insightRows.map((row, i) => ({
            id:        `ins_${i}`,
            type:      row.type as Insight['type'],
            message:   row.message,
            ctaLabel:  row.cta_label,
            ctaAction: () => {
              if (row.type === 'lesson_plan')  handleTwinOpen('lesson_plan')
              if (row.type === 'attendance')   handleTwinOpen('parent_message')
            },
            updatedAt: formatActivityTime(row.created_at),
          }))
        )
      }

      // 7. Recent activity
      const { data: activityRows } = await supabase
        .from('teacher_recent_activity')
        .select('*')
        .eq('teacher_id', uid)
        .limit(5)

      if (activityRows) {
        setActivity(
          activityRows.map((row, i) => ({
            id:        `act_${i}`,
            type:      row.type as ActivityItem['type'],
            title:     row.title,
            subtitle:  row.subtitle,
            timestamp: formatActivityTime(row.created_at),
          }))
        )
      }

      setLoading(false)
    }

    load()
  }, [])

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleTwinOpen(mode: ModeKey) {
    setActiveTab('twin')
    // TODO: open Twin with mode pre-loaded
  }

  function handleToolOpen(tool: ToolKey) {
    // TODO: navigate to tool page
    console.log('Tool opened:', tool)
  }

  async function handleMarkAttendance() {
    if (!classData) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const today = new Date().toISOString().split('T')[0]

    // Fetch all students in this class
    const { data: studentList } = await supabase
      .from('students')
      .select('id')
      .eq('class_id', classData.id) // classData.id is timetable_slot_id here
    // NOTE: For a real mark-attendance flow you'd open a screen to
    // tick each student. This sets everyone present as a placeholder.
    if (!studentList) return

    const rows = studentList.map(s => ({
      timetable_slot_id: classData.id,
      class_id:          classData.id, // replace with real class_id from slot
      student_id:        s.id,
      teacher_id:        user.id,
      date:              today,
      status:            'present',
    }))

    await supabase.from('attendance').upsert(rows, {
      onConflict: 'timetable_slot_id,student_id,date',
    })

    setClassData(prev =>
      prev ? {
        ...prev,
        attendanceMarked: true,
        presentCount:     studentList.length,
        absentCount:      0,
        markedAt:         'just now',
      } : prev
    )
    // TODO: also write to IndexedDB for offline sync
  }

  function handleViewTimetable() {
    setActiveTab('attendance')
    // TODO: navigate to timetable view
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading || !teacher || !classData) {
    return (
      <div className={`${styles.root} ${isDark ? styles.rootDark : ''}`}>
        <div className={styles.loadingState}>Loading…</div>
      </div>
    )
  }

  return (
    <div className={`${styles.root} ${isDark ? styles.rootDark : ''}`}>
      <OfflineBar />

      <Header
        isOnline={true}
        teacherInitials={teacher.initials}
        darkMode={darkMode}
        onDarkModeChange={setDarkMode}
      />

      <main className={styles.scroll}>

        {/* Zone 1 — Intelligence Strip */}
        <IntelligenceStrip
          teacherName={teacher.name}
          studentCount={classData.students}
          classesTotal={classesTotal}
          sessions={sessions as any}
        />

        {/* Zone 2 — Pulse Card + Twin Shortcut */}
        <PulseCard
          currentClass={classData}
          onMarkAttendance={handleMarkAttendance}
          onViewTimetable={handleViewTimetable}
        />
        <TwinShortcut onOpen={handleTwinOpen} />

        {/* Zone 3 — Your Tools */}
        <ToolsGrid onOpen={handleToolOpen} />

        {/* Zone 4 — Intelligence */}
        <IntelligenceCard insights={insights} />

        {/* Zone 5 — Recent Activity */}
        <RecentActivity items={activity} />

      </main>

      <BottomNav active={activeTab} onChange={setActiveTab} />
    </div>
  )
}