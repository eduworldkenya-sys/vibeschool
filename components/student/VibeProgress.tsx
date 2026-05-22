'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const ACCENT = '#CCFF00'
const MUTED  = 'rgba(255,255,255,0.4)'
const CARD   = '#1a2235'
const RED    = '#ff4d4d'

interface Stats {
  total:  number
  ebooks: number
  epages: number
}

interface CompletedRow {
  content_id:        string
  vibelearn_content: { type: string } | { type: string }[] | null
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

export default function VibeProgress() {
  const [stats, setStats]   = useState<Stats>({ total: 0, ebooks: 0, epages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setStats({ total: 0, ebooks: 0, epages: 0 })
        setLoading(false)
        return
      }

      const { data, error: err } = await supabase
        .from('vibelearn_completed')
        .select('content_id, vibelearn_content(type)')
        .eq('student_id', user.id)

      if (err) throw err

      const next: Stats = { total: 0, ebooks: 0, epages: 0 }

      if (data) {
        next.total = data.length
        ;(data as CompletedRow[]).forEach(row => {
          const vc = row.vibelearn_content
          const type = Array.isArray(vc) ? vc[0]?.type : vc?.type
          if (type === 'ebook') next.ebooks++
          else if (type === 'epage') next.epages++
        })
      }

      setStats(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load progress')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  if (loading) return (
    <div style={{ padding: '4px 0' }}>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <Skeleton h={88} radius={16} />
    </div>
  )

  if (error) return (
    <div style={{
      background: CARD, borderRadius: 16, padding: '20px',
      fontSize: 12, color: RED,
    }}>
      ⚠️ {error}
    </div>
  )

  return (
    <div style={{ background: CARD, borderRadius: 16, padding: '20px' }}>
      <div style={{
        fontSize: 11, color: MUTED, fontWeight: 700,
        letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 16,
      }}>
        🎓 Learning Progress
      </div>
      <div style={{ display: 'flex', gap: 20 }}>
        {([
          { label: 'Total',  val: stats.total  },
          { label: 'Ebooks', val: stats.ebooks },
          { label: 'Epages', val: stats.epages },
        ] as const).map(s => (
          <div key={s.label}>
            <div style={{ fontSize: 24, fontWeight: 800, color: ACCENT }}>{s.val}</div>
            <div style={{ fontSize: 11, color: MUTED }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
