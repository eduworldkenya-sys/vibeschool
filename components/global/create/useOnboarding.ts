'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export interface OnboardingHints {
  title:        boolean
  illustration: boolean
  text:         boolean
  bubble:       boolean
  characters:   boolean
  pages:        boolean
  publish:      boolean
}

const ALL_HINTS: OnboardingHints = {
  title:        true,
  illustration: true,
  text:         true,
  bubble:       true,
  characters:   true,
  pages:        true,
  publish:      true,
}

const NO_HINTS: OnboardingHints = {
  title:        false,
  illustration: false,
  text:         false,
  bubble:       false,
  characters:   false,
  pages:        false,
  publish:      false,
}

export function useOnboarding(userId: string) {
  const [hints,   setHints]   = useState<OnboardingHints>(NO_HINTS)
  const [loading, setLoading] = useState(true)
  const [complete, setComplete] = useState(false)

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    async function fetchOnboarding() {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('onboarded_chronicles')
          .eq('id', userId)
          .single()
        if (error) throw error
        if (data?.onboarded_chronicles) {
          setHints(NO_HINTS)
          setComplete(true)
        } else {
          setHints(ALL_HINTS)
        }
      } catch {
        setHints(NO_HINTS)
      } finally {
        setLoading(false)
      }
    }
    fetchOnboarding()
  }, [userId])

  const dismissHint = useCallback((key: keyof OnboardingHints) => {
    setHints(prev => {
      const next = { ...prev, [key]: false }
      const allDone = Object.values(next).every(v => !v)
      if (allDone) {
        setComplete(true)
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        supabase
          .from('profiles')
          .update({ onboarded_chronicles: true })
          .eq('id', userId)
          .then(() => {})
      }
      return next
    })
  }, [userId])

  const completeOnboarding = useCallback(() => {
    setHints(NO_HINTS)
    setComplete(true)
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    supabase
      .from('profiles')
      .update({ onboarded_chronicles: true })
      .eq('id', userId)
      .then(() => {})
  }, [userId])

  return { hints, loading, complete, dismissHint, completeOnboarding }
}
