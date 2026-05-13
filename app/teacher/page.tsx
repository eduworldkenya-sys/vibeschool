'use client'

import { useState } from 'react'
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

// ── Mock data (replace with Supabase queries) ─────────────────────────────────
const MOCK_TEACHER = {
  name:     'Ms. Wanjiku Njoroge',
  initials: 'WN',
}

const MOCK_CLASS = {
  id:               'cls_4a',
  name:             'Grade 4A',
  subject:          'Mathematics',
  time:             '8:00 – 9:00 AM',
  room:             'Room 12',
  students:         38,
  attendanceMarked: false,
  presentCount:     35,
  absentCount:      3,
  markedAt:         'just now',
}

const MOCK_SESSIONS = [
  { task_type: 'lesson_plan'    as const, minutes: 45 },
  { task_type: 'parent_message' as const, minutes: 10 },
  { task_type: 'attendance'     as const, minutes: 5  },
]

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TeacherHomePage() {
  const [darkMode,  setDarkMode]  = useState<DarkMode>('sun')
  const [activeTab, setActiveTab] = useState<TabKey>('home')
  const [classData, setClassData] = useState(MOCK_CLASS)

  const isDark =
    darkMode === 'dark' ||
    (darkMode === 'sun' && new Date().getHours() >= 18)

  // ── Handlers ────────────────────────────────────────────────────────────────
  function handleMarkAttendance() {
    setClassData(prev => ({ ...prev, attendanceMarked: true }))
    // TODO: write to Supabase + IndexedDB
  }

  function handleViewTimetable() {
    setActiveTab('attendance')
    // TODO: navigate to timetable view
  }

  function handleTwinOpen(mode: ModeKey) {
    setActiveTab('twin')
    // TODO: open Twin with mode pre-loaded
  }

  function handleToolOpen(tool: ToolKey) {
    // TODO: navigate to tool page
    console.log('Tool opened:', tool)
  }

  // ── Intelligence insights (mock — replace with Supabase query) ──────────────
  const MOCK_INSIGHTS: Insight[] = [
    {
      id:        'ins_1',
      type:      'lesson_plan',
      message:   "Friday's lesson plan is empty. 2 days away.",
      ctaLabel:  'Generate with Twin',
      ctaAction: () => handleTwinOpen('lesson_plan'),
      updatedAt: 'Tue, 4:30 PM',
    },
    {
      id:        'ins_2',
      type:      'attendance',
      message:   'Brian Otieno has been absent 3 days in a row.',
      ctaLabel:  'Message Parent',
      ctaAction: () => handleTwinOpen('parent_message'),
      updatedAt: 'Today, 8:05 AM',
    },
  ]

  // ── Recent activity (mock — replace with Supabase query) ────────────────────
  const MOCK_ACTIVITY: ActivityItem[] = [
    {
      id:        'act_1',
      type:      'attendance',
      title:     'Marked attendance — Grade 4A',
      subtitle:  '35 present · 3 absent',
      timestamp: 'Today, 7:42 AM',
    },
    {
      id:        'act_2',
      type:      'lesson_plan',
      title:     'Lesson plan generated — Grade 4A',
      subtitle:  'Fractions · Week 3',
      timestamp: 'Yesterday',
    },
    {
      id:        'act_3',
      type:      'parent_message',
      title:     'Parent message sent',
      subtitle:  'Re: Aisha Kamau absence',
      timestamp: 'Mon',
    },
  ]

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className={`${styles.root} ${isDark ? styles.rootDark : ''}`}>
      <OfflineBar />

      <Header
        isOnline={true}
        teacherInitials={MOCK_TEACHER.initials}
        darkMode={darkMode}
        onDarkModeChange={setDarkMode}
      />

      <main className={styles.scroll}>

        {/* Zone 1 — Intelligence Strip */}
        <IntelligenceStrip
          teacherName={MOCK_TEACHER.name}
          studentCount={classData.students}
          classesTotal={3}
          sessions={MOCK_SESSIONS}
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
        <IntelligenceCard insights={MOCK_INSIGHTS} />

        {/* Zone 5 — Recent Activity */}
        <RecentActivity items={MOCK_ACTIVITY} />

      </main>

      <BottomNav active={activeTab} onChange={setActiveTab} />
    </div>
  )
}