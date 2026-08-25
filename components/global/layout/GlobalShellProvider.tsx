"use client"

import React, { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter, usePathname } from 'next/navigation'
import { GlobalAuthContext } from '@/components/global/shared/GlobalAuthContext'
import { GlobalHeader } from '@/components/global/layout/GlobalHeader'
import { GlobalBottomNav } from '@/components/global/layout/GlobalBottomNav'

const HIDE_SHELL_PATHS = [
  '/global/signup',
  '/global/read',
  '/global/paused',
]

export function GlobalShellProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)

  useEffect(() => {
    const sb = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    sb.auth.getUser().then(({ data }: { data: { user: import("@supabase/supabase-js").User | null } }) => {
      const user = data.user
      if (user) {
        setIsLoggedIn(true)
        setUserId(user.id)
        setUserName(
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split('@')[0] ||
          null
        )
      }
    })
    const { data: listener } = sb.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setIsLoggedIn(true)
        setUserId(session.user.id)
        setUserName(
          session.user.user_metadata?.full_name ||
          session.user.user_metadata?.name ||
          session.user.email?.split('@')[0] ||
          null
        )
      } else {
        setIsLoggedIn(false)
        setUserId(null)
        setUserName(null)
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const triggerAuthPrompt = (_action: 'write' | 'vibe' | 'save' | 'create') => {
    router.push('/global/signup')
  }

  const hideShell = HIDE_SHELL_PATHS.some(p => pathname.startsWith(p))

  return (
    <GlobalAuthContext.Provider value={{ isLoggedIn, userId, userName, triggerAuthPrompt }}>
      {!hideShell && <GlobalHeader isLoggedIn={isLoggedIn} userName={userName} />}
      <main style={{
        minHeight: '100dvh',
        backgroundColor: '#05050F',
        paddingBottom: hideShell ? 0 : 80,
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 16,
      }}>
        {children}
      </main>
      {!hideShell && (
        <GlobalBottomNav
          isLoggedIn={isLoggedIn}
          onAuthPrompt={() => triggerAuthPrompt('create')}
        />
      )}
    </GlobalAuthContext.Provider>
  )
}
