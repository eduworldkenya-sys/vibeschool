'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExamQuestion, ExamSession } from '@/lib/types'
import FeedbackCard from '@/components/exam/FeedbackCard'

interface FeedbackPayload {
  question:     ExamQuestion
  selectedIndex: number
  sessionState: ExamSession
}

export default function ExamFeedbackPage() {
  const router = useRouter()
  const [data, setData]     = useState<FeedbackPayload | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const raw = window.sessionStorage.getItem('vibe_exam_feedback')
    if (!raw) { router.replace('/exam'); return }
    try {
      setData(JSON.parse(raw))
    } catch {
      router.replace('/exam')
      return
    }
    setLoading(false)
  }, [router])

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-[#05050F] flex items-center justify-center font-[family:var(--font-display)]">
        <div className="animate-pulse h-28 bg-zinc-800 rounded w-full max-w-md mx-4" />
      </div>
    )
  }

  const { question, selectedIndex, sessionState } = data
  const isCorrect      = selectedIndex === question.correctIndex
  const correctAnswer  = question.options[question.correctIndex]
  const isLast         = sessionState.answers.length === sessionState.totalQuestions

  const handleNext = () => {
    window.sessionStorage.setItem('vibe_exam_session', JSON.stringify(sessionState))
    window.sessionStorage.removeItem('vibe_exam_feedback')
    router.push(isLast ? '/exam/results' : '/exam/session')
  }

  return (
    <div className="min-h-screen bg-[#05050F] text-white p-4 font-[family:var(--font-display)] flex flex-col items-center justify-center">
      <div className="w-full max-w-xl space-y-5">
        <FeedbackCard
          isCorrect={isCorrect}
          explanation={question.explanation}
          teachingNote={question.teachingNote}
          correctAnswer={correctAnswer}
        />
        <button
          type="button"
          onClick={handleNext}
          className="w-full h-14 bg-[#C8A84B] hover:bg-[#b0923e] text-[#05050F] font-extrabold rounded-xl text-lg tracking-wide transition-all active:scale-[0.99]"
        >
          {isLast ? 'View Results' : 'Next Question'}
        </button>
      </div>
    </div>
  )
}
