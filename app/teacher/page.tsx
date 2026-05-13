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
type DarkMode   = 'sun' | 'light' | 'dark'
type SyncStatus = 'synced' | 'offline' | 'failed'
type TabKey     = 'home' | 'classhub' | 'twin' | 'connecthub' | 'profile'
type ModeKey    = 'lesson_plan' | 'parent_message' | 'attendance' | 'advisory'
type ToolKey    = 'attendance' | 'timetable' | 'lessonplan' | 'gradebook' | 'connecthub' | 'twin'

interface ClassData {
  id:               string
  classId:          string
  name:             string
  subject:          string
  time:             string
  room:             string
  students:         number
  attendanceMarked: boolean
  presentCount:     number
  absentCount:      number
  lateCount:        number
  markedAt:         string
}

interface NextClass {
  subject:         string
  room:            string
  startsInMinutes: number
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
  const d   = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm   = h >= 12 ? 'PM' : 'AM'
  const hour   = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

function formatActivityTime(isoString: string): string {
  const date      = new Date(isoString)
  const now       = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)

  if (date.toDateString() === now.toDateString()) {
    return 'Today, ' + date.toLocaleTimeString('en-KE', { hour: 'numeric', minute: '2-digit' })
  }
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString('en-KE', { weekday: 'short' })
}

function minutesUntil(timeStr: string): number {
  const now       = new Date()
  const [h, m]    = timeStr.split(':').map(Number)
  const target    = new Date(now)
  target.setHours(h, m, 0, 0)
  return Math.max(0, Math.round((target.getTime() - now.getTime()) / 60000))
}

const VALID_TASK_TYPES = ['lesson_plan', 'parent_message', 'attendance', 'advisory'] as const
type ValidTaskType = typeof VALID_TASK_TYPES[number]

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TeacherHomePage() {
  const supabase = createClientComponentClient()

  const [darkMode,        setDarkMode]        = useState<DarkMode>('sun')
  const [syncStatus,      setSyncStatus]      = useState<SyncStatus>('synced')
  const [activeTab,       setActiveTab]       = useState<TabKey>('home')
  const [teacher,         setTeacher]         = useState<TeacherProfile | null>(null)
  const [classData,       setClassData]       = useState<ClassData | null>(null)
  const [nextClass,       setNextClass]       = useState<NextClass | null>(null)
  const [sessions,        setSessions]        = useState<{ task_type: ValidTaskType; minutes: number }[]>([])
  const [insights,        setInsights]        = useState<Insight[]>([])
  const [activity,        setActivity]        = useState<ActivityItem[]>([])
  const [classesTotal,    setClassesTotal]    = useState(0)
  const [notifCount,      setNotifCount]      = useState(0)
  const [connecthubBadge, setConnecthubBadge] = useState(0)
  const [loading,         setLoading]         = useState(true)

  const isDark =
    darkMode === 'dark' ||
    (darkMode === 'sun' && new Date().getHours() >= 18)

  // ── Handlers (defined before useEffect) ───────────────────────────────────
  function handleTwinOpen(mode: ModeKey) {
    setActiveTab('twin')
    // TODO: open Twin with mode pre-loaded
  }

  function handleToolOpen(tool: ToolKey) {
    // TODO: navigate to tool page
    console.log('Tool opened:', tool)
  }

  function handleNotifPress() {
    // TODO: open notifications panel
  }

  function handleOpenGradebook() {
    setActiveTab('classhub')
    // TODO: navigate to gradebook
  }

  function handleMessageParents() {
    handleTwinOpen('parent_message')
  }

  async function handleMarkAttendance() {
    if (!classData) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const today = new Date().toISOString().split('T')[0]

    const { data: studentList } = await supabase
      .from('students')
      .select('id')
      .eq('class_id', classData.classId)

    if (!studentList) return

    const rows = studentList.map(s => ({
      timetable_slot_id: classData.id,
      class_id:          classData.classId,
      student_id:        s.id,
      teacher_id:        user.id,
      date:              today,
      status:            'present',
    }))

    const { error } = await supabase.from('attendance').upsert(rows, {
      onConflict: 'timetable_slot_id,student_id,date',
    })

    if (error) {
      setSyncStatus('failed')
      return
    }

    setClassData(prev =>
      prev ? {
        ...prev,
        attendanceMarked: true,
        presentCount:     studentList.length,
        absentCount:      0,
        lateCount:        0,
        markedAt:         'just now',
      } : prev
    )
    setSyncStatus('synced')
    // TODO: write to IndexedDB for offline sync
  }

  // ── Load all data ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const uid      = user.id
      const now      = new Date()
      const todayDow = now.getDay()
      const today    = now.toISOString().split('T')[0]
      const nowTime  = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:00`

      // Sunday — no classes
      if (todayDow === 0) {
        setLoading(false)
        return
      }

      // 1. Teacher profile
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

      // 2. Current timetable slot
      const { data: slots } = await supabase
        .from('timetable_slots')
        .select(`
          id, subject, start_time, end_time, room, day_of_week, class_id,
          classes ( grade_name, stream )
        `)
        .eq('teacher_id', uid)
        .eq('day_of_week', todayDow)
        .lte('start_time', nowTime)
        .order('start_time', { ascending: false })
        .limit(1)

      if (slots && slots.length > 0) {
        const slot = slots[0]
        const cls  = slot.classes as { grade_name: string; stream: string | null }

        const { count: studentCount } = await supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('class_id', slot.class_id)

        const { data: marked } = await supabase
          .from('attendance')
          .select('status')
          .eq('timetable_slot_id', slot.id)
          .eq('date', today)

        const presentCount = marked?.filter(r => r.status === 'present').length ?? 0
        const absentCount  = marked?.filter(r => r.status === 'absent').length  ?? 0
        const lateCount    = marked?.filter(r => r.status === 'late').length    ?? 0
        const wasMarked    = (marked?.length ?? 0) > 0

        setClassData({
          id:               slot.id,
          classId:          slot.class_id,
          name:             cls.grade_name + (cls.stream ? ` ${cls.stream}` : ''),
          subject:          slot.subject,
          time:             `${formatTime(slot.start_time)} – ${formatTime(slot.end_time)}`,
          room:             slot.room ?? 'TBA',
          students:         studentCount ?? 0,
          attendanceMarked: wasMarked,
          presentCount,
          absentCount,
          lateCount,
          markedAt:         wasMarked ? 'earlier today' : '',
        })
      }

      // 3. Next timetable slot
      const { data: nextSlots } = await supabase
        .from('timetable_slots')
        .select('subject, start_time, room')
        .eq('teacher_id', uid)
        .eq('day_of_week', todayDow)
        .gt('start_time', nowTime)
        .order('start_time', { ascending: true })
        .limit(1)

      if (nextSlots && nextSlots.length > 0) {
        const ns = nextSlots[0]
        setNextClass({
          subject:         ns.subject,
          room:            ns.room ?? 'TBA',
          startsInMinutes: minutesUntil(ns.start_time),
        })
      }

      // 4. Total classes today
      const { count: totalToday } = await supabase
        .from('timetable_slots')
        .select('id', { count: 'exact', head: true })
        .eq('teacher_id', uid)
        .eq('day_of_week', todayDow)

      setClassesTotal(totalToday ?? 0)

      // 5. Twin sessions this week
      const weekStart = startOfCurrentWeek()
      const { data: sessionData } = await supabase
        .from('twin_sessions')
        .select('task_type, minutes')
        .eq('teacher_id', uid)
        .gte('created_at', weekStart)

      setSessions(
        (sessionData ?? []).filter(s =>
          VALID_TASK_TYPES.includes(s.task_type as ValidTaskType)
        ) as { task_type: ValidTaskType; minutes: number }[]
      )

      // 6. Insights
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
              if (row.type === 'lesson_plan') handleTwinOpen('lesson_plan')
              if (row.type === 'attendance')  handleTwinOpen('parent_message')
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

      // 8. Notification count
      const { count: notifs } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', uid)
        .eq('read', false)

      setNotifCount(notifs ?? 0)

      // 9. ConnectHub unread count
      const { count: chUnread } = await supabase
        .from('connecthub_messages')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', uid)
        .eq('read', false)

      setConnecthubBadge(chUnread ?? 0)

      setLoading(false)
    }

    load()
  }, [])

  // ── Offline detection ──────────────────────────────────────────────────────
  useEffect(() => {
    function goOnline()  { setSyncStatus('synced')  }
    function goOffline() { setSyncStatus('offline') }
    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEven