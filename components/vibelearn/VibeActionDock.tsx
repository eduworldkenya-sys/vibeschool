"use client";
'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

const ACCENT  = '#CCFF00'
const SURFACE = '#12121a'
const BORDER  = 'rgba(255,255,255,0.07)'
const MUTED   = 'rgba(255,255,255,0.38)'

const ANIM = `
@keyframes slideUp {
  from { opacity: 0; transform: translateY(40px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes pop {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.18); }
  100% { transform: scale(1); }
}
@keyframes pulse {
  0%,100% { opacity: 1; }
  50%     { opacity: 0.4; }
}
`

interface Props {
  contentId:  string
  userId:     string
  progress:   number          // 0–100
  onNext?:    () => void
}

interface ActionBtn {
  id:    string
  icon:  string
  label: string
}

const ACTIONS: ActionBtn[] = [
  { id: 'save',  icon: '🔖', label: 'Save'  },
  { id: 'share', icon: '🔗', label: 'Share' },
  { id: 'next',  icon: '⏭',  label: 'Next'  },
]

const STARS = [1, 2, 3, 4, 5]

export default function VibeActionDock({ contentId, userId, progress, onNext }: Props) {
  const mounted     = useRef(true)
  const [saved,     setSaved]     = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [copied,    setCopied]    = useState(false)
  const [rating,    setRating]    = useState<number | null>(null)
  const [hoveredStar, setHoveredStar] = useState<number | null>(null)
  const [ratingBusy,  setRatingBusy]  = useState(false)
  const [visible,   setVisible]   = useState(false)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  // Show dock when progress >= 80
  useEffect(() => {
    if (progress >= 80 && !visible) setVisible(true)
  }, [progress, visible])

  // Load saved + rating state
  useEffect(() => {
    if (!visible) return
    async function load() {
      const [saveRes, rateRes] = await Promise.all([
        supabase.from('vibelearn_saved').select('id').eq('content_id', contentId).eq('user_id', userId).maybeSingle(),
        supabase.from('vibelearn_ratings').select('stars').eq('content_id', contentId).eq('user_id', userId).maybeSingle(),
      ])
      if (!mounted.current) return
      setSaved(!!saveRes.data)
      setRating(rateRes.data?.stars ?? null)
    }
    load()
  }, [visible, contentId, userId])

  async function handleSave() {
    if (saving) return
    setSaving(true)
    const next = !saved
    setSaved(next)
    try {
      if (next) {
        await supabase.from('vibelearn_saved').insert({ content_id: contentId, user_id: userId })
      } else {
        await supabase.from('vibelearn_saved').delete().eq('content_id', contentId).eq('user_id', userId)
      }
    } catch {
      if (mounted.current) setSaved(!next)
    } finally {
      if (mounted.current) setSaving(false)
    }
  }

  async function handleShare() {
    const url = `${window.location.origin}/global/read/${contentId}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => { if (mounted.current) setCopied(false) }, 2000)
    } catch {
      // fallback silent fail
    }
  }

  async function handleRate(stars: number) {
    if (ratingBusy) return
    setRatingBusy(true)
    setRating(stars)
    try {
      await supabase.from('vibelearn_ratings').upsert(
        { content_id: contentId, user_id: userId, stars },
        { onConflict: 'content_id,user_id' }
      )
    } catch {
      // silent — optimistic kept
    } finally {
      if (mounted.current) setRatingBusy(false)
    }
  }

  function handleAction(id: string) {
    if (id === 'save')  handleSave()
    if (id === 'share') handleShare()
    if (id === 'next')  onNext?.()
  }

  if (!visible) return null

  return (
    <>
      <style>{ANIM}</style>
      <div style={{
        position: 'fixed', bottom: 80, left: 16, right: 16, zIndex: 100,
        animation: 'slideUp 0.4s cubic-bezier(0.22,1,0.36,1)',
      }}>
        <div style={{
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 24,
          padding: '18px 20px',
          boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
        }}>

          {/* Header */}
          <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 16, textAlign: 'center' }}>
            ✦ Vibe Pass Unlocked
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            {ACTIONS.map(a => {
              const isActive = a.id === 'save' ? saved : a.id === 'share' ? copied : false
              return (
                <button
                  key={a.id}
                  onClick={() => handleAction(a.id)}
                  style={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    padding: '12px 8px', borderRadius: 16, border: `1px solid ${isActive ? 'rgba(204,255,0,0.3)' : BORDER}`,
                    background: isActive ? 'rgba(204,255,0,0.08)' : 'rgba(255,255,255,0.04)',
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all 0.2s',
                    animation: isActive ? 'pop 0.3s ease' : 'none',
                  }}
                >
                  <span style={{ fontSize: 22 }}>
                    {a.id === 'save'  ? (saved   ? '🔖' : '📌') :
                     a.id === 'share' ? (copied  ? '✓'  : '🔗') :
                     a.icon}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: isActive ? ACCENT : MUTED }}>
                    {a.id === 'save'  ? (saved  ? 'Saved'  : 'Save')  :
                     a.id === 'share' ? (copied ? 'Copied' : 'Share') :
                     a.label}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Star rating */}
          <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 16 }}>
            <div style={{ fontSize: 11, color: MUTED, fontWeight: 600, textAlign: 'center', marginBottom: 10 }}>
              Rate this content
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
              {STARS.map(s => {
                const filled = (hoveredStar ?? rating ?? 0) >= s
                return (
                  <button
                    key={s}
                    onClick={() => handleRate(s)}
                    onMouseEnter={() => setHoveredStar(s)}
                    onMouseLeave={() => setHoveredStar(null)}
                    disabled={ratingBusy}
                    style={{
                      fontSize: 28, background: 'none', border: 'none',
                      cursor: ratingBusy ? 'not-allowed' : 'pointer',
                      color: filled ? ACCENT : 'rgba(255,255,255,0.15)',
                      transition: 'all 0.15s',
                      animation: ratingBusy && filled ? 'pulse 0.6s infinite' : 'none',
                      padding: 0, lineHeight: 1,
                    }}
                  >
                    ★
                  </button>
                )
              })}
            </div>
            {rating && (
              <div style={{ fontSize: 11, color: ACCENT, fontWeight: 700, textAlign: 'center', marginTop: 8 }}>
                {rating === 5 ? 'Outstanding! 🔥' :
                 rating === 4 ? 'Great content 👍' :
                 rating === 3 ? 'Decent 👌' :
                 rating === 2 ? 'Could be better' :
                 'Needs improvement'}
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  )
}
