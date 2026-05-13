'use client'

import { useState } from 'react'
import styles from './PulseCard.module.css'

interface ClassInfo {
  id: string
  name: string
  subject: string
  time: string
  room: string
  students: number
  attendanceMarked: boolean
  presentCount?: number
  absentCount?: number
  markedAt?: string
}

interface Props {
  currentClass: ClassInfo
  onMarkAttendance: () => void
  onViewTimetable: () => void
}

export default function PulseCard({ currentClass, onMarkAttendance, onViewTimetable }: Props) {
  const [tab, setTab] = useState<'now' | 'next'>('now')

  // Name font size rule: exactly 24 chars = 18px, 25+ = 15px
  const nameSize = currentClass.name.length > 24 ? 15 : 18

  return (
    <div className={styles.card}>
      {/* Tab bar */}
      <div className={styles.tabBar}>
        <div className={styles.tabs}>
          {(['now', 'next'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
            >
              {t === 'now' ? 'Now' : 'Next'}
            </button>
          ))}
        </div>
        <div className={styles.livePill}>
          <span className={styles.liveDot} />
          <span>LIVE</span>
        </div>
      </div>

      {/* Class info */}
      <div className={styles.body}>
        <div className={styles.classRow}>
          <div>
            <div className={styles.className} style={{ fontSize: nameSize }}>
              {currentClass.name}
            </div>
            <div className={styles.classSubject}>{currentClass.subject}</div>
          </div>
          <div className={styles.classMeta}>
            <div className={styles.classTime}>{currentClass.time}</div>
            <div className={styles.classDetail}>
              {currentClass.room} · {currentClass.students} students
            </div>
          </div>
        </div>

        {/* State A / State B */}
        {currentClass.attendanceMarked ? (
          <div className={styles.stateB}>
            <div className={styles.stateBCheck}>✓</div>
            <div>
              <div className={styles.stateBTitle}>Attendance marked</div>
              <div className={styles.stateBSub}>
                {currentClass.presentCount} present · {currentClass.absentCount} absent · {currentClass.markedAt}
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.stateA}>
            <button className={styles.btnMark} onClick={onMarkAttendance}>
              + Mark Attendance
            </button>
            <button className={styles.btnTimetable} onClick={onViewTimetable}>
              View Timetable
            </button>
          </div>
        )}
      </div>
    </div>
  )
}