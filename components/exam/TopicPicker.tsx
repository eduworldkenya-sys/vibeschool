"use client"

import { ExamForm, ExamSubject } from "@/lib/types"
import { SUBJECT_DATA } from "@/lib/examData"

interface TopicPickerProps {
  subject:  ExamSubject
  form:     ExamForm
  selected: string | null
  onSelect: (t: string) => void
}

export default function TopicPicker({ subject, form, selected, onSelect }: TopicPickerProps) {
  const topics = SUBJECT_DATA[subject]?.[form] ?? []
  const hasMore = topics.length > 4
  return (
    <div style={{ position: "relative" }}>
      <div style={{ width: "100%", maxHeight: 200, overflowY: "auto", border: "1px solid #27272a", borderRadius: 12, background: "rgba(9,9,11,0.5)", padding: 8, display: "flex", flexDirection: "column", gap: 4 }}>
        {topics.map((topic) => (
          <button key={topic} type="button" onClick={() => onSelect(topic)} style={{ width: "100%", height: 44, paddingLeft: 12, paddingRight: 12, textAlign: "left", borderRadius: 8, fontSize: 13, fontWeight: 600, background: selected === topic ? "#C8A84B" : "transparent", color: selected === topic ? "#05050F" : "#d4d4d8", border: "none", cursor: "pointer" }}>
            {topic}
          </button>
        ))}
      </div>
      {hasMore && (
        <div style={{ textAlign: "center", fontSize: 10, color: "#52525b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 4 }}>
          scroll for more ↓
        </div>
      )}
    </div>
  )
}
