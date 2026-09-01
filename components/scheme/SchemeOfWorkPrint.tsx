"use client"

import { useEffect, useMemo, useState } from "react"
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

function toItems(value: string): string[] {
  if (!value || value === "—") return []
  return value
    .split(/\n+|\s*;\s*|\s+\|\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function ReadableValue({ value }: { value: string }) {
  const parts = toItems(value)
  if (parts.length <= 1) return <>{value}</>
  return (
    <ul className="scheme-value-list">
      {parts.map((part, index) => <li key={`${part}-${index}`}>{part}</li>)}
    </ul>
  )
}

export function SchemeOfWorkPrint({
  schoolId, teacherId, className, subjectLabel, termLabelText, items, onClose,
}: {
  schoolId: string; teacherId?: string; className: string; subjectLabel: string; termLabelText: string
  items: PrintSchemeItem[]; onClose: () => void
}) {
  const [schoolName, setSchoolName] = useState<string>("")
  const [teacherName, setTeacherName] = useState<string>("")
  const [defaults, setDefaults] = useState<Record<string, ContentDefaults>>({})
  const [loading, setLoading] = useState(true)
  const generatedAt = useMemo(() => new Date(), [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const { data: school } = await supabase.from("schools").select("name").eq("id", schoolId).single()
        if (!cancelled && school) setSchoolName(school.name)

        if (teacherId) {
          const { data: teacher } = await supabase.from("profiles").select("full_name").eq("id", teacherId).maybeSingle()
          if (!cancelled && teacher?.full_name) setTeacherName(teacher.full_name)
        }

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
        } else if (!cancelled) {
          setDefaults({})
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [schoolId, teacherId, items])

  const sorted = useMemo(
    () => [...items].sort((a, b) => a.week - b.week || (a.lesson_number ?? 0) - (b.lesson_number ?? 0)),
    [items],
  )

  return (
    <div className="scheme-print-shell">
      <style>{`
        .scheme-print-shell {
          position: fixed;
          inset: 0;
          z-index: 999;
          overflow: auto;
          background: #ffffff;
          color: #111827;
          padding: 16px;
          -webkit-text-size-adjust: 100%;
          text-size-adjust: 100%;
        }
        .scheme-print-shell, .scheme-print-shell * { box-sizing: border-box; }
        .scheme-print-actions {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
          position: sticky;
          top: 0;
          z-index: 3;
          padding: 6px 0;
          background: rgba(255,255,255,.96);
        }
        .scheme-document-header { min-width: 0; color: #111827; }
        .scheme-school { text-align: center; font-weight: 800; font-size: 16px; color: #111827; }
        .scheme-title { text-align: center; font-size: 13px; color: #1f2937; margin-top: 2px; }
        .tsc-meta {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          font-size: 11px;
          color: #475569;
          margin: 8px 0;
        }
        .scheme-table-scroll {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          border-radius: 4px;
        }
        .tsc-table {
          width: 100%;
          min-width: 1180px;
          border-collapse: collapse;
          table-layout: fixed;
          font-size: 12px;
          line-height: 1.4;
          color: #111827;
          background: #ffffff;
        }
        .tsc-table th, .tsc-table td {
          border: 1px solid #334155;
          padding: 7px 8px;
          vertical-align: top;
          text-align: left;
          color: #111827 !important;
          opacity: 1 !important;
          background-clip: padding-box;
          overflow-wrap: anywhere;
          word-break: normal;
        }
        .tsc-table th {
          background: #f1f5f9 !important;
          font-weight: 800;
          line-height: 1.25;
        }
        .tsc-table .col-week { width: 4%; }
        .tsc-table .col-lesson { width: 4%; }
        .tsc-table .col-strand { width: 10%; }
        .tsc-table .col-substrand { width: 12%; }
        .tsc-table .col-outcomes { width: 23%; }
        .tsc-table .col-kiq { width: 12%; }
        .tsc-table .col-experiences { width: 14%; }
        .tsc-table .col-resources { width: 8%; }
        .tsc-table .col-assessment { width: 8%; }
        .tsc-table .col-reflection { width: 5%; }
        .scheme-value-list { margin: 0; padding-left: 18px; }
        .scheme-value-list li + li { margin-top: 3px; }
        .scheme-mobile-list { display: none; }
        .scheme-mobile-card {
          border: 1px solid #cbd5e1;
          border-radius: 14px;
          padding: 14px;
          background: #ffffff;
          color: #111827;
          box-shadow: 0 1px 2px rgba(15,23,42,.05);
        }
        .scheme-mobile-card + .scheme-mobile-card { margin-top: 12px; }
        .scheme-mobile-kicker { font-size: 12px; font-weight: 800; color: #4f46e5; margin-bottom: 3px; }
        .scheme-mobile-topic { font-size: 16px; font-weight: 800; line-height: 1.35; color: #111827; }
        .scheme-mobile-field { margin-top: 12px; }
        .scheme-mobile-label { font-size: 11px; font-weight: 800; letter-spacing: .02em; text-transform: uppercase; color: #64748b; margin-bottom: 3px; }
        .scheme-mobile-value { font-size: 14px; line-height: 1.55; color: #111827; }
        .tsc-sign {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          margin-top: 22px;
          font-size: 11px;
          color: #111827;
        }
        .tsc-sign-line { border-top: 1px solid #334155; padding-top: 4px; width: 46%; }
        .scheme-empty {
          padding: 24px;
          border: 1px dashed #cbd5e1;
          border-radius: 12px;
          text-align: center;
          color: #475569;
          font-size: 13px;
        }
        @media screen and (max-width: 760px) {
          .scheme-print-shell { padding: 12px; }
          .scheme-document-header { padding: 0 2px; }
          .scheme-school { font-size: 15px; }
          .scheme-title { font-size: 12px; line-height: 1.4; }
          .tsc-meta { flex-direction: column; gap: 2px; font-size: 11px; }
          .scheme-table-scroll { display: none; }
          .scheme-mobile-list { display: block; margin-top: 12px; }
          .tsc-sign { flex-direction: column; gap: 26px; }
          .tsc-sign-line { width: 100%; }
        }
        @media print {
          @page { size: A4 landscape; margin: 10mm 8mm; }
          html, body { background: #ffffff !important; color: #000000 !important; }
          body * { visibility: hidden !important; }
          .scheme-print-shell, .scheme-print-shell * { visibility: visible !important; }
          .noprint { display: none !important; }
          .scheme-print-shell {
            position: absolute;
            inset: 0 auto auto 0;
            width: 100%;
            overflow: visible;
            padding: 0;
            background: #ffffff !important;
            color: #000000 !important;
          }
          .scheme-mobile-list { display: none !important; }
          .scheme-table-scroll { overflow: visible; }
          .tsc-table {
            min-width: 0;
            width: 100%;
            font-size: 8.5pt;
            line-height: 1.25;
            color: #000000 !important;
            background: #ffffff !important;
          }
          .tsc-table th, .tsc-table td {
            padding: 4px 5px;
            color: #000000 !important;
            border-color: #000000 !important;
            opacity: 1 !important;
          }
          .tsc-table th { background: #f1f5f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          tr { break-inside: avoid; page-break-inside: avoid; }
          .tsc-meta, .tsc-sign { color: #000000 !important; }
        }
      `}</style>

      <div className="scheme-print-actions noprint">
        <button onClick={() => window.print()} style={{ padding: "10px 16px", borderRadius: 10, background: "#111827", color: "#fff", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Print</button>
        <button onClick={onClose} style={{ padding: "10px 16px", borderRadius: 10, background: "#f1f5f9", color: "#111827", border: "1px solid #cbd5e1", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Close</button>
      </div>

      {loading ? (
        <div style={{ padding: 20, fontSize: 13, color: "#475569" }}>Loading content defaults…</div>
      ) : (
        <>
          <div className="scheme-document-header">
            <div className="scheme-school">{schoolName || "School"}</div>
            <div className="scheme-title">Scheme of Work — {subjectLabel} — {className} — {termLabelText}</div>
            <div className="tsc-meta">
              <span>Teacher: {teacherName || "—"}</span>
              <span>Generated: {generatedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
            </div>
          </div>

          {sorted.length === 0 ? (
            <div className="scheme-empty">No Scheme rows are available for this selection.</div>
          ) : (
            <>
              <div className="scheme-table-scroll" aria-label="Scheme of work table">
                <table className="tsc-table">
                  <thead>
                    <tr>
                      <th className="col-week">Wk</th><th className="col-lesson">Lsn</th><th className="col-strand">Strand</th><th className="col-substrand">Sub-strand</th>
                      <th className="col-outcomes">Specific Learning Outcomes</th><th className="col-kiq">Key Inquiry Question(s)</th>
                      <th className="col-experiences">Learning Experiences</th><th className="col-resources">Learning Resources</th>
                      <th className="col-assessment">Assessment Methods</th><th className="col-reflection">Reflection</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(item => {
                      const d = item.curriculum_content_id ? defaults[item.curriculum_content_id] : undefined
                      const outcomes = item.objectives || (d?.outcomes?.length ? d.outcomes.join("; ") : "—")
                      const kiq = item.key_inquiry_question || asText(d?.key_inquiry_question)
                      const experiences = item.learning_experiences || asText(d?.learning_experiences)
                      const resources = item.learning_resources || asText(d?.learning_resources)
                      const assessment = item.assessment_methods || asText(d?.assessment_methods)
                      return (
                        <tr key={item.id}>
                          <td>{item.week}</td>
                          <td>{item.lesson_number ?? "—"}</td>
                          <td>{item.strand ?? "—"}</td>
                          <td>{item.sub_strand ?? "—"}</td>
                          <td><ReadableValue value={outcomes} /></td>
                          <td><ReadableValue value={kiq} /></td>
                          <td><ReadableValue value={experiences} /></td>
                          <td><ReadableValue value={resources} /></td>
                          <td><ReadableValue value={assessment} /></td>
                          <td>{item.reflection || "—"}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="scheme-mobile-list" aria-label="Readable scheme of work">
                {sorted.map(item => {
                  const d = item.curriculum_content_id ? defaults[item.curriculum_content_id] : undefined
                  const outcomes = item.objectives || (d?.outcomes?.length ? d.outcomes.join("; ") : "—")
                  const fields = [
                    ["Strand", item.strand ?? "—"],
                    ["Sub-strand", item.sub_strand ?? "—"],
                    ["Specific Learning Outcomes", outcomes],
                    ["Key Inquiry Question(s)", item.key_inquiry_question || asText(d?.key_inquiry_question)],
                    ["Learning Experiences", item.learning_experiences || asText(d?.learning_experiences)],
                    ["Learning Resources", item.learning_resources || asText(d?.learning_resources)],
                    ["Assessment Methods", item.assessment_methods || asText(d?.assessment_methods)],
                    ["Reflection", item.reflection || "—"],
                  ] as const
                  return (
                    <article className="scheme-mobile-card" key={`mobile-${item.id}`}>
                      <div className="scheme-mobile-kicker">Week {item.week} · Lesson {item.lesson_number ?? "—"}</div>
                      <div className="scheme-mobile-topic">{item.topic || item.sub_strand || item.strand || "Scheme lesson"}</div>
                      {fields.map(([label, value]) => (
                        <div className="scheme-mobile-field" key={label}>
                          <div className="scheme-mobile-label">{label}</div>
                          <div className="scheme-mobile-value"><ReadableValue value={value} /></div>
                        </div>
                      ))}
                    </article>
                  )
                })}
              </div>
            </>
          )}

          <div className="tsc-sign">
            <div className="tsc-sign-line">Teacher&apos;s Signature &amp; Date</div>
            <div className="tsc-sign-line">Head Teacher&apos;s Signature &amp; Date</div>
          </div>
        </>
      )}
    </div>
  )
}
