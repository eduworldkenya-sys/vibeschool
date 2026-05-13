'use client'

import { useState } from 'react'
import styles from './Header.module.css'

type DarkMode = 'sun' | 'light' | 'dark'

interface Props {
  isOnline: boolean
  teacherInitials: string
  darkMode: DarkMode
  onDarkModeChange: (mode: DarkMode) => void
}

export default function Header({ isOnline, teacherInitials, darkMode, onDarkModeChange }: Props) {
  const [showSelector, setShowSelector] = useState(false)

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-KE', {
    weekday: 'long', day: 'numeric', month: 'long'
  })

  const modeLabel =
    darkMode === 'sun'   ? '☾ Following sun' :
    darkMode === 'light' ? '☀ Light · Manual' :
                           '☾ Dark · Manual'

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
        <div className={styles.brand}>
          <div className={styles.logo}>
            <span className={styles.logoLetter}>V</span>
          </div>
          <div>
            <div className={styles.brandName}>VibeSchool</div>
            <div className={styles.brandDate}>{dateStr}</div>
          </div>
        </div>

        <div className={styles.actions}>
          <div className={`${styles.syncPill} ${isOnline ? styles.online : styles.offlinePill}`}>
            <span className={`${styles.dot} ${isOnline ? styles.dotOnline : styles.dotOffline}`} />
            <span>{isOnline ? 'Synced' : 'Offline'}</span>
          </div>

          <button className={styles.modeToggle} onClick={handleToggle}>
            {modeLabel}
          </button>

          <div className={styles.avatar}>{teacherInitials}</div>
        </div>
      </header>

      {showSelector && (
        <div className={styles.sheetBackdrop} onClick={() => setShowSelector(false)}>
          <div className={styles.sheet} onClick={e => e.stopPropagation()}>
            <div className={styles.sheetTitle}>Display mode</div>
            {(['light', 'dark', 'sun'] as DarkMode[]).map(opt => (
              <button key={opt} className={styles.sheetOption} onClick={() => {
                onDarkModeChange(opt)
                setShowSelector(false)
              }}>
                {opt === 'light' ? '☀ Force light' : opt === 'dark' ? '☾ Force dark' : '◎ Back to sun'}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}