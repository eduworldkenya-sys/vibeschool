import styles from './TwinShortcut.module.css'

const iconProps = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
function PlanIcon() { return <svg {...iconProps}><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 2h6v4H9zM9 10h6M9 14h6"/></svg> }
function MessageIcon() { return <svg {...iconProps}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> }
function AttendanceIcon() { return <svg {...iconProps}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m17 11 2 2 4-4"/></svg> }
function TwinIcon() { return <svg {...iconProps}><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z"/></svg> }

const MODES = [
  { key: 'lesson_plan', label: 'Lesson Plan', icon: <PlanIcon /> },
  { key: 'parent_message', label: 'Parent Message', icon: <MessageIcon /> },
  { key: 'attendance', label: 'Attendance', icon: <AttendanceIcon /> },
  { key: 'advisory', label: 'Ask Twin', icon: <TwinIcon /> },
] as const

type ModeKey = typeof MODES[number]['key']
interface Props { onOpen: (mode: ModeKey) => void }

export default function TwinShortcut({ onOpen }: Props) {
  return (
    <div className={styles.card}>
      <div className={styles.label}>Twin AI</div>
      <div className={styles.grid}>
        {MODES.map(m => (
          <button key={m.key} className={styles.modeBtn} onClick={() => onOpen(m.key)}>
            <span className={styles.icon} aria-hidden="true">{m.icon}</span>
            <span className={styles.modeLabel}>{m.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
