'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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

const SUBJECT_COLORS: Record<Subject, string> = {
  Mathematics: '#3b82f6',
  English: '#8b5cf6',
  Science: '#10b981',
  'Social Studies': '#f97316',
  Kiswahili: '#ef4444',
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
  const supabase = createClient()

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
      const { data, error: sbError } = await supabase
        .from('trivia_questions')
        .select('*')
        .eq('subject', subject)
        .eq('difficulty', difficulty)
        .eq('is_active', true)
      if (sbError) throw sbError
      if (!data || data.length === 0) throw new Error('No questions found')
      const parsed: TriviaQuestion[] = data.map(row => ({
        ...row,
        options: Array.isArray(row.options) ? row.options : JSON.parse(row.options),
      }))
      setCache(subject, difficulty, parsed)
      setQuestions(shuffle(parsed).slice(0, QUESTIONS_PER_GAME))
    } catch (err) {
      setError('Could not load questions. Check your connection.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [supabase])

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
    setTimeout(() => {
      if (currentIndex + 1 >= questions.length) { setPhase('result') }
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

  // SETUP
  if (phase === 'setup') return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#fff', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
        <button onClick={() => router.back()} style={{ background: '#18181b', border: 'none', color: '#fff', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', fontSize: 16 }}>←</button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900 }}>Trivia</div>
          <div style={{ fontSize: 11, color: '#71717a' }}>CBC Challenge · Pick & Play</div>
        </div>
      </div>

      <div style={{ fontSize: 10, fontWeight: 700, color: '#52525b', letterSpacing: 2, marginBottom: 12 }}>PICK A SUBJECT</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 28 }}>
        {SUBJECTS.map(s => (
          <div key={s} onClick={() => setSelectedSubject(s)} style={{
            background: selectedSubject === s ? SUBJECT_COLORS[s] : '#18181b',
            borderRadius: 16, padding: '16px 12px', cursor: 'pointer',
            border: selectedSubject === s ? `2px solid ${SUBJECT_COLORS[s]}` : '2px solid #27272a',
            transform: selectedSubject === s ? 'scale(1.02)' : 'scale(1)',
            transition: 'all 0.15s ease',
          }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{SUBJECT_ICONS[s]}</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>{s}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 10, fontWeight: 700, color: '#52525b', letterSpacing: 2, marginBottom: 12 }}>PICK DIFFICULTY</div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 32 }}>
        {DIFFICULTIES.map(d => {
          const dc = d === 'Easy' ? '#10b981' : d === 'Medium' ? '#f59e0b' : '#ef4444'
          return (
            <div key={d} onClick={() => setSelectedDifficulty(d)} style={{
              flex: 1, padding: '12px 0', borderRadius: 12, textAlign: 'center', cursor: 'pointer',
              border: selectedDifficulty === d ? `2px solid ${dc}` : '2px solid #27272a',
              background: selectedDifficulty === d ? `${dc}22` : '#18181b',
              color: selectedDifficulty === d ? dc : '#71717a',
              fontWeight: 800, fontSize: 13,
              transition: 'all 0.15s ease',
            }}>
              {d}
              <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2 }}>+{DIFFICULTY_POINTS[d]}pts</div>
            </div>
          )
        })}
      </div>

      {error && <div style={{ color: '#f87171', fontSize: 13, textAlign: 'center', marginBottom: 16 }}>{error}</div>}

      <div onClick={(!selectedSubject || !selectedDifficulty || loading) ? undefined : startGame} style={{
        background: selectedSubject && selectedDifficulty && !loading ? '#f59e0b' : '#27272a',
        color: selectedSubject && selectedDifficulty && !loading ? '#000' : '#52525b',
        borderRadius: 16, padding: '16px 0', textAlign: 'center',
        fontWeight: 900, fontSize: 15, cursor: selectedSubject && selectedDifficulty ? 'pointer' : 'not-allowed',
        transition: 'all 0.15s ease',
      }}>
        {loading ? '⏳ Loading...' : '⚡ Start Trivia'}
      </div>
    </div>
  )

  // PLAYING
  if (phase === 'playing' && current) {
    const timerPct = (timer / SECONDS_PER_QUESTION) * 100
    const timerColor = timer > 10 ? '#10b981' : timer > 5 ? '#f59e0b' : '#ef4444'
    return (
      <div style={{ minHeight: '100vh', background: '#000', color: '#fff', padding: '24px 16px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: '#71717a' }}>{currentIndex + 1}/{questions.length}</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#f59e0b' }}>{score}pts</span>
          <span style={{ fontSize: 13, color: '#fb923c' }}>🔥 {streak}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: timer <= 5 ? '#ef4444' : '#d4d4d8' }}>{timer}s</span>
        </div>

        <div style={{ background: '#27272a', borderRadius: 99, height: 6, marginBottom: 20, overflow: 'hidden' }}>
          <div style={{ width: `${timerPct}%`, height: '100%', borderRadius: 99, background: timerColor, transition: 'width 1s linear, background 0.3s' }} />
        </div>

        <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 20 }}>
          {questions.map((_, i) => (
            <div key={i} style={{ height: 4, borderRadius: 99, background: i < currentIndex ? '#10b981' : i === currentIndex ? '#f59e0b' : '#27272a', width: i === currentIndex ? 20 : 8, transition: 'all 0.3s' }} />
          ))}
        </div>

        {current.strand && (
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 10, padding: '4px 10px', borderRadius: 99, background: '#18181b', color: '#71717a', border: '1px solid #27272a' }}>{current.strand}</span>
          </div>
        )}

        <div style={{ background: '#18181b', borderRadius: 20, padding: 20, marginBottom: 20, flex: 1, display: 'flex', alignItems: 'center' }}>
          <p style={{ fontSize: 17, fontWeight: 700, color: '#fff', lineHeight: 1.5, margin: 0 }}>{current.question}</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {current.options.map((opt, i) => {
            let bg = '#18181b', border = '#27272a', color = '#d4d4d8'
            if (isAnswered) {
              if (i === current.answer_index) { bg = '#052e16'; border = '#10b981'; color = '#4ade80' }
              else if (i === selectedAnswer) { bg = '#2d0a0a'; border = '#ef4444'; color = '#f87171' }
              else { color = '#52525b' }
            }
            return (
              <div key={i} onClick={() => handleAnswer(i)} style={{
                background: bg, border: `2px solid ${border}`, borderRadius: 14,
                padding: '14px 16px', cursor: isAnswered ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 12,
                color, fontSize: 14, fontWeight: 600,
                transition: 'all 0.2s ease',
              }}>
                <span style={{ width: 24, height: 24, borderRadius: '50%', border: `1.5px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
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

  // RESULT
  if (phase === 'result') {
    const grade = percentage >= 80 ? { label: 'Excellent!', color: '#10b981', emoji: '🏆' }
      : percentage >= 60 ? { label: 'Good Job!', color: '#f59e0b', emoji: '⭐' }
      : { label: 'Keep Trying!', color: '#ef4444', emoji: '💪' }
    return (
      <div style={{ minHeight: '100vh', background: '#000', color: '#fff', padding: '40px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>{grade.emoji}</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: grade.color, marginBottom: 4 }}>{grade.label}</div>
        <div style={{ fontSize: 12, color: '#71717a', marginBottom: 32 }}>{selectedSubject} · {selectedDifficulty}</div>

        <div style={{ width: '100%', background: '#18181b', borderRadius: 20, padding: 20, marginBottom: 20, border: '1px solid #27272a' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, textAlign: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 900 }}>{score}</div>
              <div style={{ fontSize: 10, color: '#71717a', marginTop: 4 }}>Points</div>
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#10b981' }}>{correctCount}/{QUESTIONS_PER_GAME}</div>
              <div style={{ fontSize: 10, color: '#71717a', marginTop: 4 }}>Correct</div>
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#fb923c' }}>{bestStreak}</div>
              <div style={{ fontSize: 10, color: '#71717a', marginTop: 4 }}>Best Streak</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#71717a', marginBottom: 6 }}>
            <span>Accuracy</span><span>{percentage}%</span>
          </div>
          <div style={{ background: '#27272a', borderRadius: 99, height: 8, overflow: 'hidden' }}>
            <div style={{ width: `${percentage}%`, height: '100%', borderRadius: 99, background: grade.color, transition: 'width 0.8s ease' }} />
          </div>
        </div>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div onClick={startGame} style={{ background: '#f59e0b', color: '#000', borderRadius: 16, padding: '16px 0', textAlign: 'center', fontWeight: 900, fontSize: 15, cursor: 'pointer' }}>
            🔄 Play Again
          </div>
          <div onClick={reset} style={{ background: '#18181b', color: '#d4d4d8', borderRadius: 16, padding: '16px 0', textAlign: 'center', fontWeight: 700, fontSize: 14, cursor: 'pointer', border: '1px solid #27272a' }}>
            📚 Change Subject
          </div>
          <div onClick={() => router.back()} style={{ background: 'transparent', color: '#71717a', borderRadius: 16, padding: '12px 0', textAlign: 'center', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            ← Back to FunHub
          </div>
        </div>
      </div>
    )
  }

  return null
}
