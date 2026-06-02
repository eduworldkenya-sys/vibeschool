"use client";

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const GAMES = [
  { id: 'quiz',     icon: '🧠', name: 'Quiz Blitz',    subject: 'Maths',     desc: '10 questions · 15s each',    color: '#4f46e5', difficulty: 3 },
  { id: 'flash',    icon: '🃏', name: 'Flashcards',    subject: 'English',   desc: 'Flip & master terms',         color: '#0891b2', difficulty: 1 },
  { id: 'math',     icon: '🔢', name: 'Math Sprint',   subject: 'Maths',     desc: '60s speed arithmetic',        color: '#059669', difficulty: 2 },
  { id: 'scramble', icon: '🔤', name: 'Word Scramble', subject: 'Kiswahili', desc: 'Unscramble the word',         color: '#d97706', difficulty: 2 },
  { id: 'memory',   icon: '🧩', name: 'Memory Match',  subject: 'Science',   desc: 'Match terms & defs',          color: '#7c3aed', difficulty: 2 },
  { id: 'spelling', icon: '🔊', name: 'Spelling Bee',  subject: 'English',   desc: 'Spell it right',              color: '#db2777', difficulty: 3 },
  { id: 'trivia',   icon: '⚡', name: 'Trivia',        subject: 'All',       desc: 'Pick subject & difficulty',   color: '#f59e0b', difficulty: 2 },
  { id: 'balloon',  icon: '🎈', name: 'Pop Balloon',   subject: 'All',       desc: 'Pop the right answer!',       color: '#3b82f6', difficulty: 2 },
]

const FILTERS = ['All', 'Maths', 'English', 'Kiswahili', 'Science']

export default function FunHubPage() {
  const router = useRouter()
  const [filter, setFilter] = useState('All')
  const [pressing, setPressing] = useState<string | null>(null)

  const visible = filter === 'All' ? GAMES : GAMES.filter(g => g.subject === filter || g.subject === 'All')

  return (
    <div style={{ animation: 'slideIn 0.22s ease' }}>
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #4f46e5 100%)',
        borderRadius: 20, padding: '16px 16px 20px', marginBottom: 16, color: '#fff',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -20, right: -20, fontSize: 80, opacity: 0.08 }}>🎮</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>FUNHUB</div>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 4 }}>Play. Learn. Win. 🔥</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>8 games · CBC aligned · Compete with your class</div>
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 5 }}>
            <span>⚡ Level 3</span><span>420 / 600 XP</span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 99, height: 7 }}>
            <div style={{ width: '70%', height: '100%', borderRadius: 99, background: 'linear-gradient(90deg, #10b981, #34d399)', boxShadow: '0 0 8px rgba(16,185,129,0.6)' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
          {[{ v: '🔥 5', l: 'Day Streak' }, { v: '👑 #3', l: 'Class Rank' }, { v: '⚡ 420', l: 'Total XP' }].map(s => (
            <div key={s.l} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>{s.v}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

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

      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', marginBottom: 12 }}>🏆 Class Leaderboard</div>
        {[
          { rank: 1, name: 'Amina K.', xp: 820, you: false },
          { rank: 2, name: 'Brian O.', xp: 640, you: false },
          { rank: 3, name: 'You',      xp: 420, you: true  },
        ].map(p => (
          <div key={p.rank} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
            borderRadius: 10, marginBottom: 4,
            background: p.you ? '#ede9fe' : 'transparent',
            border: p.you ? '1.5px solid #a78bfa' : '1px solid transparent',
          }}>
            <div style={{ fontSize: 16, width: 24, textAlign: 'center' }}>
              {p.rank === 1 ? '👑' : p.rank === 2 ? '🥈' : '🥉'}
            </div>
            <div style={{ flex: 1, fontSize: 13, fontWeight: p.you ? 800 : 600, color: '#111827' }}>{p.name}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed' }}>⚡ {p.xp}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
