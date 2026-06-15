"use client"

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ExamSession, ExamResult } from '@/lib/types'
import { incrementExamCount, shouldShowRegisterPrompt, getKNECGrade } from '@/lib/examTracker'
import ScoreCard from '@/components/exam/ScoreCard'
import ShareButton from '@/components/exam/ShareButton'

function IconRefresh() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
    </svg>
  )
}
function IconDrill() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}

export default function ExamResultsPage() {
  const router = useRouter()
  const [result,      setResult]      = useState<ExamResult | null>(null)
  const [session,     setSession]     = useState<ExamSession | null>(null)
  const [showPrompt,  setShowPrompt]  = useState(false)
  const [loading,     setLoading]     = useState(true)
  const [drillLoad,   setDrillLoad]   = useState(false)
  // FIX: StrictMode safe guard
  const countedRef = useRef(false)

  useEffect(() => {
    // FIX: read from localStorage — same key session page writes
    const raw = window.localStorage.getItem('vibe_active_exam_session')
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

      // FIX 2a: setLoading inside try
      setLoading(false)

      // FIX 4: StrictMode safe, fires exactly at count === 3
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

  const knec = getKNECGrade(result.percentage)

  const handleDrill = async () => {
    if (result.weakTopics.length === 0) return
    setDrillLoad(true)
    const drillTopic = result.weakTopics[0]
    try {
      const res = await fetch('/api/exam/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          subject:    session.subject,
          form:       session.form,
          topic:      drillTopic,
          difficulty: 'medium',
          count:      5,
        }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()

      const drillSession = {
        subject:        session.subject,
        form:           session.form,
        topic:          drillTopic,
        difficulty:     'medium' as const,
        totalQuestions: data.questions.length,
        questions:      data.questions,
        answers:        [],
        startedAt:      new Date().toISOString(),
        completedAt:    null,
        currentStreak:  0,
      }
      window.localStorage.setItem('vibe_active_exam_session', JSON.stringify(drillSession))
      router.push('/exam/session')
    } catch {
      setDrillLoad(false)
    }
  }

  const handleNewExam = () => {
    window.localStorage.removeItem('vibe_active_exam_session')
    window.sessionStorage.removeItem('vibe_exam_feedback')
    router.push('/exam')
  }

  return (
    <div className="min-h-screen bg-[#05050F] text-white p-4 font-[family:var(--font-display)] flex flex-col items-center">
      <div className="w-full max-w-xl space-y-5 py-5 pb-28">

        <h1 className="text-2xl font-black tracking-tight text-center">
          Performance <span className="text-[#C8A84B]">Summary</span>
        </h1>

        {/* Snapshot card — screenshot-friendly */}
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-start border-b border-zinc-800/80 pb-3">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-[#C8A84B]">VIBEEXAM</span>
              <h2 className="text-lg font-bold text-white">{session.subject}</h2>
              <p className="text-xs text-zinc-400">{session.form} · {session.topic}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">KNEC Grade</span>
              <span className={`text-3xl font-black tracking-tighter ${knec.color}`}>{knec.grade}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-900">
              <span className="text-[9px] uppercase font-bold text-zinc-500 block">Score</span>
              <span className="text-xl font-black text-white">{result.score}/{result.total}</span>
            </div>
            <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-900">
              <span className="text-[9px] uppercase font-bold text-zinc-500 block">Percentage</span>
              <span className="text-xl font-black text-white">{result.percentage}%</span>
            </div>
            <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-900">
              <span className="text-[9px] uppercase font-bold text-zinc-500 block">Difficulty</span>
              <span className="text-xs font-black text-zinc-300 block pt-1.5 capitalize">{session.difficulty}</span>
            </div>
          </div>

          <p className="text-xs font-medium leading-relaxed text-zinc-300 bg-zinc-950/80 border border-zinc-900 p-3 rounded-xl">
            {knec.feedback}
          </p>

          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-center">
            📸 Screenshot this card to share on WhatsApp Status
          </p>
        </div>

        <ScoreCard result={result} />

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block mb-2">Strong</span>
            {result.strongTopics.length > 0
              ? <p className="text-xs text-zinc-300 font-medium">✓ {result.strongTopics.join(', ')}</p>
              : <p className="text-[11px] text-zinc-500">Keep practicing</p>}
          </div>
          <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-400 block mb-2">Review</span>
            {result.weakTopics.length > 0
              ? <p className="text-xs text-zinc-300 font-medium">⚠ {result.weakTopics.join(', ')}</p>
              : <p className="text-[11px] text-emerald-500 font-bold">All correct!</p>}
          </div>
        </div>

        {result.weakTopics.length > 0 && (
          <button
            type="button"
            disabled={drillLoad}
            onClick={handleDrill}
            className="w-full h-14 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-xl text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <IconDrill />
            <span>{drillLoad ? 'Preparing drill...' : `Drill: ${result.weakTopics[0]} (5 Questions)`}</span>
          </button>
        )}

        <ShareButton score={result.score} total={result.total} subject={session.subject} topic={session.topic} />

        <button
          type="button"
          onClick={handleNewExam}
          className="w-full h-12 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2"
        >
          <IconRefresh />
          <span>New Exam</span>
        </button>

      </div>

      {showPrompt && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#05050F] border-t border-[#C8A84B]/40 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 z-50 rounded-t-2xl shadow-2xl">
          <div className="text-center sm:text-left">
            <p className="text-sm font-bold text-white">Save your streak!</p>
            <p className="text-xs text-zinc-400">Create a free account to track progress across sessions.</p>
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
