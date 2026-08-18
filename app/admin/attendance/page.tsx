"use client"
export const dynamic = "force-dynamic"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { getAdminSchoolAuthority } from "@/lib/admin/authority"
import { nairobiDateStr } from "@/lib/time"

interface ClassRow {
  id: string
  name: string
  stream: string | null
}

interface AttendanceRow {
  class_id: string
  student_id: string
  status: string
  teacher_id: string | null
}

interface EnrollmentRow {
  class_id: string
  student_id: string
}

const fieldStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: "10px 12px",
  background: "white",
  fontSize: 14,
}

export default function AdminAttendancePage() {
  const [schoolId, setSchoolId] = useState("")
  const [date, setDate] = useState(() => nairobiDateStr())
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([])
  const [attendance, setAttendance] = useState<AttendanceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    void bootstrap()
  }, [])

  useEffect(() => {
    if (schoolId) void loadAttendance(schoolId, date)
  }, [schoolId, date])

  async function bootstrap() {
    setLoading(true)
    setError("")
    try {
      const authority = await getAdminSchoolAuthority()
      setSchoolId(authority.schoolId)
      const [classRes, enrollmentRes] = await Promise.all([
        supabase.from("classes").select("id,name,stream").eq("school_id", authority.schoolId).order("name").order("stream"),
        supabase.from("student_classes").select("class_id,student_id").eq("school_id", authority.schoolId).eq("is_current", true),
      ])
      if (classRes.error) throw classRes.error
      if (enrollmentRes.error) throw enrollmentRes.error
      setClasses((classRes.data ?? []) as ClassRow[])
      setEnrollments((enrollmentRes.data ?? []).filter(row => Boolean(row.class_id && row.student_id)) as EnrollmentRow[])
    } catch (cause) {
      console.error("Admin attendance bootstrap failed", cause)
      setError(cause instanceof Error ? cause.message : "Attendance oversight could not be loaded.")
    } finally {
      setLoading(false)
    }
  }

  async function loadAttendance(sid: string, selectedDate: string) {
    setError("")
    const { data, error: queryError } = await supabase
      .from("attendance")
      .select("class_id,student_id,status,teacher_id")
      .eq("school_id", sid)
      .eq("date", selectedDate)
    if (queryError) {
      setError(queryError.message)
      return
    }
    setAttendance((data ?? []) as AttendanceRow[])
  }

  const summaries = useMemo(() => {
    return classes.map(classRow => {
      const expected = new Set(enrollments.filter(row => row.class_id === classRow.id).map(row => row.student_id)).size
      const rows = attendance.filter(row => row.class_id === classRow.id)
      const captured = new Set(rows.map(row => row.student_id)).size
      const present = rows.filter(row => row.status === "present").length
      const absent = rows.filter(row => row.status === "absent").length
      const late = rows.filter(row => row.status === "late").length
      const teacherCount = new Set(rows.map(row => row.teacher_id).filter(Boolean)).size
      return { ...classRow, expected, captured, present, absent, late, teacherCount }
    })
  }, [classes, enrollments, attendance])

  const totals = useMemo(() => ({
    expected: new Set(enrollments.map(row => row.student_id)).size,
    captured: new Set(attendance.map(row => row.student_id)).size,
    present: attendance.filter(row => row.status === "present").length,
    absent: attendance.filter(row => row.status === "absent").length,
    classesCaptured: new Set(attendance.map(row => row.class_id)).size,
  }), [enrollments, attendance])

  if (loading) return <div aria-busy="true" style={{ minHeight: 260, borderRadius: 18, background: "#e2e8f0" }} />

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>Attendance oversight</h1>
          <p style={{ margin: "5px 0 0", color: "#64748b" }}>Read-only view of attendance captured by authorized teachers. Admin does not replace the classroom attendance workflow.</p>
        </div>
        <input aria-label="Attendance date" type="date" value={date} onChange={event => setDate(event.target.value)} style={fieldStyle} />
      </header>

      {error && <div role="alert" style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", padding: 12, borderRadius: 12 }}>{error}</div>}

      {classes.length === 0 ? (
        <section style={{ background: "white", border: "1px solid #f59e0b", borderRadius: 16, padding: 20 }}>
          <strong>No classes configured</strong>
          <p style={{ color: "#64748b" }}>Attendance oversight becomes available after the school creates classes and enrolls learners.</p>
        </section>
      ) : (
        <>
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
            {[
              ["Classes captured", `${totals.classesCaptured}/${classes.length}`],
              ["Learners captured", `${totals.captured}/${totals.expected}`],
              ["Present", String(totals.present)],
              ["Absent", String(totals.absent)],
            ].map(([label, value]) => (
              <div key={label} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 14, padding: 14 }}>
                <div style={{ fontSize: 23, fontWeight: 820 }}>{value}</div>
                <div style={{ color: "#64748b", fontSize: 13 }}>{label}</div>
              </div>
            ))}
          </section>

          <section style={{ display: "grid", gap: 9 }}>
            {summaries.map(row => {
              const complete = row.expected > 0 && row.captured >= row.expected
              const missing = Math.max(row.expected - row.captured, 0)
              return (
                <article key={row.id} style={{ background: "white", border: `1px solid ${complete ? "#bbf7d0" : "#fde68a"}`, borderRadius: 14, padding: 14, display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 780 }}>{row.name}{row.stream ? ` ${row.stream}` : ""}</div>
                    <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
                      {row.present} present · {row.absent} absent · {row.late} late · {row.teacherCount} recorder{row.teacherCount === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 780 }}>{row.captured}/{row.expected}</div>
                    <div style={{ color: complete ? "#047857" : "#92400e", fontSize: 12 }}>{complete ? "Captured" : `${missing} missing`}</div>
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
