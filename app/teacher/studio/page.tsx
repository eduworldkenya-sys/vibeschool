"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { PublicationEditor } from '@/components/global/publish/PublicationEditor'
import type { PublicationFormat, VibePublication } from '@/lib/publishTypes'

const BG = '#090D16'
const CARD = '#111827'
const PANEL = '#1a2235'
const TEXT = '#ffffff'
const MUTED = 'rgba(255,255,255,.5)'
const BORDER = 'rgba(255,255,255,.08)'
const ACCENT = '#CCFF00'

type StudioFormat = 'vibetextbook' | 'ebook'

const FORMAT_OPTIONS: Array<{
  format: StudioFormat
  title: string
  description: string
  icon: string
}> = [
  {
    format: 'vibetextbook',
    title: 'Interactive textbook',
    description: 'Curriculum-linked units, illustrations, activities, questions, media and revision history.',
    icon: '🎓',
  },
  {
    format: 'ebook',
    title: 'eBook',
    description: 'Chapter-based publication using the same rich editor and content blocks.',
    icon: '📘',
  },
]

function dateLabel(value: string): string {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function TeacherContentStudioPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedId = searchParams.get('publication') ?? undefined
  const requestedFormat = searchParams.get('format')

  const initialFormat: StudioFormat | null =
    requestedFormat === 'vibetextbook' || requestedFormat === 'ebook'
      ? requestedFormat
      : null

  const [userId, setUserId] = useState<string | null>(null)
  const [roleChecked, setRoleChecked] = useState(false)
  const [publications, setPublications] = useState<VibePublication[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | undefined>(requestedId)
  const [editingFormat, setEditingFormat] = useState<StudioFormat | null>(initialFormat)

  useEffect(() => {
    let cancelled = false
    const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

    async function load() {
      const { data: auth } = await sb.auth.getUser()
      const user = auth.user
      if (!user) {
        router.replace('/?role=teacher')
        return
      }

      const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).maybeSingle()
      if (!profile || !['teacher', 'admin'].includes(profile.role)) {
        router.replace('/')
        return
      }

      const { data, error } = await sb
        .from('vibe_publications')
        .select('*')
        .eq('author_id', user.id)
        .in('format', ['vibetextbook', 'ebook'])
        .order('updated_at', { ascending: false })

      if (cancelled) return
      setUserId(user.id)
      setRoleChecked(true)
      if (!error) setPublications((data ?? []) as VibePublication[])
      setLoading(false)
    }

    void load()
    return () => { cancelled = true }
  }, [router])

  const editingPublication = useMemo(
    () => publications.find(item => item.id === editingId),
    [editingId, publications],
  )

  const resolvedFormat: PublicationFormat | null = editingPublication?.format ?? editingFormat

  if (!roleChecked || !userId || loading) {
    return (
      <div style={{ minHeight: '100dvh', background: BG, color: MUTED, display: 'grid', placeItems: 'center', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
        Loading Content Studio…
      </div>
    )
  }

  if (resolvedFormat && (resolvedFormat === 'vibetextbook' || resolvedFormat === 'ebook')) {
    return (
      <PublicationEditor
        authorId={userId}
        format={resolvedFormat}
        publicationId={editingId}
        onExit={() => {
          setEditingId(undefined)
          setEditingFormat(null)
          router.replace('/teacher/studio')
        }}
      />
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: BG, color: TEXT, padding: '24px 16px 110px', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <button onClick={() => router.push('/teacher/vibelearn')} style={{ background: 'transparent', border: 'none', color: MUTED, fontSize: 14, cursor: 'pointer', padding: '4px 0 18px' }}>‹ VibeLearn</button>

        <div style={{ marginBottom: 24 }}>
          <div style={{ color: ACCENT, fontSize: 10, fontWeight: 850, letterSpacing: '.12em', marginBottom: 7 }}>VIBESCHOOL CONTENT STUDIO</div>
          <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.15, letterSpacing: '-.04em' }}>Create once. Teach, study and generate from it.</h1>
          <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.7, maxWidth: 640, margin: '10px 0 0' }}>
            Build structured educational content with curriculum outcomes, illustrations, diagrams, activities, assessments and rich media. Published textbooks keep revision history and become available to VibeLearn.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 12, marginBottom: 30 }}>
          {FORMAT_OPTIONS.map(option => (
            <button
              key={option.format}
              onClick={() => { setEditingId(undefined); setEditingFormat(option.format) }}
              style={{ textAlign: 'left', background: CARD, border: `1px solid ${BORDER}`, borderRadius: 18, padding: 18, color: TEXT, cursor: 'pointer' }}
            >
              <div style={{ fontSize: 28, marginBottom: 12 }}>{option.icon}</div>
              <div style={{ fontSize: 16, fontWeight: 850, marginBottom: 6 }}>{option.title}</div>
              <div style={{ color: MUTED, fontSize: 12, lineHeight: 1.6 }}>{option.description}</div>
              <div style={{ color: ACCENT, fontWeight: 800, fontSize: 12, marginTop: 14 }}>Create →</div>
            </button>
          ))}
        </div>

        <section>
          <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em', color: MUTED }}>YOUR CONTENT</div>
              <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>Drafts and published resources use the same editor.</div>
            </div>
          </div>

          {publications.length === 0 ? (
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 28, textAlign: 'center', color: MUTED }}>No studio publications yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {publications.map(item => (
                <button
                  key={item.id}
                  onClick={() => { setEditingId(item.id); setEditingFormat(item.format === 'ebook' ? 'ebook' : 'vibetextbook') }}
                  style={{ width: '100%', textAlign: 'left', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 15, color: TEXT, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 14 }}>{item.title || 'Untitled publication'}</strong>
                      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.08em', color: item.status === 'published' ? ACCENT : MUTED, border: `1px solid ${item.status === 'published' ? 'rgba(204,255,0,.35)' : BORDER}`, borderRadius: 999, padding: '3px 7px' }}>{item.status.toUpperCase()}</span>
                    </div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 5 }}>{item.format === 'vibetextbook' ? 'Interactive textbook' : 'eBook'} · {item.chapter_count} {item.chapter_count === 1 ? 'unit' : 'units'} · Updated {dateLabel(item.updated_at)}</div>
                  </div>
                  <span style={{ color: ACCENT, fontSize: 20 }}>›</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
