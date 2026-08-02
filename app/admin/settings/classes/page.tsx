"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

const GRADES = ["PP1","PP2","Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6","Grade 7","Grade 8","Grade 9"]

interface ClassRow {
  id: string
  name: string
  stream: string | null
}

export default function ClassesSettingsPage() {
  const router = useRouter()
  const [schoolId, setSchoolId] = useState("")
  const [classes,  setClasses]  = useState<ClassRow[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error,    setError]    = useState("")
  const [grade,    setGrade]    = useState("")
  const [stream,   setStream]   = useState("")

  useEffect(() => { boot() }, [])

  async function boot() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/admin/login"); return }
      const { data: p } = await supabase.from("profiles").select("school_id").eq("id", user.id).single()
      if (!p?.school_id) { router.push("/admin/login"); return }
      setSchoolId(p.school_id)
      await loadClasses(p.school_id)
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  async function loadClasses(sid: string) {
    const { data } = await supabase.from("classes").select("id, name, stream").eq("school_id", sid).order("name")
    setClasses(data ?? [])
  }

  async function addClass() {
    if (!grade) { setError("Select a grade"); return }
    setError(""); setSaving(true)
    try {
      const { error: err } = await supabase.from("classes").insert({ name: grade, stream: stream.trim() || null, school_id: schoolId })
      if (err) throw err
      setGrade(""); setStream("")
      await loadClasses(schoolId)
    } catch (e: any) { setError(e?.message ?? "Failed to add class") } finally { setSaving(false) }
  }

  async function deleteClass(id: string) {
    setDeleting(id)
    try {
      const { error: err } = await supabase.from("classes").delete().eq("id", id)
      if (err) throw err
      await loadClasses(schoolId)
    } catch (e: any) { setError(e?.message ?? "Failed to delete") } finally { setDeleting(null) }
  }

  const C = { bg: "#f0f4f8", card: "#ffffff", border: "#e2e8f0", text: "#0f172a", muted: "#64748b", emerald: "#10b981", red: "#ef4444" }

  if (loading) return (
    <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
      {[1,2,3].map(i => <div key={i} style={{ height: "56px", background: "#e2e8f0", borderRadius: "12px", opacity: 0.6 }} />)}
    </div>
  )

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", color: C.muted, fontSize: "24px", cursor: "pointer", padding: "0" }}>‹</button>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "700", color: C.text, margin: 0 }}>Classes</h1>
          <p style={{ fontSize: "13px", color: C.muted, margin: "2px 0 0" }}>Manage classes and streams for your school</p>
        </div>
      </div>

      <div style={{ background: C.card, borderRadius: "16px", padding: "18px", border: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: "12px" }}>
        <p style={{ fontSize: "13px", fontWeight: "700", color: C.text, margin: 0, textTransform: "uppercase", letterSpacing: "0.8px" }}>Add New Class</p>
        <select value={grade} onChange={e => setGrade(e.target.value)} style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: `1px solid ${C.border}`, fontSize: "14px", color: grade ? C.text : C.muted, background: C.card, outline: "none" }}>
          <option value="">Select Grade / Level</option>
          {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <input value={stream} onChange={e => setStream(e.target.value)} placeholder="Stream name e.g. Blue, East, A (optional)" style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: `1px solid ${C.border}`, fontSize: "14px", color: C.text, background: C.card, outline: "none", boxSizing: "border-box" }} />
        <p style={{ fontSize: "11px", color: C.muted, margin: "-4px 0 0", paddingLeft: "4px" }}>Stream is optional — use it if you have multiple classes per grade (e.g. Grade 4 Blue, Grade 4 Red)</p>
        {error && <p style={{ color: C.red, fontSize: "13px", margin: 0 }}>{error}</p>}
        <button onClick={addClass} disabled={saving} style={{ background: C.emerald, border: "none", borderRadius: "10px", padding: "13px", color: "#fff", fontSize: "14px", fontWeight: "700", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
          {saving ? "Adding..." : "+ Add Class"}
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <p style={{ fontSize: "10px", fontWeight: "700", color: C.muted, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "1px" }}>All Classes ({classes.length})</p>
        {classes.length === 0 ? (
          <div style={{ background: C.card, borderRadius: "14px", padding: "32px 20px", textAlign: "center", border: `1px solid ${C.border}` }}>
            <p style={{ color: C.muted, fontSize: "14px", margin: 0 }}>No classes yet. Add your first class above.</p>
          </div>
        ) : classes.map(cls => (
          <div key={cls.id} style={{ background: C.card, borderRadius: "12px", padding: "14px 16px", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button onClick={() => router.push("/admin/students")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
              <p style={{ fontSize: "15px", fontWeight: "600", color: C.text, margin: 0 }}>{cls.name}{cls.stream ? ` ${cls.stream}` : ""}</p>
              {cls.stream && <p style={{ fontSize: "12px", color: C.muted, margin: "2px 0 0" }}>Stream: {cls.stream}</p>}
              <p style={{ fontSize: "11px", color: C.emerald, margin: "4px 0 0", fontWeight: "600" }}>View students →</p>
            </button>
            <button onClick={() => deleteClass(cls.id)} disabled={deleting === cls.id} style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "8px", padding: "6px 12px", color: C.red, fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>
              {deleting === cls.id ? "..." : "Delete"}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
