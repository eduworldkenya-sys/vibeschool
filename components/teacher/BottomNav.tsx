'use client'

import styles from './BottomNav.module.css'

const TABS = [
  { key: 'home',       icon: '⌂',  label: 'Home'       },
  { key: 'attendance', icon: '✓',  label: 'Attendance' },
  { key: 'twin',       icon: '✦',  label: 'Twin'       },
  { key: 'classes',    icon: '◫',  label: 'Classes'    },
  { key: 'profile',    icon: '◉',  label: 'Profile'    },
] as const

type TabKey = typeof TABS[number]['key']

interface Props {
  active: TabKey
  onChange: (key: TabKey) => void
}

export default function BottomNav({ active, onChange }: Props) {
  return (
    <nav className={styles.nav}>
      {TABS.map(tab => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`${styles.tab} ${active === tab.key ? styles.tabActive : ''}`}
        >
          <span className={`${styles.icon} ${tab.key === 'twin' ? styles.twinIcon : ''}`}>
            {tab.icon}
          </span>
          <span className={styles.tabLabel}>{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}