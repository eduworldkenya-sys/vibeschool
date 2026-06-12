"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const GAMES = [
  { id: 'quiz',       icon: '🧠', name: 'Quiz Blitz',    subject: 'Maths',     desc: '10 questions · 15s each',    color: '#4f46e5', difficulty: 3 },
  { id: 'flash',      icon: '🃏', name: 'Flashcards',    subject: 'English',   desc: 'Flip & master terms',        color: '#0891b2', difficulty: 1 },
  { id: 'math',       icon: '🔢', name: 'Math Sprint',   subject: 'Maths',     desc: '60s speed arithmetic',      color: '#059669', difficulty: 2 },
  { id: 'scramble',   icon: '🔤', name: 'Word Scramble', subject: 'Kiswahili', desc: 'Unscramble the word',       color: '#d97706', difficulty: 2 },
  { id: 'memory',     icon: '🧩', name: 'Memory Match',  subject: 'Science',   desc: 'Match terms & defs',        color: '#7c3aed', difficulty: 2 },
  { id: 'spelling',   icon: '🔊', name: 'Spelling Bee',  subject: 'English',   desc: 'Spell it right',            color: '#db2777', difficulty: 3 },
  { id: 'trivia',     icon: '⚡', name: 'Trivia',        subject: 'All',       desc: 'Pick subject & difficulty', color: '#f59e0b', difficulty: 2 },
  { id: 'balloon',    icon: '🎈', name: 'Pop Balloon',   subject: 'All',       desc: 'Pop the right answer!',    color: '#3b82f6', difficulty: 2 },
]

const FILTERS = ['All', 'Maths', 'English', 'Kiswahili', 'Science']

const LEVEL_NAMES = ['', 'Starter', 'Explorer', 'Scholar', 'Champion', 'Legend', 'Master', 'Elite']

export default function FunHubPage() {
  const router = useRouter()
  const [filter, setFilter] = useState('All')
  const [pressing, setPressing] = useState<string | null>(null)
  const [xpData, setXpData] = useState<{ total_xp: number; level: number; weekly_xp: number } | null>(null)
  const [streak, setStreak] = useState(0)
  const [leaderboard, setLeaderboard] = useState<{ display_name: string; total_xp: number; school_rank: number }[]>([])
  const [myRank, setMyRank] = useState<number | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get student id
      const { data: student } = await supabase
        .from('students').select('id').eq('profile_id', user.id).single()
      if (!student) return

      // XP wallet
      const { data: xp } = await supabase
        .from('funhub_xp')
        .select('total_xp, level, weekly_xp')
        .eq('student_id', student.id)
        .single()
      if (xp) setXpData(xp)

      // Best streak across all subjects
      const { data: streaks } = await supabase
        .from('funhub_streaks')
        .select('current_count')
        .eq('student_id', student.id)
        .order('current_count', { ascending: false })
        .limit(1)
      if (streaks && streaks.length > 0) setStreak(streaks[0].current_count)

      // School leaderboard — get school_id from profiles
      const { data: profile } = await supabase
        .from('profiles').select('school_id').eq('id', user.id).single()
      if (profile?.school_id) {
        const { data: lb } = await supabase
          .from('funhub_leaderboard_school')
          .select('display_name, total_xp, school_rank')
          .eq('school_id', profile.school_id)
          .order('school_rank', { ascending: true })
          .limit(10)
        if (lb) {
          setLeaderboard(lb)
        }
      }
    }
    load()
  }, [])

  const level = xpData?.level ?? 1
  const totalXp = xpData?.total_xp ?? 0
  const weeklyXp = xpData?.weekly_xp ?? 0

  // XP thresholds matching the RPC function
  const XP_THRESHOLDS = [0, 100, 300, 600, 1000, 2000, 5000, Infinity]
  const levelStart = XP_THRESHOLDS[level - 1] ?? 0
  const levelEnd   = XP_THRESHOLDS[level] ?? 5000
  const xpInLevel  = totalXp - levelStart
  const xpNeeded   = levelEnd - levelStart
  const xpPct      = Math.min(100, Math.round((xpInLevel / xpNeeded) * 100))

  const visible = filter === 'All' ? GAMES : GAMES.filter(g => g.subject === filter || g.subject === 'All')

  return (
    <div style={{ animation: 'slideIn 0.22s ease' }}>
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #4f46e5 100%)',
        borderRadius: 20, padding: '16px 16px 20px', marginBottom: 16, color: '#fff',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -20, right: -20, fontSize: 80, opacity: 0.08 }}>🎮</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>FUNHUB</div>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 4 }}>Play. Learn. Win. 🔥</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>8 games · CBC aligned · Compete with your school</div>
        {/* XP bar */}
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 5 }}>
            <span>⚡ Level {level} — {LEVEL_NAMES[level] ?? ''}</span>
            <span>{xpInLevel} / {xpNeeded} XP</span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 99, height: 7 }}>
            <div style={{ width: `${xpPct}%`, height: '100%', borderRadius: 99, background: 'linear-gradient(90deg, #10b981, #34d399)', boxShadow: '0 0 8px rgba(16,185,129,0.6)', transition: 'width 0.6s ease' }} />
          </div>
        </div>
        {/* Stats */}
        <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
          {[
            { v: `🔥 ${streak}`, l: 'Day Streak' },
            { v: `⚡ ${weeklyXp}`, l: 'This Week' },
            { v: `💎 ${totalXp}`, l: 'Total XP' },
          ].map(s => (
            <div key={s.l} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>{s.v}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 14, scrollbarWidth: 'none' }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            flexShrink: 0, padding: '7px 16px', borderRadius: 99,
            border: filter === f ? 'none' : '1.5px solid #e5e7eb',
            background: filter === f ? '#1e1b4b' : '#fff',
            color: filter === f ? '#fff' : '#6b7280',
            fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
            transition: 'all 0.15s ease',
          }}>
            {f}
          </button>
        ))}
      </div>

      {/* Game grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        {visible.map(g => (
          <div
            key={g.id}
            onMouseDown={() => setPressing(g.id)}
            onMouseUp={() => setPressing(null)}
            onTouchStart={() => setPressing(g.id)}
            onTouchEnd={() => setPressing(null)}
            onClick={() => router.push('/parent/funhub/' + g.id)}
            style={{
              background: '#fff', borderRadius: 16, overflow: 'hidden',
              border: '1px solid #e5e7eb', cursor: 'pointer',
              transform: pressing === g.id ? 'scale(0.96)' : 'scale(1)',
              transition: 'transform 0.12s ease',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}
          >
            <div style={{ background: g.color, padding: '18px 0', textAlign: 'center', fontSize: 32 }}>{g.icon}</div>
            <div style={{ padding: '10px 12px 12px' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', marginBottom: 2 }}>{g.name}</div>
              <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 8 }}>{g.desc}</div>
              <div style={{ display: 'flex', gap: 3, marginBottom: 8 }}>
                {[1,2,3].map(d => (
                  <div key={d} style={{ width: 6, height: 6, borderRadius: '50%', background: d <= g.difficulty ? g.color : '#e5e7eb' }} />
                ))}
              </div>
              <div style={{ background: g.color, color: '#fff', borderRadius: 8, padding: '6px 0', textAlign: 'center', fontSize: 11, fontWeight: 800 }}>
                PLAY →
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* School Leaderboard */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', marginBottom: 12 }}>🏆 School Leaderboard</div>
        {leaderboard.length === 0 ? (
          <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: '12px 0' }}>No data yet — play a game!</div>
        ) : (
          leaderboard.slice(0, 5).map((p, idx) => (
            <div key={idx} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
              borderRadius: 10, marginBottom: 4,
              background: 'transparent',
              border: '1px solid transparent',
            }}>
              <div style={{ fontSize: 16, width: 24, textAlign: 'center' }}>
                {p.school_rank === 1 ? '👑' : p.school_rank === 2 ? '🥈' : p.school_rank === 3 ? '🥉' : `#${p.school_rank}`}
              </div>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#111827' }}>{p.display_name}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed' }}>⚡ {p.total_xp}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
