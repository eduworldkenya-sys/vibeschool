'use client'

import styles from './VibeTutor.module.css'
import { DAYPARTS, DAYS, summarizeDays, summarizeParts, type DayPart } from './data'

type Props = {
  days: string[]
  onDays: (v: string[]) => void
  parts: DayPart[]
  onParts: (v: DayPart[]) => void
}

const toggle = <T extends string>(list: T[], v: T): T[] => (list.includes(v) ? list.filter(x => x !== v) : [...list, v])

export default function SchedulePicker({ days, onDays, parts, onParts }: Props) {
  return (
    <div className={styles.schedule}>
      <div>
        <p className={styles.subLabel}>Days</p>
        <div className={styles.dayRow} role="group" aria-label="Days">
          {DAYS.map(d => (
            <button
              key={d}
              type="button"
              className={`${styles.dayBtn} ${days.includes(d) ? styles.dayOn : ''}`}
              aria-pressed={days.includes(d)}
              onClick={() => onDays(toggle(days, d))}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className={styles.subLabel}>Time of day</p>
        <div className={styles.partGrid} role="group" aria-label="Time of day">
          {DAYPARTS.map(p => {
            const on = parts.includes(p.id)
            return (
              <button
                key={p.id}
                type="button"
                className={`${styles.partTile} ${on ? styles.partOn : ''}`}
                aria-pressed={on}
                onClick={() => onParts(toggle(parts, p.id))}
              >
                <span className={styles.partCopy}>
                  <span className={styles.partLabel}>{p.label}</span>
                  <span className={styles.partHours}>{p.hours}</span>
                </span>
                <span className={styles.partState} aria-hidden="true">{on ? "Selected" : "Select"}</span>
              </button>
            )
          })}
        </div>
      </div>

      <p className={styles.summaryLine}>
        <strong>{summarizeDays(days)}</strong> · {summarizeParts(parts)}
      </p>
    </div>
  )
}
