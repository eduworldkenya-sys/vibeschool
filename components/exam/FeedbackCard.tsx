"use client"

interface FeedbackCardProps {
  isCorrect:     boolean
  explanation:   string
  teachingNote:  string
  correctAnswer: string
}

function IconCheck() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12l3 3 5-5" />
    </svg>
  )
}
function IconX() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M15 9l-6 6M9 9l6 6" />
    </svg>
  )
}

export default function FeedbackCard({ isCorrect, explanation, teachingNote, correctAnswer }: FeedbackCardProps) {
  const accent = isCorrect ? "#34d399" : "#f87171"
  const accentBg = isCorrect ? "rgba(6,78,59,0.2)" : "rgba(69,10,10,0.2)"
  const accentBorder = isCorrect ? "#064e3b" : "#7f1d1d"
  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ border: `1px solid ${accentBorder}`, padding: 20, borderRadius: 16, display: "flex", alignItems: "flex-start", gap: 16, background: accentBg, color: accent }}>
        <div style={{ flexShrink: 0, marginTop: 2 }}>
          {isCorrect ? <IconCheck /> : <IconX />}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h2 style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em", margin: 0, color: accent }}>
            {isCorrect ? "Correct!" : "Not quite"}
          </h2>
          {!isCorrect && (
            <p style={{ fontSize: 14, fontWeight: 600, color: "#d4d4d8", margin: 0 }}>
              Correct Answer: <span style={{ color: "#34d399" }}>{correctAnswer}</span>
            </p>
          )}
          <p style={{ fontSize: 14, color: "#d4d4d8", lineHeight: 1.6, margin: 0 }}>
            {explanation}
          </p>
        </div>
      </div>

      <div style={{ background: "#18181b", border: "1px solid rgba(200,168,75,0.4)", borderRadius: 16, padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
        <p style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 800, letterSpacing: "0.1em", color: "#C8A84B", margin: 0 }}>
          Learn This
        </p>
        <p style={{ fontSize: 14, color: "#ffffff", fontWeight: 500, lineHeight: 1.6, margin: 0 }}>
          {teachingNote}
        </p>
      </div>
    </div>
  )
}
