"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

interface WeekRow {
  week_number: number
  start_date: string
  end_date: string
  week_type: string
  label: string | null
  is_override: boolean
}

type TermWeekDBRow = {
  week_number: number
  start_date: string
  end_date: string
  week_type: string
  label: string | null
}

const WEEK_TYPES = [
  { value: "normal", label: "Normal" },
  { value: "exam", label: "Exam" },
  { value: "midterm_break", label: "Mid-Term Break" },
  { value: "sports", label: "Sports" },
  { value: "holiday", label: "Holiday" },
]

export default function TermWeeksPage() {
  const router = useRouter()
  const params = useParams()
  const termId = params.termId as string

  const [schoolId, setSchoolId] = useState("")
  const [termLabel, setTermLabel] = useState("")
  const [weeks, setWeeks] = useState<WeekRow[]>([])
  const [loading, setLoading] = useState(true)
  const [savingWeek, setSavingWeek] = useState<number | null>(null)
  const [error, setError] = useState("")

  const C = { card: "#ffffff", border: "#e2e8f0", text: "#0f172a", muted: "#64748b", emerald: "#10b981", red: "#ef4444", amber: "#f59e0b", purple: "#8b5cf6" }

  const loadWeeks = useCallback(async (sid: string, tid: string) => {
    const { data: termRow } = await supabase
      .from("academic_terms")
      .select("name,academic_year")
      .eq("id", tid)
      .single()
    if (termRow) setTermLabel(`${termRow.name} ${termRow.academic_year}`)

    const { data: nationalRows } = await supabase
      .from("term_weeks")
      .select("week_number,start_date,end_date,week_type,label")
      .eq("term_id", tid)
      .is("school_id", null)
      .order("week_number", { ascending: true })

    const { data: overrideRows } = await supabase
      .from("term_weeks")
      .select("week_number,start_date,end_date,week_type,label")
      .eq("term_id", tid)
      .eq("school_id", sid)

    const overrideByWeek = new Map<number, TermWeekDBRow>(
      (overrideRows ?? []).map((r): [number, TermWeekDBRow] => [r.week_number, r])
    )

    const merged: WeekRow[] = ((nationalRows ?? []) as TermWeekDBRow[]).map(n => {
      const o = overrideByWeek.get(n.week_number)
      return o
        ? { week_number: n.week_number, start_date: o.start_date, end_date: o.end_date, week_type: o.week_type, label: o.label, is_override: true }
        : { week_number: n.week_number, start_date: n.start_date, end_date: n.end_date, week_type: n.week_type, label: n.label, is_override: false }
    })

    setWeeks(merged)
  }, [])

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push("/admin/login"); return }
        const { data: p } = await supabase.from("profiles").select("school_id").eq("id", user.id).single()
        if (!p?.school_id) { router.push("/admin/login"); return }
        setSchoolId(p.school_id)
        await loadWeeks(p.school_id, termId)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    })()
  }, [termId, loadWeeks, router])

  async function updateWeekType(week: WeekRow, newType: string) {
    setSavingWeek(week.week_number)
    setError("")
    try {
      const { error: upsertError } = await supabase
        .from("term_weeks")
        .upsert(
          {
            school_id: schoolId,
            term_id: termId,
            week_number: week.week_number,
            start_date: week.start_date,
            end_date: week.end_date,
            week_type: newType,
            label: week.label,
          },
          { onConflict: "term_id,week_number,school_id" }
        )
      if (upsertError) throw upsertError
      await loadWeeks(schoolId, termId)
    } catch (e: any) {
      setError(e.message ?? "Failed to save")
    } finally {
      setSavingWeek(null)
    }
  }

  const typeColor = (type: string) =>
    type === "exam" ? C.red : type === "sports" ? C.amber : type === "holiday" || type === "midterm_break" ? C.purple : C.border

  if (loading) return (
    <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
      {[1,2,3].map(i => <div key={i} style={{ height: "56px", background: "#e2e8f0", borderRadius: "12px", opacity: 0.6 }} />)}
    </div>
  )

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", color: C.muted, fontSize: "24px", cursor: "pointer", padding: "0" }}>‹</button>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "700", color: C.text, margin: 0 }}>Week Calendar</h1>
          <p style={{ fontSize: "13px", color: C.muted, margin: "2px 0 0" }}>{termLabel}</p>
        </div>
      </div>

      {error && <p style={{ color: C.red, fontSize: "13px", margin: 0 }}>{error}</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {weeks.map(w => (
          <div key={w.week_number} style={{ background: C.card, borderRadius: "12px", padding: "14px 16px", border: `1px solid ${typeColor(w.week_type)}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: "14px", fontWeight: "700", color: C.text, margin: 0 }}>
                Week {w.week_number}
                {w.is_override && <span style={{ fontSize: "10px", color: C.purple, fontWeight: "700", marginLeft: "6px" }}>· CUSTOM</span>}
              </p>
              <p style={{ fontSize: "12px", color: C.muted, margin: "3px 0 0" }}>{w.start_date} → {w.end_date}</p>
            </div>
            <select
              value={w.week_type}
              disabled={savingWeek === w.week_number}
              onChange={e => updateWeekType(w, e.target.value)}
              style={{ fontSize: "13px", fontWeight: "700", color: C.text, border: `1px solid ${C.border}`, borderRadius: "8px", padding: "8px 10px", background: C.card, flexShrink: 0 }}
            >
              {WEEK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  )
}
