"use client";

import React, { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { GlobalAuthContext } from '@/components/global/shared/GlobalAuthContext'
import { GlobalHeader } from '@/components/global/layout/GlobalHeader'
import { GlobalBottomNav } from '@/components/global/layout/GlobalBottomNav'
import { AuthPromptSheet } from '@/components/global/shared/AuthPromptSheet'

export default function GlobalLayout({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [authPromptOpen, setAuthPromptOpen] = useState<boolean>(false)
  const [authPromptAction, setAuthPromptAction] = useState<'write' | 'vibe' | 'save' | 'create'>('create')

  const triggerAuthPrompt = (action: 'write' | 'vibe' | 'save' | 'create') => {
    setAuthPromptAction(action)
    setAuthPromptOpen(true)
  }

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const checkAuth = async () => {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (user && !error) {
        setIsLoggedIn(true)
        setUserId(user.id)
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single()
        setUserName(profile?.full_name || user.email || 'Learner')
      } else {
        setIsLoggedIn(false)
        setUserId(null)
        setUserName(null)
      }
    }

    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setIsLoggedIn(true)
        setUserId(session.user.id)
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', session.user.id)
          .single()
        setUserName(profile?.full_name || session.user.email || 'Learner')
      } else {
        setIsLoggedIn(false)
        setUserId(null)
        setUserName(null)
      }
    })

    return () => { subscription.unsubscribe() }
  }, [])

  return (
    <GlobalAuthContext.Provider value={{ isLoggedIn, userId, userName, triggerAuthPrompt }}>
      <div style={{
        backgroundColor: '#090D16',
        color: '#ffffff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        maxWidth: '480px',
        margin: '0 auto',
        boxSizing: 'border-box',
      }}>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        ` }} />
        <GlobalHeader isLoggedIn={isLoggedIn} userName={userName} />
        <main style={{ flexGrow: 1, padding: '16px', paddingBottom: '80px' }}>
          {children}
        </main>
        <GlobalBottomNav isLoggedIn={isLoggedIn} onAuthPrompt={() => triggerAuthPrompt('create')} />
        <AuthPromptSheet
          isOpen={authPromptOpen}
          onClose={() => setAuthPromptOpen(false)}
          action={authPromptAction}
        />
      </div>
    </GlobalAuthContext.Provider>
  )
}
