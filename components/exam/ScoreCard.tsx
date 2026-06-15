"use client"

import { ExamResult } from "@/lib/types"
import { getKNECGrade } from "@/lib/examTracker"

interface ScoreCardProps { result: ExamResult }

function IconAward() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="6" /><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
    </svg>
  )
}

export default function ScoreCard({ result }: ScoreCardProps) {
  const analytics = getKNECGrade(result.percentage)
  return (
    <div style={{ width: "100%", background: "#09090b", border: "1px solid #18181b", borderRadius: 16, padding: 24, textAlign: "center", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", background: "#18181b", border: "1px solid #27272a", borderRadius: 999, fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C8A84B", alignSelf: "center" }}>
        <IconAward /><span>KNEC Evaluation Standard</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontSize: 60, fontWeight: 900, letterSpacing: "-0.03em", color: "#fff", lineHeight: 1 }}>
          {result.score}<span style={{ fontSize: 30, fontWeight: 300, color: "#52525b" }}> / {result.total}</span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: analytics.color }}>
          Projected Grade: {analytics.grade}
        </div>
      </div>
      <div style={{ height: 6, width: "100%", background: "#18181b", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${result.percentage}%`, background: "#C8A84B", borderRadius: 999, transition: "width 0.5s ease" }} />
      </div>
      <div style={{ fontSize: 12, color: "#71717a", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        Accuracy: {result.percentage}%
      </div>
    </div>
  )
}
