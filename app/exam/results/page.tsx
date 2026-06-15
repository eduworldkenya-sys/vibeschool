"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { ExamSession, ExamResult } from "@/lib/types"
import { incrementExamCount, shouldShowRegisterPrompt, getKNECGrade } from "@/lib/examTracker"
import ScoreCard from "@/components/exam/ScoreCard"
import ShareButton from "@/components/exam/ShareButton"

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
  const [result,     setResult]     = useState<ExamResult | null>(null)
  const [session,    setSession]    = useState<ExamSession | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [loading,    setLoading]    = useState(true)
  const [drillLoad,  setDrillLoad]  = useState(false)
  const countedRef = useRef(false)

  useEffect(() => {
    const raw = window.localStorage.getItem("vibe_active_exam_session")
    if (!raw) { router.replace("/exam"); return }
    try {
      const s: ExamSession = JSON.parse(raw)
      const score      = s.answers.filter((a) => a.isCorrect).length
      const total      = s.totalQuestions
      const percentage = total > 0 ? Math.round((score / total) * 100) : 0
      const weakSet    = new Set<string>()
      const strongSet  = new Set<string>()
      s.answers.forEach((ans) => {
        const q = s.questions.find((q) => q.id === ans.questionId)
        if (!q) return
        const t = q.topic || s.topic
        if (ans.isCorrect) strongSet.add(t) else weakSet.add(t)
      })
      setResult({ score, total, percentage, weakTopics: Array.from(weakSet), strongTopics: Array.from(strongSet).filter((t) => !weakSet.has(t)), answers: s.answers, questions: s.questions })
      setSession(s)
      setLoading(false)
      if (!countedRef.current) {
        countedRef.current = true
        incrementExamCount()
        if (shouldShowRegisterPrompt()) setShowPrompt(true)
      }
    } catch { router.replace("/exam") }
  }, [router])

  if (loading || !result || !session) {
    return (
      <div style={{ minHeight: "100vh", background: "#05050F", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div style={{ height: 128, background: "#18181b", borderRadius: 12, width: "100%", maxWidth: 480 }} />
      </div>
    )
  }

  const knec = getKNECGrade(result.percentage)

  const handleDrill = async () => {
    if (result.weakTopics.length === 0) return
    setDrillLoad(true)
    const drillTopic = result.weakTopics[0]
    try {
      const res = await fetch("/api/exam/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: session.subject, form: session.form, topic: drillTopic, difficulty: "medium", count: 5 }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      window.localStorage.setItem("vibe_active_exam_session", JSON.stringify({
        subject: session.subject, form: session.form, topic: drillTopic,
        difficulty: "medium" as const, totalQuestions: data.questions.length,
        questions: data.questions, answers: [], startedAt: new Date().toISOString(), completedAt: null, currentStreak: 0,
      }))
      router.push("/exam/session")
    } catch { setDrillLoad(false) }
  }

  const handleNewExam = () => {
    window.localStorage.removeItem("vibe_active_exam_session")
    window.sessionStorage.removeItem("vibe_exam_feedback")
    router.push("/exam")
  }

  return (
    <div style={{ minHeight: "100vh", background: "#05050F", color: "#fff", padding: 16, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: "100%", maxWidth: 560, display: "flex", flexDirection: "column", gap: 20, paddingTop: 20, paddingBottom: 112 }}>

        <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.02em", textAlign: "center", margin: 0 }}>
          Performance <span style={{ color: "#C8A84B" }}>Summary</span>
        </h1>

        {/* Snapshot card */}
        <div style={{ background: "rgba(24,24,27,0.4)", border: "1px solid #27272a", borderRadius: 16, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid rgba(39,39,42,0.8)", paddingBottom: 12 }}>
            <div>
              <span style={{ fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C8A84B" }}>VIBEEXAM</span>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: "2px 0 0" }}>{session.subject}</h2>
              <p style={{ fontSize: 12, color: "#71717a", margin: 0 }}>{session.form} · {session.topic}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#52525b", textTransform: "uppercase", letterSpacing: "0.08em", display: "block" }}>KNEC Grade</span>
              <span style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-0.03em", color: knec.color }}>{knec.grade}</span>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, textAlign: "center" }}>
            {[["Score", `${result.score}/${result.total}`],["Percentage",`${result.percentage}%`],["Difficulty", session.difficulty]].map(([label, val]) => (
              <div key={label} style={{ background: "#09090b", padding: 10, borderRadius: 12, border: "1px solid #18181b" }}>
                <span style={{ fontSize: 9, textTransform: "uppercase", fontWeight: 700, color: "#52525b", display: "block" }}>{label}</span>
                <span style={{ fontSize: label==="Difficulty"?12:20, fontWeight: 900, color: "#fff", display: "block", paddingTop: label==="Difficulty"?6:0, textTransform: "capitalize" }}>{val}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.6, color: "#d4d4d8", background: "rgba(9,9,11,0.8)", border: "1px solid #18181b", padding: 12, borderRadius: 12, margin: 0 }}>
            {knec.feedback}
          </p>
          <p style={{ fontSize: 10, fontWeight: 700, color: "#52525b", textTransform: "uppercase", letterSpacing: "0.1em", textAlign: "center", margin: 0 }}>
            📸 Screenshot this card to share on WhatsApp Status
          </p>
        </div>

        <ScoreCard result={result} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ background: "#09090b", border: "1px solid #18181b", padding: 16, borderRadius: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", color: "#34d399", display: "block", marginBottom: 8 }}>Strong</span>
            {result.strongTopics.length > 0
              ? <p style={{ fontSize: 12, color: "#d4d4d8", fontWeight: 500, margin: 0 }}>✓ {result.strongTopics.join(", ")}</p>
              : <p style={{ fontSize: 11, color: "#52525b", margin: 0 }}>Keep practicing</p>}
          </div>
          <div style={{ background: "#09090b", border: "1px solid #18181b", padding: 16, borderRadius: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", color: "#f87171", display: "block", marginBottom: 8 }}>Review</span>
            {result.weakTopics.length > 0
              ? <p style={{ fontSize: 12, color: "#d4d4d8", fontWeight: 500, margin: 0 }}>⚠ {result.weakTopics.join(", ")}</p>
              : <p style={{ fontSize: 11, color: "#34d399", fontWeight: 700, margin: 0 }}>All correct!</p>}
          </div>
        </div>

        {result.weakTopics.length > 0 && (
          <button type="button" disabled={drillLoad} onClick={handleDrill} style={{ width: "100%", height: 56, background: "#d97706", color: "#fff", fontWeight: 900, borderRadius: 12, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em", border: "none", cursor: drillLoad?"not-allowed":"pointer", opacity: drillLoad?0.5:1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <IconDrill />
            <span>{drillLoad ? "Preparing drill..." : `Drill: ${result.weakTopics[0]} (5 Questions)`}</span>
          </button>
        )}

        <ShareButton score={result.score} total={result.total} subject={session.subject} topic={session.topic} />

        <button type="button" onClick={handleNewExam} style={{ width: "100%", height: 48, background: "#18181b", border: "1px solid #27272a", color: "#fff", fontWeight: 700, fontSize: 14, borderRadius: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <IconRefresh /><span>New Exam</span>
        </button>

      </div>

      {showPrompt && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#05050F", borderTop: "1px solid rgba(200,168,75,0.4)", padding: 16, display: "flex", flexDirection: "column", gap: 12, zIndex: 50, borderRadius: "16px 16px 0 0" }}>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>Save your streak!</p>
            <p style={{ fontSize: 12, color: "#71717a", margin: "4px 0 0" }}>Create a free account to track progress across sessions.</p>
          </div>
          <button type="button" onClick={() => router.push("/exam/register")} style={{ height: 40, padding: "0 20px", background: "#C8A84B", color: "#05050F", fontWeight: 800, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", borderRadius: 8, border: "none", cursor: "pointer" }}>
            Create Account
          </button>
        </div>
      )}
    </div>
  )
}
