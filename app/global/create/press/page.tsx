'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { VibePublication } from '@/lib/publishTypes'
import { PublicationEditor } from '@/components/global/publish/PublicationEditor'

const BG     = '#090D16'
const SURF   = '#111827'
const ACCENT = '#CCFF00'
const TEXT   = '#ffffff'
const MUTED  = 'rgba(255,255,255,0.4)'
const BORDER = 'rgba(255,255,255,0.06)'
const CARD   = '#1a2235'

export default function VibePressPage() {
  const router = useRouter()
  const [userId,       setUserId]       = useState<string | null>(null)
  const [drafts,       setDrafts]       = useState<VibePublication[]>([])
  const [loadingDrafts,setLoadingDrafts]= useState(true)
  const [selectedId,   setSelectedId]   = useState<string | undefined>(undefined)
  const [showEditor,   setShowEditor]   = useState(false)

  useEffect(() => {
    const sb = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    sb.auth.getUser().then(async ({ data: { user }, error }) => {
      if (error || !user) { router.replace('/global/signin'); return }
      setUserId(user.id)
      const { data } = await sb
        .from('vibe_publications')
        .select('*')
        .eq('author_id', user.id)
        .eq('format', 'vibepress')
        .eq('status', 'draft')
        .order('updated_at', { ascending: false })
      setDrafts((data || []) as VibePublication[])
      setLoadingDrafts(false)
    })
  }, [router])

  if (!userId) return null

  if (showEditor) {
    return (
      <PublicationEditor
        authorId={userId}
        format="vibepress"
        publicationId={selectedId}
      />
    )
  }

  return (
    <div style={{ background: BG, minHeight: '100dvh', color: TEXT, padding: '24px 16px', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        <button onClick={() => router.back()} style={{
          background: 'none', border: 'none', color: MUTED,
          fontSize: 22, cursor: 'pointer', marginBottom: 20,
          display: 'block', padding: '4px 8px',
        }}>‹</button>

        <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.03em' }}>
          📰 VibePress
        </h1>
        <p style={{ color: MUTED, fontSize: 13, margin: '0 0 28px' }}>
          Magazine articles, revision guides, editorial content.
        </p>

        <button
          onClick={() => { setSelectedId(undefined); setShowEditor(true) }}
          style={{
            width: '100%', padding: 14,
            background: ACCENT, color: '#090D16',
            border: 'none', borderRadius: 12,
            fontSize: 15, fontWeight: 800,
            cursor: 'pointer', marginBottom: 28,
          }}
        >
          + New Article
        </button>

        <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: '0.1em', marginBottom: 12 }}>
          YOUR DRAFTS
        </div>

        {loadingDrafts ? (
          <div style={{ color: MUTED, fontSize: 13 }}>Loading drafts…</div>
        ) : drafts.length === 0 ? (
          <div style={{
            background: SURF, border: '1px solid ' + BORDER,
            borderRadius: 12, padding: '24px',
            textAlign: 'center', color: MUTED, fontSize: 13,
          }}>
            No drafts yet. Start your first article.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {drafts.map(d => (
              <div
                key={d.id}
                onClick={() => { setSelectedId(d.id); setShowEditor(true) }}
                style={{
                  background: CARD, border: '1px solid ' + BORDER,
                  borderRadius: 12, padding: 16,
                  cursor: 'pointer', display: 'flex',
                  justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: TEXT, marginBottom: 4 }}>
                    {d.title || 'Untitled Article'}
                  </div>
                  <div style={{ fontSize: 11, color: MUTED }}>
                    {"Updated " + new Date(d.updated_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <span style={{ color: ACCENT, fontSize: 18 }}>›</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
