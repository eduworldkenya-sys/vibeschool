"use client"

import { ExamSubject } from "@/lib/types"

interface SubjectPickerProps {
  selected: ExamSubject | null
  onSelect: (s: ExamSubject) => void
}

const SUBJECTS: { name: ExamSubject; emoji: string }[] = [
  { name: "Mathematics", emoji: "📐" },
  { name: "English",     emoji: "📖" },
  { name: "Biology",     emoji: "🧬" },
  { name: "Chemistry",   emoji: "⚗️" },
  { name: "History",     emoji: "🏛️" },
]

export default function SubjectPicker({ selected, onSelect }: SubjectPickerProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, width: "100%" }}>
      {SUBJECTS.map((s) => (
        <button
          key={s.name}
          type="button"
          onClick={() => onSelect(s.name)}
          style={{
            height: 52, paddingLeft: 14, paddingRight: 14,
            border: `1px solid ${selected === s.name ? "#C8A84B" : "#27272a"}`,
            borderRadius: 12, display: "flex", alignItems: "center", gap: 10,
            fontWeight: 700, fontSize: 13,
            background: selected === s.name ? "rgba(200,168,75,0.1)" : "#18181b",
            color: selected === s.name ? "#C8A84B" : "#d4d4d8",
            cursor: "pointer", transition: "all 0.15s", textAlign: "left",
          }}
        >
          <span style={{ fontSize: 18 }}>{s.emoji}</span>
          <span>{s.name}</span>
        </button>
      ))}
    </div>
  )
}
