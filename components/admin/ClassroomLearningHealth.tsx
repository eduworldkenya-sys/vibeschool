"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

interface Health {
  period_days: number
  scheduled_occurrences: number
  completed_occurrences: number
  occurrences_with_attendance: number
  occurrences_with_homework: number
  occurrences_with_evidence: number
  occurrences_with_progress: number
  learners: number
  linked_parents: number
  homework_submissions: number
  released_feedback: number
}

export default function ClassroomLearningHealth() {
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from("profiles").select("school_id").eq("id", user.id).maybeSingle()
      if (!profile?.school_id) {
        if (active) setError(true)
        return
      }
      const { data, error: rpcError } = await (supabase as any).rpc("admin_get_classroom_learning_health", { p_school_id: profile.school_id })
      if (!active) return
      if (rpcError) setError(true)
      else setHealth(data as Health)
    })()
    return () => { active = false }
  }, [])

  if (error) return <section style={warning}>Classroom learning health is temporarily unavailable.</section>
  if (!health) return null

  const completion = percent(health.completed_occurrences, health.scheduled_occurrences)
  const attendance = percent(health.occurrences_with_attendance, health.completed_occurrences)
  const progress = percent(health.occurrences_with_progress, health.completed_occurrences)

  return (
    <section style={card}>
      <div style={eyebrow}>CLASSROOM DELIVERY · LAST {health.period_days} DAYS</div>
      <h2 style={title}>Did teaching reach learners and families?</h2>
      <div style={grid}>
        <Metric label="Lessons completed" value={completion + "%"} />
        <Metric label="Attendance captured" value={attendance + "%"} />
        <Metric label="Progress recorded" value={progress + "%"} />
        <Metric label="Parents linked" value={health.linked_parents + "/" + health.learners} />
      </div>
      <div style={details}>
        <span>{health.occurrences_with_homework} lessons issued linked homework</span>
        <span>{health.occurrences_with_evidence} lessons produced evidence</span>
        <span>{health.homework_submissions} submissions · {health.released_feedback} feedback released</span>
      </div>
    </section>
  )
}

function percent(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0
}
function Metric({ label, value }: { label: string; value: string }) {
  return <div style={metric}><strong style={{ fontSize: 17, color: "#0f172a" }}>{value}</strong><span style={{ fontSize: 9, color: "#64748b" }}>{label}</span></div>
}
const card: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, padding: 16, marginBottom: 14 }
const title: React.CSSProperties = { margin: "4px 0 12px", fontSize: 16, color: "#0f172a" }
const eyebrow: React.CSSProperties = { fontSize: 9, fontWeight: 900, letterSpacing: .7, color: "#0369a1" }
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 7 }
const metric: React.CSSProperties = { display: "grid", gap: 3, minWidth: 0, padding: 9, borderRadius: 11, background: "#f8fafc" }
const details: React.CSSProperties = { display: "grid", gap: 4, marginTop: 11, fontSize: 10, color: "#64748b" }
const warning: React.CSSProperties = { padding: 12, marginBottom: 12, borderRadius: 12, background: "#fff7ed", color: "#9a3412", fontSize: 11 }
