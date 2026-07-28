
"use client";

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { VibeContent } from '@/lib/types'
import ScrollSurface from '@/components/vibelearn/reader/ScrollSurface'
import AudioDock from '@/components/vibelearn/reader/AudioDock'
import ModeSwitcher from '@/components/vibelearn/reader/ModeSwitcher'

const BG      = '#090D16'
const SURFACE = '#111827'
const ACCENT  = '#CCFF00'
const MUTED   = 'rgba(255,255,255,0.4)'
const TEXT    = '#ffffff'

export type ReadMode = 'scroll' | 'listen'

export default function ReaderPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()
  const [content, setContent]   = useState<VibeContent | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error,   setError]     = useState('')
  const [mode,    setMode]      = useState<ReadMode>('scroll')
  const [userId,  setUserId]    = useState<string>('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/'); return }
      setUserId(user.id)

      const { data: rpcData, error: rpcErr } = await supabase.rpc(
        'get_vibelearn_content_reader',
        { content_id_input: id }
      )

      if (rpcErr || !rpcData || rpcData.ok !== true) {
        if (rpcErr) {
          console.error('get_vibelearn_content_reader failed:', rpcErr)
        }
        setError('Content not found.')
        setLoading(false)
        return
      }

      setContent(rpcData as VibeContent)

      // increment view count — non-blocking, but no longer silently
      // swallowed. This is exactly how two real bugs in
      // increment_view_count went undetected earlier today: the RPC was
      // failing on every call and nothing surfaced it.
      const { error: viewCountError } = await supabase.rpc('increment_view_count', {
        content_id: id,
        viewer_id:  user.id,
      })
      if (viewCountError) {
        console.error('increment_view_count failed:', viewCountError)
      }

      setLoading(false)
    }
    load()
  }, [id, router])

  if (loading) return (
    <div style={{ background: BG, minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 13, color: MUTED }}>Loading…</div>
    </div>
  )

  if (error || !content) return (
    <div style={{ background: BG, minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ fontSize: 15, color: TEXT }}>{error || 'Not found.'}</div>
      <button
        onClick={() => router.back()}
        style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: ACCENT, color: '#000', fontWeight: 800, cursor: 'pointer' }}
      >
        Go Back
      </button>
    </div>
  )

  return (
    <div style={{ background: BG, minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px', background: SURFACE,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', color: MUTED, fontSize: 20, cursor: 'pointer', padding: 0 }}
        >
          ←
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {content.title}
          </div>
          <div style={{ fontSize: 11, color: MUTED }}>
            {content.source} · {content.type.toUpperCase()}
          </div>
        </div>
        <ModeSwitcher mode={mode} onChange={setMode} />
      </div>

      {/* Reader surface */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: mode === 'listen' ? 120 : 40 }}>
        <ScrollSurface content={content} active={mode === 'scroll' || mode === 'listen'} />
      </div>

      {/* Audio dock — floats when in listen mode */}
      {mode === 'listen' && (
        <AudioDock content={content} />
      )}
    </div>
  )
}
