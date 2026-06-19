"use client"

import { ExamQuestion, ExamAnswer } from "@/lib/types"

interface QuestionReviewProps {
  questions: ExamQuestion[]
  answers:   ExamAnswer[]
  onClose:   () => void
}

const OPTION_LABELS = ["A","B","C","D"]

export default function QuestionReview({ questions, answers, onClose }: QuestionReviewProps) {
  const answerMap = new Map(answers.map(a => [a.questionId, a]))

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 100, overflowY: "auto", padding: "16px 16px 80px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 0 }}>

        <div style={{ position: "sticky", top: 0, background: "#05050F", padding: "12px 0 16px", zIndex: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0, letterSpacing: "-0.02em" }}>
              Question <span style={{ color: "#C8A84B" }}>Review</span>
            </h2>
            <p style={{ fontSize: 11, color: "#52525b", margin: "2px 0 0", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {answers.filter(a => a.isCorrect).length} / {questions.length} correct
            </p>
          </div>
          <button type="button" onClick={onClose} style={{ height: 36, paddingLeft: 16, paddingRight: 16, background: "#18181b", border: "1px solid #27272a", borderRadius: 8, color: "#d4d4d8", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            Close
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {questions.map((q, qi) => {
            const answer      = answerMap.get(q.id)
            const isCorrect   = answer?.isCorrect ?? false
            const selectedIdx = answer?.selectedIndex ?? -1
            const skipped     = selectedIdx === -1
            const statusColor = skipped ? "#71717a" : isCorrect ? "#34d399" : "#f87171"
            const statusLabel = skipped ? "Skipped" : isCorrect ? "Correct" : "Wrong"

            return (
              <div key={q.id} style={{ background: "#0d0d14", border: `1px solid ${skipped ? "#27272a" : isCorrect ? "rgba(52,211,153,0.25)" : "rgba(248,113,113,0.25)"}`, borderRadius: 16, overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #18181b" }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#52525b", textTransform: "uppercase", letterSpacing: "0.08em" }}>Q{qi + 1}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: statusColor, background: `${statusColor}18`, padding: "3px 8px", borderRadius: 6 }}>
                    {statusLabel}
                  </span>
                </div>
                <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#e4e4e7", lineHeight: 1.55, margin: 0 }}>{q.question}</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {q.options.map((opt, oi) => {
                      const isCorrectOpt  = oi === q.correctIndex
                      const isSelectedOpt = oi === selectedIdx
                      const bg     = isCorrectOpt ? "rgba(6,78,59,0.35)" : isSelectedOpt ? "rgba(69,10,10,0.35)" : "#18181b"
                      const border = isCorrectOpt ? "#34d399" : isSelectedOpt ? "#f87171" : "#27272a"
                      const color  = isCorrectOpt ? "#34d399" : isSelectedOpt ? "#f87171" : "#71717a"
                      return (
                        <div key={oi} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, background: bg, border: `1px solid ${border}` }}>
                          <span style={{ height: 26, width: 26, flexShrink: 0, background: "#09090b", border: `1px solid ${border}`, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, color }}>
                            {OPTION_LABELS[oi]}
                          </span>
                          <span style={{ fontSize: 13, color: isCorrectOpt || isSelectedOpt ? "#e4e4e7" : "#71717a", fontWeight: 500 }}>{opt}</span>
                          {isCorrectOpt  && <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 800, color: "#34d399" }}>✓ Correct</span>}
                          {isSelectedOpt && !isCorrectOpt && <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 800, color: "#f87171" }}>✗ Your answer</span>}
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 10, padding: 12 }}>
                    <p style={{ fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C8A84B", margin: "0 0 6px" }}>Explanation</p>
                    <p style={{ fontSize: 13, color: "#d4d4d8", lineHeight: 1.6, margin: 0 }}>{q.explanation}</p>
                  </div>
                  <div style={{ background: "rgba(200,168,75,0.06)", border: "1px solid rgba(200,168,75,0.2)", borderRadius: 10, padding: 12 }}>
                    <p style={{ fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C8A84B", margin: "0 0 6px" }}>Learn This</p>
                    <p style={{ fontSize: 13, color: "#fff", fontWeight: 500, lineHeight: 1.6, margin: 0 }}>{q.teachingNote}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <button type="button" onClick={onClose} style={{ marginTop: 20, width: "100%", height: 52, background: "#18181b", border: "1px solid #27272a", color: "#fff", fontWeight: 700, fontSize: 15, borderRadius: 12, cursor: "pointer" }}>
          Back to Results
        </button>
      </div>
    </div>
  )
}
