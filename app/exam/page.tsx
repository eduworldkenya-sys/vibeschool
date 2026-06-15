'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExamForm, ExamSubject, ExamDifficulty } from '@/lib/types'
import { EXAM_DATA } from '@/lib/examData'
import SubjectPicker from '@/components/exam/SubjectPicker'
import TopicPicker from '@/components/exam/TopicPicker'

export default function ExamLandingPage() {
  const router = useRouter()
  const [subject,    setSubject]    = useState<ExamSubject>('Mathematics')
  const [form,       setForm]       = useState<ExamForm>('Form 1')
  const [topic,      setTopic]      = useState<string>(EXAM_DATA['Form 1'][0])
  const [difficulty, setDifficulty] = useState<ExamDifficulty>('medium')
  const [count,      setCount]      = useState<number>(10)
  const [loading,    setLoading]    = useState<boolean>(false)
  const [error,      setError]      = useState<string | null>(null)

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
      }
      window.sessionStorage.setItem('vibe_exam_session', JSON.stringify(session))
      router.push('/exam/session')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#05050F] text-white flex flex-col items-center justify-center p-6 font-[family:var(--font-display)]">
        <div className="w-full max-w-md space-y-4 animate-pulse">
          <div className="h-8 bg-zinc-800 rounded w-3/4 mx-auto" />
          <div className="h-4 bg-zinc-800 rounded w-1/2 mx-auto" />
          <div className="space-y-3 pt-6">
            <div className="h-14 bg-zinc-800 rounded" />
            <div className="h-14 bg-zinc-800 rounded" />
            <div className="h-14 bg-zinc-800 rounded" />
          </div>
          <p className="text-center text-[#C8A84B] text-sm font-medium pt-4 tracking-wide">
            Building your KCSE mock via AI...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#05050F] text-white p-4 font-[family:var(--font-display)] flex flex-col items-center">
      <div className="w-full max-w-xl space-y-7 py-6">

        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight">
            VIBE<span className="text-[#C8A84B]">EXAM</span>
          </h1>
          <p className="text-sm text-zinc-400 mt-1">Free AI-powered KCSE mock exams</p>
        </div>

        {error && (
          <div className="bg-red-950/40 border border-red-800 text-red-200 p-4 rounded-xl text-sm">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs uppercase font-bold tracking-wider text-[#C8A84B]">1. Subject</p>
          <SubjectPicker selected={subject} onSelect={setSubject} />
        </div>

        <div className="space-y-2">
          <p className="text-xs uppercase font-bold tracking-wider text-[#C8A84B]">2. Form Level</p>
          <div className="grid grid-cols-4 gap-2">
            {(['Form 1', 'Form 2', 'Form 3', 'Form 4'] as ExamForm[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => handleFormChange(f)}
                className={`h-12 border rounded-xl font-bold text-sm transition-all ${
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

        <div className="space-y-2">
          <p className="text-xs uppercase font-bold tracking-wider text-[#C8A84B]">3. Topic</p>
          <TopicPicker form={form} selected={topic} onSelect={setTopic} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-xs uppercase font-bold tracking-wider text-[#C8A84B]">Difficulty</p>
            <div className="flex flex-col gap-1">
              {(['easy', 'medium', 'hard'] as ExamDifficulty[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  className={`h-12 px-4 text-left border rounded-xl capitalize text-sm font-semibold transition-all ${
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

          <div className="space-y-2">
            <p className="text-xs uppercase font-bold tracking-wider text-[#C8A84B]">Questions</p>
            <div className="flex flex-col gap-1">
              {[10, 20, 30].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCount(c)}
                  className={`h-12 px-4 text-left border rounded-xl text-sm font-semibold transition-all ${
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

        <button
          type="button"
          onClick={handleStart}
          className="w-full h-14 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-lg tracking-wide transition-all shadow-lg active:scale-[0.99]"
        >
          Start Exam
        </button>
      </div>
    </div>
  )
}
