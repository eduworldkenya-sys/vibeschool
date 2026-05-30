'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const CARD   = '#1a2235'
const ACCENT = '#CCFF00'
const MUTED  = 'rgba(255,255,255,0.4)'
const TEXT   = '#ffffff'
const RED    = '#ff4d4d'
const GOLD   = '#f59e0b'
const SILVER = '#9ca3af'
const BRONZE = '#b45309'

interface LeaderRow {
  id:           string
  full_name:    string
  total_points: number
  completions:  number
}

function Skeleton({ h = 56, radius = 12 }: { h?: number; radius?: number }) {
  return (
    <div style={{
      height: h, borderRadius: radius,
      background: 'linear-gradient(90deg,#1a2235 25%,#243044 50%,#1a2235 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

const MEDAL = ['🥇', '🥈', '🥉']
const MEDAL_COLOR = [GOLD, SILVER, BRONZE]

export default function VibeLeaderboard() {
  const [rows, setRows]       = useState<LeaderRow[]>([])
  const [myId, setMyId]       = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setMyId(user.id)

      const { data, error: err } = await supabase
        .from('vibelearn_leaderboard')
        .select('id, full_name, total_points, completions')

      if (err) throw err
      setRows((data ?? []) as LeaderRow[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load leaderboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return (
    <div style={{ padding: '16px' }}>
      {[1,2,3,4,5].map(i => (
        <div key={i} style={{ marginBottom: 10 }}><Skeleton h={64} /></div>
      ))}
    </div>
  )

  if (error) return (
    <div style={{ padding: '16px', background: CARD, borderRadius: 16, fontSize: 12, color: RED }}>
      ⚠️ {error}
    </div>
  )

  if (rows.length === 0) return (
    <div style={{ textAlign: 'center', padding: '60px 24px' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🏆</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: TEXT, marginBottom: 8 }}>No Vibes Yet</div>
      <div style={{ fontSize: 13, color: MUTED }}>Drop vibes and complete content to appear on the Vibe Board.</div>
    </div>
  )

  return (
    <div style={{ padding: '16px' }}>
      <div style={{
        fontSize: 11, color: MUTED, fontWeight: 700,
        letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 16,
      }}>
        ✦ Vibe Board
      </div>
      {rows.map((row, i) => {
        const isMe    = row.id === myId
        const isMedal = i < 3
        return (
          <div key={row.id} style={{
            background: isMe ? 'rgba(204,255,0,0.06)' : CARD,
            border: isMe
              ? '1px solid rgba(204,255,0,0.3)'
              : '1px solid rgba(255,255,255,0.06)',
            borderRadius: 14, padding: '14px 16px',
            marginBottom: 10,
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 999, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isMedal ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.03)',
              fontSize: isMedal ? 18 : 13,
              fontWeight: 800,
              color: isMedal ? MEDAL_COLOR[i] : MUTED,
            }}>
              {isMedal ? MEDAL[i] : i + 1}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 700,
                color: isMe ? ACCENT : TEXT,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {row.full_name ?? 'Anonymous'}{isMe ? ' (You)' : ''}
              </div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                {row.completions} vibes out
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: ACCENT }}>
                {row.total_points}
              </div>
              <div style={{ fontSize: 9, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                Vibe pts
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
