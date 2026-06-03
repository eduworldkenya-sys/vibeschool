
"use client";

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { VibePublication, VibeChapter, FORMAT_META } from '@/lib/publishTypes'
import { ContentBlockEditor } from '@/components/global/publish/ContentBlockEditor'

const BG     = '#090D16'
const SURF   = '#111827'
const CARD   = '#1a2235'
const ACCENT = '#CCFF00'
const TEXT   = '#ffffff'
const MUTED  = 'rgba(255,255,255,0.4)'
const BORDER = 'rgba(255,255,255,0.06)'

const COVER_GRADIENTS = [
  'linear-gradient(135deg,#1a2235,#2d3748)',
  'linear-gradient(135deg,#0f2027,#203a43,#2c5364)',
  'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)',
  'linear-gradient(135deg,#0d0d0d,#1a1a1a,#333)',
  'linear-gradient(135deg,#0a0a0a,#1a2235)',
]

function coverGradient(id: string): string {
  const idx = id.charCodeAt(0) % COVER_GRADIENTS.length
  return COVER_GRADIENTS[idx]
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-KE', {
      year: 'numeric', month: 'long', day: 'numeric',
    })
  } catch { return '' }
}

export default function ReadPublicationPage() {
  const params = useParams()
  const router = useRouter()
  const id = typeof params.id === 'string' ? params.id : ''

  const [publication,  setPublication]  = useState<VibePublication | null>(null)
  const [chapters,     setChapters]     = useState<VibeChapter[]>([])
  const [activeIndex,  setActiveIndex]  = useState(0)
  const [authorName,   setAuthorName]   = useState('')
  const [loading,      setLoading]      = useState(true)
  const [notFound,     setNotFound]     = useState(false)
  const [isLoggedIn,   setIsLoggedIn]   = useState(false)

  useEffect(() => {
    if (!id) { setNotFound(true); setLoading(false); return }
    const sb = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    async function load() {
      const { data: { user } } = await sb.auth.getUser()
      setIsLoggedIn(!!user)

      const { data: pub, error: pe } = await sb
        .from('vibe_publications')
        .select('*')
        .eq('id', id)
        .eq('status', 'published')
        .single()
      if (pe || !pub) { setNotFound(true); setLoading(false); return }
      setPublication(pub as VibePublication)

      const key = 'read_' + id
      if (typeof sessionStorage !== 'undefined' && !sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1')
        await sb.rpc('increment_publication_reads', { pub_id: id })
      }

      const { data: chaps } = await sb
        .from('vibe_chapters')
        .select('*')
        .eq('publication_id', id)
        .in('status', ['published', 'locked'])
        .order('number', { ascending: true })
      setChapters((chaps || []) as VibeChapter[])

      const { data: prof } = await sb
        .from('profiles')
        .select('full_name')
        .eq('id', pub.author_id)
        .single()
      setAuthorName(prof?.full_name || 'Anonymous')
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

  if (notFound || !publication) return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '0 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 48 }}>📖</div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: TEXT, margin: 0 }}>Not found</h2>
      <button onClick={() => router.push('/global')} style={{ background: ACCENT, color: '#090D16', border: 'none', borderRadius: 12, padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Go Home</button>
    </div>
  )

  const meta          = FORMAT_META[publication.format]
  const activeChapter = chapters[activeIndex] ?? null
  const gradient      = coverGradient(publication.id)

  const canReadChapter = (): boolean => {
    if (!activeChapter) return false
    if (publication.pricing.type === 'free') return true
    if (activeChapter.status === 'published') return true
    if (publication.pricing.type === 'freemium') {
      return activeChapter.number <= publication.pricing.freeChapters
    }
    return false
  }

  return (
    <div style={{ minHeight: '100dvh', background: BG, fontFamily: 'system-ui,-apple-system,sans-serif' }}>

      {/* Hero — always shown, gradient fallback if no cover */}
      <div style={{ position: 'relative', height: 240, overflow: 'hidden' }}>
        {publication.cover_url
          ? <img
              src={publication.cover_url}
              alt={publication.title || ''}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          : <div style={{
              width: '100%', height: '100%',
              background: gradient,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 56, opacity: 0.4 }}>{meta.icon}</span>
            </div>
        }
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(9,13,22,1) 0%,rgba(9,13,22,0.3) 70%,transparent 100%)' }} />
        <button onClick={() => router.back()} style={{
          position: 'absolute', top: 16, left: 16,
          background: 'rgba(9,13,22,0.7)', border: '1px solid ' + BORDER,
          borderRadius: 10, padding: '6px 14px',
          color: TEXT, fontSize: 13, fontWeight: 600,
          cursor: 'pointer', backdropFilter: 'blur(8px)',
        }}>← Back</button>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 16px 80px', boxSizing: 'border-box' }}>

        {/* Publication header */}
        <span style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 24, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: MUTED }}>
          {meta.icon} {meta.label}
        </span>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: TEXT, margin: '10px 0 6px', lineHeight: 1.3 }}>
          {publication.title}
        </h1>
        {publication.subtitle && (
          <p style={{ fontSize: 15, color: MUTED, margin: '0 0 10px', lineHeight: 1.5 }}>{publication.subtitle}</p>
        )}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: TEXT, fontWeight: 600 }}>{authorName}</span>
          <span style={{ color: MUTED }}>·</span>
          <span style={{ fontSize: 12, color: MUTED }}>{fmtDate(publication.published_at || publication.created_at)}</span>
          <span style={{ color: MUTED }}>·</span>
          <span style={{ fontSize: 12, color: MUTED }}>{chapters.length} {meta.chapterPlural.toLowerCase()}</span>
        </div>
        {publication.description && (
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', margin: '0 0 20px', lineHeight: 1.65 }}>
            {publication.description}
          </p>
        )}

        <div style={{ borderTop: '1px solid ' + BORDER, marginBottom: 20 }} />

        {/* Chapter list */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: '0.1em', marginBottom: 10 }}>
            {meta.chapterPlural.toUpperCase()}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {chapters.map((chap, idx) => {
              const active = idx === activeIndex
              const locked = chap.status === 'locked' && !(
                publication.pricing.type === 'free' ||
                (publication.pricing.type === 'freemium' && chap.number <= publication.pricing.freeChapters)
              )
              return (
                <div key={chap.id} onClick={() => setActiveIndex(idx)} style={{
                  padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                  background: active ? 'rgba(204,255,0,0.08)' : CARD,
                  border: '1px solid ' + (active ? 'rgba(204,255,0,0.25)' : BORDER),
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontSize: 12, color: active ? ACCENT : MUTED, fontWeight: 700, marginBottom: 2 }}>
                      {meta.chapterLabel} {chap.number}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
                      {chap.title || `${meta.chapterLabel} ${chap.number}`}
                    </div>
                    <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>
                      {chap.word_count.toLocaleString()} words · {chap.reading_time_min} min
                    </div>
                  </div>
                  {locked && <span style={{ fontSize: 16 }}>🔒</span>}
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ borderTop: '1px solid ' + BORDER, marginBottom: 20 }} />

        {/* Chapter content */}
        {activeChapter && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: meta.accent, letterSpacing: '0.12em', marginBottom: 8 }}>
              {meta.chapterLabel.toUpperCase()} {activeChapter.number}
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: TEXT, margin: '0 0 16px' }}>
              {activeChapter.title || `${meta.chapterLabel} ${activeChapter.number}`}
            </h2>

            {canReadChapter() ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {activeChapter.blocks.map(block => (
                  <ContentBlockEditor
                    key={block.id}
                    block={block}
                    format={publication.format}
                    readOnly={true}
                    isFocused={false}
                    onFocus={() => {}}
                    onUpdate={() => {}}
                    onDelete={() => {}}
                    onMoveUp={() => {}}
                    onMoveDown={() => {}}
                  />
                ))}
              </div>
            ) : (
              <div style={{
                background: SURF, border: '1px solid ' + BORDER,
                borderRadius: 16, padding: '36px 24px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: TEXT, margin: '0 0 8px' }}>
                  Paid {meta.chapterLabel}
                </h3>
                <p style={{ fontSize: 14, color: MUTED, margin: '0 0 20px', lineHeight: 1.6 }}>
                  {publication.pricing.type === 'freemium'
                    ? `First ${publication.pricing.freeChapters} ${meta.chapterPlural.toLowerCase()} are free.`
                    : publication.pricing.type === 'paid'
                    ? `Purchase for KSh ${publication.pricing.priceKsh}.`
                    : publication.pricing.type === 'school_license'
                    ? 'Available via school license.'
                    : 'This content requires purchase.'}
                </p>
                <button
                  onClick={() => isLoggedIn ? alert('M-Pesa coming soon') : router.push('/global/signin')}
                  style={{
                    background: ACCENT, color: '#090D16', border: 'none',
                    borderRadius: 12, padding: '13px 28px',
                    fontSize: 15, fontWeight: 800, cursor: 'pointer',
                  }}
                >
                  {isLoggedIn ? '💚 Unlock via M-Pesa' : 'Sign in to Continue'}
                </button>
              </div>
            )}

            {/* Chapter nav */}
            <div style={{ display: 'flex', gap: 10, marginTop: 32 }}>
              {activeIndex > 0 && (
                <button onClick={() => setActiveIndex(p => p - 1)} style={{
                  flex: 1, padding: 12, background: CARD,
                  border: '1px solid ' + BORDER, borderRadius: 12,
                  color: TEXT, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>← Previous {meta.chapterLabel}</button>
              )}
              {activeIndex < chapters.length - 1 && (
                <button onClick={() => setActiveIndex(p => p + 1)} style={{
                  flex: 1, padding: 12, background: CARD,
                  border: '1px solid ' + BORDER, borderRadius: 12,
                  color: TEXT, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>Next {meta.chapterLabel} →</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
