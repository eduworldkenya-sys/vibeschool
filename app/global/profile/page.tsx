"use client";
'use client'

import React, { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { useGlobalAuth } from '@/components/global/shared/GlobalAuthContext'

interface ProfileStats {
  storiesWritten: number
  vibesDropped: number
  totalViews: number
  countryCode: string
}

export default function ProfilePage() {
  const { isLoggedIn, userId, userName } = useGlobalAuth()
  const router = useRouter()
  const [stats, setStats] = useState<ProfileStats>({ storiesWritten: 0, vibesDropped: 0, totalViews: 0, countryCode: '' })
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    if (!isLoggedIn || !userId) { setLoading(false); return }

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    async function fetchStats() {
      const [profileRes, storiesRes, vibesRes, storyViewsRes, vibeViewsRes] = await Promise.all([
        supabase.from('profiles').select('country_code').eq('id', userId!).single(),
        supabase.from('vibe_stories').select('*', { count: 'exact', head: true }).eq('author_id', userId!),
        supabase.from('vibelearn_content').select('*', { count: 'exact', head: true }).eq('submitted_by', userId!),
        supabase.from('vibe_stories').select('view_count').eq('author_id', userId!),
        supabase.from('vibelearn_content').select('view_count').eq('submitted_by', userId!),
      ])

      const sumStory = (storyViewsRes.data || []).reduce((acc, r) => acc + (r.view_count || 0), 0)
      const sumVibe  = (vibeViewsRes.data || []).reduce((acc, r) => acc + (r.view_count || 0), 0)

      setStats({
        storiesWritten: storiesRes.count || 0,
        vibesDropped:   vibesRes.count  || 0,
        totalViews:     sumStory + sumVibe,
        countryCode:    profileRes.data?.country_code || '',
      })
      setLoading(false)
    }

    fetchStats()
  }, [isLoggedIn, userId])

  const handleSignOut = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.signOut()
    router.replace('/global')
  }

  if (!isLoggedIn) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70dvh', textAlign: 'center', gap: 24, padding: '0 16px' }}>
        <div>
          <div style={{ fontSize: 48, marginBottom: 16 }}>👤</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: '#ffffff' }}>Join VibeSchool Global</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 8, maxWidth: 280, margin: '8px auto 0' }}>
            Track your progress, publish stories and drop vibes.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 280 }}>
          <button onClick={() => router.push('/global/signup')} style={{ width: '100%', padding: 14, backgroundColor: '#CCFF00', color: '#090D16', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Create Account
          </button>
          <button onClick={() => router.push('/global/signin')} style={{ width: '100%', padding: 14, backgroundColor: 'transparent', color: '#ffffff', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Sign In
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60dvh' }}>
        <span style={{ color: '#CCFF00', fontSize: 14, fontWeight: 600 }}>Loading…</span>
      </div>
    )
  }

  const initials = userName ? userName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'U'
  const firstName = userName ? userName.split(' ')[0] : 'Learner'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', backgroundColor: '#CCFF00', color: '#090D16', fontSize: 22, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {initials}
        </div>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: '#ffffff' }}>{userName}</h2>
          {stats.countryCode && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>📍 {stats.countryCode}</span>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, backgroundColor: '#111827', padding: 16, borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
        {[
          { label: 'Stories', value: stats.storiesWritten },
          { label: 'Drops',   value: stats.vibesDropped },
          { label: 'Views',   value: stats.totalViews },
        ].map((s, i) => (
          <div key={s.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#CCFF00' }}>{s.value}</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{s.label}</span>
          </div>
        ))}
      </div>

      <button onClick={() => router.push('/global/dashboard')} style={{ width: '100%', padding: 14, backgroundColor: '#1a2235', color: '#ffffff', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' }}>
        <span>Creator Dashboard</span><span>→</span>
      </button>

      <button onClick={handleSignOut} style={{ width: '100%', padding: 14, backgroundColor: 'transparent', color: '#ff4444', border: '1px solid rgba(255,68,68,0.15)', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 8 }}>
        Sign Out
      </button>
    </div>
  )
}
