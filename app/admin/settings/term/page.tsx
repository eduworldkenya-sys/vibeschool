"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

interface Term {
  id: string; name: string; term: number; academic_year: number
  start_date: string; end_date: string; status: string
}

const TERM_NAMES: Record<number, string> = { 1: "Term 1", 2: "Term 2", 3: "Term 3" }

export default function TermSettingsPage() {
  const router = useRouter()
  const [schoolId, setSchoolId] = useState("")
  const [terms,    setTerms]    = useState<Term[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState("")
  const [form, setForm] = useState({
    term: "1", academic_year: new Date().getFullYear().toString(),
    start_date: "", end_date: ""
  })

  useEffect(() => { boot() }, [])

  async function boot() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/admin/login"); return }
      const { data: p } = await supabase.from("profiles").select("school_id").eq("id", user.id).single()
      if (!p?.school_id) { router.push("/admin/login"); return }
      setSchoolId(p.school_id)
      await loadTerms(p.school_id)
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  async function loadTerms(sid: string) {
    const { data } = await supabase
      .from("academic_terms")
      .select("id,name,term,academic_year,start_date,end_date,status")
      .eq("school_id", sid)
      .order("academic_year", { ascending: false })
      .order("term", { ascending: false })
    setTerms(data ?? [])
  }

  async function addTerm() {
    if (!form.start_date || !form.end_date) { setError("Start and end dates are required"); return }
    setError(""); setSaving(true)
    try {
      const termNum = parseInt(form.term)
      const year    = parseInt(form.academic_year)
      const name    = TERM_NAMES[termNum]
      const { error: err } = await supabase.from("academic_terms").insert({
        school_id: schoolId, name, term: termNum, academic_year: year,
        start_date: form.start_date, end_date: form.end_date, status: "inactive"
      })
      if (err) throw err
      setForm({ term: "1", academic_year: new Date().getFullYear().toString(), start_date: "", end_date: "" })
      await loadTerms(schoolId)
    } catch (e: any) { setError(e?.message ?? "Failed to add term") } finally { setSaving(false) }
  }

  async function activateTerm(id: string) {
    try {
      await supabase.from("academic_terms").update({ status: "inactive" }).eq("school_id", schoolId)
      await supabase.from("academic_terms").update({ status: "active" }).eq("id", id)
      await loadTerms(schoolId)
    } catch (e: any) { setError(e?.message ?? "Failed to activate") }
  }

  async function deleteTerm(id: string) {
    try {
      const { error: err } = await supabase.from("academic_terms").delete().eq("id", id)
      if (err) throw err
      await loadTerms(schoolId)
    } catch (e: any) { setError(e?.message ?? "Failed to delete") }
  }

  const C = { card: "#ffffff", border: "#e2e8f0", text: "#0f172a", muted: "#64748b", emerald: "#10b981", red: "#ef4444", amber: "#f59e0b" }

  const inputStyle = { width: "100%", padding: "12px 14px", borderRadius: "10px", border: `1px solid ${C.border}`, fontSize: "14px", color: C.text, background: C.card, outline: "none", boxSizing: "border-box" as const }

  if (loading) return (
    <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
      {[1,2].map(i => <div key={i} style={{ height: "60px", background: "#e2e8f0", borderRadius: "12px", opacity: 0.6 }} />)}
    </div>
  )

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>

      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", color: C.muted, fontSize: "24px", cursor: "pointer", padding: "0" }}>‹</button>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "700", color: C.text, margin: 0 }}>Academic Terms</h1>
          <p style={{ fontSize: "13px", color: C.muted, margin: "2px 0 0" }}>Set and activate terms for your school</p>
        </div>
      </div>

      {/* Add Term Form */}
      <div style={{ background: C.card, borderRadius: "16px", padding: "18px", border: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: "12px" }}>
        <p style={{ fontSize: "13px", fontWeight: "700", color: C.text, margin: 0, textTransform: "uppercase", letterSpacing: "0.8px" }}>Add New Term</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <select value={form.term} onChange={e => setForm(f => ({ ...f, term: e.target.value }))} style={inputStyle}>
            <option value="1">Term 1</option>
            <option value="2">Term 2</option>
            <option value="3">Term 3</option>
          </select>
          <select value={form.academic_year} onChange={e => setForm(f => ({ ...f, academic_year: e.target.value }))} style={inputStyle}>
            {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "11px", fontWeight: "600", color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Start Date</label>
          <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} style={inputStyle} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "11px", fontWeight: "600", color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px" }}>End Date</label>
          <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} style={inputStyle} />
        </div>

        {error && <p style={{ color: C.red, fontSize: "13px", margin: 0 }}>{error}</p>}

        <button onClick={addTerm} disabled={saving} style={{ background: C.emerald, border: "none", borderRadius: "10px", padding: "13px", color: "#fff", fontSize: "14px", fontWeight: "700", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
          {saving ? "Adding..." : "+ Add Term"}
        </button>
      </div>

      {/* Terms List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <p style={{ fontSize: "10px", fontWeight: "700", color: C.muted, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "1px" }}>All Terms ({terms.length})</p>

        {terms.length === 0 ? (
          <div style={{ background: C.card, borderRadius: "14px", padding: "32px 20px", textAlign: "center", border: `1px solid ${C.border}` }}>
            <p style={{ color: C.muted, fontSize: "14px", margin: 0 }}>No terms yet. Add your first term above.</p>
          </div>
        ) : terms.map(t => (
          <div key={t.id} style={{ background: C.card, borderRadius: "12px", padding: "14px 16px", border: `1px solid ${t.status === "active" ? C.emerald : C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <p style={{ fontSize: "15px", fontWeight: "600", color: C.text, margin: 0 }}>{t.name} {t.academic_year}</p>
                {t.status === "active" && <span style={{ background: "rgba(16,185,129,0.1)", color: C.emerald, fontSize: "10px", fontWeight: "700", padding: "2px 8px", borderRadius: "99px" }}>ACTIVE</span>}
              </div>
              <p style={{ fontSize: "12px", color: C.muted, margin: "3px 0 0" }}>{t.start_date} → {t.end_date}</p>
            </div>
            <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
              {t.status !== "active" && (
                <button onClick={() => activateTerm(t.id)} style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "8px", padding: "6px 10px", color: C.emerald, fontSize: "11px", fontWeight: "700", cursor: "pointer" }}>
                  Activate
                </button>
              )}
              <button onClick={() => deleteTerm(t.id)} style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "8px", padding: "6px 10px", color: C.red, fontSize: "11px", fontWeight: "700", cursor: "pointer" }}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
