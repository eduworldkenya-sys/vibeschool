'use client'

import { useEffect, type ReactNode } from 'react'
import { ThemeProvider, useTheme } from 'next-themes'

export const VIBESCHOOL_THEME_KEY = 'vibeschool-theme'

// Reuse the current appearance preferences instead of resetting a visitor's
// choice when a VibeTutor or learner visits another VibeSchool workspace.
function ImportExistingPreference() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  useEffect(() => {
    try {
      if (window.localStorage.getItem(VIBESCHOOL_THEME_KEY) !== null) return
      const tutor = window.localStorage.getItem('vibetutor-theme')
      const learner = window.localStorage.getItem('vs_student_theme_v1')
      const previous = tutor === 'light' || tutor === 'dark' || tutor === 'system'
        ? tutor
        : learner === 'light' || learner === 'dark' || learner === 'auto'
          ? (learner === 'auto' ? 'system' : learner)
          : null
      if (previous) setTheme(previous)
    } catch {
      // Theme is purely a device preference; the system setting stays usable
      // when browser storage is blocked.
    }
  }, [setTheme])
  useEffect(() => {
    if (!resolvedTheme) return
    window.dispatchEvent(new Event('vibeschool:theme-changed'))
    window.dispatchEvent(new Event('vibeschool:learner-appearance-changed'))
  }, [theme, resolvedTheme])
  return null
}

export default function VibeSchoolThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="data-vs-theme" storageKey={VIBESCHOOL_THEME_KEY}
      defaultTheme="system" enableSystem enableColorScheme disableTransitionOnChange>
      <ImportExistingPreference />
      {children}
    </ThemeProvider>
  )
}
