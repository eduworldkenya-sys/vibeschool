'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ExamSession } from '@/lib/types'
import ProgressBar from '@/components/exam/ProgressBar'
import QuestionCard from '@/components/exam/QuestionCard'
import AnswerOption from '@/components/exam/AnswerOption'

function IconClock() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
    </svg>
  )
}
function IconFlame() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M12 2C6 8 8 12 8 14a4 4 0 008 0c0-2-1-4-1-4s3 2 3 5a5 5 0 01-10 0C8 11 12 2 12 2z" />
    </svg>
  )
}
function IconHint() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><circle cx="12" cy="17" r=".5" fill="currentColor" />
    </svg>
  )
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function ExamSessionPage() {
  const router = useRouter()
  const [session,     setSession]     = useState<ExamSession | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [showHint,    setShowHint]    = useState(false)
  const [elapsed,     setElapsed]     = useState(0)
  const [visible,     setVisible]     = useState(false)
  const startRef = useRef<number>(Date.now())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const raw = window.localStorage.getItem('vibe_active_exam_session')
    if (!raw) { router.replace('/exam'); return }
    try {
      const parsed = JSON.parse(raw) as ExamSession
      setSession(parsed)
      setVisible(true)
    } catch {
      router.replace('/exam')
      return
    }
    setLoading(false)
    startRef.current = Date.now()
    timerRef.current = setInterval(() => setElapsed((p) => p + 1), 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [router])

  // FIX 1: redirect inside useEffect, never during render
  useEffect(() => {
    if (session && session.answers.length >= session.totalQuestions) {
      router.replace('/exam/results')
    }
  }, [session, router])

  if (loading || !session) {
    return (
      <div className="min-h-screen bg-[#05050F] flex items-center justify-center font-[family:var(--font-display)]">
        <div className="animate-pulse space-y-4 w-full max-w-md px-4">
          <div className="h-4 bg-zinc-800 rounded w-full" />
          <div className="h-28 bg-zinc-800 rounded w-full" />
          <div className="h-12 bg-zinc-800 rounded w-full" />
          <div className="h-12 bg-zinc-800 rounded w-full" />
        </div>
      </div>
    )
  }

  const currentIndex    = session.answers.length
  const currentQuestion = session.questions[currentIndex]
  if (!currentQuestion) return null

  const handleSelect = (optionIndex: number) => {
    if (selectedIdx !== null) return
    setSelectedIdx(optionIndex)
    if (timerRef.current) clearInterval(timerRef.current)

    const timeSpent = Math.max(1, Math.round((Date.now() - startRef.current) / 1000))
    const isCorrect = optionIndex === currentQuestion.correctIndex
    const nextStreak = isCorrect ? session.currentStreak + 1 : 0

    const updatedSession: ExamSession = {
      ...session,
      answers:       [...session.answers, { questionId: currentQuestion.id, selectedIndex: optionIndex, isCorrect, timeSpentSeconds: timeSpent }],
      currentStreak: nextStreak,
    }

    window.localStorage.setItem('vibe_active_exam_session', JSON.stringify(updatedSession))
    window.sessionStorage.setItem('vibe_exam_feedback', JSON.stringify({
      question:      currentQuestion,
      selectedIndex: optionIndex,
      sessionState:  updatedSession,
    }))

    setTimeout(() => {
      setVisible(false)
      setTimeout(() => router.push('/exam/feedback'), 180)
    }, 320)
  }

  return (
    <div className="min-h-screen bg-[#05050F] text-white p-4 font-[family:var(--font-display)] flex flex-col items-center">
      <div className={`w-full max-w-xl flex flex-col gap-5 pt-4 transition-all duration-200 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}>

        <div className="flex justify-between items-center bg-zinc-900/40 border border-zinc-800 px-3 py-2.5 rounded-xl">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-bold">
            <IconClock />
            <span>{formatTime(elapsed)}</span>
          </div>
          {session.currentStreak >= 2 && (
            <div className="flex items-center gap-1 text-orange-400 font-black text-xs uppercase tracking-wider">
              <IconFlame />
              <span>{session.currentStreak} in a row!</span>
            </div>
          )}
          <span className="text-[11px] font-extrabold tracking-widest text-[#C8A84B] uppercase">
            {session.subject}
          </span>
        </div>

        <ProgressBar current={currentIndex + 1} total={session.totalQuestions} />

        <QuestionCard
          question={currentQuestion}
          questionNumber={currentIndex + 1}
          total={session.totalQuestions}
        />

        {currentQuestion.hint && (
          <div>
            <button
              type="button"
              onClick={() => setShowHint((p) => !p)}
              className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-[#C8A84B] transition-colors"
            >
              <IconHint />
              <span>{showHint ? 'Hide Hint' : 'Show Hint'}</span>
            </button>
            {showHint && (
              <div className="mt-2 p-3 bg-zinc-900/60 border border-zinc-800 text-zinc-300 text-xs rounded-xl leading-relaxed">
                {currentQuestion.hint}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          {currentQuestion.options.map((option, idx) => (
            <div
              key={idx}
              className={`transition-all duration-150 ${selectedIdx === idx ? 'ring-2 ring-[#C8A84B] rounded-xl scale-[0.997]' : ''}`}
            >
              <AnswerOption
                label={option}
                index={idx}
                onSelect={handleSelect}
                disabled={selectedIdx !== null}
              />
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
