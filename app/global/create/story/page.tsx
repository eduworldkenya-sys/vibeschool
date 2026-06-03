
"use client";

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { StoryCanvas } from '@/components/global/create/StoryCanvas'

interface UserSessionState {
  loading: boolean
  userId: string | null
}

export default function StoryEditorEntryPage() {
  const router = useRouter()
  const [session, setSession] = useState<UserSessionState>({
    loading: true,
    userId: null,
  })

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    async function resolveUserSession() {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) {
          router.replace('/global/signin')
        } else {
          setSession({ loading: false, userId: user.id })
        }
      } catch (err) {
        console.error('Editor auth error:', err)
        router.replace('/global/signin')
      }
    }

    resolveUserSession()
  }, [router])

  if (session.loading || !session.userId) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#090D16',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        zIndex: 9999,
      }}>
        <style dangerouslySetInnerHTML={{ __html: '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }' }} />
        <div style={{
          width: 32,
          height: 32,
          borderWidth: 3,
          borderStyle: 'solid',
          borderColor: '#1a2235',
          borderTopColor: '#CCFF00',
          borderRadius: '50%',
          animationName: 'spin',
          animationDuration: '1s',
          animationTimingFunction: 'linear',
          animationIterationCount: 'infinite',
        }} />
        <div style={{
          color: 'rgba(255,255,255,0.4)',
          fontSize: 13,
          fontWeight: 500,
        }}>
          Loading editor…
        </div>
      </div>
    )
  }

  return <StoryCanvas authorId={session.userId} />
}
