"use client";
'use client'

import { useState } from 'react'
import styles from './PulseCard.module.css'

interface ClassInfo {
  id:               string
  name:             string
  subject:          string
  time:             string
  room:             string
  students:         number
  attendanceMarked: boolean
  presentCount?:    number
  absentCount?:     number
  lateCount?:       number
  markedAt?:        string
}

interface NextClass {
  subject:         string
  room:            string
  startsInMinutes: number
}

interface Props {
  currentClass:     ClassInfo
  nextClass?:       NextClass | null
  onMarkAttendance: () => void
  onOpenGradebook:  () => void
  onMessageParents: () => void
}

export default function PulseCard({
  currentClass,
  nextClass,
  onMarkAttendance,
  onOpenGradebook,
  onMessageParents,
}: Props) {
  const [tab, setTab] = useState<'now' | 'next'>('now')

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

      {/* Body */}
      <div className={styles.body}>

        {/* ── NOW TAB ── */}
        {tab === 'now' && (
          <>
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

            {/* Attendance counts */}
            {currentClass.attendanceMarked && (
              <div className={styles.countRow}>
                <div className={styles.countItem}>
                  <span className={styles.countValue} style={{ color: '#10B981' }}>
                    {currentClass.presentCount ?? 0}
                  </span>
                  <span className={styles.countLabel}>PRESENT</span>
                </div>
                <div className={styles.countItem}>
                  <span className={styles.countValue} style={{ color: '#EF4444' }}>
                    {currentClass.absentCount ?? 0}
                  </span>
                  <span className={styles.countLabel}>ABSENT</span>
                </div>
                <div className={styles.countItem}>
                  <span className={styles.countValue} style={{ color: '#F59E0B' }}>
                    {currentClass.lateCount ?? 0}
                  </span>
                  <span className={styles.countLabel}>LATE</span>
                </div>
              </div>
            )}

            {/* Next class preview */}
            {nextClass && (
              <div className={styles.nextPreview}>
                <span className={styles.nextLabel}>Next:</span>
                <span className={styles.nextSubject}>{nextClass.subject}</span>
                <span className={styles.nextDot}>·</span>
                <span className={styles.nextRoom}>{nextClass.room}</span>
                <span className={styles.nextDot}>·</span>
                <span className={styles.nextTime}>in {nextClass.startsInMinutes} mins</span>
              </div>
            )}

            {/* State A — not marked */}
            {!currentClass.attendanceMarked && (
              <div className={styles.stateA}>
                <button className={styles.btnMark} onClick={onMarkAttendance}>
                  + Mark Attendance
                </button>
              </div>
            )}

            {/* State B — marked, show action buttons */}
            {currentClass.attendanceMarked && (
              <div className={styles.stateB}>
                <button className={styles.btnGradebook} onClick={onOpenGradebook}>
                  Open Gradebook
                </button>
                <button className={styles.btnParents} onClick={onMessageParents}>
                  Message Parents
                </button>
              </div>
            )}
          </>
        )}

        {/* ── NEXT TAB ── */}
        {tab === 'next' && (
          <>
            {nextClass ? (
              <div className={styles.nextFull}>
                <div className={styles.nextFullSubject}>{nextClass.subject}</div>
                <div className={styles.nextFullMeta}>{nextClass.room}</div>
                <div className={styles.nextFullCountdown}>
                  in {nextClass.startsInMinutes} mins
                </div>
              </div>
            ) : (
              <div className={styles.noNext}>
                No more classes today
              </div>
            )}
          </>
        )}

      </div>
    </div>
  )
}