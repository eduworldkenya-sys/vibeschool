"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ExamSession, ExamQuestion, ExamAnswer, ExamResult } from "@/lib/types"
import { incrementExamCount, shouldShowRegisterPrompt, getKNECGrade, getStudentStreak } from "@/lib/examTracker"

// ─── Icons ────────────────────────────────────────────────────────────────────
function IconClock() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
    </svg>
  )
}
function IconFlame() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M12 2C6 8 8 12 8 14a4 4 0 008 0c0-2-1-4-1-4s3 2 3 5a5 5 0 01-10 0C8 11 12 2 12 2z"/>
    </svg>
  )
}
function IconHint() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/>
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
function IconFlag() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
    </svg>
  )
}
function IconRefresh() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
    </svg>
  )
}
function IconDrill() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  )
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

type Stage = "question" | "feedback" | "results"

const ANSWER_COLORS = {
  correct:   { bg: "rgba(6,78,59,0.25)",  border: "#065f46", text: "#34d399" },
  incorrect: { bg: "rgba(69,10,10,0.25)", border: "#7f1d1d", text: "#f87171" },
  neutral:   { bg: "#18181b",             border: "#27272a", text: "#e4e4e7" },
}

export default function ExamSessionPage() {
  const router = useRouter()

  // ── Session state ──────────────────────────────────────────────────────────
  const [session,      setSession]      = useState<ExamSession | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [stage,        setStage]        = useState<Stage>("question")
  const [visible,      setVisible]      = useState(true)

  // ── Question state ─────────────────────────────────────────────────────────
  const [selectedIdx,  setSelectedIdx]  = useState<number | null>(null)
  const [showHint,     setShowHint]     = useState(false)
  const [elapsed,      setElapsed]      = useState(0)
  const [streak,       setStreak]       = useState(0)

  // ── Feedback state ─────────────────────────────────────────────────────────
  const [flagged,      setFlagged]      = useState(false)
  const [contested,    setContested]    = useState(false)
  const [contestText,  setContestText]  = useState("")

  // ── Results state ──────────────────────────────────────────────────────────
  const [result,       setResult]       = useState<ExamResult | null>(null)
  const [showPrompt,   setShowPrompt]   = useState(false)
  const [drillLoad,    setDrillLoad]    = useState(false)

  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const startRef   = useRef<number>(Date.now())
  const countedRef = useRef(false)

  // ── Load session ───────────────────────────────────────────────────────────
  useEffect(() => {
    const raw = window.localStorage.getItem("vibe_active_exam_session")
    if (!raw) { router.replace("/exam"); return }
    try {
      const parsed = JSON.parse(raw) as ExamSession
      setSession(parsed)
      setStreak(getStudentStreak().currentStreak)
      setLoading(false)
      startTimer()
    } catch {
      router.replace("/exam")
    }
    return () => stopTimer()
  }, [router])

  const startTimer = () => {
    startRef.current = Date.now()
    timerRef.current = setInterval(() => setElapsed((p) => p + 1), 1000)
  }
  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  const transition = (next: Stage) => {
    setVisible(false)
    setTimeout(() => { setStage(next); setVisible(true) }, 200)
  }

  // ── Answer handler ─────────────────────────────────────────────────────────
  const handleSelect = useCallback((optionIndex: number) => {
    if (!session || selectedIdx !== null) return
    setSelectedIdx(optionIndex)
    stopTimer()

    const timeSpent     = Math.max(1, Math.round((Date.now() - startRef.current) / 1000))
    const currentIndex  = session.answers.length
    const currentQ      = session.questions[currentIndex]
    const isCorrect     = optionIndex === currentQ.correctIndex
    const nextStreak    = isCorrect ? (session.currentStreak ?? 0) + 1 : 0

    const updatedSession: ExamSession = {
      ...session,
      answers:       [...session.answers, { questionId: currentQ.id, selectedIndex: optionIndex, isCorrect, timeSpentSeconds: timeSpent }],
      currentStreak: nextStreak,
    }
    setSession(updatedSession)
    window.localStorage.setItem("vibe_active_exam_session", JSON.stringify(updatedSession))

    // brief flash, then feedback
    setTimeout(() => transition("feedback"), 400)
  }, [session, selectedIdx])

  // ── Next question ──────────────────────────────────────────────────────────
  const handleNext = useCallback(() => {
    if (!session) return
    const updatedSession = JSON.parse(window.localStorage.getItem("vibe_active_exam_session") ?? "{}")
    const done = updatedSession.answers?.length >= updatedSession.totalQuestions

    if (done) {
      // build results
      const s: ExamSession = updatedSession
      const score      = s.answers.filter((a: ExamAnswer) => a.isCorrect).length
      const total      = s.totalQuestions
      const percentage = total > 0 ? Math.round((score / total) * 100) : 0
      const weakSet    = new Set<string>()
      const strongSet  = new Set<string>()
      s.answers.forEach((ans: ExamAnswer) => {
        const q = s.questions.find((q: ExamQuestion) => q.id === ans.questionId)
        if (!q) return
        const t = q.topic || s.topic
        if (ans.isCorrect) strongSet.add(t) else weakSet.add(t)
      })
      const r: ExamResult = {
        score, total, percentage,
        weakTopics:   Array.from(weakSet),
        strongTopics: Array.from(strongSet).filter((t) => !weakSet.has(t)),
        answers:      s.answers,
        questions:    s.questions,
      }
      setResult(r)
      setSession(s)
      if (!countedRef.current) {
        countedRef.current = true
        incrementExamCount()
        if (shouldShowRegisterPrompt()) setShowPrompt(true)
      }
      transition("results")
    } else {
      // next question
      setSession(updatedSession)
      setSelectedIdx(null)
      setShowHint(false)
      setFlagged(false)
      setContested(false)
      setContestText("")
      setElapsed(0)
      transition("question")
      setTimeout(startTimer, 220)
    }
  }, [session])

  // ── Flag / contest ─────────────────────────────────────────────────────────
  const submitFlag = async (type: "error" | "contest", reason?: string) => {
    if (!session) return
    const currentQ = session.questions[session.answers.length - 1]
    try {
      await fetch("/api/exam/flag", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: currentQ?.id, type, reason }),
      })
    } catch { /* silent */ }
  }

  // ── Drill ──────────────────────────────────────────────────────────────────
  const handleDrill = async () => {
    if (!result || !session || result.weakTopics.length === 0) return
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
        questions: data.questions, answers: [], startedAt: new Date().toISOString(),
        completedAt: null, currentStreak: 0,
      }))
      router.push("/exam/session")
    } catch { setDrillLoad(false) }
  }

  const handleNewExam = () => {
    window.localStorage.removeItem("vibe_active_exam_session")
    router.push("/exam")
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading || !session) {
    return (
      <div style={{ minHeight: "100vh", background: "#05050F", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div style={{ width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", gap: 12 }}>
          {[48, 8, 120, 56, 56, 56].map((h, i) => (
            <div key={i} style={{ height: h, borderRadius: 12, background: "#18181b" }} />
          ))}
        </div>
      </div>
    )
  }

  const currentIndex = stage === "feedback"
    ? session.answers.length - 1
    : session.answers.length
  const currentQ     = session.questions[Math.min(currentIndex, session.questions.length - 1)]
  const lastAnswer   = session.answers[session.answers.length - 1]
  const knec         = result ? getKNECGrade(result.percentage) : null

  // ── Shared header ──────────────────────────────────────────────────────────
  const Header = () => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(24,24,27,0.5)", border: "1px solid #27272a", padding: "10px 14px", borderRadius: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#71717a", fontSize: 12, fontWeight: 700 }}>
        <IconClock /><span>{formatTime(elapsed)}</span>
      </div>
      {(session.currentStreak ?? 0) >= 2 && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#fb923c", fontWeight: 900, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          <IconFlame /><span>{session.currentStreak} in a row!</span>
        </div>
      )}
      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: "#C8A84B", textTransform: "uppercase" }}>
        {session.subject}
      </span>
    </div>
  )

  // ── Progress bar ───────────────────────────────────────────────────────────
  const answered = session.answers.length
  const pct      = session.totalQuestions > 0 ? Math.min(100, (answered / session.totalQuestions) * 100) : 0
  const ProgressBar = () => (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#71717a", marginBottom: 4 }}>
        <span>Progress</span>
        <span>{answered} / {session.totalQuestions}</span>
      </div>
      <div style={{ width: "100%", height: 6, background: "#18181b", border: "1px solid #27272a", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "#C8A84B", borderRadius: 999, transition: "width 0.4s ease" }} />
      </div>
    </div>
  )

  // ── STAGE: QUESTION ────────────────────────────────────────────────────────
  const renderQuestion = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Header />
      <ProgressBar />

      {/* Question card */}
      <div style={{ background: "rgba(24,24,27,0.6)", border: "1px solid #27272a", borderRadius: 16, padding: 20 }}>
        <span style={{ display: "inline-block", padding: "4px 12px", background: "rgba(200,168,75,0.1)", border: "1px solid rgba(200,168,75,0.4)", borderRadius: 999, fontSize: 11, fontWeight: 700, color: "#C8A84B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
          Question {currentIndex + 1} of {session.totalQuestions}
        </span>
        <p style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.6, color: "#fff", margin: 0 }}>
          {currentQ.question}
        </p>
      </div>

      {/* Hint */}
      {currentQ.hint && (
        <div>
          <button type="button" onClick={() => setShowHint((p) => !p)} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: showHint ? "#C8A84B" : "#71717a", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <IconHint /><span>{showHint ? "Hide Hint" : "Show Hint"}</span>
          </button>
          {showHint && (
            <div style={{ marginTop: 8, padding: 12, background: "rgba(24,24,27,0.6)", border: "1px solid #27272a", color: "#d4d4d8", fontSize: 12, borderRadius: 12, lineHeight: 1.6 }}>
              {currentQ.hint}
            </div>
          )}
        </div>
      )}

      {/* Answer options */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {currentQ.options.map((option, idx) => {
          const isSelected = selectedIdx === idx
          const isCorrect  = idx === currentQ.correctIndex
          let colors = ANSWER_COLORS.neutral
          if (selectedIdx !== null) {
            if (isCorrect)        colors = ANSWER_COLORS.correct
            else if (isSelected)  colors = ANSWER_COLORS.incorrect
          }
          return (
            <button
              key={idx}
              type="button"
              disabled={selectedIdx !== null}
              onClick={() => handleSelect(idx)}
              style={{
                width: "100%", minHeight: 56, textAlign: "left", padding: "12px 16px",
                background: colors.bg, border: `1px solid ${colors.border}`,
                borderRadius: 12, display: "flex", alignItems: "center", gap: 12,
                cursor: selectedIdx !== null ? "not-allowed" : "pointer",
                transition: "all 0.15s", opacity: selectedIdx !== null && !isSelected && !isCorrect ? 0.4 : 1,
              }}
            >
              <div style={{ height: 32, width: 32, flexShrink: 0, background: "#09090b", border: `1px solid ${colors.border}`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, color: colors.text }}>
                {["A","B","C","D"][idx]}
              </div>
              <span style={{ fontSize: 14, color: colors.text, fontWeight: 500, lineHeight: 1.4 }}>
                {option}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )

  // ── STAGE: FEEDBACK ────────────────────────────────────────────────────────
  const renderFeedback = () => {
    if (!lastAnswer || !currentQ) return null
    const isCorrect     = lastAnswer.isCorrect
    const correctAnswer = currentQ.options[currentQ.correctIndex]
    const isLast        = session.answers.length >= session.totalQuestions
    const accent        = isCorrect ? "#34d399" : "#f87171"
    const accentBg      = isCorrect ? "rgba(6,78,59,0.2)" : "rgba(69,10,10,0.2)"
    const accentBorder  = isCorrect ? "#065f46" : "#7f1d1d"

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Result banner */}
        <div style={{ textAlign: "center", padding: "4px 0" }}>
          <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C8A84B", margin: 0 }}>
            {isCorrect ? "Boom! Solid logic! 🎉" : "Don't sweat it — next one is yours! 🎯"}
          </p>
        </div>

        {/* Correct / Wrong card */}
        <div style={{ border: `1px solid ${accentBorder}`, padding: 18, borderRadius: 16, display: "flex", alignItems: "flex-start", gap: 14, background: accentBg }}>
          <div style={{ color: accent, flexShrink: 0, marginTop: 2 }}>
            {isCorrect ? <IconCheck /> : <IconX />}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: accent, margin: 0 }}>
              {isCorrect ? "Correct!" : "Not quite"}
            </h2>
            {!isCorrect && (
              <p style={{ fontSize: 13, fontWeight: 600, color: "#d4d4d8", margin: 0 }}>
                Correct Answer: <span style={{ color: "#34d399" }}>{correctAnswer}</span>
              </p>
            )}
            <p style={{ fontSize: 13, color: "#d4d4d8", lineHeight: 1.6, margin: 0 }}>
              {currentQ.explanation}
            </p>
          </div>
        </div>

        {/* Learn This */}
        <div style={{ background: "#18181b", border: "1px solid rgba(200,168,75,0.35)", borderRadius: 16, padding: 18 }}>
          <p style={{ fontSize: 10, textTransform: "uppercase", fontWeight: 900, letterSpacing: "0.1em", color: "#C8A84B", margin: "0 0 8px" }}>Learn This</p>
          <p style={{ fontSize: 13, color: "#fff", fontWeight: 500, lineHeight: 1.6, margin: 0 }}>
            {currentQ.teachingNote}
          </p>
        </div>

        {/* Validation desk */}
        <div style={{ background: "#09090b", border: "1px solid #18181b", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", color: "#3f3f46" }}>Validation Desk</span>
            <button type="button" onClick={() => { if (!flagged) { setFlagged(true); submitFlag("error", "Student flagged question error") } }} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, padding: "4px 8px", borderRadius: 6, background: "none", border: "none", cursor: flagged ? "default" : "pointer", color: flagged ? "#f59e0b" : "#52525b" }}>
              <IconFlag /><span>{flagged ? "Reported" : "Report Error"}</span>
            </button>
          </div>
          {!contested ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ fontSize: 11, color: "#52525b", lineHeight: 1.5, margin: 0 }}>Think another answer is also correct? Explain why:</p>
              <div style={{ display: "flex", gap: 8 }}>
                <textarea value={contestText} onChange={(e) => setContestText(e.target.value)} placeholder="e.g. Option B is also valid" rows={2} style={{ flex: 1, background: "#18181b", border: "1px solid #27272a", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#fff", outline: "none", resize: "none", fontFamily: "inherit" }} />
                <button type="button" onClick={() => { if (contestText.trim()) { setContested(true); submitFlag("contest", contestText) } }} style={{ padding: "8px 12px", background: "#27272a", color: "#fff", fontWeight: 700, fontSize: 12, borderRadius: 8, border: "none", cursor: "pointer", alignSelf: "flex-end" }}>
                  Contest
                </button>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: "#34d399", margin: 0 }}>✓ Contest recorded. Our team will review your note.</p>
          )}
        </div>

        {/* Next button */}
        <button type="button" onClick={handleNext} style={{ width: "100%", height: 56, background: "#C8A84B", color: "#05050F", fontWeight: 900, borderRadius: 12, fontSize: 16, letterSpacing: "0.03em", border: "none", cursor: "pointer" }}>
          {isLast ? "View Results" : "Next Question →"}
        </button>
      </div>
    )
  }

  // ── STAGE: RESULTS ─────────────────────────────────────────────────────────
  const renderResults = () => {
    if (!result || !knec) return null
    const waMsg = `I scored ${result.score}/${result.total} on KCSE ${session.subject} (${session.topic}) on VibeExam! Try it free at vibeschool.co.ke/exam 🎯`

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.02em", textAlign: "center", margin: 0 }}>
          Performance <span style={{ color: "#C8A84B" }}>Summary</span>
        </h1>

        {/* Main result card */}
        <div style={{ background: "rgba(24,24,27,0.5)", border: "1px solid #27272a", borderRadius: 16, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Top row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <span style={{ fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C8A84B" }}>VIBEEXAM</span>
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: "2px 0 0", color: "#fff" }}>{session.subject}</h2>
              <p style={{ fontSize: 12, color: "#71717a", margin: 0 }}>{session.form} · {session.topic}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#52525b", textTransform: "uppercase", letterSpacing: "0.08em", display: "block" }}>KNEC Grade</span>
              <span style={{ fontSize: 48, fontWeight: 900, letterSpacing: "-0.04em", color: knec.color, lineHeight: 1 }}>{knec.grade}</span>
            </div>
          </div>

          {/* Score big */}
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <div style={{ fontSize: 56, fontWeight: 900, letterSpacing: "-0.04em", color: "#fff", lineHeight: 1 }}>
              {result.score}<span style={{ fontSize: 28, fontWeight: 300, color: "#52525b" }}> / {result.total}</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", color: knec.color, marginTop: 4 }}>
              {result.percentage}% · {knec.grade}
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ height: 8, background: "#18181b", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${result.percentage}%`, background: knec.color, borderRadius: 999, transition: "width 0.6s ease" }} />
          </div>

          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
            {[["Difficulty", session.difficulty],["Questions", `${result.total}`],["Time", `${session.topic.slice(0,8)}…`]].map(([label, val]) => (
              <div key={label} style={{ background: "#09090b", border: "1px solid #18181b", borderRadius: 10, padding: "8px 6px", textAlign: "center" }}>
                <span style={{ fontSize: 9, textTransform: "uppercase", fontWeight: 700, color: "#52525b", display: "block" }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#d4d4d8", textTransform: "capitalize", display: "block", marginTop: 2 }}>{val}</span>
              </div>
            ))}
          </div>

          {/* Feedback */}
          <p style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.6, color: "#d4d4d8", background: "#09090b", border: "1px solid #18181b", padding: 12, borderRadius: 10, margin: 0 }}>
            {knec.feedback}
          </p>

          <p style={{ fontSize: 10, fontWeight: 700, color: "#3f3f46", textTransform: "uppercase", letterSpacing: "0.1em", textAlign: "center", margin: 0 }}>
            📸 Screenshot to share on WhatsApp Status
          </p>
        </div>

        {/* Strong / Weak */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ background: "#09090b", border: "1px solid #18181b", padding: 14, borderRadius: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", color: "#34d399", display: "block", marginBottom: 6 }}>Strong</span>
            {result.strongTopics.length > 0
              ? <p style={{ fontSize: 12, color: "#d4d4d8", fontWeight: 500, margin: 0 }}>✓ {result.strongTopics.join(", ")}</p>
              : <p style={{ fontSize: 11, color: "#52525b", margin: 0 }}>Keep practicing</p>}
          </div>
          <div style={{ background: "#09090b", border: "1px solid #18181b", padding: 14, borderRadius: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", color: "#f87171", display: "block", marginBottom: 6 }}>Review</span>
            {result.weakTopics.length > 0
              ? <p style={{ fontSize: 12, color: "#d4d4d8", fontWeight: 500, margin: 0 }}>⚠ {result.weakTopics.join(", ")}</p>
              : <p style={{ fontSize: 11, color: "#34d399", fontWeight: 700, margin: 0 }}>All correct!</p>}
          </div>
        </div>

        {/* Drill */}
        {result.weakTopics.length > 0 && (
          <button type="button" disabled={drillLoad} onClick={handleDrill} style={{ width: "100%", height: 52, background: "#d97706", color: "#fff", fontWeight: 900, borderRadius: 12, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em", border: "none", cursor: drillLoad ? "not-allowed" : "pointer", opacity: drillLoad ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <IconDrill /><span>{drillLoad ? "Preparing drill..." : `Drill: ${result.weakTopics[0]} (5 Qs)`}</span>
          </button>
        )}

        {/* WhatsApp share */}
        <a href={`https://wa.me/?text=${encodeURIComponent(waMsg)}`} target="_blank" rel="noopener noreferrer" style={{ width: "100%", height: 52, background: "#25D366", color: "#fff", fontWeight: 800, borderRadius: 12, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
          Share Score on WhatsApp
        </a>

        {/* New exam */}
        <button type="button" onClick={handleNewExam} style={{ width: "100%", height: 46, background: "#18181b", border: "1px solid #27272a", color: "#fff", fontWeight: 700, fontSize: 14, borderRadius: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <IconRefresh /><span>New Exam</span>
        </button>

        {/* Register prompt */}
        {showPrompt && (
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#0a0a0f", borderTop: "1px solid rgba(200,168,75,0.4)", padding: 16, display: "flex", flexDirection: "column", gap: 12, zIndex: 50, borderRadius: "16px 16px 0 0" }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>Save your streak!</p>
              <p style={{ fontSize: 12, color: "#71717a", margin: "4px 0 0" }}>Create a free account to track progress across sessions.</p>
            </div>
            <button type="button" onClick={() => router.push("/exam/register")} style={{ height: 40, background: "#C8A84B", color: "#05050F", fontWeight: 800, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", borderRadius: 8, border: "none", cursor: "pointer" }}>
              Create Account
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#05050F", color: "#fff", padding: 16, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{
        width: "100%", maxWidth: 560, paddingTop: 16, paddingBottom: 80,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(6px)",
        transition: "opacity 0.2s ease, transform 0.2s ease",
      }}>
        {stage === "question" && renderQuestion()}
        {stage === "feedback" && renderFeedback()}
        {stage === "results"  && renderResults()}
      </div>
    </div>
  )
}
