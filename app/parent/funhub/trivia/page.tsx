"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { saveFunHubSession } from '@/lib/useFunHubSession'

type Subject = 'Mathematics' | 'English' | 'Science' | 'Social Studies' | 'Kiswahili'
type Difficulty = 'Easy' | 'Medium' | 'Hard'
type GamePhase = 'setup' | 'playing' | 'result'

interface TriviaQuestion {
  id: string
  subject: Subject
  difficulty: Difficulty
  strand: string | null
  question: string
  options: string[]
  answer_index: number
}

const SUBJECTS: Subject[] = ['Mathematics', 'English', 'Science', 'Social Studies', 'Kiswahili']
const DIFFICULTIES: Difficulty[] = ['Easy', 'Medium', 'Hard']
const QUESTIONS_PER_GAME = 10
const SECONDS_PER_QUESTION = 20

const BG = '#faf5ff'
const ACCENT = '#7c3aed'
const ACCENT_LIGHT = '#ede9fe'
const CARD = '#ffffff'
const TEXT = '#1f2937'
const MUTED = '#6b7280'

const SUBJECT_COLORS: Record<Subject, string> = {
  Mathematics: '#3b82f6',
  English: '#8b5cf6',
  Science: '#10b981',
  'Social Studies': '#f97316',
  Kiswahili: '#e11d48',
}

const SUBJECT_ICONS: Record<Subject, string> = {
  Mathematics: '📐',
  English: '📖',
  Science: '🔬',
  'Social Studies': '🌍',
  Kiswahili: '🗣️',
}

const DIFFICULTY_POINTS: Record<Difficulty, number> = {
  Easy: 10, Medium: 20, Hard: 30,
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const CACHE_KEY = 'vibeschool_trivia_cache'
const CACHE_TTL = 1000 * 60 * 60 * 24

function getCached(subject: Subject, difficulty: Difficulty): TriviaQuestion[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cache = JSON.parse(raw)
    const entry = cache[`${subject}_${difficulty}`]
    if (!entry || Date.now() - entry.timestamp > CACHE_TTL) return null
    return entry.data
  } catch { return null }
}

function setCache(subject: Subject, difficulty: Difficulty, data: TriviaQuestion[]) {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    const cache = raw ? JSON.parse(raw) : {}
    cache[`${subject}_${difficulty}`] = { data, timestamp: Date.now() }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {}
}

export default function TriviaPage() {
  const router = useRouter()

  const [phase, setPhase] = useState<GamePhase>('setup')
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null)
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | null>(null)
  const [questions, setQuestions] = useState<TriviaQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [isAnswered, setIsAnswered] = useState(false)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [timer, setTimer] = useState(SECONDS_PER_QUESTION)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (phase !== 'playing' || isAnswered) return
    if (timer === 0) { handleAnswer(-1); return }
    const id = setTimeout(() => setTimer(t => t - 1), 1000)
    return () => clearTimeout(id)
  }, [timer, phase, isAnswered])

  const fetchQuestions = useCallback(async (subject: Subject, difficulty: Difficulty) => {
    setLoading(true)
    setError(null)
    const cached = getCached(subject, difficulty)
    if (cached && cached.length >= QUESTIONS_PER_GAME) {
      setQuestions(shuffle(cached).slice(0, QUESTIONS_PER_GAME))
      setLoading(false)
      return
    }
    try {
      const subjectMap: Record<Subject, string> = {
        Mathematics: 'maths',
        English: 'english',
        Science: 'science',
        'Social Studies': 'social_studies',
        Kiswahili: 'kiswahili',
      }
      const diffMap: Record<Difficulty, string> = {
        Easy: 'easy', Medium: 'medium', Hard: 'hard',
      }
      const { data, error: sbError } = await supabase
        .from('funhub_questions')
        .select('*')
        .eq('subject', subjectMap[subject])
        .eq('difficulty', diffMap[difficulty])
      if (sbError) throw sbError
      if (!data || data.length === 0) throw new Error('No questions found')
      const parsed: TriviaQuestion[] = data.map((row, idx) => ({
        id: row.id ?? String(idx),
        subject,
        difficulty,
        strand: row.strand ?? null,
        question: row.question_text,
        options: Array.isArray(row.options)
          ? row.options.filter((option): option is string => typeof option === "string")
          : typeof row.options === "string"
            ? JSON.parse(row.options)
            : [],
        answer_index: Number(row.correct) ?? 0,
      }))
      setCache(subject, difficulty, parsed)
      setQuestions(shuffle(parsed).slice(0, QUESTIONS_PER_GAME))
    } catch (err) {
      setError("Could not load questions. Check your connection.")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  const startGame = async () => {
    if (!selectedSubject || !selectedDifficulty) return
    await fetchQuestions(selectedSubject, selectedDifficulty)
    setPhase('playing')
    setCurrentIndex(0)
    setScore(0)
    setStreak(0)
    setBestStreak(0)
    setCorrectCount(0)
    setSelectedAnswer(null)
    setIsAnswered(false)
    setTimer(SECONDS_PER_QUESTION)
  }

  const handleAnswer = useCallback((index: number) => {
    if (isAnswered || phase !== 'playing') return
    const current = questions[currentIndex]
    const isCorrect = index === current.answer_index
    setSelectedAnswer(index)
    setIsAnswered(true)
    if (isCorrect) {
      const pts = DIFFICULTY_POINTS[selectedDifficulty!] + (timer > 10 ? 5 : 0)
      setScore(s => s + pts)
      setStreak(s => { const n = s + 1; setBestStreak(b => Math.max(b, n)); return n })
      setCorrectCount(c => c + 1)
    } else {
      setStreak(0)
    }
    setTimeout(async () => {
      if (currentIndex + 1 >= questions.length) {
        const finalXp = score + (isCorrect ? (DIFFICULTY_POINTS[selectedDifficulty!] + (timer > 10 ? 5 : 0)) : 0)
        await saveFunHubSession({
          game_slug:  'trivia',
          subject:    selectedSubject ?? 'General',
          grade:      1,
          score:      finalXp,
          xp_earned:  finalXp,
          correct:    isCorrect ? correctCount + 1 : correctCount,
          total:      QUESTIONS_PER_GAME,
        }).catch(() => {})
        setPhase('result')
      }
      else {
        setCurrentIndex(i => i + 1)
        setSelectedAnswer(null)
        setIsAnswered(false)
        setTimer(SECONDS_PER_QUESTION)
      }
    }, 1500)
  }, [isAnswered, phase, questions, currentIndex, selectedDifficulty, timer])

  const reset = () => {
    setPhase('setup')
    setSelectedSubject(null)
    setSelectedDifficulty(null)
    setQuestions([])
    setCurrentIndex(0)
    setScore(0)
    setStreak(0)
    setBestStreak(0)
    setCorrectCount(0)
    setSelectedAnswer(null)
    setIsAnswered(false)
    setTimer(SECONDS_PER_QUESTION)
    setError(null)
  }

  const current = questions[currentIndex]
  const percentage = Math.round((correctCount / QUESTIONS_PER_GAME) * 100)

  // ── SETUP ──────────────────────────────────────────────────────────────────
  if (phase === 'setup') return (
    <div style={{ minHeight: '100vh', background: BG, padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button onClick={() => router.back()} style={{ background: ACCENT_LIGHT, border: 'none', color: ACCENT, borderRadius: 10, padding: '8px 12px', cursor: 'pointer', fontSize: 16, fontFamily: 'inherit' }}>←</button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: TEXT }}>⚡ Trivia</div>
          <div style={{ fontSize: 11, color: MUTED }}>CBC Challenge · Pick & Play</div>
        </div>
      </div>

      <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, letterSpacing: 2, marginBottom: 12 }}>PICK A SUBJECT</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 28 }}>
        {SUBJECTS.map(s => (
          <div key={s} onClick={() => setSelectedSubject(s)} style={{
            background: selectedSubject === s ? SUBJECT_COLORS[s] : CARD,
            borderRadius: 16, padding: '16px 12px', cursor: 'pointer',
            border: selectedSubject === s ? `2px solid ${SUBJECT_COLORS[s]}` : '2px solid #e5e7eb',
            transform: selectedSubject === s ? 'scale(1.02)' : 'scale(1)',
            transition: 'all 0.15s ease',
            boxShadow: selectedSubject === s ? `0 4px 16px ${SUBJECT_COLORS[s]}33` : '0 1px 4px rgba(0,0,0,0.06)',
          }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{SUBJECT_ICONS[s]}</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: selectedSubject === s ? '#fff' : TEXT }}>{s}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, letterSpacing: 2, marginBottom: 12 }}>PICK DIFFICULTY</div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 32 }}>
        {DIFFICULTIES.map(d => {
          const dc = d === 'Easy' ? '#10b981' : d === 'Medium' ? '#f59e0b' : '#ef4444'
          const active = selectedDifficulty === d
          return (
            <div key={d} onClick={() => setSelectedDifficulty(d)} style={{
              flex: 1, padding: '12px 0', borderRadius: 12, textAlign: 'center', cursor: 'pointer',
              border: active ? `2px solid ${dc}` : '2px solid #e5e7eb',
              background: active ? `${dc}18` : CARD,
              color: active ? dc : MUTED,
              fontWeight: 800, fontSize: 13, transition: 'all 0.15s ease',
              fontFamily: 'inherit',
            }}>
              {d}
              <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2 }}>+{DIFFICULTY_POINTS[d]}pts</div>
            </div>
          )
        })}
      </div>

      {error && <div style={{ color: '#ef4444', fontSize: 13, textAlign: 'center', marginBottom: 16 }}>{error}</div>}

      <div onClick={(!selectedSubject || !selectedDifficulty || loading) ? undefined : startGame} style={{
        background: selectedSubject && selectedDifficulty && !loading ? ACCENT : '#e5e7eb',
        color: selectedSubject && selectedDifficulty && !loading ? '#fff' : MUTED,
        borderRadius: 16, padding: '16px 0', textAlign: 'center',
        fontWeight: 900, fontSize: 15, cursor: selectedSubject && selectedDifficulty ? 'pointer' : 'not-allowed',
        transition: 'all 0.15s ease',
        boxShadow: selectedSubject && selectedDifficulty ? `0 4px 16px ${ACCENT}44` : 'none',
      }}>
        {loading ? '⏳ Loading...' : '⚡ Start Trivia'}
      </div>
    </div>
  )

  // ── PLAYING ────────────────────────────────────────────────────────────────
  if (phase === 'playing' && current) {
    const timerPct = (timer / SECONDS_PER_QUESTION) * 100
    const timerColor = timer > 10 ? '#10b981' : timer > 5 ? '#f59e0b' : '#ef4444'
    return (
      <div style={{ minHeight: '100vh', background: BG, padding: '24px 16px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: MUTED }}>{currentIndex + 1}/{questions.length}</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>{score}pts</span>
          <span style={{ fontSize: 13, color: '#f97316' }}>🔥 {streak}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: timer <= 5 ? '#ef4444' : TEXT }}>{timer}s</span>
        </div>

        <div style={{ background: '#e5e7eb', borderRadius: 99, height: 6, marginBottom: 16, overflow: 'hidden' }}>
          <div style={{ width: `${timerPct}%`, height: '100%', borderRadius: 99, background: timerColor, transition: 'width 1s linear, background 0.3s' }} />
        </div>

        <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 16 }}>
          {questions.map((_, i) => (
            <div key={i} style={{ height: 4, borderRadius: 99, background: i < currentIndex ? '#10b981' : i === currentIndex ? ACCENT : '#e5e7eb', width: i === currentIndex ? 20 : 8, transition: 'all 0.3s' }} />
          ))}
        </div>

        {current.strand && (
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 10, padding: '4px 10px', borderRadius: 99, background: ACCENT_LIGHT, color: ACCENT, fontWeight: 700 }}>{current.strand}</span>
          </div>
        )}

        <div style={{ background: CARD, borderRadius: 20, padding: 20, marginBottom: 20, flex: 1, display: 'flex', alignItems: 'center', boxShadow: '0 2px 12px rgba(124,58,237,0.08)', border: `1px solid ${ACCENT_LIGHT}` }}>
          <p style={{ fontSize: 17, fontWeight: 700, color: TEXT, lineHeight: 1.5, margin: 0 }}>{current.question}</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {current.options.map((opt, i) => {
            let bg = CARD, border = '#e5e7eb', color = TEXT
            if (isAnswered) {
              if (i === current.answer_index) { bg = '#f0fdf4'; border = '#10b981'; color = '#16a34a' }
              else if (i === selectedAnswer) { bg = '#fef2f2'; border = '#ef4444'; color = '#dc2626' }
              else { color = MUTED }
            }
            return (
              <div key={i} onClick={() => handleAnswer(i)} style={{
                background: bg, border: `2px solid ${border}`, borderRadius: 14,
                padding: '14px 16px', cursor: isAnswered ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 12,
                color, fontSize: 14, fontWeight: 600,
                transition: 'all 0.2s ease',
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              }}>
                <span style={{ width: 26, height: 26, borderRadius: '50%', border: `1.5px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0, background: isAnswered && i === current.answer_index ? '#10b981' : isAnswered && i === selectedAnswer ? '#ef4444' : ACCENT_LIGHT, color: isAnswered && (i === current.answer_index || i === selectedAnswer) ? '#fff' : ACCENT }}>
                  {String.fromCharCode(65 + i)}
                </span>
                {opt}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── RESULT ─────────────────────────────────────────────────────────────────
  if (phase === 'result') {
    const grade = percentage >= 80 ? { label: 'Excellent!', color: '#10b981', emoji: '🏆' }
      : percentage >= 60 ? { label: 'Good Job!', color: '#f59e0b', emoji: '⭐' }
      : { label: 'Keep Trying!', color: '#ef4444', emoji: '💪' }
    return (
      <div style={{ minHeight: '100vh', background: BG, padding: '40px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>{grade.emoji}</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: grade.color, marginBottom: 4 }}>{grade.label}</div>
        <div style={{ fontSize: 12, color: MUTED, marginBottom: 32 }}>{selectedSubject} · {selectedDifficulty}</div>

        <div style={{ width: '100%', background: CARD, borderRadius: 20, padding: 20, marginBottom: 20, border: '1px solid #e5e7eb', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, textAlign: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 900, color: ACCENT }}>{score}</div>
              <div style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>Points</div>
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#10b981' }}>{correctCount}/{QUESTIONS_PER_GAME}</div>
              <div style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>Correct</div>
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#f97316' }}>{bestStreak}</div>
              <div style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>Best Streak</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: MUTED, marginBottom: 6 }}>
            <span>Accuracy</span><span>{percentage}%</span>
          </div>
          <div style={{ background: '#e5e7eb', borderRadius: 99, height: 8, overflow: 'hidden' }}>
            <div style={{ width: `${percentage}%`, height: '100%', borderRadius: 99, background: grade.color, transition: 'width 0.8s ease' }} />
          </div>
        </div>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div onClick={startGame} style={{ background: ACCENT, color: '#fff', borderRadius: 16, padding: '16px 0', textAlign: 'center', fontWeight: 900, fontSize: 15, cursor: 'pointer', boxShadow: `0 4px 16px ${ACCENT}44` }}>
            🔄 Play Again
          </div>
          <div onClick={reset} style={{ background: CARD, color: TEXT, borderRadius: 16, padding: '16px 0', textAlign: 'center', fontWeight: 700, fontSize: 14, cursor: 'pointer', border: '1px solid #e5e7eb' }}>
            📚 Change Subject
          </div>
          <div onClick={() => router.back()} style={{ color: MUTED, padding: '12px 0', textAlign: 'center', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            ← Back to FunHub
          </div>
        </div>
      </div>
    )
  }

  return null
}
