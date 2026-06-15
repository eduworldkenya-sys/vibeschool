"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ExamForm, ExamSubject, ExamDifficulty } from '@/lib/types'
import { EXAM_DATA } from '@/lib/examData'
import { getStudentStreak } from '@/lib/examTracker'
import SubjectPicker from '@/components/exam/SubjectPicker'
import TopicPicker from '@/components/exam/TopicPicker'

function IconFlame() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M12 2C12 2 8 6 8 10a4 4 0 008 0c0-1.5-.5-2.5-.5-2.5S17 10 17 13a5 5 0 01-10 0C7 9 12 2 12 2z" />
    </svg>
  )
}

const DIFFICULTY_NOTES = {
  easy:   'Foundational rules, direct calculations, base formulas.',
  medium: 'Standard KCSE structures with core conceptual steps.',
  hard:   'Advanced problems, multi-step proofs, common exam traps.',
}

export default function ExamLandingPage() {
  const router = useRouter()
  const [subject,    setSubject]    = useState<ExamSubject>('Mathematics')
  const [form,       setForm]       = useState<ExamForm>('Form 1')
  const [topic,      setTopic]      = useState<string>(EXAM_DATA['Form 1'][0])
  const [difficulty, setDifficulty] = useState<ExamDifficulty>('medium')
  const [count,      setCount]      = useState<number>(10)
  const [loading,    setLoading]    = useState<boolean>(false)
  const [error,      setError]      = useState<string | null>(null)
  const [streak,     setStreak]     = useState<number>(0)

  useEffect(() => {
    setStreak(getStudentStreak().currentStreak)
  }, [])

  const handleFormChange = (f: ExamForm) => {
    setForm(f)
    setTopic(EXAM_DATA[f][0])
  }

  const handleStart = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/exam/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ subject, form, topic, difficulty, count }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate questions')

      const session = {
        subject,
        form,
        topic,
        difficulty,
        totalQuestions: data.questions.length,
        questions:      data.questions,
        answers:        [],
        startedAt:      new Date().toISOString(),
        completedAt:    null,
        currentStreak:  0,
      }
      // FIX: write to localStorage so session survives tab switches
      window.localStorage.setItem('vibe_active_exam_session', JSON.stringify(session))
      router.push('/exam/session')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#05050F] text-white flex flex-col items-center justify-center p-6 font-[family:var(--font-display)]">
        <div className="w-full max-w-md space-y-4 text-center">
          <div className="animate-pulse space-y-3">
            <div className="h-8 bg-zinc-800 rounded w-3/4 mx-auto" />
            <div className="h-4 bg-zinc-800 rounded w-1/2 mx-auto" />
            <div className="space-y-2 pt-4">
              <div className="h-14 bg-zinc-800 rounded" />
              <div className="h-14 bg-zinc-800 rounded" />
              <div className="h-14 bg-zinc-800 rounded" />
            </div>
          </div>
          <p className="text-[#C8A84B] text-xs font-bold uppercase tracking-widest pt-4">
            Assembling your KCSE revision set...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#05050F] text-white p-4 font-[family:var(--font-display)] flex flex-col items-center">
      <div className="w-full max-w-xl space-y-6 py-5">

        {/* Header bar */}
        <div className="flex justify-between items-center bg-zinc-900/40 border border-zinc-800 px-4 py-3 rounded-xl">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping inline-block" />
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">KCSE AI Engine</span>
          </div>
          {streak > 0 && (
            <div className="flex items-center gap-1.5 text-[#C8A84B] font-black text-sm">
              <IconFlame />
              <span>{streak} Day Streak</span>
            </div>
          )}
        </div>

        {/* Title */}
        <div className="text-center">
          <h1 className="text-4xl font-black tracking-tight">
            VIBE<span className="text-[#C8A84B]">EXAM</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">Free AI-powered KCSE mock exams</p>
        </div>

        {error && (
          <div className="bg-rose-950/30 border border-rose-900 text-rose-300 p-4 rounded-xl text-xs font-medium">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <p className="text-xs uppercase font-extrabold tracking-wider text-[#C8A84B]">1. Subject</p>
          <SubjectPicker selected={subject} onSelect={setSubject} />
        </div>

        <div className="space-y-1.5">
          <p className="text-xs uppercase font-extrabold tracking-wider text-[#C8A84B]">2. Form Level</p>
          <div className="grid grid-cols-4 gap-2">
            {(['Form 1', 'Form 2', 'Form 3', 'Form 4'] as ExamForm[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => handleFormChange(f)}
                className={`h-12 border rounded-xl font-bold text-xs tracking-wide transition-all ${
                  form === f
                    ? 'bg-[#C8A84B] border-[#C8A84B] text-[#05050F]'
                    : 'bg-zinc-900 border-zinc-800 text-white hover:border-zinc-700'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs uppercase font-extrabold tracking-wider text-[#C8A84B]">3. Topic</p>
          <TopicPicker form={form} selected={topic} onSelect={setTopic} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <p className="text-xs uppercase font-extrabold tracking-wider text-[#C8A84B]">Difficulty</p>
            <div className="flex flex-col gap-1">
              {(['easy', 'medium', 'hard'] as ExamDifficulty[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  className={`h-12 px-3 text-left border rounded-xl capitalize text-xs font-bold transition-all ${
                    difficulty === d
                      ? 'bg-[#C8A84B]/10 border-[#C8A84B] text-[#C8A84B]'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs uppercase font-extrabold tracking-wider text-[#C8A84B]">Questions</p>
            <div className="flex flex-col gap-1">
              {[10, 20, 30].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCount(c)}
                  className={`h-12 px-3 text-left border rounded-xl text-xs font-bold transition-all ${
                    count === c
                      ? 'bg-[#C8A84B]/10 border-[#C8A84B] text-[#C8A84B]'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  {c} Questions
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Difficulty info + data note */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-3 space-y-2 text-zinc-400">
          <p className="text-xs leading-relaxed">
            <span className="font-bold text-zinc-300 capitalize">{difficulty}:</span>{' '}
            {DIFFICULTY_NOTES[difficulty]}
          </p>
          <div className="h-px bg-zinc-900" />
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            <span>Network estimate</span>
            <span className="text-emerald-500">~ 45 KB · Low-data safe</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleStart}
          className="w-full h-14 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-lg tracking-wide transition-all shadow-lg active:scale-[0.99]"
        >
          Start Exam
        </button>

      </div>
    </div>
  )
}
