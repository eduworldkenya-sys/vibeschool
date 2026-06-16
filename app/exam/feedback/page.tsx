"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ExamQuestion, ExamSession } from "@/lib/types"

function IconFlag() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
    </svg>
  )
}
function IconCheck() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/>
    </svg>
  )
}
function IconX() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>
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
    const raw = window.localStorage.getItem("vibe_exam_feedback")
    if (!raw) { router.replace("/exam"); return }
    try { setData(JSON.parse(raw)) } catch { router.replace("/exam"); return }
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
  const isLast        = sessionState.answers.length >= sessionState.totalQuestions
  const accent        = isCorrect ? "#34d399" : "#f87171"
  const accentBg      = isCorrect ? "rgba(6,78,59,0.2)" : "rgba(69,10,10,0.2)"
  const accentBorder  = isCorrect ? "#065f46" : "#7f1d1d"

  const submitFlag = async (type: "error" | "contest", reason?: string) => {
    try {
      await fetch("/api/exam/flag", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, type, reason }),
      })
    } catch { /* silent */ }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#05050F", color: "#fff", padding: 16, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: "100%", maxWidth: 560, display: "flex", flexDirection: "column", gap: 16, paddingTop: 16 }}>

        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C8A84B", margin: 0 }}>
            {isCorrect ? "Boom! Solid logic! 🎉" : "Don't sweat it — next one is yours! 🎯"}
          </p>
        </div>

        <div style={{ border: `1px solid ${accentBorder}`, padding: 18, borderRadius: 16, display: "flex", alignItems: "flex-start", gap: 14, background: accentBg }}>
          <div style={{ color: accent, flexShrink: 0, marginTop: 2 }}>
            {isCorrect ? <IconCheck /> : <IconX />}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: accent, margin: 0 }}>{isCorrect ? "Correct!" : "Not quite"}</h2>
            {!isCorrect && (
              <p style={{ fontSize: 13, fontWeight: 600, color: "#d4d4d8", margin: 0 }}>
                Correct Answer: <span style={{ color: "#34d399" }}>{correctAnswer}</span>
              </p>
            )}
            <p style={{ fontSize: 13, color: "#d4d4d8", lineHeight: 1.6, margin: 0 }}>{question.explanation}</p>
          </div>
        </div>

        <div style={{ background: "#18181b", border: "1px solid rgba(200,168,75,0.35)", borderRadius: 16, padding: 18 }}>
          <p style={{ fontSize: 10, textTransform: "uppercase", fontWeight: 900, letterSpacing: "0.1em", color: "#C8A84B", margin: "0 0 8px" }}>Learn This</p>
          <p style={{ fontSize: 13, color: "#fff", fontWeight: 500, lineHeight: 1.6, margin: 0 }}>{question.teachingNote}</p>
        </div>

        <div style={{ background: "#09090b", border: "1px solid #18181b", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", color: "#3f3f46" }}>Validation Desk</span>
            <button type="button" onClick={() => { if (!flagged) { setFlagged(true); submitFlag("error", "Student flagged") } }} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, padding: "4px 8px", borderRadius: 6, background: "none", border: "none", cursor: flagged ? "default" : "pointer", color: flagged ? "#f59e0b" : "#52525b" }}>
              <IconFlag /><span>{flagged ? "Reported" : "Report Error"}</span>
            </button>
          </div>
          {!contested ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ fontSize: 11, color: "#52525b", lineHeight: 1.5, margin: 0 }}>Think another answer is also correct? Explain why:</p>
              <div style={{ display: "flex", gap: 8 }}>
                <textarea value={contestText} onChange={(e) => setContestText(e.target.value)} placeholder="e.g. Option B is also valid" rows={2} style={{ flex: 1, background: "#18181b", border: "1px solid #27272a", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#fff", outline: "none", resize: "none", fontFamily: "inherit" }} />
                <button type="button" onClick={() => { if (contestText.trim()) { setContested(true); submitFlag("contest", contestText) } }} style={{ padding: "8px 12px", background: "#27272a", color: "#fff", fontWeight: 700, fontSize: 12, borderRadius: 8, border: "none", cursor: "pointer", alignSelf: "flex-end" }}>Contest</button>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: "#34d399", margin: 0 }}>✓ Contest recorded. Our team will review.</p>
          )}
        </div>

        <button type="button" onClick={() => { window.localStorage.removeItem("vibe_exam_feedback"); router.push(isLast ? "/exam/results" : "/exam/session") }} style={{ width: "100%", height: 56, background: "#C8A84B", color: "#05050F", fontWeight: 900, borderRadius: 12, fontSize: 16, border: "none", cursor: "pointer" }}>
          {isLast ? "View Results" : "Next Question →"}
        </button>

      </div>
    </div>
  )
}
