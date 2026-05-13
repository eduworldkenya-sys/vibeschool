'use client'

import { useState } from 'react'
import styles from './Header.module.css'

type DarkMode    = 'sun' | 'light' | 'dark'
type SyncStatus  = 'synced' | 'offline' | 'failed'

interface Props {
  syncStatus:       SyncStatus
  notifCount:       number
  darkMode:         DarkMode
  onDarkModeChange: (mode: DarkMode) => void
  onNotifPress:     () => void
}

const SYNC_CONFIG: Record<SyncStatus, { label: string; dotClass: string; pillClass: string }> = {
  synced:  { label: 'Synced',      dotClass: 'dotOnline',  pillClass: 'pillSynced'  },
  offline: { label: 'Offline',     dotClass: 'dotOffline', pillClass: 'pillOffline' },
  failed:  { label: 'Sync failed', dotClass: 'dotFailed',  pillClass: 'pillFailed'  },
}

export default function Header({
  syncStatus,
  notifCount,
  darkMode,
  onDarkModeChange,
  onNotifPress,
}: Props) {
  const [showSelector, setShowSelector] = useState(false)

  const now     = new Date()
  const dateStr = now.toLocaleDateString('en-KE', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  const modeLabel =
    darkMode === 'sun'   ? '☾ Sun' :
    darkMode === 'light' ? '☀ Light' :
                           '☾ Dark'

  const sync = SYNC_CONFIG[syncStatus]

  function handleToggle() {
    if (darkMode === 'sun') {
      setShowSelector(true)
    } else {
      onDarkModeChange('sun')
    }
  }

  return (
    <>
      <header className={styles.header}>
        {/* Left — brand */}
        <div className={styles.brand}>
          <div className={styles.logo}>
            <span className={styles.logoLetter}>V</span>
          </div>
          <div>
            <div className={styles.brandName}>VibeSchool</div>
            <div className={styles.brandDate}>{dateStr}</div>
          </div>
        </div>

        {/* Right — actions */}
        <div className={styles.actions}>
          {/* Sync status */}
          <div className={`${styles.syncPill} ${styles[sync.pillClass]}`}>
            <span className={`${styles.dot} ${styles[sync.dotClass]}`} />
            <span>{sync.label}</span>
          </div>

          {/* Dark mode toggle */}
          <button className={styles.modeToggle} onClick={handleToggle}>
            {modeLabel}
          </button>

          {/* Notification bell */}
          <button className={styles.bellWrap} onClick={onNotifPress}>
            <span className={styles.bellIcon}>🔔</span>
            {notifCount > 0 && (
              <span className={styles.bellBadge}>
                {notifCount > 9 ? '9+' : notifCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Dark mode bottom sheet */}
      {showSelector && (
        <div className={styles.sheetBackdrop} onClick={() => setShowSelector(false)}>
          <div className={styles.sheet} onClick={e => e.stopPropagation()}>
            <div className={styles.sheetTitle}>Display mode</div>
            {(['light', 'dark', 'sun'] as DarkMode[]).map(opt => (
              <button
                key={opt}
                className={styles.sheetOption}
                onClick={() => { onDarkModeChange(opt); setShowSelector(false) }}
              >
                {opt === 'light' ? '☀ Force light' : opt === 'dark' ? '☾ Force dark' : '◎ Back to sun'}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}