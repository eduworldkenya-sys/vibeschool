"use client";
'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const ACCENT = '#CCFF00'
const MUTED  = 'rgba(255,255,255,0.4)'
const CARD   = '#1a2235'
const RED    = '#ff4d4d'
const GREEN  = '#10b981'
const ORANGE = '#f59e0b'

interface Stats {
  total:         number
  ebooks:        number
  epages:        number
  points:        number
  level:         number
  levelName:     string
  nextLevel:     number
  streak:        number
  longestStreak: number
}

interface CompletedRow {
  content_id:        string
  vibelearn_content: { type: string } | { type: string }[] | null
}

const LEVELS = [
  { min: 0,    name: 'Fresh Vibe'   },
  { min: 50,   name: 'Vibe Curious'   },
  { min: 150,  name: 'Vibe Learner'    },
  { min: 300,  name: 'Vibe Scholar'    },
  { min: 600,  name: 'Vibe Achiever'   },
  { min: 1000, name: 'Vibe Master'     },
  { min: 2000, name: 'Vibe Legend'     },
]

function getLevel(points: number): { level: number; levelName: string; nextLevel: number } {
  let level = 0
  let levelName = LEVELS[0].name
  let nextLevel = LEVELS[1].min
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (points >= LEVELS[i].min) {
      level = i
      levelName = LEVELS[i].name
      nextLevel = i < LEVELS.length - 1 ? LEVELS[i + 1].min : LEVELS[i].min
      break
    }
  }
  return { level, levelName, nextLevel }
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

async function resolveCanonicalStudentId(): Promise<string> {
  const { data, error } = await supabase.rpc('current_student_id')
  if (error) throw error
  if (typeof data !== 'string' || !data) throw new Error('Canonical learner identity is unavailable.')
  return data
}

export default function VibeProgress() {
  const [stats, setStats]     = useState<Stats>({
    total: 0, ebooks: 0, epages: 0,
    points: 0, level: 0, levelName: 'Fresh Vibe',
    nextLevel: 50, streak: 0, longestStreak: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const studentId = await resolveCanonicalStudentId()

      const [completedRes, pointsRes, streakRes] = await Promise.all([
        supabase
          .from('vibelearn_completed')
          .select('content_id, vibelearn_content(type)')
          .eq('student_id', studentId),
        supabase
          .from('vibelearn_points')
          .select('points')
          .eq('student_id', studentId),
        supabase
          .from('vibelearn_streaks')
          .select('current_streak, longest_streak')
          .eq('student_id', studentId)
          .maybeSingle(),
      ])

      if (completedRes.error) throw completedRes.error
      if (pointsRes.error) throw pointsRes.error
      if (streakRes.error) throw streakRes.error

      const next: Stats = {
        total: 0, ebooks: 0, epages: 0,
        points: 0, level: 0, levelName: 'Fresh Vibe',
        nextLevel: 50, streak: 0, longestStreak: 0,
      }

      if (completedRes.data) {
        next.total = completedRes.data.length
        ;(completedRes.data as CompletedRow[]).forEach(row => {
          const vc = row.vibelearn_content
          const type = Array.isArray(vc) ? vc[0]?.type : vc?.type
          if (type === 'ebook') next.ebooks++
          else if (type === 'epage') next.epages++
        })
      }

      if (pointsRes.data) {
        next.points = pointsRes.data.reduce((sum: number, r: { points: number }) => sum + r.points, 0)
      }

      const levelData = getLevel(next.points)
      next.level     = levelData.level
      next.levelName = levelData.levelName
      next.nextLevel = levelData.nextLevel

      if (streakRes.data) {
        next.streak        = streakRes.data.current_streak ?? 0
        next.longestStreak = streakRes.data.longest_streak ?? 0
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
      <Skeleton h={160} radius={16} />
    </div>
  )

  if (error) return (
    <div style={{ background: CARD, borderRadius: 16, padding: '16px', fontSize: 12, color: RED }}>
      ⚠️ {error}
    </div>
  )

  const progressPct = stats.nextLevel > 0
    ? Math.min(100, Math.round((stats.points / stats.nextLevel) * 100))
    : 100

  return (
    <div style={{ background: CARD, borderRadius: 16, padding: '20px', marginBottom: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, color: MUTED, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
            Level {stats.level}
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT }}>
            {stats.levelName}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: ORANGE }}>
            🔥 {stats.streak}
          </div>
          <div style={{ fontSize: 10, color: MUTED }}>Vibe Streak</div>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: MUTED }}>{stats.points} Vibe pts</span>
          <span style={{ fontSize: 11, color: MUTED }}>{stats.nextLevel} Vibe pts</span>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 999, height: 6, overflow: 'hidden' }}>
          <div style={{
            width: `${progressPct}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${ACCENT}, #88ff00)`,
            borderRadius: 999,
            transition: 'width 600ms ease',
          }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 0 }}>
        {([
          { label: 'Vibed Out', val: stats.total,         color: ACCENT  },
          { label: 'Ebooks',    val: stats.ebooks,        color: ACCENT  },
          { label: 'Epages',    val: stats.epages,        color: GREEN   },
          { label: 'Best Streak',      val: stats.longestStreak, color: ORANGE  },
        ] as const).map((s, i) => (
          <div key={s.label} style={{
            flex: 1, textAlign: 'center',
            borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
            padding: '0 4px',
          }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 9, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}