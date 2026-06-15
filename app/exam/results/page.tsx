'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ExamSession, ExamResult } from '@/lib/types'
import { incrementExamCount, shouldShowRegisterPrompt } from '@/lib/examTracker'
import ScoreCard from '@/components/exam/ScoreCard'
import ShareButton from '@/components/exam/ShareButton'

export default function ExamResultsPage() {
  const router                          = useRouter()
  const [result, setResult]             = useState<ExamResult | null>(null)
  const [session, setSession]           = useState<ExamSession | null>(null)
  const [showPrompt, setShowPrompt]     = useState(false)
  const [loading, setLoading]           = useState(true)
  const countedRef                      = useRef(false)

  useEffect(() => {
    const raw = window.sessionStorage.getItem('vibe_exam_session')
    if (!raw) { router.replace('/exam'); return }

    try {
      const s: ExamSession = JSON.parse(raw)
      const score      = s.answers.filter((a) => a.isCorrect).length
      const total      = s.totalQuestions
      const percentage = total > 0 ? Math.round((score / total) * 100) : 0

      const weakSet   = new Set<string>()
      const strongSet = new Set<string>()
      s.answers.forEach((ans) => {
        const q = s.questions.find((q) => q.id === ans.questionId)
        if (!q) return
        const t = q.topic || s.topic
        if (ans.isCorrect) strongSet.add(t)
        else weakSet.add(t)
      })

      const weakTopics   = Array.from(weakSet)
      const strongTopics = Array.from(strongSet).filter((t) => !weakSet.has(t))

      setResult({ score, total, percentage, weakTopics, strongTopics, answers: s.answers, questions: s.questions })
      setSession(s)

      // FIX 2a — setLoading inside try, only on success
      setLoading(false)

      // FIX 2b — StrictMode safe, fires exactly at exam 3
      if (!countedRef.current) {
        countedRef.current = true
        incrementExamCount()
        if (shouldShowRegisterPrompt()) setShowPrompt(true)
      }
    } catch {
      router.replace('/exam')
    }
  }, [router])

  if (loading || !result || !session) {
    return (
      <div className="min-h-screen bg-[#05050F] flex items-center justify-center font-[family:var(--font-display)]">
        <div className="animate-pulse h-32 bg-zinc-800 rounded w-full max-w-md mx-4" />
      </div>
    )
  }

  const handleTryAgain = () => {
    window.sessionStorage.removeItem('vibe_exam_session')
    window.sessionStorage.removeItem('vibe_exam_feedback')
    router.push('/exam')
  }

  return (
    <div className="min-h-screen bg-[#05050F] text-white p-4 font-[family:var(--font-display)] flex flex-col items-center">
      <div className="w-full max-w-xl space-y-5 py-6 pb-28">

        <h1 className="text-3xl font-extrabold tracking-tight text-center">
          Performance <span className="text-[#C8A84B]">Summary</span>
        </h1>

        <ScoreCard result={result} />

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-xl">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2">Strong</h3>
            {result.strongTopics.length > 0 ? (
              <ul className="text-sm space-y-1 text-zinc-300">
                {result.strongTopics.map((t, i) => <li key={i}>✓ {t}</li>)}
              </ul>
            ) : (
              <p className="text-xs text-zinc-500">Keep practicing</p>
            )}
          </div>
          <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-xl">
            <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400 mb-2">Review</h3>
            {result.weakTopics.length > 0 ? (
              <ul className="text-sm space-y-1 text-zinc-300">
                {result.weakTopics.map((t, i) => <li key={i}>⚠ {t}</li>)}
              </ul>
            ) : (
              <p className="text-xs text-zinc-500">All correct!</p>
            )}
          </div>
        </div>

        <ShareButton score={result.score} total={result.total} subject={session.subject} topic={session.topic} />

        <button
          type="button"
          onClick={handleTryAgain}
          className="w-full h-14 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-white font-bold rounded-xl transition-all"
        >
          New Exam
        </button>
      </div>

      {showPrompt && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#05050F] border-t border-[#C8A84B]/40 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 z-50 rounded-t-2xl shadow-2xl">
          <div className="text-center sm:text-left">
            <p className="text-sm font-bold text-white">Save your streak!</p>
            <p className="text-xs text-zinc-400">Create a free account to track progress and unlock more subjects.</p>
          </div>
          <button
            type="button"
            onClick={() => router.push('/exam/register')}
            className="h-10 px-5 bg-[#C8A84B] text-[#05050F] font-extrabold text-xs uppercase tracking-wider rounded-lg whitespace-nowrap"
          >
            Create Account
          </button>
        </div>
      )}
    </div>
  )
}
