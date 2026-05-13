import styles from './RecentActivity.module.css'

export interface ActivityItem {
  id: string
  type: 'attendance' | 'lesson_plan' | 'parent_message' | 'gradebook' | 'twin'
  title: string
  subtitle: string
  timestamp: string
}

interface Props {
  items: ActivityItem[]
}

const TYPE_ICON: Record<ActivityItem['type'], string> = {
  attendance:     '✓',
  lesson_plan:    '✎',
  parent_message: '✉',
  gradebook:      '▐',
  twin:           '◎',
}

const TYPE_COLOR: Record<ActivityItem['type'], string> = {
  attendance:     '#10B981',
  lesson_plan:    '#F59E0B',
  parent_message: '#8B5CF6',
  gradebook:      '#3B82F6',
  twin:           '#10B981',
}

export default function RecentActivity({ items }: Props) {
  if (!items.length) return null

  return (
    <div className={styles.wrapper}>
      <div className={styles.sectionLabel}>RECENT ACTIVITY</div>
      <div className={styles.card}>
        {items.map((item, index) => (
          <div key={item.id}>
            <div className={styles.row}>
              <div
                className={styles.iconWrap}
                style={{ background: `${TYPE_COLOR[item.type]}18`, color: TYPE_COLOR[item.type] }}
              >
                {TYPE_ICON[item.type]}
              </div>
              <div className={styles.content}>
                <div className={styles.title}>{item.title}</div>
                <div className={styles.sub}>{item.subtitle}</div>
              </div>
              <div className={styles.time}>{item.timestamp}</div>
            </div>
            {index < items.length - 1 && <div className={styles.divider} />}
          </div>
        ))}
      </div>
    </div>
  )
}