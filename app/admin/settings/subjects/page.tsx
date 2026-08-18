"use client"
export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getAdminSchoolAuthority } from "@/lib/admin/authority"

type SubjectRow = { id: string; name: string; global_subject_id: string | null }

const fieldStyle = { width: "100%", boxSizing: "border-box" as const, border: "1px solid #cbd5e1", borderRadius: 10, padding: "11px 12px", background: "white", fontSize: 14 }

export default function AdminSubjectsSettingsPage() {
  const router = useRouter()
  const [schoolId, setSchoolId] = useState("")
  const [subjects, setSubjects] = useState<SubjectRow[]>([])
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => { void bootstrap() }, [])

  async function bootstrap() {
    setLoading(true)
    setError("")
    try {
      const authority = await getAdminSchoolAuthority()
      setSchoolId(authority.schoolId)
      await loadSubjects(authority.schoolId)
    } catch (cause) {
      console.error("Admin subject setup failed", cause)
      setError(cause instanceof Error ? cause.message : "Subjects could not be loaded.")
    } finally {
      setLoading(false)
    }
  }

  async function loadSubjects(sid: string) {
    const { data, error: queryError } = await supabase.from("subjects").select("id,name,global_subject_id").eq("school_id", sid).order("name")
    if (queryError) throw queryError
    setSubjects((data ?? []) as SubjectRow[])
  }

  async function addSubject() {
    const value = name.trim().replace(/\s+/g, " ")
    if (!schoolId || !value || saving) return
    setSaving(true)
    setError("")
    try {
      if (subjects.some(row => row.name.trim().toLowerCase() === value.toLowerCase())) throw new Error("That subject already exists in this school.")
      const { error: insertError } = await supabase.from("subjects").insert({ school_id: schoolId, name: value })
      if (insertError) throw insertError
      setName("")
      await loadSubjects(schoolId)
    } catch (cause) {
      console.error("Admin subject creation failed", cause)
      setError(cause instanceof Error ? cause.message : "Subject could not be created.")
    } finally {
      setSaving(false)
    }
  }

  async function removeUnusedSubject(row: SubjectRow) {
    if (!schoolId || saving) return
    setSaving(true)
    setError("")
    try {
      const [assignments, timetable, schemes, lessons, assessments, results] = await Promise.all([
        supabase.from("teacher_classes").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("subject_id", row.id),
        supabase.from("timetable_slots").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("subject_id", row.id),
        supabase.from("scheme_of_work").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("subject_id", row.id),
        supabase.from("lesson_plans").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("subject_id", row.id),
        supabase.from("assessment_definitions").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("subject_id", row.id),
        supabase.from("exam_results").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("subject_id", row.id),
      ])
      const firstError = [assignments.error, timetable.error, schemes.error, lessons.error, assessments.error, results.error].find(Boolean)
      if (firstError) throw firstError
      const evidence = [assignments.count, timetable.count, schemes.count, lessons.count, assessments.count, results.count].reduce((sum, count) => sum + (count ?? 0), 0)
      if (evidence > 0) throw new Error("This subject is already used by teaching, timetable or assessment records and cannot be deleted.")
      const { error: deleteError } = await supabase.from("subjects").delete().eq("id", row.id).eq("school_id", schoolId)
      if (deleteError) throw deleteError
      await loadSubjects(schoolId)
    } catch (cause) {
      console.error("Admin subject removal failed", cause)
      setError(cause instanceof Error ? cause.message : "Subject could not be removed.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div aria-busy="true" style={{ minHeight: 220, borderRadius: 18, background: "#e2e8f0" }} />

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", display: "grid", gap: 18 }}>
      <header style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button aria-label="Back" onClick={() => router.back()} style={{ border: 0, background: "transparent", fontSize: 26, cursor: "pointer" }}>‹</button>
        <div><h1 style={{ margin: 0, fontSize: 24 }}>Subjects</h1><p style={{ color: "#64748b", margin: "4px 0 0" }}>One stable subject ID is reused by teacher assignments, timetable, schemes, lessons, assessments and results.</p></div>
      </header>
      {error && <div role="alert" style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 12, padding: 12 }}>{error}</div>}
      <section style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 9 }}>
        <input value={name} onChange={event => setName(event.target.value)} placeholder="Subject name, e.g. Mathematics" style={fieldStyle} />
        <button disabled={saving || !name.trim()} onClick={() => void addSubject()} style={{ border: 0, borderRadius: 10, padding: "0 15px", background: "#10b981", color: "white", fontWeight: 780, cursor: "pointer" }}>{saving ? "…" : "Add"}</button>
      </section>
      <section style={{ display: "grid", gap: 8 }}>
        {subjects.length === 0 ? <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: 26, textAlign: "center" }}><strong>No school subjects configured</strong><p style={{ color: "#64748b" }}>Add the subjects this school teaches. Duplicate names are blocked.</p></div> : subjects.map(row => (
          <article key={row.id} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 13, padding: 13, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div><strong>{row.name}</strong>{row.global_subject_id && <div style={{ color: "#64748b", fontSize: 11, marginTop: 3 }}>Mapped to canonical catalogue</div>}</div>
            <button disabled={saving} onClick={() => void removeUnusedSubject(row)} style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", borderRadius: 9, padding: "7px 10px", cursor: "pointer" }}>Remove if unused</button>
          </article>
        ))}
      </section>
    </main>
  )
}
