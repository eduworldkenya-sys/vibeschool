'use client'

import styles from './BottomNav.module.css'

const TABS = [
  { key: 'home',        icon: '⌂',  label: 'Home'       },
  { key: 'classhub',   icon: '▦',  label: 'ClassHub'   },
  { key: 'twin',        icon: '◎',  label: 'Twin'       },
  { key: 'connecthub', icon: '⬡',  label: 'ConnectHub' },
  { key: 'profile',    icon: null,  label: 'Profile'    },
] as const

type TabKey = typeof TABS[number]['key']

interface Props {
  active:          TabKey
  onChange:        (key: TabKey) => void
  connecthubBadge?: number
  profileInitials?: string
  profileColor?:   string
}

export default function BottomNav({
  active,
  onChange,
  connecthubBadge = 0,
  profileInitials = '??',
  profileColor    = '#10B981',
}: Props) {
  return (
    <nav className={styles.nav}>
      {TABS.map(tab => {
        const isActive = active === tab.key

        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
          >
            {/* Twin — oversized centered button */}
            {tab.key === 'twin' && (
              <span className={`${styles.twinWrap} ${isActive ? styles.twinWrapActive : ''}`}>
                <span className={styles.twinIcon}>{tab.icon}</span>
              </span>
            )}

            {/* Profile — avatar initials */}
            {tab.key === 'profile' && (
              <span
                className={styles.avatar}
                style={{ background: profileColor }}
              >
                {profileInitials}
              </span>
            )}

            {/* ConnectHub — icon with optional badge */}
            {tab.key === 'connecthub' && (
              <span className={styles.badgeWrap}>
                <span className={`${styles.icon} ${isActive ? styles.iconActive : ''}`}>
                  {tab.icon}
                </span>
                {connecthubBadge > 0 && (
                  <span className={styles.badge}>
                    {connecthubBadge > 9 ? '9+' : connecthubBadge}
                  </span>
                )}
              </span>
            )}

            {/* All other tabs */}
            {tab.key !== 'twin' && tab.key !== 'profile' && tab.key !== 'connecthub' && (
              <span className={`${styles.icon} ${isActive ? styles.iconActive : ''}`}>
                {tab.icon}
              </span>
            )}

            <span className={`${styles.tabLabel} ${isActive ? styles.tabLabelActive : ''}`}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}