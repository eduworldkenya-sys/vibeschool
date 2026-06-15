"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { ExamSession } from "@/lib/types"
import ProgressBar from "@/components/exam/ProgressBar"
import QuestionCard from "@/components/exam/QuestionCard"
import AnswerOption from "@/components/exam/AnswerOption"

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
  return `${m}:${s.toString().padStart(2, "0")}`
}

export default function ExamSessionPage() {
  const router = useRouter()
  const [session,     setSession]     = useState<ExamSession | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [showHint,    setShowHint]    = useState(false)
  const [elapsed,     setElapsed]     = useState(0)
  const startRef = useRef<number>(Date.now())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const raw = window.localStorage.getItem("vibe_active_exam_session")
    if (!raw) { router.replace("/exam"); return }
    try {
      const parsed = JSON.parse(raw) as ExamSession
      setSession(parsed)
    } catch {
      router.replace("/exam")
      return
    }
    setLoading(false)
    startRef.current = Date.now()
    timerRef.current = setInterval(() => setElapsed((p) => p + 1), 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [router])

  useEffect(() => {
    if (session && session.answers.length >= session.totalQuestions) {
      router.replace("/exam/results")
    }
  }, [session, router])

  if (loading || !session) {
    return (
      <div style={{ minHeight: "100vh", background: "#05050F", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div style={{ width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", gap: 12 }}>
          {[80, 120, 56, 56].map((h, i) => (
            <div key={i} style={{ height: h, borderRadius: 12, background: "#18181b" }} />
          ))}
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
    const nextStreak = isCorrect ? (session.currentStreak ?? 0) + 1 : 0

    const updatedSession: ExamSession = {
      ...session,
      answers:       [...session.answers, { questionId: currentQuestion.id, selectedIndex: optionIndex, isCorrect, timeSpentSeconds: timeSpent }],
      currentStreak: nextStreak,
    }

    window.localStorage.setItem("vibe_active_exam_session", JSON.stringify(updatedSession))
    window.sessionStorage.setItem("vibe_exam_feedback", JSON.stringify({
      question:      currentQuestion,
      selectedIndex: optionIndex,
      sessionState:  updatedSession,
    }))

    setTimeout(() => router.push("/exam/feedback"), 320)
  }

  return (
    <div style={{ minHeight: "100vh", background: "#05050F", color: "#ffffff", padding: 16, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: "100%", maxWidth: 560, display: "flex", flexDirection: "column", gap: 20, paddingTop: 16 }}>

        {/* Header bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(24,24,27,0.4)", border: "1px solid #27272a", padding: "10px 14px", borderRadius: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#71717a", fontSize: 12, fontWeight: 700 }}>
            <IconClock />
            <span>{formatTime(elapsed)}</span>
          </div>
          {(session.currentStreak ?? 0) >= 2 && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#fb923c", fontWeight: 900, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <IconFlame />
              <span>{session.currentStreak} in a row!</span>
            </div>
          )}
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: "#C8A84B", textTransform: "uppercase" }}>
            {session.subject}
          </span>
        </div>

        <ProgressBar current={currentIndex + 1} total={session.totalQuestions} />

        <QuestionCard question={currentQuestion} questionNumber={currentIndex + 1} total={session.totalQuestions} />

        {currentQuestion.hint && (
          <div>
            <button
              type="button"
              onClick={() => setShowHint((p) => !p)}
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#71717a", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              <IconHint />
              <span>{showHint ? "Hide Hint" : "Show Hint"}</span>
            </button>
            {showHint && (
              <div style={{ marginTop: 8, padding: 12, background: "rgba(24,24,27,0.6)", border: "1px solid #27272a", color: "#d4d4d8", fontSize: 12, borderRadius: 12, lineHeight: 1.6 }}>
                {currentQuestion.hint}
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {currentQuestion.options.map((option, idx) => (
            <div
              key={idx}
              style={{ borderRadius: 12, outline: selectedIdx === idx ? "2px solid #C8A84B" : "none", outlineOffset: 2 }}
            >
              <AnswerOption label={option} index={idx} onSelect={handleSelect} disabled={selectedIdx !== null} />
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
