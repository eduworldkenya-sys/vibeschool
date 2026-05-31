'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { VibeContent } from '@/lib/types'
import ScrollSurface from '@/components/vibelearn/reader/ScrollSurface'
import VibeActionDock from '@/components/vibelearn/VibeActionDock'
import AudioDock from '@/components/vibelearn/reader/AudioDock'
import ModeSwitcher from '@/components/vibelearn/reader/ModeSwitcher'

const BG      = '#0a0a0f'
const SURFACE = '#12121a'
const ACCENT  = '#CCFF00'
const MUTED   = 'rgba(255,255,255,0.38)'
const BORDER  = 'rgba(255,255,255,0.07)'

const SHIMMER_CSS = `
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}
@keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
@keyframes pulse   { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
`

type ReaderMode = 'scroll' | 'listen'

interface Props { contentId: string }

function Shimmer({ h = 16, w = '100%', r = 8 }: { h?: number; w?: string | number; r?: number }) {
  return (
    <div style={{
      height: h, width: w, borderRadius: r,
      background: 'linear-gradient(90deg,#1a1a24 25%,#22222e 50%,#1a1a24 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.6s infinite',
    }} />
  )
}

function VibeButton({ contentId, userId }: { contentId: string; userId: string }) {
  const [vibed, setVibed] = useState(false)
  const [count, setCount] = useState(0)
  const [busy,  setBusy]  = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    async function init() {
      const [countRes, vibeRes] = await Promise.all([
        supabase.from('vibelearn_content').select('vibe_count').eq('id', contentId).single(),
        supabase.from('vibelearn_vibes').select('id').eq('content_id', contentId).eq('user_id', userId).maybeSingle(),
      ])
      if (!mounted.current) return
      setCount(countRes.data?.vibe_count ?? 0)
      setVibed(!!vibeRes.data)
    }
    init()
    return () => { mounted.current = false }
  }, [contentId, userId])

  async function toggle() {
    if (busy) return
    setBusy(true)
    const next = !vibed
    setVibed(next)
    setCount(c => next ? c + 1 : Math.max(0, c - 1))
    try {
      if (next) {
        await supabase.from('vibelearn_vibes').insert({ content_id: contentId, user_id: userId })
      } else {
        await supabase.from('vibelearn_vibes').delete().eq('content_id', contentId).eq('user_id', userId)
      }
    } catch {
      if (mounted.current) { setVibed(!next); setCount(c => next ? Math.max(0, c - 1) : c + 1) }
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  return (
    <button onClick={toggle} disabled={busy} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: vibed ? 'rgba(204,255,0,0.12)' : 'rgba(255,255,255,0.06)',
      border: `1px solid ${vibed ? 'rgba(204,255,0,0.3)' : BORDER}`,
      borderRadius: 20, padding: '6px 14px', cursor: busy ? 'not-allowed' : 'pointer',
      transition: 'all 0.2s', fontFamily: 'inherit',
    }}>
      <span style={{ fontSize: 16, animation: busy ? 'pulse 0.6s infinite' : 'none' }}>
        {vibed ? '⚡' : '🤍'}
      </span>
      <span style={{ fontSize: 12, fontWeight: 700, color: vibed ? ACCENT : MUTED }}>{count}</span>
    </button>
  )
}

export default function VibeLearnShellWrapper({ contentId }: Props) {
  const router  = useRouter()
  const mounted = useRef(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  const [userId,  setUserId]  = useState<string | null>(null)
  const [content, setContent] = useState<VibeContent | null>(null)
  const [mode,    setMode]    = useState<ReaderMode>('scroll')
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.replace('/global/signin'); return }
        if (!mounted.current) return
        setUserId(user.id)

        const { data, error: fetchErr } = await supabase
          .from('vibelearn_content')
          .select('id,title,description,body,type,source,url,tags,status,view_count,vibe_count,earnings_ksh,created_at,submitted_by')
          .eq('id', contentId)
          .eq('status', 'live')
          .single()

        if (fetchErr || !data) {
          if (mounted.current) setError('This content is unavailable or has been removed.')
          return
        }

        if (!mounted.current) return
        setContent(data as VibeContent)

        // fire view count — deduped 24h via RPC
        await supabase.rpc('increment_view_count', { content_id: contentId })
      } catch {
        if (mounted.current) setError('Failed to load content. Check your connection.')
      } finally {
        if (mounted.current) setLoading(false)
      }
    }
    init()
  }, [contentId, router])

  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const pct = Math.min(100, Math.round((el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100))
    setProgress(pct)
  }, [])

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <>
      <style>{SHIMMER_CSS}</style>
      <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column' }}>
        {/* top bar skeleton */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: `1px solid ${BORDER}` }}>
          <Shimmer w={36} h={36} r={10} />
          <Shimmer w={160} h={14} />
          <div style={{ marginLeft: 'auto' }}><Shimmer w={60} h={30} r={20} /></div>
        </div>
        {/* body skeleton */}
        <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Shimmer h={28} w="75%" />
          <Shimmer h={12} w="40%" />
          {[1,2,3,4,5].map(i => <Shimmer key={i} h={12} w={i % 3 === 0 ? '60%' : '100%'} />)}
        </div>
      </div>
    </>
  )

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error || !content) return (
    <>
      <style>{SHIMMER_CSS}</style>
      <div style={{ minHeight: '100dvh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', animation: 'fadeIn 0.3s ease' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Content Unavailable</div>
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 24, lineHeight: 1.6 }}>{error || 'This content could not be loaded.'}</div>
          <button onClick={() => router.back()} style={{
            padding: '12px 28px', borderRadius: 12, border: 'none',
            background: ACCENT, color: '#000', fontWeight: 800, fontSize: 14,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>← Go Back</button>
        </div>
      </div>
    </>
  )

  // ── Reader ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{SHIMMER_CSS}</style>
      <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.25s ease' }}>

        {/* ── Top bar ── */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px',
          background: 'rgba(10,10,15,0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${BORDER}`,
        }}>
          <button onClick={() => router.back()} style={{
            width: 36, height: 36, borderRadius: 10, border: `1px solid ${BORDER}`,
            background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 18,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, fontFamily: 'inherit',
          }}>←</button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {content.title}
            </div>
            <div style={{ fontSize: 10, color: MUTED, marginTop: 1 }}>
              {content.source} · {content.type.toUpperCase()}
            </div>
          </div>

          {userId && <VibeButton contentId={content.id} userId={userId} />}
        </div>

        {/* ── Progress bar ── */}
        <div style={{ height: 2, background: 'rgba(255,255,255,0.04)', flexShrink: 0 }}>
          <div style={{
            height: '100%', background: ACCENT,
            width: `${progress}%`,
            transition: 'width 0.2s ease',
            boxShadow: `0 0 8px ${ACCENT}66`,
          }} />
        </div>

        {/* ── Scroll body ── */}
        <div
          ref={scrollRef}
          onScroll={onScroll}
          style={{ flex: 1, overflowY: 'auto', paddingBottom: 120 }}
        >
          {mode === 'scroll' && (
            <div style={{ animation: 'slideUp 0.3s ease' }}>
              <ScrollSurface content={content} active={mode === 'scroll'} />
            </div>
          )}
          {mode === 'listen' && (
            <div style={{ animation: 'slideUp 0.3s ease', padding: '24px 20px' }}>
              <AudioDock content={content} active={mode === 'listen'} />
            </div>
          )}
        </div>

        {userId && <VibeActionDock contentId={content.id} userId={userId} progress={progress} />}

        {/* ── Bottom dock ── */}
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
          padding: '12px 16px 24px',
          background: 'linear-gradient(to top, rgba(10,10,15,0.98) 80%, transparent)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 20,
            padding: '8px 12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}>
            <ModeSwitcher mode={mode} onChange={setMode} />
          </div>

          {/* progress label */}
          <div style={{ textAlign: 'center', marginTop: 8, fontSize: 10, color: MUTED }}>
            {progress}% read
          </div>
        </div>

      </div>
    </>
  )
}
