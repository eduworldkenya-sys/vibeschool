'use client'

import styles from './ClassCard.module.css'
import type { ClassItem } from '@/app/teacher/classhub/page'

interface Props {
  data:    ClassItem
  isDark:  boolean
  onTap:   () => void
}

export default function ClassCard({ data, isDark, onTap }: Props) {
  const cardClass = [styles.card, isDark ? styles.cardDark : ''].filter(Boolean).join(' ')

  return (
    <button className={cardClass} onClick={onTap}>

      {/* Top row — class name + alerts badge */}
      <div className={styles.topRow}>
        <div className={styles.nameBlock}>
          <span className={styles.className}>{data.name}</span>
          {data.stream && (
            <span className={styles.streamPill}>{data.stream}</span>
          )}
        </div>
        {data.unreadAlerts > 0 && (
          <span className={styles.alertBadge}>{data.unreadAlerts}</span>
        )}
      </div>

      {/* Subject + time */}
      <div className={styles.metaRow}>
        <span className={styles.subject}>{data.subject}</span>
        <span className={styles.dot}>·</span>
        <span className={styles.time}>{data.lessonTime}</span>
      </div>

      {/* Stats row */}
      <div className={styles.statsRow}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{data.studentCount}</span>
          <span className={styles.statLabel}>Students</span>
        </div>

        <div className={styles.stat}>
          <span className={[
            styles.statValue,
            data.attendancePct >= 90 ? styles.green :
            data.attendancePct >= 75 ? styles.amber : styles.red
          ].join(' ')}>
            {data.attendancePct}%
          </span>
          <span className={styles.statLabel}>Attendance</span>
        </div>

        <div className={styles.stat}>
          <span className={[
            styles.statValue,
            data.attendanceMarked ? styles.green : styles.amber
          ].join(' ')}>
            {data.attendanceMarked ? '✓ Marked' : '— Pending'}
          </span>
          <span className={styles.statLabel}>Today</span>
        </div>
      </div>

      {/* Next assessment strip — only if present */}
      {data.nextAssessment && (
        <div className={styles.assessmentStrip}>
          <span className={styles.assessmentIcon}>📋</span>
          <span className={styles.assessmentText}>{data.nextAssessment}</span>
        </div>
      )}

      {/* Tap indicator */}
      <div className={styles.tapHint}>Open class →</div>

    </button>
  )
}