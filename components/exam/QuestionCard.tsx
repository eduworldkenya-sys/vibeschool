"use client"

import { ExamQuestion } from "@/lib/types"

interface QuestionCardProps {
  question:       ExamQuestion
  questionNumber: number
  total:          number
}

export default function QuestionCard({ question, questionNumber, total }: QuestionCardProps) {
  return (
    <div style={{ width: "100%", background: "rgba(24,24,27,0.6)", border: "1px solid #27272a", borderRadius: 16, padding: 20 }}>
      <span style={{ display: "inline-block", padding: "4px 12px", background: "rgba(200,168,75,0.1)", border: "1px solid rgba(200,168,75,0.4)", borderRadius: 999, fontSize: 11, fontWeight: 700, color: "#C8A84B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
        Question {questionNumber} of {total}
      </span>
      <p style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.6, color: "#ffffff", margin: 0 }}>
        {question.question}
      </p>
    </div>
  )
}
