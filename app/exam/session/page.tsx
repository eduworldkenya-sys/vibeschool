'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ExamSession } from '@/lib/types'
import ProgressBar from '@/components/exam/ProgressBar'
import QuestionCard from '@/components/exam/QuestionCard'
import AnswerOption from '@/components/exam/AnswerOption'

export default function ExamSessionPage() {
  const router                    = useRouter()
  const [session, setSession]     = useState<ExamSession | null>(null)
  const [loading, setLoading]     = useState(true)
  const [answered, setAnswered]   = useState(false)
  const startRef                  = useRef<number>(Date.now())

  useEffect(() => {
    const raw = window.sessionStorage.getItem('vibe_exam_session')
    if (!raw) { router.replace('/exam'); return }
    try {
      setSession(JSON.parse(raw))
    } catch {
      router.replace('/exam')
      return
    }
    setLoading(false)
    startRef.current = Date.now()
  }, [router])

  // FIX 1 — route to results inside effect, never during render
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

  const runningScore = session.answers.filter((a) => a.isCorrect).length

  const handleSelect = (optionIndex: number) => {
    if (answered) return
    setAnswered(true)

    const timeSpentSeconds = Math.max(1, Math.round((Date.now() - startRef.current) / 1000))
    const isCorrect        = optionIndex === currentQuestion.correctIndex

    const newAnswer = {
      questionId:       currentQuestion.id,
      selectedIndex:    optionIndex,
      isCorrect,
      timeSpentSeconds,
    }

    const updatedSession = {
      ...session,
      answers: [...session.answers, newAnswer],
    }

    window.sessionStorage.setItem('vibe_exam_feedback', JSON.stringify({
      question:      currentQuestion,
      selectedIndex: optionIndex,
      sessionState:  updatedSession,
    }))

    router.push('/exam/feedback')
  }

  return (
    <div className="min-h-screen bg-[#05050F] text-white p-4 font-[family:var(--font-display)] flex flex-col items-center">
      <div className="w-full max-w-xl flex flex-col gap-5 pt-4">

        <div className="flex justify-between items-center">
          <span className="text-xs font-extrabold uppercase tracking-widest text-[#C8A84B]">
            {session.subject} · {session.topic}
          </span>
          <span className="bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-full text-xs font-bold text-emerald-400">
            {runningScore} / {session.totalQuestions}
          </span>
        </div>

        <ProgressBar current={currentIndex + 1} total={session.totalQuestions} />

        <QuestionCard
          question={currentQuestion}
          questionNumber={currentIndex + 1}
          total={session.totalQuestions}
        />

        <div className="flex flex-col gap-3">
          {currentQuestion.options.map((option, idx) => (
            <AnswerOption
              key={idx}
              label={option}
              index={idx}
              onSelect={handleSelect}
              disabled={answered}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
