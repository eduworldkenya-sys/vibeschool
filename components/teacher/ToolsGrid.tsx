import styles from './ToolsGrid.module.css'

const TOOLS = [
  { key: 'attendance',  label: 'Attendance',  icon: '✓' },
  { key: 'timetable',   label: 'Timetable',   icon: '▦' },
  { key: 'lessonplan',  label: 'Lesson Plan', icon: '✎' },
  { key: 'gradebook',   label: 'Gradebook',   icon: '▐' },
  { key: 'connecthub',  label: 'ConnectHub',  icon: '⬡' },
  { key: 'twin',        label: 'Twin',        icon: '◎' },
] as const

type ToolKey = typeof TOOLS[number]['key']

interface Props {
  onOpen: (tool: ToolKey) => void
}

export default function ToolsGrid({ onOpen }: Props) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.label}>YOUR TOOLS</span>
        <button className={styles.allFeatures}>All Features →</button>
      </div>
      <div className={styles.grid}>
        {TOOLS.map(tool => (
          <button
            key={tool.key}
            className={styles.tool}
            onClick={() => onOpen(tool.key)}
          >
            <span className={styles.icon}>{tool.icon}</span>
            <span className={styles.toolLabel}>{tool.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}