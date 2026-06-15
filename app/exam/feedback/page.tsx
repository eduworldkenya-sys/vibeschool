'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExamQuestion, ExamSession } from '@/lib/types'
import FeedbackCard from '@/components/exam/FeedbackCard'

function IconFlag() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  )
}
function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

interface FeedbackPayload {
  question:      ExamQuestion
  selectedIndex: number
  sessionState:  ExamSession
}

export default function ExamFeedbackPage() {
  const router = useRouter()
  const [data,        setData]        = useState<FeedbackPayload | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [flagged,     setFlagged]     = useState(false)
  const [contested,   setContested]   = useState(false)
  const [contestText, setContestText] = useState('')

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
  const isCorrect     = selectedIndex === question.correctIndex
  const correctAnswer = question.options[question.correctIndex]
  const isLast        = sessionState.answers.length === sessionState.totalQuestions

  const submitFlag = async (type: 'error' | 'contest', reason?: string) => {
    try {
      await fetch('/api/exam/flag', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ questionId: question.id, type, reason }),
      })
    } catch { /* silent */ }
  }

  const handleFlag = () => {
    if (flagged) return
    setFlagged(true)
    submitFlag('error', 'Student flagged question error')
  }

  const handleContest = () => {
    if (!contestText.trim() || contested) return
    setContested(true)
    submitFlag('contest', contestText)
  }

  const handleNext = () => {
    window.sessionStorage.removeItem('vibe_exam_feedback')
    router.push(isLast ? '/exam/results' : '/exam/session')
  }

  return (
    <div className="min-h-screen bg-[#05050F] text-white p-4 font-[family:var(--font-display)] flex flex-col items-center justify-center">
      <div className="w-full max-w-xl space-y-5">

        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-[#C8A84B]">
            {isCorrect ? 'Boom! Solid logic! 🎉' : "Don't sweat it — next one is yours! 🎯"}
          </p>
        </div>

        <FeedbackCard
          isCorrect={isCorrect}
          explanation={question.explanation}
          teachingNote={question.teachingNote}
          correctAnswer={correctAnswer}
        />

        {/* Validation desk */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
              Validation Desk
            </span>
            <button
              type="button"
              onClick={handleFlag}
              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded transition-colors ${
                flagged ? 'text-amber-500' : 'text-zinc-400 hover:text-amber-500'
              }`}
            >
              <IconFlag />
              <span>{flagged ? 'Reported' : 'Report Error'}</span>
            </button>
          </div>

          {!contested ? (
            <div className="space-y-2">
              <p className="text-[11px] text-zinc-400 leading-normal">
                Think another answer is also correct? Explain why:
              </p>
              <div className="flex gap-2">
                <textarea
                  value={contestText}
                  onChange={(e) => setContestText(e.target.value)}
                  placeholder="e.g. Option B is also valid because..."
                  rows={2}
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-700 placeholder-zinc-600 resize-none"
                />
                <button
                  type="button"
                  onClick={handleContest}
                  className="px-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs rounded-lg transition-colors self-end pb-2 pt-2"
                >
                  Contest
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-zinc-900/60 p-2 rounded-lg border border-zinc-800">
              <IconCheck />
              <span>Contest recorded. Our team will review your note.</span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleNext}
          className="w-full h-14 bg-[#C8A84B] hover:bg-[#b0923e] text-[#05050F] font-black rounded-xl text-base tracking-wide transition-all shadow-lg active:scale-[0.99]"
        >
          {isLast ? 'View Results' : 'Next Question'}
        </button>

      </div>
    </div>
  )
}
