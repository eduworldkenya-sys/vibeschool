'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { SunMoon } from 'lucide-react'
import styles from './ThemeControl.module.css'

export type VibeSchoolTheme = 'system' | 'light' | 'dark'

function isTheme(value: unknown): value is VibeSchoolTheme {
  return value === 'system' || value === 'light' || value === 'dark'
}

/** One theme preference for signed-in users and guests, with no auth dependency. */
export function ThemeControl({ className = '', native = false, compact = false }: { className?: string; native?: boolean; compact?: boolean }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return (
    <label data-site-theme-host={native ? 'true' : undefined} className={`${styles.control} ${compact ? styles.compact : ''} ${className}`}>
      <SunMoon size={17} aria-hidden="true" />
      <span className={styles.sr}>Appearance</span>
      <select aria-label="VibeSchool appearance" disabled={!mounted}
        value={mounted && isTheme(theme) ? theme : 'system'}
        onChange={event => setTheme(event.target.value)}>
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  )
}
