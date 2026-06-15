"use client"

import { ExamSubject } from "@/lib/types"

interface SubjectPickerProps {
  selected: ExamSubject | null
  onSelect: (s: ExamSubject) => void
}

const SUBJECTS: { name: ExamSubject; available: boolean }[] = [
  { name: "Mathematics", available: true  },
  { name: "English",     available: false },
  { name: "Biology",     available: false },
  { name: "Chemistry",   available: false },
  { name: "History",     available: false },
]

export default function SubjectPicker({ selected, onSelect }: SubjectPickerProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
      {SUBJECTS.map((s) =>
        s.available ? (
          <button key={s.name} type="button" onClick={() => onSelect(s.name)} style={{ height: 56, paddingLeft: 16, paddingRight: 16, border: `1px solid ${selected===s.name?"#C8A84B":"#27272a"}`, borderRadius: 12, display: "flex", alignItems: "center", fontWeight: 700, fontSize: 14, background: selected===s.name?"rgba(200,168,75,0.1)":"#18181b", color: selected===s.name?"#C8A84B":"#fff", cursor: "pointer", textAlign: "left" }}>
            {s.name}
          </button>
        ) : (
          <div key={s.name} style={{ height: 56, paddingLeft: 16, paddingRight: 16, background: "#09090b", border: "1px solid #18181b", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "space-between", opacity: 0.5, cursor: "not-allowed" }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: "#52525b" }}>{s.name}</span>
            <span style={{ fontSize: 10, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.08em", padding: "2px 8px", background: "#18181b", color: "#52525b", borderRadius: 4 }}>Soon</span>
          </div>
        )
      )}
    </div>
  )
}
