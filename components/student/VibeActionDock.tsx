"use client";
'use client'

import { useCallback, useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const SURFACE = '#111827'
const ACCENT  = '#CCFF00'
const MUTED   = 'rgba(255,255,255,0.4)'
const GREEN   = '#10b981'
const PINK    = '#f472b6'

interface VibeActionDockProps {
  contentId:    string
  isSaved:      boolean
  isCompleted:  boolean
  onToggleSave: (contentId: string) => void
  onComplete:   (contentId: string) => void
}

export default function VibeActionDock({
  contentId,
  isSaved,
  isCompleted,
  onToggleSave,
  onComplete,
}: VibeActionDockProps) {

  const [isVibed,    setIsVibed]    = useState(false)
  const [vibeCount,  setVibeCount]  = useState(0)
  const [vibing,     setVibing]     = useState(false)

  useEffect(() => {
    async function loadVibeState() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [vibeRes, countRes] = await Promise.all([
        supabase.from('vibelearn_vibes')
          .select('id')
          .eq('content_id', contentId)
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase.from('vibelearn_content')
          .select('vibe_count')
          .eq('id', contentId)
          .single(),
      ])
      setIsVibed(!!vibeRes.data)
      setVibeCount(countRes.data?.vibe_count ?? 0)
    }
    loadVibeState()
  }, [contentId])

  const handleVibe = useCallback(async () => {
    if (vibing) return
    setVibing(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      if (isVibed) {
        await supabase.from('vibelearn_vibes')
          .delete()
          .eq('content_id', contentId)
          .eq('user_id', user.id)
        setIsVibed(false)
        setVibeCount(p => Math.max(p - 1, 0))
      } else {
        await supabase.from('vibelearn_vibes')
          .insert({ content_id: contentId, user_id: user.id })
        setIsVibed(true)
        setVibeCount(p => p + 1)
      }
    } finally {
      setVibing(false)
    }
  }, [contentId, isVibed, vibing])

  const handleSave = useCallback(() => {
    onToggleSave(contentId)
  }, [contentId, onToggleSave])

  const handleVibePass = useCallback(() => {
    if (navigator.share) {
      navigator.share({
        title: 'Vibe Pass',
        text:  'Vibe — check this out on VibeLearn',
        url:   window.location.href,
      }).catch(() => {})
    } else {
      navigator.clipboard.writeText(window.location.href)
        .catch(() => {})
    }
  }, [])

  const handleComplete = useCallback(() => {
    if (isCompleted) return
    onComplete(contentId)
  }, [contentId, isCompleted, onComplete])

  return (
    <div style={{
      display: 'flex',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      background: SURFACE,
      flexShrink: 0,
      height: 72,
    }}>

      {/* Save */}
      <button
        onClick={handleSave}
        aria-label={isSaved ? 'Remove from library' : 'Save to library'}
        style={{
          flex: 1,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 4, border: 'none',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          background: isSaved ? 'rgba(204,255,0,0.06)' : 'none',
          cursor: 'pointer', padding: 0,
        }}
      >
        <span style={{ fontSize: 20 }}>{isSaved ? '🔖' : '📌'}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: isSaved ? ACCENT : MUTED, letterSpacing: 0.4 }}>
          {isSaved ? 'Saved' : 'Save'}
        </span>
      </button>

      {/* Vibe */}
      <button
        onClick={handleVibe}
        disabled={vibing}
        aria-label={isVibed ? 'Remove vibe' : 'Vibe this content'}
        style={{
          flex: 1,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 4, border: 'none',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          background: isVibed ? 'rgba(244,114,182,0.08)' : 'none',
          cursor: vibing ? 'default' : 'pointer', padding: 0,
          transition: 'background 0.2s',
        }}
      >
        <span style={{
          fontSize: 20,
          transform: isVibed ? 'scale(1.2)' : 'scale(1)',
          transition: 'transform 0.15s',
          display: 'block',
        }}>
          ✦
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, color: isVibed ? PINK : MUTED, letterSpacing: 0.4 }}>
          {vibeCount > 0 ? `${vibeCount} Vibes` : isVibed ? 'Vibed' : 'Vibe'}
        </span>
      </button>

      {/* Complete */}
      <button
        onClick={handleComplete}
        aria-label={isCompleted ? 'Already completed' : 'Mark complete'}
        disabled={isCompleted}
        style={{
          flex: 1,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 4, border: 'none',
          background: isCompleted ? 'rgba(16,185,129,0.06)' : 'none',
          cursor: isCompleted ? 'default' : 'pointer', padding: 0,
          opacity: isCompleted ? 0.8 : 1,
        }}
      >
        <span style={{ fontSize: 20 }}>{isCompleted ? '✅' : '☑️'}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: isCompleted ? GREEN : MUTED, letterSpacing: 0.4 }}>
          {isCompleted ? 'Vibe Out' : 'Complete'}
        </span>
      </button>

      {/* Vibe Pass */}
      <button
        onClick={handleVibePass}
        aria-label="Share this content"
        style={{
          flex: 1,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 4, border: 'none',
          borderLeft: '1px solid rgba(255,255,255,0.06)',
          background: 'none',
          cursor: 'pointer', padding: 0,
        }}
      >
        <span style={{ fontSize: 20 }}>↗</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: MUTED, letterSpacing: 0.4 }}>
          Vibe Pass
        </span>
      </button>

    </div>
  )
}
