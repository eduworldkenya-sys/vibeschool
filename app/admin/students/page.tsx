"use client"
export const dynamic = "force-dynamic"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getAdminSchoolAuthority } from "@/lib/admin/authority"
import type { Database } from "@/lib/database.types"

type GeneratedAdminAddStudentArgs = Database["public"]["Functions"]["admin_add_student"]["Args"]

type AdminAddStudentArgs = {
  p_name: string
  p_admission_number: string | null
  p_gender: string | null
  p_date_of_birth: string | null
  p_class_id: string | null
  p_school_id: string
}

interface ClassRow {
  id: string
  name: string
  stream: string | null
}

interface StudentRow {
  id: string
  name: string
  admissionNumber: string | null
  gender: string | null
  classId: string
  className: string
  stream: string | null
  parentLinked: boolean
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 11,
  padding: "11px 12px",
  background: "white",
  fontSize: 14,
}

export default function AdminStudentsPage() {
  const router = useRouter()
  const [schoolId, setSchoolId] = useState("")
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [students, setStudents] = useState<StudentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [classId, setClassId] = useState("all")
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: "", admissionNumber: "", gender: "", dateOfBirth: "", classId: "" })

  useEffect(() => {
    void bootstrap()
  }, [])

  async function bootstrap() {
    setLoading(true)
    setError("")
    try {
      const authority = await getAdminSchoolAuthority()
      setSchoolId(authority.schoolId)
      await Promise.all([loadClasses(authority.schoolId), loadStudents(authority.schoolId)])
    } catch (cause) {
      console.error("Admin students bootstrap failed", cause)
      setError(cause instanceof Error ? cause.message : "Students could not be loaded.")
    } finally {
      setLoading(false)
    }
  }

  async function loadClasses(sid: string) {
    const { data, error: queryError } = await supabase
      .from("classes")
      .select("id,name,stream")
      .eq("school_id", sid)
      .order("name")
      .order("stream")
    if (queryError) throw queryError
    setClasses((data ?? []) as ClassRow[])
  }

  async function loadStudents(sid: string) {
    const { data: enrollmentRows, error: enrollmentError } = await supabase
      .from("student_classes")
      .select("student_id,class_id,classes(id,name,stream)")
      .eq("school_id", sid)
      .eq("is_current", true)
    if (enrollmentError) throw enrollmentError

    const enrollments = enrollmentRows ?? []
    const ids = Array.from(new Set(enrollments.map(row => row.student_id).filter((id): id is string => Boolean(id))))
    if (ids.length === 0) {
      setStudents([])
      return
    }

    const [studentRes, parentRes] = await Promise.all([
      supabase.from("students").select("id,name,admission_number,gender").in("id", ids).is("deleted_at", null),
      supabase.from("parent_student_links").select("student_id,access_level").eq("school_id", sid).in("student_id", ids),
    ])
    if (studentRes.error) throw studentRes.error
    if (parentRes.error) throw parentRes.error

    const parentLinked = new Set(
      (parentRes.data ?? [])
        .filter(row => (row.access_level ?? "full") !== "none")
        .map(row => row.student_id)
    )
    const enrollmentByStudent = new Map<string, { classId: string; name: string; stream: string | null }>()

    for (const row of enrollments) {
      if (!row.student_id || !row.class_id) continue
      const joined = Array.isArray(row.classes) ? row.classes[0] : row.classes
      if (!joined) continue
      enrollmentByStudent.set(row.student_id, { classId: row.class_id, name: joined.name, stream: joined.stream ?? null })
    }

    setStudents(
      (studentRes.data ?? [])
        .map(student => {
          const enrollment = enrollmentByStudent.get(student.id)
          if (!enrollment) return null
          return {
            id: student.id,
            name: student.name,
            admissionNumber: student.admission_number,
            gender: student.gender,
            classId: enrollment.classId,
            className: enrollment.name,
            stream: enrollment.stream,
            parentLinked: parentLinked.has(student.id),
          } satisfies StudentRow
        })
        .filter((row): row is StudentRow => row !== null)
        .sort((a, b) => a.name.localeCompare(b.name))
    )
  }

  async function addStudent() {
    if (!schoolId || !form.name.trim() || saving) return
    setSaving(true)
    setError("")
    try {
      const args: AdminAddStudentArgs = {
        p_name: form.name.trim(),
        p_admission_number: form.admissionNumber.trim() || null,
        p_gender: form.gender || null,
        p_date_of_birth: form.dateOfBirth || null,
        p_class_id: form.classId || null,
        p_school_id: schoolId,
      }
      const { data, error: rpcError } = await supabase.rpc("admin_add_student", args as unknown as GeneratedAdminAddStudentArgs)
      if (rpcError || !data) throw rpcError ?? new Error("Student was not created.")
      setForm({ name: "", admissionNumber: "", gender: "", dateOfBirth: "", classId: "" })
      setShowAdd(false)
      await loadStudents(schoolId)
    } catch (cause) {
      console.error("Admin add student failed", cause)
      const message = cause instanceof Error ? cause.message : "Student could not be added."
      setError(message.includes("duplicate") ? "This learner or admission number may already exist. Search before creating another learner." : message)
    } finally {
      setSaving(false)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return students.filter(student => {
      const matchesClass = classId === "all" || student.classId === classId
      const matchesSearch = !q || student.name.toLowerCase().includes(q) || (student.admissionNumber ?? "").toLowerCase().includes(q)
      return matchesClass && matchesSearch
    })
  }, [students, search, classId])

  if (loading) return <div aria-busy="true" style={{ minHeight: 220, borderRadius: 18, background: "#e2e8f0" }} />

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", display: "grid", gap: 16 }}>
      <header style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>Learners</h1>
          <p style={{ color: "#64748b", margin: "5px 0 0" }}>{students.length} currently enrolled · canonical enrollment roster</p>
        </div>
        <button onClick={() => setShowAdd(true)} style={{ border: 0, borderRadius: 12, padding: "11px 15px", background: "#10b981", color: "white", fontWeight: 750, cursor: "pointer" }}>
          Add learner
        </button>
      </header>

      {error && (
        <div role="alert" style={{ border: "1px solid #fecaca", background: "#fef2f2", borderRadius: 12, padding: 12, color: "#991b1b" }}>
          {error}
        </div>
      )}

      {classes.length === 0 ? (
        <section style={{ background: "white", border: "1px solid #f59e0b", borderRadius: 16, padding: 18 }}>
          <strong>Create classes before enrolling learners</strong>
          <p style={{ color: "#64748b", lineHeight: 1.5 }}>A learner needs a valid current school/class enrollment. Set up classes and streams first.</p>
          <button onClick={() => router.push("/admin/settings/classes")} style={{ border: 0, borderRadius: 10, padding: "9px 13px", cursor: "pointer" }}>Open class setup</button>
        </section>
      ) : (
        <>
          <section style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(150px,240px)", gap: 10 }}>
            <input aria-label="Search learners" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name or admission number" style={inputStyle} />
            <select aria-label="Filter by class" value={classId} onChange={event => setClassId(event.target.value)} style={inputStyle}>
              <option value="all">All classes</option>
              {classes.map(row => <option key={row.id} value={row.id}>{row.name}{row.stream ? ` ${row.stream}` : ""}</option>)}
            </select>
          </section>

          {filtered.length === 0 ? (
            <section style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: 28, textAlign: "center" }}>
              <strong>{students.length === 0 ? "No learners enrolled yet" : "No learners match this search"}</strong>
              <p style={{ color: "#64748b" }}>{students.length === 0 ? "Use Add learner to create the first canonical enrollment." : "Change the search or class filter."}</p>
            </section>
          ) : (
            <section style={{ display: "grid", gap: 8 }}>
              {filtered.map(student => (
                <button key={student.id} onClick={() => router.push(`/admin/students/${student.id}`)} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 14, padding: 14, display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 12, textAlign: "left", cursor: "pointer" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 780, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{student.name}</div>
                    <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
                      {student.className}{student.stream ? ` ${student.stream}` : ""}{student.admissionNumber ? ` · #${student.admissionNumber}` : ""}
                    </div>
                  </div>
                  <span style={{ alignSelf: "center", borderRadius: 999, padding: "4px 9px", fontSize: 12, background: student.parentLinked ? "#ecfdf5" : "#fffbeb", color: student.parentLinked ? "#047857" : "#92400e" }}>
                    {student.parentLinked ? "Guardian linked" : "Guardian needed"}
                  </span>
                </button>
              ))}
            </section>
          )}
        </>
      )}

      {showAdd && (
        <div role="dialog" aria-modal="true" aria-label="Add learner" style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(15,23,42,.55)", display: "grid", placeItems: "end center" }}>
          <section style={{ width: "min(100%,620px)", maxHeight: "90vh", overflowY: "auto", background: "white", borderRadius: "22px 22px 0 0", padding: 20, boxSizing: "border-box" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20 }}>Add learner</h2>
                <p style={{ color: "#64748b", fontSize: 13 }}>Search before creating. Duplicate learner identities must not be created.</p>
              </div>
              <button aria-label="Close" onClick={() => setShowAdd(false)} style={{ border: 0, background: "#f1f5f9", borderRadius: 999, width: 36, height: 36, cursor: "pointer" }}>×</button>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <label>Full name<input value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} style={inputStyle} /></label>
              <label>Admission number<input value={form.admissionNumber} onChange={event => setForm(current => ({ ...current, admissionNumber: event.target.value }))} style={inputStyle} /></label>
              <label>Class / stream<select value={form.classId} onChange={event => setForm(current => ({ ...current, classId: event.target.value }))} style={inputStyle}><option value="">Choose class</option>{classes.map(row => <option key={row.id} value={row.id}>{row.name}{row.stream ? ` ${row.stream}` : ""}</option>)}</select></label>
              <label>Gender<select value={form.gender} onChange={event => setForm(current => ({ ...current, gender: event.target.value }))} style={inputStyle}><option value="">Not specified</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></label>
              <label>Date of birth<input type="date" value={form.dateOfBirth} onChange={event => setForm(current => ({ ...current, dateOfBirth: event.target.value }))} style={inputStyle} /></label>
              <button disabled={saving || !form.name.trim()} onClick={() => void addStudent()} style={{ border: 0, borderRadius: 12, padding: 13, background: saving ? "#94a3b8" : "#10b981", color: "white", fontWeight: 780, cursor: saving ? "not-allowed" : "pointer" }}>
                {saving ? "Saving…" : "Create learner enrollment"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
