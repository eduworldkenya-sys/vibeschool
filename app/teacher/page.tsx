'use client'

import { useState } from 'react'
import styles from './teacher-home.module.css'

import OfflineBar         from '@/components/teacher/OfflineBar'
import Header             from '@/components/teacher/Header'
import IntelligenceStrip  from '@/components/teacher/IntelligenceStrip'
import PulseCard          from '@/components/teacher/PulseCard'
import TwinShortcut       from '@/components/teacher/TwinShortcut'
import ZonePlaceholder    from '@/components/teacher/ZonePlaceholder'
import BottomNav          from '@/components/teacher/BottomNav'

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

type DarkMode = 'sun' | 'light' | 'dark'
type TabKey   = 'home' | 'attendance' | 'twin' | 'classes' | 'profile'
type ModeKey  = 'lesson_plan' | 'parent_message' | 'attendance' | 'advisory'

export default function TeacherHomePage() {
  const [darkMode,  setDarkMode]  = useState<DarkMode>('sun')
  const [activeTab, setActiveTab] = useState<TabKey>('home')
  const [classData, setClassData] = useState(MOCK_CLASS)

  const isDark = darkMode === 'dark' ||
    (darkMode === 'sun' && new Date().getHours() >= 18)

  function handleMarkAttendance() {
    setClassData(prev => ({ ...prev, attendanceMarked: true }))
    // TODO: write to Supabase + IndexedDB
  }

  function handleViewTimetable() {
    setActiveTab('attendance')
    // TODO: navigate to timetable
  }

  function handleTwinOpen(mode: ModeKey) {
    setActiveTab('twin')
    // TODO: open Twin with mode pre-loaded
    console.log('Twin opened in mode:', mode)
  }

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
        <IntelligenceStrip
          teacherName={MOCK_TEACHER.name}
          studentCount={classData.students}
          classesTotal={3}
          sessions={MOCK_SESSIONS}
        />

        <PulseCard
          currentClass={classData}
          onMarkAttendance={handleMarkAttendance}
          onViewTimetable={handleViewTimetable}
        />

        <TwinShortcut onOpen={handleTwinOpen} />

        <ZonePlaceholder
          zoneNumber={3}
          note="Spec in V1 doc — not yet provided"
        />
        <ZonePlaceholder
          zoneNumber={4}
          note="Spec in V1 doc — not yet provided"
        />
        <ZonePlaceholder
          zoneNumber={5}
          note="Spec in V1 doc — not yet provided"
        />
      </main>

      <BottomNav active={activeTab} onChange={setActiveTab} />
    </div>
  )
}