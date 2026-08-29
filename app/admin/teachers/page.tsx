"use client"
export const dynamic = "force-dynamic"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { getAdminSchoolAuthority } from "@/lib/admin/authority"

type Teacher = { id: string; name: string; phone: string | null }
type ClassRow = { id: string; name: string; stream: string | null }
type SubjectRow = { id: string; name: string }
type Assignment = { id: string; teacher_id: string; class_id: string; subject_id: string; is_class_teacher: boolean }

const fieldStyle = { width: "100%", boxSizing: "border-box" as const, border: "1px solid #cbd5e1", borderRadius: 10, padding: "10px 11px", background: "white", fontSize: 14 }

export default function AdminTeachersPage() {
  const [schoolId, setSchoolId] = useState("")
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [subjects, setSubjects] = useState<SubjectRow[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [selectedTeacher, setSelectedTeacher] = useState("")
  const [classId, setClassId] = useState("")
  const [subjectId, setSubjectId] = useState("")
  const [classTeacher, setClassTeacher] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [schoolName, setSchoolName] = useState("")
  const [inviteMessage, setInviteMessage] = useState("")

  useEffect(() => { void bootstrap() }, [])

  async function bootstrap() {
    setLoading(true)
    setError("")
    try {
      const authority = await getAdminSchoolAuthority()
      setSchoolId(authority.schoolId)
      await loadAll(authority.schoolId)
    } catch (cause) {
      console.error("Admin teachers bootstrap failed", cause)
      setError(cause instanceof Error ? cause.message : "Teachers could not be loaded.")
    } finally {
      setLoading(false)
    }
  }

  async function loadAll(sid: string) {
    const [schoolRes, memberRes, classRes, subjectRes, assignmentRes] = await Promise.all([
      supabase.from("schools").select("name").eq("id", sid).single(),
      supabase.from("school_members").select("profile_id").eq("school_id", sid).eq("role", "teacher"),
      supabase.from("classes").select("id,name,stream").eq("school_id", sid).order("name").order("stream"),
      supabase.from("subjects").select("id,name").eq("school_id", sid).order("name"),
      supabase.from("teacher_classes").select("id,teacher_id,class_id,subject_id,is_class_teacher").eq("school_id", sid),
    ])
    const firstError = [schoolRes.error, memberRes.error, classRes.error, subjectRes.error, assignmentRes.error].find(Boolean)
    if (firstError) throw firstError
    setSchoolName(schoolRes.data?.name ?? "this school")

    const teacherIds = Array.from(new Set((memberRes.data ?? []).map(row => row.profile_id)))
    const profileRes = teacherIds.length
      ? await supabase.from("profiles").select("id,full_name,phone").in("id", teacherIds)
      : { data: [], error: null }
    if (profileRes.error) throw profileRes.error

    setTeachers((profileRes.data ?? []).map(row => ({ id: row.id, name: row.full_name, phone: row.phone })).sort((a, b) => a.name.localeCompare(b.name)))
    setClasses((classRes.data ?? []) as ClassRow[])
    setSubjects((subjectRes.data ?? []) as SubjectRow[])
    setAssignments((assignmentRes.data ?? []) as Assignment[])
  }

  async function addAssignment() {
    if (!schoolId || !selectedTeacher || !classId || !subjectId || saving) return
    setSaving(true)
    setError("")
    try {
      const { error: insertError } = await supabase.from("teacher_classes").insert({
        school_id: schoolId,
        teacher_id: selectedTeacher,
        class_id: classId,
        subject_id: subjectId,
        is_class_teacher: classTeacher,
      })
      if (insertError) throw insertError
      setClassId("")
      setSubjectId("")
      setClassTeacher(false)
      await loadAll(schoolId)
    } catch (cause) {
      console.error("Admin teacher assignment failed", cause)
      setError(cause instanceof Error ? cause.message : "Teacher assignment could not be saved.")
    } finally {
      setSaving(false)
    }
  }

  async function removeAssignment(id: string) {
    if (!schoolId || saving) return
    setSaving(true)
    setError("")
    try {
      const { error: deleteError } = await supabase.from("teacher_classes").delete().eq("id", id).eq("school_id", schoolId)
      if (deleteError) throw deleteError
      await loadAll(schoolId)
    } catch (cause) {
      console.error("Admin teacher assignment removal failed", cause)
      setError(cause instanceof Error ? cause.message : "Assignment could not be removed.")
    } finally {
      setSaving(false)
    }
  }

  async function removeTeacher(teacherId: string) {
    if (!schoolId || saving) return
    setSaving(true)
    setError("")
    try {
      // Assignment rows describe current authority, while lesson/attendance/result records
      // retain the teacher UUID and remain historical evidence after assignment removal.
      const { error: assignmentError } = await supabase.from("teacher_classes").delete().eq("school_id", schoolId).eq("teacher_id", teacherId)
      if (assignmentError) throw assignmentError
      const { error: memberError } = await supabase.from("school_members").delete().eq("school_id", schoolId).eq("profile_id", teacherId).eq("role", "teacher")
      if (memberError) throw memberError
      if (selectedTeacher === teacherId) setSelectedTeacher("")
      await loadAll(schoolId)
    } catch (cause) {
      console.error("Admin teacher removal failed", cause)
      setError(cause instanceof Error ? cause.message : "Teacher could not be removed from this school.")
    } finally {
      setSaving(false)
    }
  }

  async function copyTeacherInvite() {
    const signupUrl = `${window.location.origin}/signup/teacher`
    const message = `Join ${schoolName || "our school"} on VibeSchool as a teacher: ${signupUrl}\n\nCreate your teacher account, choose your school level, then search for ${schoolName || "our school"}. The school admin will assign your classes and subjects after you connect.`
    try {
      await navigator.clipboard.writeText(message)
      setInviteMessage("Teacher invitation copied. Send it by WhatsApp, SMS or email.")
    } catch {
      setInviteMessage(message)
    }
  }

  const classById = useMemo(() => new Map(classes.map(row => [row.id, row])), [classes])
  const subjectById = useMemo(() => new Map(subjects.map(row => [row.id, row])), [subjects])

  if (loading) return <div aria-busy="true" style={{ minHeight: 260, borderRadius: 18, background: "#e2e8f0" }} />

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", display: "grid", gap: 16 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 24 }}>Teachers</h1>
        <p style={{ color: "#64748b", margin: "5px 0 0" }}>Teacher authority comes from canonical school membership; class and subject assignments use stable IDs.</p>
      </header>
      {error && <div role="alert" style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", padding: 12, borderRadius: 12 }}>{error}</div>}

      <section style={{ background: "#0f172a", color: "white", borderRadius: 16, padding: 16, display: "grid", gap: 10 }}>
        <div><strong>Add a teacher securely</strong><div style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.5, marginTop: 4 }}>The teacher creates their own account and connects to {schoolName || "the school"}. This protects identity; Admin then assigns their secondary class, stream and subject below.</div></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>
          <button onClick={() => window.open("/signup/teacher", "_blank", "noopener,noreferrer")} style={{ border: 0, borderRadius: 11, padding: 12, background: "#10b981", color: "white", fontWeight: 800, cursor: "pointer" }}>Open teacher signup</button>
          <button onClick={() => void copyTeacherInvite()} style={{ border: "1px solid #475569", borderRadius: 11, padding: 12, background: "transparent", color: "white", fontWeight: 800, cursor: "pointer" }}>Copy invitation</button>
        </div>
        {inviteMessage && <div role="status" style={{ color: inviteMessage.startsWith("Teacher") ? "#bbf7d0" : "#e2e8f0", whiteSpace: "pre-wrap", fontSize: 12 }}>{inviteMessage}</div>}
      </section>

      {teachers.length === 0 ? (
        <section style={{ background: "white", border: "1px solid #f59e0b", borderRadius: 16, padding: 20 }}>
          <strong>No teachers connected to this school</strong>
          <p style={{ color: "#64748b", lineHeight: 1.5 }}>Send the invitation above. When the teacher connects to this school, they will appear here for class and subject assignment.</p>
        </section>
      ) : (
        <>
          <section style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, display: "grid", gap: 10 }}>
            <strong>Assign teacher</strong>
            <select value={selectedTeacher} onChange={event => setSelectedTeacher(event.target.value)} style={fieldStyle}><option value="">Choose teacher</option>{teachers.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 9 }}>
              <select value={classId} onChange={event => setClassId(event.target.value)} style={fieldStyle}><option value="">Choose class</option>{classes.map(row => <option key={row.id} value={row.id}>{row.name}{row.stream ? ` ${row.stream}` : ""}</option>)}</select>
              <select value={subjectId} onChange={event => setSubjectId(event.target.value)} style={fieldStyle}><option value="">Choose subject</option>{subjects.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
            </div>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={classTeacher} onChange={event => setClassTeacher(event.target.checked)} /> Class teacher assignment</label>
            <button disabled={saving || !selectedTeacher || !classId || !subjectId} onClick={() => void addAssignment()} style={{ border: 0, borderRadius: 11, padding: 12, background: "#10b981", color: "white", fontWeight: 780, cursor: "pointer" }}>{saving ? "Saving…" : "Add assignment"}</button>
          </section>

          <section style={{ display: "grid", gap: 9 }}>
            {teachers.map(teacher => {
              const rows = assignments.filter(row => row.teacher_id === teacher.id)
              return (
                <article key={teacher.id} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 14, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div><strong>{teacher.name}</strong><div style={{ color: "#64748b", fontSize: 12, marginTop: 3 }}>{teacher.phone || "No phone on profile"} · {rows.length} assignment{rows.length === 1 ? "" : "s"}</div></div>
                    <button disabled={saving} onClick={() => void removeTeacher(teacher.id)} style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", borderRadius: 9, padding: "7px 10px", cursor: "pointer" }}>Remove from school</button>
                  </div>
                  <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
                    {rows.length === 0 ? <div style={{ color: "#92400e", fontSize: 13 }}>No class/subject assignments yet.</div> : rows.map(row => {
                      const cls = classById.get(row.class_id)
                      const subject = subjectById.get(row.subject_id)
                      return (
                        <div key={row.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", background: "#f8fafc", borderRadius: 10, padding: "8px 10px" }}>
                          <span style={{ fontSize: 13 }}>{cls ? `${cls.name}${cls.stream ? ` ${cls.stream}` : ""}` : "Unknown class"} · {subject?.name ?? "Unknown subject"}{row.is_class_teacher ? " · Class teacher" : ""}</span>
                          <button aria-label="Remove assignment" disabled={saving} onClick={() => void removeAssignment(row.id)} style={{ border: 0, background: "transparent", color: "#b91c1c", cursor: "pointer" }}>Remove</button>
                        </div>
                      )
                    })}
                  </div>
                </article>
              )
            })}
          </section>
        </>
      )}
    </main>
  )
}
