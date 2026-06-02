"use client";
'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { VibePublication, ProfileData, FORMAT_META } from '@/lib/publishTypes'

const BG     = '#090D16'
const SURF   = '#111827'
const CARD   = '#1a2235'
const ACCENT = '#CCFF00'
const TEXT   = '#ffffff'
const MUTED  = 'rgba(255,255,255,0.4)'
const BORDER = 'rgba(255,255,255,0.06)'

export default function CreatorProfilePage() {
  const params = useParams()
  const router = useRouter()
  const id     = typeof params.id === 'string' ? params.id : ''

  const [profile,      setProfile]      = useState<ProfileData | null>(null)
  const [publications, setPublications] = useState<VibePublication[]>([])
  const [loading,      setLoading]      = useState(true)
  const [notFound,     setNotFound]     = useState(false)

  useEffect(() => {
    if (!id) { setNotFound(true); setLoading(false); return }
    const sb = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    async function load() {
      const { data: prof, error: pe } = await sb
        .from('profiles')
        .select('id,full_name,avatar_url,bio')
        .eq('id', id)
        .single()
      if (pe || !prof) { setNotFound(true); setLoading(false); return }
      setProfile(prof as ProfileData)

      const { data: pubs } = await sb
        .from('vibe_publications')
        .select('*')
        .eq('author_id', id)
        .eq('status', 'published')
        .order('published_at', { ascending: false })
      setPublications((pubs || []) as VibePublication[])
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid ' + ACCENT, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
      <style dangerouslySetInnerHTML={{ __html: '@keyframes spin{to{transform:rotate(360deg)}}' }} />
    </div>
  )

  if (notFound || !profile) return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '0 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 48 }}>👤</div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: TEXT, margin: 0 }}>Creator not found</h2>
      <button onClick={() => router.push('/global')} style={{ background: ACCENT, color: '#090D16', border: 'none', borderRadius: 12, padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
        Go Home
      </button>
    </div>
  )

  const totalEarnings = publications.reduce((a, p) => a + Number(p.earnings_ksh || 0), 0)
  const grouped = publications.reduce<Record<string, VibePublication[]>>((acc, pub) => {
    if (!acc[pub.format]) acc[pub.format] = []
    acc[pub.format].push(pub)
    return acc
  }, {})

  return (
    <div style={{ minHeight: '100dvh', background: BG, fontFamily: 'system-ui,-apple-system,sans-serif' }}>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(180deg,#1a2235 0%,#090D16 100%)', padding: '32px 20px 24px' }}>
        <button onClick={() => router.back()} style={{
          background: 'none', border: 'none', color: MUTED,
          fontSize: 22, cursor: 'pointer', marginBottom: 20,
          display: 'block', padding: '4px 8px',
        }}>‹</button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%', flexShrink: 0,
            background: profile.avatar_url ? 'none' : 'linear-gradient(135deg,#CCFF00,#4ECDC4)',
            overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 800, color: '#090D16',
            border: '2px solid rgba(255,255,255,0.1)',
          }}>
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt={profile.full_name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : (profile.full_name || 'A').charAt(0).toUpperCase()
            }
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: TEXT, margin: '0 0 2px' }}>
              {profile.full_name || 'Anonymous'}
            </h1>
            {profile.bio && (
              <p style={{ fontSize: 13, color: MUTED, margin: 0, lineHeight: 1.5 }}>{profile.bio}</p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 24, marginTop: 20 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{publications.length}</div>
            <div style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>Works</div>
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#4ade80' }}>
              {"KSh " + totalEarnings.toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>Earned</div>
          </div>
        </div>
      </div>

      {/* Publications */}
      <div style={{ padding: '20px 16px 80px' }}>
        {publications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: MUTED, fontSize: 14 }}>
            No published works yet.
          </div>
        ) : (
          Object.entries(grouped).map(([fmt, pubs]) => {
            const fmeta = FORMAT_META[fmt as keyof typeof FORMAT_META]
            if (!fmeta) return null
            return (
              <div key={fmt} style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 16 }}>{fmeta.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{fmeta.label}</span>
                  <span style={{ fontSize: 11, color: MUTED }}>({pubs.length})</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
                  {pubs.map(pub => (
                    <div key={pub.id} onClick={() => router.push('/global/read/publication/' + pub.id)} style={{
                      background: CARD, borderRadius: 14, overflow: 'hidden',
                      border: '1px solid ' + BORDER, cursor: 'pointer',
                    }}>
                      <div style={{
                        height: 110, overflow: 'hidden',
                        background: pub.cover_url ? 'none' : 'linear-gradient(135deg,#1a2235,#2d3748)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {pub.cover_url
                          ? <img src={pub.cover_url} alt={pub.title || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ fontSize: 32 }}>{fmeta.icon}</span>
                        }
                      </div>
                      <div style={{ padding: '10px 12px' }}>
                        <div style={{
                          fontSize: 13, fontWeight: 700, color: TEXT, lineHeight: 1.3,
                          overflow: 'hidden', display: '-webkit-box',
                          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
                        }}>
                          {pub.title || 'Untitled'}
                        </div>
                        <div style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>
                          {pub.chapter_count} {fmeta.chapterPlural.toLowerCase()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
