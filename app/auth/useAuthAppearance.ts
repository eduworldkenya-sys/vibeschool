'use client'

import { useEffect, useState } from 'react'
import { readTheme, resolveTheme } from '@/lib/student-theme'

// Registration and sign-in follow the learner's saved appearance, including
// the operating-system preference when the learner selected "auto".
export function useAuthAppearance(): 'light' | 'dark' {
  const [resolved, setResolved] = useState<'light' | 'dark'>('light')
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setResolved(resolveTheme(readTheme()))
    update()
    media.addEventListener('change', update)
    window.addEventListener('storage', update)
    window.addEventListener('vibeschool:theme-changed', update)
    return () => {
      media.removeEventListener('change', update)
      window.removeEventListener('storage', update)
      window.removeEventListener('vibeschool:theme-changed', update)
    }
  }, [])
  return resolved
}
