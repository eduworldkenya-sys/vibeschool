"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

interface ParentChildBrief {
  student_id: string
  name: string
  class_name: string
  school_name: string
  attendance: { marked: number; present: number; absent: number; late: number; percentage: number | null }
  homework: { assigned: number; submitted: number; marked: number; overdue: number; feedback_released: number }
  latest_summary: {
    teacher_comment?: string | null
    strengths?: string[]
    focus_areas?: string[]
    period_start?: string
    period_end?: string
  } | null
  recent_messages: Array<{ id: string; subject: string | null; body: string; sent_at: string }>
}

interface ParentBrief {
  period_days: number
  children: ParentChildBrief[]
}

export default function ClassroomLearningBrief() {
  const [brief, setBrief] = useState<ParentBrief | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data, error: rpcError } = await (supabase as any).rpc("parent_get_classroom_learning_brief")
      if (!active) return
      if (rpcError) setError("Learning updates are temporarily unavailable.")
      else setBrief(data as ParentBrief)
    })()
    return () => { active = false }
  }, [])

  if (error) return <section style={notice}>{error}</section>
  if (!brief || brief.children.length === 0) return null

  return (
    <section style={section}>
      <div style={{ marginBottom: 12 }}>
        <div style={eyebrow}>CLASSROOM LEARNING LOOP · LAST {brief.period_days} DAYS</div>
        <h2 style={title}>What teaching produced</h2>
      </div>
      {brief.children.map(child => (
        <article key={child.student_id} style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div>
              <strong style={{ color: "#111827" }}>{child.name}</strong>
              <div style={muted}>{child.class_name} · {child.school_name}</div>
            </div>
            <strong style={{ color: child.attendance.percentage != null && child.attendance.percentage < 80 ? "#b45309" : "#047857" }}>
              {child.attendance.percentage == null ? "—" : child.attendance.percentage + "%"} attendance
            </strong>
          </div>
          <div style={grid}>
            <Metric label="Assigned" value={child.homework.assigned} />
            <Metric label="Submitted" value={child.homework.submitted} />
            <Metric label="Marked" value={child.homework.marked} />
            <Metric label="Needs action" value={child.homework.overdue} alert={child.homework.overdue > 0} />
          </div>
          {child.latest_summary?.teacher_comment && (
            <div style={summary}>
              <div style={eyebrow}>PUBLISHED TEACHER SUMMARY</div>
              <div style={{ marginTop: 5 }}>{child.latest_summary.teacher_comment}</div>
            </div>
          )}
          {child.recent_messages[0] && (
            <div style={summary}>
              <div style={eyebrow}>LATEST SCHOOL UPDATE</div>
              <strong style={{ display: "block", marginTop: 5 }}>{child.recent_messages[0].subject ?? "Learning update"}</strong>
              <div style={muted}>{child.recent_messages[0].body}</div>
            </div>
          )}
        </article>
      ))}
    </section>
  )
}

function Metric({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) {
  return <div style={{ ...metric, background: alert ? "#fff7ed" : "#f8fafc" }}><strong style={{ color: alert ? "#c2410c" : "#111827" }}>{value}</strong><span style={muted}>{label}</span></div>
}

const section: React.CSSProperties = { marginBottom: 14 }
const card: React.CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 15, marginBottom: 10 }
const title: React.CSSProperties = { margin: "3px 0 0", color: "#111827", fontSize: 16 }
const eyebrow: React.CSSProperties = { fontSize: 9, fontWeight: 900, color: "#4f46e5", letterSpacing: .7 }
const muted: React.CSSProperties = { fontSize: 10, color: "#6b7280", lineHeight: 1.45, marginTop: 3 }
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 6, marginTop: 12 }
const metric: React.CSSProperties = { minWidth: 0, borderRadius: 10, padding: 8, display: "grid", gap: 2 }
const summary: React.CSSProperties = { marginTop: 10, padding: 10, borderRadius: 10, background: "#f5f3ff", color: "#312e81", fontSize: 11, lineHeight: 1.45 }
const notice: React.CSSProperties = { marginBottom: 12, padding: 12, borderRadius: 12, background: "#fff7ed", color: "#9a3412", fontSize: 11 }
