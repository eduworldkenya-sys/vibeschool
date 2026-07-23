"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

interface PrintSchemeItem {
  id: string
  curriculum_content_id: string | null
  week: number
  lesson_number: number | null
  strand: string | null
  sub_strand: string | null
  topic: string
  reflection: string | null
  objectives: string | null
  key_inquiry_question: string | null
  learning_resources: string | null
  assessment_methods: string | null
  learning_experiences: string | null
}

interface ContentDefaults {
  outcomes?: string[]
  key_inquiry_question?: string
  learning_resources?: string | string[]
  assessment_methods?: string | string[]
  learning_experiences?: string | string[]
}

function asText(v: string | string[] | undefined): string {
  if (!v) return "—"
  return Array.isArray(v) ? v.join("; ") : v
}

export function SchemeOfWorkPrint({
  schoolId, className, subjectLabel, termLabelText, items, onClose,
}: {
  schoolId: string; className: string; subjectLabel: string; termLabelText: string
  items: PrintSchemeItem[]; onClose: () => void
}) {
  const [schoolName, setSchoolName] = useState<string>("")
  const [defaults, setDefaults] = useState<Record<string, ContentDefaults>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: school } = await supabase.from("schools").select("name").eq("id", schoolId).single()
      if (!cancelled && school) setSchoolName(school.name)

      const contentIds = Array.from(new Set(items.map(i => i.curriculum_content_id).filter((id): id is string => !!id)))
      if (contentIds.length > 0) {
        const { data: rows } = await supabase
          .from("curriculum_content")
          .select("id,lesson_context")
          .in("id", contentIds)
        const map: Record<string, ContentDefaults> = {}
        for (const row of rows ?? []) {
          map[row.id] = (row.lesson_context ?? {}) as ContentDefaults
        }
        if (!cancelled) setDefaults(map)
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, items])

  const sorted = [...items].sort((a, b) => a.week - b.week || (a.lesson_number ?? 0) - (b.lesson_number ?? 0))

  return (
    <div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 999, overflow: "auto", padding: 16 }}>
      <style>{`
        @media print {
          .noprint { display: none !important; }
          body { background: #fff !important; }
        }
        .tsc-table { width: 100%; border-collapse: collapse; font-size: 10px; }
        .tsc-table th, .tsc-table td { border: 1px solid #333; padding: 4px 6px; vertical-align: top; text-align: left; }
        .tsc-table th { background: #f1f5f9; font-weight: 700; }
      `}</style>

      <div className="noprint" style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={() => window.print()} style={{ padding: "9px 16px", borderRadius: 10, background: "#111827", color: "#fff", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Print</button>
        <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: 10, background: "#f1f5f9", color: "#111827", border: "1px solid #cbd5e1", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Close</button>
      </div>

      {loading ? (
        <div style={{ padding: 20, fontSize: 13, color: "#64748b" }}>Loading content defaults…</div>
      ) : (
        <>
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 14 }}>{schoolName || "School"}</div>
            <div style={{ fontSize: 12 }}>Scheme of Work — {subjectLabel} — {className} — {termLabelText}</div>
          </div>

          <table className="tsc-table">
            <thead>
              <tr>
                <th>Wk</th><th>Lsn</th><th>Strand</th><th>Sub-strand</th>
                <th>Specific Learning Outcomes</th><th>Key Inquiry Question(s)</th>
                <th>Learning Experiences</th><th>Learning Resources</th>
                <th>Assessment Methods</th><th>Reflection</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(item => {
                const d = item.curriculum_content_id ? defaults[item.curriculum_content_id] : undefined
                return (
                  <tr key={item.id}>
                    <td>{item.week}</td>
                    <td>{item.lesson_number ?? "—"}</td>
                    <td>{item.strand ?? "—"}</td>
                    <td>{item.sub_strand ?? "—"}</td>
                    <td>{item.objectives || (d?.outcomes?.length ? d.outcomes.join("; ") : "—")}</td>
                    <td>{item.key_inquiry_question || asText(d?.key_inquiry_question)}</td>
                    <td>{item.learning_experiences || asText(d?.learning_experiences)}</td>
                    <td>{item.learning_resources || asText(d?.learning_resources)}</td>
                    <td>{item.assessment_methods || asText(d?.assessment_methods)}</td>
                    <td>{item.reflection || "—"}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
