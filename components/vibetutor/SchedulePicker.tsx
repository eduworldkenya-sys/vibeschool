'use client'

import styles from './VibeTutor.module.css'
import { DAYS, summarizeDays } from './data'

type Props = { days: string[]; onDays: (v: string[]) => void }
const toggle = (list: string[], value: string) => list.includes(value) ? list.filter(x => x !== value) : [...list, value]

export default function SchedulePicker({ days, onDays }: Props) {
  return (
    <div className={styles.schedule}>
      <div>
        <p className={styles.subLabel}>Holiday availability</p>
        <div className={styles.dayRow} role="group" aria-label="Holiday availability">
          {DAYS.map(day => (
            <button key={day} type="button" className={`${styles.dayBtn} ${days.includes(day) ? styles.dayOn : ''}`} aria-pressed={days.includes(day)} onClick={() => onDays(toggle(days, day))}>
              {day}
            </button>
          ))}
        </div>
      </div>
      <p className={styles.summaryLine}><strong>{summarizeDays(days)}</strong></p>
    </div>
  )
}
