import styles from './IntelligenceStrip.module.css'

interface Session {
  task_type: 'lesson_plan' | 'parent_message' | 'attendance' | 'advisory'
  minutes: number
}

interface Props {
  teacherName: string
  studentCount: number
  classesTotal: number
  sessions: Session[]
}

const MULTIPLIERS: Record<string, number> = {
  lesson_plan:    45,
  parent_message: 10,
  attendance:      5,
  advisory:        5,
}

function calcTimeSaved(sessions: Session[]): string | null {
  let total = sessions.reduce((acc, s) => acc + MULTIPLIERS[s.task_type], 0)
  total = Math.min(total, 180) // 3hr daily cap
  if (total === 0) return null
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

export default function IntelligenceStrip({ teacherName, studentCount, classesTotal, sessions }: Props) {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const timeSaved = calcTimeSaved(sessions)
  const shortName = teacherName.replace(/^(Ms\.|Mr\.|Mrs\.|Dr\.)\s/, '')

  return (
    <div className={styles.strip}>
      <div className={styles.greeting}>{greeting}</div>
      <div className={styles.name}>{shortName}</div>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{studentCount}</span>
          <span className={styles.statLabel}>Students today</span>
        </div>
        {timeSaved && (
          <div className={`${styles.stat} ${styles.statAmber}`}>
            <span className={`${styles.statValue} ${styles.amberValue}`}>{timeSaved}</span>
            <span className={styles.statLabel}>Saved this week</span>
          </div>
        )}
        <div className={styles.stat}>
          <span className={styles.statValue}>{classesTotal}</span>
          <span className={styles.statLabel}>Classes today</span>
        </div>
      </div>
    </div>
  )
}