'use client'

import { useRouter } from 'next/navigation'
import styles from './BottomNav.module.css'

type TabKey = 'home' | 'lessonplan' | 'vibelearn' | 'more' | 'profile'

interface Props {
  active:        TabKey
  onChange?:     (tab: TabKey) => void
  unreadLearn?:  number
}

const TABS = [
  { id: 'home',       icon: '🏠', label: 'Home',      href: '/teacher'            },
  { id: 'lessonplan', icon: '📖', label: 'Plans',      href: '/teacher/lessonplan' },
  { id: 'vibelearn',  icon: '🎓', label: 'VibeLearn',  href: '/teacher/vibelearn'  },
  { id: 'more',       icon: '⋯',  label: 'More',       href: '/teacher/more'       },
  { id: 'profile',    icon: '👤', label: 'Profile',    href: '/teacher/profile'    },
] as const

export default function BottomNav({ active, unreadLearn = 0 }: Props) {
  const router = useRouter()

  return (
    <div className={styles.nav}>
      {TABS.map(t => (
        <button
          key={t.id}
          onClick={() => router.push(t.href)}
          className={`${styles.tab}${active === t.id ? ` ${styles.active}` : ''}`}
        >
          {t.id === 'vibelearn' && unreadLearn > 0 && (
            <span className={styles.badge}>{unreadLearn}</span>
          )}
          <span className={styles.tabIcon}>{t.icon}</span>
          <span className={styles.tabLabel}>{t.label}</span>
          {active === t.id && <div className={styles.activeLine} />}
        </button>
      ))}
    </div>
  )
}