"use client"
export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getAdminSchoolAuthority } from "@/lib/admin/authority"

interface TermRow {
  id: string
  name: string
  term: number
  academic_year: number
  start_date: string
  end_date: string
  status: string
}

const fieldStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: "11px 12px",
  background: "white",
  fontSize: 14,
}

export default function AdminTermSettingsPage() {
  const router = useRouter()
  const currentYear = new Date().getFullYear()
  const [schoolId, setSchoolId] = useState("")
  const [terms, setTerms] = useState<TermRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState({ term: "1", academicYear: String(currentYear), startDate: "", endDate: "" })

  useEffect(() => {
    void bootstrap()
  }, [])

  async function bootstrap() {
    setLoading(true)
    setError("")
    try {
      const authority = await getAdminSchoolAuthority()
      setSchoolId(authority.schoolId)
      await loadTerms(authority.schoolId)
    } catch (cause) {
      console.error("Admin term setup failed", cause)
      setError(cause instanceof Error ? cause.message : "Academic terms could not be loaded.")
    } finally {
      setLoading(false)
    }
  }

  async function loadTerms(sid: string) {
    const { data, error: queryError } = await supabase
      .from("academic_terms")
      .select("id,name,term,academic_year,start_date,end_date,status")
      .eq("school_id", sid)
      .order("academic_year", { ascending: false })
      .order("term", { ascending: false })
    if (queryError) throw queryError
    setTerms((data ?? []) as TermRow[])
  }

  async function saveTerm() {
    if (!schoolId || !form.startDate || !form.endDate || saving) return
    if (form.endDate < form.startDate) {
      setError("End date must be on or after the start date.")
      return
    }
    setSaving(true)
    setError("")
    try {
      const { error: rpcError } = await supabase.rpc(
        "admin_upsert_academic_term" as never,
        {
          p_school_id: schoolId,
          p_term: Number(form.term),
          p_academic_year: Number(form.academicYear),
          p_start_date: form.startDate,
          p_end_date: form.endDate,
        } as never
      )
      if (rpcError) throw rpcError
      setForm({ term: "1", academicYear: String(currentYear), startDate: "", endDate: "" })
      await loadTerms(schoolId)
    } catch (cause) {
      console.error("Admin term upsert failed", cause)
      setError(cause instanceof Error ? cause.message : "Term could not be saved.")
    } finally {
      setSaving(false)
    }
  }

  async function activateTerm(id: string) {
    if (!schoolId || saving) return
    setSaving(true)
    setError("")
    try {
      const { error: rpcError } = await supabase.rpc(
        "admin_activate_academic_term" as never,
        { p_school_id: schoolId, p_term_id: id } as never
      )
      if (rpcError) throw rpcError
      await loadTerms(schoolId)
    } catch (cause) {
      console.error("Admin term activation failed", cause)
      setError(cause instanceof Error ? cause.message : "Term could not be activated.")
    } finally {
      setSaving(false)
    }
  }

  async function removeUnusedTerm(id: string) {
    if (!schoolId || saving) return
    setSaving(true)
    setError("")
    try {
      const { error: rpcError } = await supabase.rpc(
        "admin_delete_unused_academic_term" as never,
        { p_school_id: schoolId, p_term_id: id } as never
      )
      if (rpcError) throw rpcError
      await loadTerms(schoolId)
    } catch (cause) {
      console.error("Admin term removal failed", cause)
      setError(cause instanceof Error ? cause.message : "Used or active terms cannot be removed.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div aria-busy="true" style={{ minHeight: 220, borderRadius: 18, background: "#e2e8f0" }} />

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", display: "grid", gap: 18 }}>
      <header style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button aria-label="Back" onClick={() => router.back()} style={{ border: 0, background: "transparent", fontSize: 26, cursor: "pointer" }}>‹</button>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>Academic terms</h1>
          <p style={{ color: "#64748b", margin: "4px 0 0" }}>One active school term controls current academic context. Re-saving the same year/term updates it rather than duplicating it.</p>
        </div>
      </header>

      {error && <div role="alert" style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 12, padding: 12 }}>{error}</div>}

      <section style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, display: "grid", gap: 10 }}>
        <strong>Add or update term</strong>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 9 }}>
          <select value={form.term} onChange={event => setForm(current => ({ ...current, term: event.target.value }))} style={fieldStyle}>
            <option value="1">Term 1</option><option value="2">Term 2</option><option value="3">Term 3</option>
          </select>
          <select value={form.academicYear} onChange={event => setForm(current => ({ ...current, academicYear: event.target.value }))} style={fieldStyle}>
            {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map(year => <option key={year} value={year}>{year}</option>)}
          </select>
        </div>
        <label>Start date<input type="date" value={form.startDate} onChange={event => setForm(current => ({ ...current, startDate: event.target.value }))} style={fieldStyle} /></label>
        <label>End date<input type="date" value={form.endDate} onChange={event => setForm(current => ({ ...current, endDate: event.target.value }))} style={fieldStyle} /></label>
        <button disabled={saving || !form.startDate || !form.endDate} onClick={() => void saveTerm()} style={{ border: 0, borderRadius: 11, padding: 12, background: "#10b981", color: "white", fontWeight: 780, cursor: "pointer" }}>{saving ? "Saving…" : "Save term"}</button>
      </section>

      <section style={{ display: "grid", gap: 8 }}>
        {terms.length === 0 ? (
          <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: 26, textAlign: "center" }}><strong>No academic terms yet</strong><p style={{ color: "#64748b" }}>Create the first term above, then activate it.</p></div>
        ) : terms.map(term => (
          <article key={term.id} style={{ background: "white", border: `1px solid ${term.status === "active" ? "#86efac" : "#e2e8f0"}`, borderRadius: 14, padding: 14, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <strong>{term.name} {term.academic_year}</strong>
              <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>{term.start_date} → {term.end_date} · <span style={{ textTransform: "capitalize" }}>{term.status}</span></div>
            </div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              <button onClick={() => router.push(`/admin/settings/term/${term.id}/weeks`)} style={{ border: "1px solid #cbd5e1", borderRadius: 9, padding: "7px 10px", background: "white", cursor: "pointer" }}>Weeks</button>
              {term.status !== "active" && <button disabled={saving} onClick={() => void activateTerm(term.id)} style={{ border: 0, borderRadius: 9, padding: "7px 10px", background: "#10b981", color: "white", fontWeight: 730, cursor: "pointer" }}>Activate</button>}
              {term.status !== "active" && <button disabled={saving} onClick={() => void removeUnusedTerm(term.id)} style={{ border: "1px solid #fecaca", borderRadius: 9, padding: "7px 10px", background: "#fef2f2", color: "#b91c1c", cursor: "pointer" }}>Remove if unused</button>}
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}
