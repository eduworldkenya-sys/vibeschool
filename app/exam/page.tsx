"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ExamForm, ExamSubject, ExamDifficulty } from "@/lib/types"
import { EXAM_DATA } from "@/lib/examData"
import { getStudentStreak } from "@/lib/examTracker"
import SubjectPicker from "@/components/exam/SubjectPicker"
import TopicPicker from "@/components/exam/TopicPicker"

function IconFlame() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M12 2C12 2 8 6 8 10a4 4 0 008 0c0-1.5-.5-2.5-.5-2.5S17 10 17 13a5 5 0 01-10 0C7 9 12 2 12 2z" />
    </svg>
  )
}

const DIFFICULTY_NOTES = {
  easy:   "Foundational rules, direct calculations, base formulas.",
  medium: "Standard KCSE structures with core conceptual steps.",
  hard:   "Advanced problems, multi-step proofs, common exam traps.",
}

export default function ExamLandingPage() {
  const router = useRouter()
  const [subject,    setSubject]    = useState<ExamSubject>("Mathematics")
  const [form,       setForm]       = useState<ExamForm>("Form 1")
  const [topic,      setTopic]      = useState<string>(EXAM_DATA["Form 1"][0])
  const [difficulty, setDifficulty] = useState<ExamDifficulty>("medium")
  const [count,      setCount]      = useState<number>(10)
  const [loading,    setLoading]    = useState<boolean>(false)
  const [error,      setError]      = useState<string | null>(null)
  const [streak,     setStreak]     = useState<number>(0)

  useEffect(() => { setStreak(getStudentStreak().currentStreak) }, [])

  const handleFormChange = (f: ExamForm) => { setForm(f); setTopic(EXAM_DATA[f][0]) }

  const handleStart = async () => {
    setLoading(true); setError(null)
    try {
      const res  = await fetch("/api/exam/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, form, topic, difficulty, count }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to generate questions")
      window.localStorage.setItem("vibe_active_exam_session", JSON.stringify({
        subject, form, topic, difficulty,
        totalQuestions: data.questions.length,
        questions: data.questions, answers: [],
        startedAt: new Date().toISOString(), completedAt: null, currentStreak: 0,
      }))
      router.push("/exam/session")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong")
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#05050F", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
            <div style={{ height: 32, background: "#18181b", borderRadius: 8, width: "75%" }} />
            <div style={{ height: 16, background: "#18181b", borderRadius: 8, width: "50%" }} />
            <div style={{ height: 56, background: "#18181b", borderRadius: 8 }} />
            <div style={{ height: 56, background: "#18181b", borderRadius: 8 }} />
            <div style={{ height: 56, background: "#18181b", borderRadius: 8 }} />
          </div>
          <p style={{ color: "#C8A84B", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Assembling your KCSE revision set...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: "100vh", background: "#05050F", color: "#fff", padding: 16, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: "100%", maxWidth: 560, display: "flex", flexDirection: "column", gap: 24, paddingTop: 20, paddingBottom: 40 }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(24,24,27,0.4)", border: "1px solid #27272a", padding: "12px 16px", borderRadius: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ height: 8, width: 8, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#71717a" }}>KCSE AI Engine</span>
          </div>
          {streak > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#C8A84B", fontWeight: 900, fontSize: 14 }}>
              <IconFlame /><span>{streak} Day Streak</span>
            </div>
          )}
        </div>

        {/* Title */}
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 36, fontWeight: 900, letterSpacing: "-0.02em", margin: 0 }}>
            VIBE<span style={{ color: "#C8A84B" }}>EXAM</span>
          </h1>
          <p style={{ fontSize: 12, color: "#71717a", marginTop: 4 }}>Free AI-powered KCSE mock exams</p>
        </div>

        {error && (
          <div style={{ background: "rgba(69,10,10,0.3)", border: "1px solid #7f1d1d", color: "#fca5a5", padding: 16, borderRadius: 12, fontSize: 12, fontWeight: 500 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <p style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 800, letterSpacing: "0.08em", color: "#C8A84B", margin: 0 }}>1. Subject</p>
          <SubjectPicker selected={subject} onSelect={setSubject} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <p style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 800, letterSpacing: "0.08em", color: "#C8A84B", margin: 0 }}>2. Form Level</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
            {(["Form 1","Form 2","Form 3","Form 4"] as ExamForm[]).map((f) => (
              <button key={f} type="button" onClick={() => handleFormChange(f)} style={{ height: 48, border: `1px solid ${form===f?"#C8A84B":"#27272a"}`, borderRadius: 12, fontWeight: 700, fontSize: 12, letterSpacing: "0.03em", background: form===f?"rgba(200,168,75,0.1)":"#18181b", color: form===f?"#C8A84B":"#fff", cursor: "pointer", transition: "all 0.15s" }}>
                {f}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <p style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 800, letterSpacing: "0.08em", color: "#C8A84B", margin: 0 }}>3. Topic</p>
          <TopicPicker form={form} selected={topic} onSelect={setTopic} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <p style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 800, letterSpacing: "0.08em", color: "#C8A84B", margin: 0 }}>Difficulty</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {(["easy","medium","hard"] as ExamDifficulty[]).map((d) => (
                <button key={d} type="button" onClick={() => setDifficulty(d)} style={{ height: 48, paddingLeft: 12, textAlign: "left", border: `1px solid ${difficulty===d?"#C8A84B":"#27272a"}`, borderRadius: 12, textTransform: "capitalize", fontSize: 12, fontWeight: 700, background: difficulty===d?"rgba(200,168,75,0.1)":"#18181b", color: difficulty===d?"#C8A84B":"#d4d4d8", cursor: "pointer" }}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <p style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 800, letterSpacing: "0.08em", color: "#C8A84B", margin: 0 }}>Questions</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {[10,20,30].map((c) => (
                <button key={c} type="button" onClick={() => setCount(c)} style={{ height: 48, paddingLeft: 12, textAlign: "left", border: `1px solid ${count===c?"#C8A84B":"#27272a"}`, borderRadius: 12, fontSize: 12, fontWeight: 700, background: count===c?"rgba(200,168,75,0.1)":"#18181b", color: count===c?"#C8A84B":"#d4d4d8", cursor: "pointer" }}>
                  {c} Questions
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ background: "#09090b", border: "1px solid #18181b", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ fontSize: 12, lineHeight: 1.6, color: "#71717a", margin: 0 }}>
            <span style={{ fontWeight: 700, color: "#d4d4d8", textTransform: "capitalize" }}>{difficulty}:</span>{" "}{DIFFICULTY_NOTES[difficulty]}
          </p>
          <div style={{ height: 1, background: "#18181b" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#52525b" }}>
            <span>Network estimate</span>
            <span style={{ color: "#22c55e" }}>~ 45 KB · Low-data safe</span>
          </div>
        </div>

        <button type="button" onClick={handleStart} style={{ width: "100%", height: 56, background: "#16a34a", color: "#fff", fontWeight: 900, borderRadius: 12, fontSize: 18, letterSpacing: "0.05em", border: "none", cursor: "pointer" }}>
          Start Exam
        </button>

      </div>
    </div>
  )
}
