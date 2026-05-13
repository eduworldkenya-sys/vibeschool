import styles from './TwinShortcut.module.css'

const MODES = [
  { key: 'lesson_plan',    label: 'Lesson Plan',    icon: '📋' },
  { key: 'parent_message', label: 'Parent Message', icon: '✉️' },
  { key: 'attendance',     label: 'Attendance',     icon: '📊' },
  { key: 'advisory',       label: 'Ask Twin',       icon: '✦'  },
] as const

type ModeKey = typeof MODES[number]['key']

interface Props {
  onOpen: (mode: ModeKey) => void
}

export default function TwinShortcut({ onOpen }: Props) {
  return (
    <div className={styles.card}>
      <div className={styles.label}>Twin AI</div>
      <div className={styles.grid}>
        {MODES.map(m => (
          <button key={m.key} className={styles.modeBtn} onClick={() => onOpen(m.key)}>
            <span className={styles.icon}>{m.icon}</span>
            <span className={styles.modeLabel}>{m.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}