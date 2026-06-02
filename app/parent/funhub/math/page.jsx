"use client";
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

const COLOR = '#059669'
const TOTAL_TIME = 60

function generate(level) {
  const ops = level <= 2 ? ['+', '-'] : level === 3 ? ['+', '-', '×'] : ['+', '-', '×', '÷']
  const op = ops[Math.floor(Math.random() * ops.length)]
  let a, b, answer

  if (op === '+') {
    a = Math.floor(Math.random() * (10 * level)) + 1
    b = Math.floor(Math.random() * (10 * level)) + 1
    answer = a + b
  } else if (op === '-') {
    a = Math.floor(Math.random() * (10 * level)) + 10
    b = Math.floor(Math.random() * a) + 1
    answer = a - b
  } else if (op === '×') {
    a = Math.floor(Math.random() * 12) + 1
    b = Math.floor(Math.random() * 12) + 1
    answer = a * b
  } else {
    b = Math.floor(Math.random() * 11) + 1
    answer = Math.floor(Math.random() * 11) + 1
    a = b * answer
  }

  return { a, b, op, answer }
}

// ── SCREENS ──────────────────────────────────────────────
function Lobby({ onStart }) {
  const [grade, setGrade] = useState(4)
  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        {/* Card */}
        <div style={{ background: '#fff', borderRadius: 24, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.10)', marginBottom: 24 }}>
          <div style={{ background: 'linear-gradient(135deg, #059669, #10b981)', padding: '32px 0 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 64 }}>🔢</div>
            <div style={{ color: '#fff', fontSize: 22, fontWeight: 900, marginTop: 8 }}>Math Sprint</div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 }}>60 seconds · beat the clock</div>
          </div>
          <div style={{ padding: 24 }}>
            {[
              { icon: '⏱️', text: '60 seconds on the clock' },
              { icon: '🔥', text: 'Streak multiplier — stay sharp' },
              { icon: '⚡', text: 'Earn XP for every correct answer' },
            ].map(r => (
              <div key={r.text} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <span style={{ fontSize: 20 }}>{r.icon}</span>
                <span style={{ fontSize: 14, color: '#374151', fontWeight: 600 }}>{r.text}</span>
              </div>
            ))}

            {/* Grade picker */}
            <div style={{ marginTop: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 8 }}>SELECT GRADE</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[1,2,3,4,5,6,7,8,9].map(g => (
                  <button key={g} onClick={() => setGrade(g)} style={{
                    width: 40, height: 40, borderRadius: 10, border: 'none',
                    background: grade === g ? COLOR : '#f3f4f6',
                    color: grade === g ? '#fff' : '#374151',
                    fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
                  }}>{g}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <button onClick={() => onStart(grade)} style={{
          width: '100%', padding: '16px 0', borderRadius: 16, border: 'none',
          background: 'linear-gradient(135deg, #059669, #10b981)',
          color: '#fff', fontSize: 17, fontWeight: 900, cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(5,150,105,0.4)', fontFamily: 'inherit',
          letterSpacing: 0.5,
        }}>
          START SPRINT 🚀
        </button>
      </div>
    </div>
  )
}

function GameOver({ score, correct, total, streak, xp, grade, onReplay, onHome }) {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0
  const stars = pct >= 90 ? 3 : pct >= 60 ? 2 : 1
  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ background: '#fff', borderRadius: 24, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.10)', marginBottom: 20 }}>
          <div style={{ background: 'linear-gradient(135deg, #059669, #10b981)', padding: '28px 0 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 4 }}>
              {'⭐'.repeat(stars)}{'🌑'.repeat(3 - stars)}
            </div>
            <div style={{ color: '#fff', fontSize: 28, fontWeight: 900 }}>{score}</div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>FINAL SCORE</div>
          </div>
          <div style={{ padding: 20 }}>
            {[
              { label: 'Correct', value: `${correct} / ${total}` },
              { label: 'Accuracy', value: `${pct}%` },
              { label: 'Best Streak', value: `🔥 ${streak}` },
              { label: 'XP Earned', value: `⚡ +${xp}` },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ fontSize: 14, color: '#6b7280', fontWeight: 600 }}>{s.label}</span>
                <span style={{ fontSize: 14, color: '#111827', fontWeight: 800 }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        <button onClick={onReplay} style={{
          width: '100%', padding: '15px 0', borderRadius: 16, border: 'none',
          background: 'linear-gradient(135deg, #059669, #10b981)',
          color: '#fff', fontSize: 16, fontWeight: 900, cursor: 'pointer',
          marginBottom: 12, fontFamily: 'inherit',
          boxShadow: '0 4px 16px rgba(5,150,105,0.35)',
        }}>🔄 PLAY AGAIN</button>

        <button onClick={onHome} style={{
          width: '100%', padding: '15px 0', borderRadius: 16, border: '2px solid #e5e7eb',
          background: '#fff', color: '#374151', fontSize: 16, fontWeight: 800,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>← Back to FunHub</button>
      </div>
    </div>
  )
}

// ── MAIN GAME ─────────────────────────────────────────────
export default function MathSprint() {
  const router = useRouter()
  const [screen, setScreen] = useState('lobby') // lobby | game | gameover
  const [grade, setGrade] = useState(4)
  const [q, setQ] = useState(null)
  const [input, setInput] = useState('')
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME)
  const [score, setScore] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [total, setTotal] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [shake, setShake] = useState(false)
  const [flash, setFlash] = useState(null) // 'correct' | 'wrong'
  const inputRef = useRef(null)
  const timerRef = useRef(null)

  const xpEarned = Math.floor(score / 2) + bestStreak * 5

  const nextQ = useCallback((g) => {
    setQ(generate(Math.ceil((g || grade) / 3)))
    setInput('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [grade])

  const startGame = (g) => {
    setGrade(g)
    setScore(0); setCorrect(0); setTotal(0)
    setStreak(0); setBestStreak(0)
    setTimeLeft(TOTAL_TIME)
    nextQ(g)
    setScreen('game')
  }

  // Timer
  useEffect(() => {
    if (screen !== 'game') return
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); setScreen('gameover'); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [screen])

  const submit = () => {
    if (!input.trim() || !q) return
    const guess = parseInt(input, 10)
    setTotal(t => t + 1)

    if (guess === q.answer) {
      const newStreak = streak + 1
      const multiplier = 1 + Math.floor(newStreak / 3) * 0.5
      const pts = Math.round(10 * multiplier)
      setStreak(newStreak)
      setBestStreak(b => Math.max(b, newStreak))
      setCorrect(c => c + 1)
      setScore(s => s + pts)
      setFlash('correct')
      setTimeout(() => setFlash(null), 300)
    } else {
      setStreak(0)
      setShake(true)
      setFlash('wrong')
      setTimeout(() => { setShake(false); setFlash(null) }, 400)
    }
    nextQ()
  }

  const handleKey = (e) => {
    if (e.key === 'Enter') submit()
  }

  if (screen === 'lobby') return <Lobby onStart={startGame} />
  if (screen === 'gameover') return (
    <GameOver
      score={score} correct={correct} total={total}
      streak={bestStreak} xp={xpEarned} grade={grade}
      onReplay={() => startGame(grade)}
      onHome={() => router.push('/parent/funhub')}
    />
  )

  const timerPct = (timeLeft / TOTAL_TIME) * 100
  const timerColor = timeLeft > 20 ? '#10b981' : timeLeft > 10 ? '#f59e0b' : '#ef4444'
  const multiplier = 1 + Math.floor(streak / 3) * 0.5

  return (
    <div style={{
      minHeight: '100vh', background: '#f9fafb',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '24px 20px',
    }}>
      <div style={{ width: '100%', maxWidth: 360 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <button onClick={() => { clearInterval(timerRef.current); router.push('/parent/funhub') }} style={{
            background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', padding: 4,
          }}>←</button>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>Math Sprint</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed' }}>⚡ {score}</div>
        </div>

        {/* Timer bar */}
        <div style={{ background: '#e5e7eb', borderRadius: 99, height: 8, marginBottom: 6, overflow: 'hidden' }}>
          <div style={{
            width: `${timerPct}%`, height: '100%', borderRadius: 99,
            background: timerColor,
            transition: 'width 1s linear, background 0.3s',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', marginBottom: 20 }}>
          <span style={{ fontWeight: 700, color: timerColor, fontSize: 13 }}>{timeLeft}s</span>
          {streak >= 3 && <span style={{ fontWeight: 800, color: '#f59e0b' }}>🔥 {streak} streak · {multiplier}×</span>}
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          {[
            { label: 'Score', value: score },
            { label: 'Correct', value: correct },
            { label: 'Streak', value: `🔥${streak}` },
          ].map(s => (
            <div key={s.label} style={{
              flex: 1, background: '#fff', borderRadius: 12, padding: '10px 8px',
              textAlign: 'center', border: '1px solid #e5e7eb',
            }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#111827' }}>{s.value}</div>
              <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Question card */}
        {q && (
          <div style={{
            background: flash === 'correct' ? '#d1fae5' : flash === 'wrong' ? '#fee2e2' : '#fff',
            borderRadius: 24, padding: '36px 24px 28px', textAlign: 'center',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)', marginBottom: 20,
            border: `2px solid ${flash === 'correct' ? '#10b981' : flash === 'wrong' ? '#ef4444' : '#e5e7eb'}`,
            transition: 'background 0.2s, border 0.2s',
            transform: shake ? 'translateX(0)' : 'none',
            animation: shake ? 'shake 0.4s ease' : 'none',
          }}>
            <div style={{ fontSize: 42, fontWeight: 900, color: '#111827', letterSpacing: -1 }}>
              {q.a} {q.op} {q.b} = ?
            </div>
            {flash === 'correct' && <div style={{ fontSize: 28, marginTop: 8 }}>✅</div>}
            {flash === 'wrong' && <div style={{ fontSize: 14, color: '#ef4444', marginTop: 8, fontWeight: 700 }}>Answer: {q.answer}</div>}
          </div>
        )}

        {/* Input */}
        <input
          ref={inputRef}
          type="number"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Your answer..."
          style={{
            width: '100%', padding: '16px 20px', borderRadius: 16, fontSize: 22,
            fontWeight: 800, textAlign: 'center', border: '2px solid #e5e7eb',
            outline: 'none', fontFamily: 'inherit', background: '#fff',
            boxSizing: 'border-box', marginBottom: 12,
            WebkitAppearance: 'none', MozAppearance: 'textfield',
          }}
          autoComplete="off"
        />

        <button onClick={submit} style={{
          width: '100%', padding: '15px 0', borderRadius: 16, border: 'none',
          background: 'linear-gradient(135deg, #059669, #10b981)',
          color: '#fff', fontSize: 17, fontWeight: 900, cursor: 'pointer',
          fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(5,150,105,0.35)',
        }}>
          SUBMIT ✓
        </button>

        {/* Numeric pad for mobile */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 16 }}>
          {['1','2','3','4','5','6','7','8','9','-','0','⌫'].map(k => (
            <button key={k} onClick={() => {
              if (k === '⌫') setInput(i => i.slice(0, -1))
              else if (k === '-') setInput(i => i === '' ? '-' : i)
              else setInput(i => i + k)
            }} style={{
              padding: '16px 0', borderRadius: 12, border: '1px solid #e5e7eb',
              background: '#fff', fontSize: 18, fontWeight: 800, cursor: 'pointer',
              fontFamily: 'inherit', color: '#111827',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}>{k}</button>
          ))}
        </div>

      </div>

      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-8px)}
          40%{transform:translateX(8px)}
          60%{transform:translateX(-6px)}
          80%{transform:translateX(6px)}
        }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }
      `}</style>
    </div>
  )
}
