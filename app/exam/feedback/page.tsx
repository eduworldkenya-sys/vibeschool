"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ExamQuestion, ExamSession } from "@/lib/types"
import FeedbackCard from "@/components/exam/FeedbackCard"

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
  const [contestText, setContestText] = useState("")

  useEffect(() => {
    const raw = window.sessionStorage.getItem("vibe_exam_feedback")
    if (!raw) { router.replace("/exam"); return }
    try {
      setData(JSON.parse(raw))
    } catch {
      router.replace("/exam")
      return
    }
    setLoading(false)
  }, [router])

  if (loading || !data) {
    return (
      <div style={{ minHeight: "100vh", background: "#05050F", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div style={{ height: 112, background: "#18181b", borderRadius: 12, width: "100%", maxWidth: 480 }} />
      </div>
    )
  }

  const { question, selectedIndex, sessionState } = data
  const isCorrect     = selectedIndex === question.correctIndex
  const correctAnswer = question.options[question.correctIndex]
  const isLast        = sessionState.answers.length === sessionState.totalQuestions

  const submitFlag = async (type: "error" | "contest", reason?: string) => {
    try {
      await fetch("/api/exam/flag", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ questionId: question.id, type, reason }),
      })
    } catch { /* silent */ }
  }

  const handleFlag = () => {
    if (flagged) return
    setFlagged(true)
    submitFlag("error", "Student flagged question error")
  }

  const handleContest = () => {
    if (!contestText.trim() || contested) return
    setContested(true)
    submitFlag("contest", contestText)
  }

  const handleNext = () => {
    window.sessionStorage.removeItem("vibe_exam_feedback")
    router.push(isLast ? "/exam/results" : "/exam/session")
  }

  return (
    <div style={{ minHeight: "100vh", background: "#05050F", color: "#ffffff", padding: 16, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 560, display: "flex", flexDirection: "column", gap: 20 }}>

        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C8A84B", margin: 0 }}>
            {isCorrect ? "Boom! Solid logic! 🎉" : "Don't sweat it — next one is yours! 🎯"}
          </p>
        </div>

        <FeedbackCard
          isCorrect={isCorrect}
          explanation={question.explanation}
          teachingNote={question.teachingNote}
          correctAnswer={correctAnswer}
        />

        {/* Validation desk */}
        <div style={{ background: "#09090b", border: "1px solid #18181b", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", color: "#52525b" }}>
              Validation Desk
            </span>
            <button
              type="button"
              onClick={handleFlag}
              style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, padding: "4px 8px", borderRadius: 6, background: "none", border: "none", cursor: flagged ? "default" : "pointer", color: flagged ? "#f59e0b" : "#71717a" }}
            >
              <IconFlag />
              <span>{flagged ? "Reported" : "Report Error"}</span>
            </button>
          </div>

          {!contested ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ fontSize: 11, color: "#71717a", lineHeight: 1.5, margin: 0 }}>
                Think another answer is also correct? Explain why:
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <textarea
                  value={contestText}
                  onChange={(e) => setContestText(e.target.value)}
                  placeholder="e.g. Option B is also valid"
                  rows={2}
                  style={{ flex: 1, background: "#18181b", border: "1px solid #27272a", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#ffffff", outline: "none", resize: "none", fontFamily: "inherit" }}
                />
                <button
                  type="button"
                  onClick={handleContest}
                  style={{ padding: "8px 12px", background: "#27272a", color: "#ffffff", fontWeight: 700, fontSize: 12, borderRadius: 8, border: "none", cursor: "pointer", alignSelf: "flex-end" }}
                >
                  Contest
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#34d399", background: "rgba(24,24,27,0.6)", padding: 10, borderRadius: 8, border: "1px solid #27272a" }}>
              <IconCheck />
              <span>Contest recorded. Our team will review your note.</span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleNext}
          style={{ width: "100%", height: 56, background: "#C8A84B", color: "#05050F", fontWeight: 900, borderRadius: 12, fontSize: 16, letterSpacing: "0.05em", border: "none", cursor: "pointer" }}
        >
          {isLast ? "View Results" : "Next Question"}
        </button>

      </div>
    </div>
  )
}
