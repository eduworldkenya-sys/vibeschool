"use client"
export const dynamic = "force-dynamic"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getAdminSchoolAuthority } from "@/lib/admin/authority"
import { nairobiDateStr } from "@/lib/time"

type ClassRow = { id: string; name: string; stream: string | null }
type EnrollmentRow = { student_id: string; class_id: string }
type AttendanceRow = { student_id: string; class_id: string; status: string }
type TeachingRow = { class_id: string; lifecycle: string }
type ResultRow = { student_id: string; class_id: string; subject_id: string; marks: number | null; is_absent: boolean }

export default function AdminReportsPage() {
  const router = useRouter()
  const [schoolName, setSchoolName] = useState("")
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([])
  const [attendance, setAttendance] = useState<AttendanceRow[]>([])
  const [teaching, setTeaching] = useState<TeachingRow[]>([])
  const [results, setResults] = useState<ResultRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => { void load() }, [])

  async function load() {
    setLoading(true)
    setError("")
    try {
      const authority = await getAdminSchoolAuthority()
      const sid = authority.schoolId
      const today = nairobiDateStr()
      const [schoolRes, classRes, enrollmentRes, attendanceRes, teachingRes, resultRes] = await Promise.all([
        supabase.from("schools").select("name").eq("id", sid).single(),
        supabase.from("classes").select("id,name,stream").eq("school_id", sid).order("name").order("stream"),
        supabase.from("student_classes").select("student_id,class_id").eq("school_id", sid).eq("is_current", true),
        supabase.from("attendance").select("student_id,class_id,status").eq("school_id", sid).eq("date", today),
        supabase.from("teaching_occurrences").select("class_id,lifecycle").eq("school_id", sid).eq("occurrence_date", today),
        supabase.from("exam_results").select("student_id,class_id,subject_id,marks,is_absent").eq("school_id", sid).gte("created_at", `${today.slice(0,4)}-01-01T00:00:00+03:00`),
      ])
      const firstError = [schoolRes.error, classRes.error, enrollmentRes.error, attendanceRes.error, teachingRes.error, resultRes.error].find(Boolean)
      if (firstError) throw firstError
      setSchoolName(schoolRes.data?.name ?? "School")
      setClasses((classRes.data ?? []) as ClassRow[])
      setEnrollments((enrollmentRes.data ?? []) as EnrollmentRow[])
      setAttendance((attendanceRes.data ?? []) as AttendanceRow[])
      setTeaching((teachingRes.data ?? []) as TeachingRow[])
      setResults((resultRes.data ?? []) as ResultRow[])
    } catch (cause) {
      console.error("Admin reports load failed", cause)
      setError(cause instanceof Error ? cause.message : "School reports could not be loaded.")
    } finally {
      setLoading(false)
    }
  }

  const totals = useMemo(() => {
    const enrolled = new Set(enrollments.map(row => row.student_id)).size
    const attendanceCaptured = new Set(attendance.map(row => row.student_id)).size
    const attendanceRate = attendance.length ? Math.round((attendance.filter(row => row.status === "present").length / attendance.length) * 100) : null
    const teachingCompleted = teaching.filter(row => row.lifecycle === "completed").length
    const resultStudents = new Set(results.map(row => row.student_id)).size
    return { enrolled, attendanceCaptured, attendanceRate, teachingCompleted, teachingScheduled: teaching.length, resultStudents, resultRows: results.length }
  }, [enrollments, attendance, teaching, results])

  const classRows = useMemo(() => classes.map(cls => {
    const expected = new Set(enrollments.filter(row => row.class_id === cls.id).map(row => row.student_id)).size
    const captured = new Set(attendance.filter(row => row.class_id === cls.id).map(row => row.student_id)).size
    const sessions = teaching.filter(row => row.class_id === cls.id)
    const classResults = results.filter(row => row.class_id === cls.id)
    return {
      ...cls,
      expected,
      captured,
      sessions: sessions.length,
      completed: sessions.filter(row => row.lifecycle === "completed").length,
      resultStudents: new Set(classResults.map(row => row.student_id)).size,
    }
  }), [classes, enrollments, attendance, teaching, results])

  if (loading) return <div aria-busy="true" style={{ minHeight: 280, borderRadius: 18, background: "#e2e8f0" }} />

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: 16 }}>
      <header><h1 style={{ margin: 0, fontSize: 24 }}>School reports</h1><p style={{ color: "#64748b", margin: "5px 0 0" }}>{schoolName} · pilot-critical operational reports use the same canonical identities as daily workflows.</p></header>
      {error && <div role="alert" style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", padding: 12, borderRadius: 12 }}>{error}</div>}

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
        {[
          ["Current enrollment", totals.enrolled, "/admin/students"],
          ["Attendance captured", `${totals.attendanceCaptured}/${totals.enrolled}`, "/admin/attendance"],
          ["Present rate today", totals.attendanceRate === null ? "—" : `${totals.attendanceRate}%`, "/admin/attendance"],
          ["Teaching completed", `${totals.teachingCompleted}/${totals.teachingScheduled}`, "/admin/academics"],
          ["Learners with results", totals.resultStudents, "/admin/academics/gradebook"],
          ["Result records", totals.resultRows, "/admin/academics/gradebook"],
        ].map(([label, value, href]) => <button key={String(label)} onClick={() => router.push(String(href))} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 14, padding: 14, textAlign: "left", cursor: "pointer" }}><div style={{ fontSize: 22, fontWeight: 820 }}>{String(value)}</div><div style={{ color: "#64748b", fontSize: 12, marginTop: 3 }}>{String(label)}</div></button>)}
      </section>

      <section style={{ display: "grid", gap: 8 }}>
        <h2 style={{ margin: "4px 0", fontSize: 17 }}>Class consistency</h2>
        {classRows.length === 0 ? <div style={{ background: "white", border: "1px solid #fde68a", borderRadius: 14, padding: 20 }}><strong>No classes configured</strong><p style={{ color: "#64748b" }}>Reports will populate as the school completes setup.</p></div> : classRows.map(row => (
          <article key={row.id} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 13, padding: 13, display: "grid", gridTemplateColumns: "minmax(0,1fr) repeat(3,auto)", gap: 14, alignItems: "center" }}>
            <strong>{row.name}{row.stream ? ` ${row.stream}` : ""}</strong>
            <div style={{ textAlign: "right" }}><div style={{ fontWeight: 760 }}>{row.captured}/{row.expected}</div><div style={{ color: "#64748b", fontSize: 10 }}>attendance</div></div>
            <div style={{ textAlign: "right" }}><div style={{ fontWeight: 760 }}>{row.completed}/{row.sessions}</div><div style={{ color: "#64748b", fontSize: 10 }}>teaching</div></div>
            <div style={{ textAlign: "right" }}><div style={{ fontWeight: 760 }}>{row.resultStudents}</div><div style={{ color: "#64748b", fontSize: 10 }}>with results</div></div>
          </article>
        ))}
      </section>
    </main>
  )
}
