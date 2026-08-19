"use client"
export const dynamic = "force-dynamic"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getAdminSchoolAuthority } from "@/lib/admin/authority"
import { nairobiDateStr } from "@/lib/time"

type Alert = { id: string; title: string; detail: string; href: string; severity: "info" | "attention" | "critical" }

export default function AdminNotificationsPage() {
  const router = useRouter()
  const [alerts, setAlerts] = useState<Alert[]>([])
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
      const [termRes, classRes, subjectRes, enrollmentRes, attendanceRes, parentRes, teacherRes, timetableRes] = await Promise.all([
        supabase.from("academic_terms").select("id", { count: "exact", head: true }).eq("school_id", sid).eq("status", "active"),
        supabase.from("classes").select("id").eq("school_id", sid),
        supabase.from("subjects").select("id", { count: "exact", head: true }).eq("school_id", sid),
        supabase.from("student_classes").select("student_id,class_id").eq("school_id", sid).eq("is_current", true),
        supabase.from("attendance").select("student_id,class_id").eq("school_id", sid).eq("date", today),
        supabase.from("parent_student_links").select("student_id,access_level").eq("school_id", sid),
        supabase.from("school_members").select("profile_id").eq("school_id", sid).eq("role", "teacher"),
        supabase.from("timetable_slots").select("id", { count: "exact", head: true }).eq("school_id", sid).lte("effective_from", today).or(`effective_until.is.null,effective_until.gte.${today}`),
      ])
      const firstError = [termRes.error, classRes.error, subjectRes.error, enrollmentRes.error, attendanceRes.error, parentRes.error, teacherRes.error, timetableRes.error].find(Boolean)
      if (firstError) throw firstError

      const next: Alert[] = []
      const classes = classRes.data ?? []
      const enrollments = enrollmentRes.data ?? []
      const attendanceClasses = new Set((attendanceRes.data ?? []).map(row => row.class_id))
      const linkedStudents = new Set((parentRes.data ?? []).filter(row => (row.access_level ?? "full") !== "none").map(row => row.student_id))
      const enrolledStudents = new Set(enrollments.map(row => row.student_id))

      if ((termRes.count ?? 0) === 0) next.push({ id: "term", title: "No active academic term", detail: "Activate the current term before teaching and results oversight can reconcile correctly.", href: "/admin/settings/term", severity: "critical" })
      if (classes.length === 0) next.push({ id: "classes", title: "No classes configured", detail: "Create classes/streams before enrolling learners or assigning teachers.", href: "/admin/settings/classes", severity: "critical" })
      if ((subjectRes.count ?? 0) === 0) next.push({ id: "subjects", title: "No subjects configured", detail: "Create stable school subjects for teacher assignments, timetable and assessment.", href: "/admin/settings/subjects", severity: "attention" })
      if ((teacherRes.data ?? []).length === 0) next.push({ id: "teachers", title: "No teachers connected", detail: "Teachers must first establish a valid school membership before class/subject assignment.", href: "/admin/teachers", severity: "attention" })
      if ((timetableRes.count ?? 0) === 0 && classes.length > 0) next.push({ id: "timetable", title: "No active timetable", detail: "The school has classes but no currently effective timetable slots.", href: "/admin/timetable", severity: "attention" })

      const classesWithStudents = new Set(enrollments.map(row => row.class_id))
      const missingAttendance = Array.from(classesWithStudents).filter(id => !attendanceClasses.has(id)).length
      if (missingAttendance > 0) next.push({ id: "attendance", title: `${missingAttendance} class${missingAttendance === 1 ? "" : "es"} missing attendance today`, detail: "Open attendance oversight to identify classroom follow-up. Admin does not replace teacher attendance entry.", href: "/admin/attendance", severity: "attention" })

      const unlinked = Array.from(enrolledStudents).filter(id => !linkedStudents.has(id)).length
      if (unlinked > 0) next.push({ id: "parents", title: `${unlinked} learner${unlinked === 1 ? "" : "s"} without active guardian access`, detail: "Verify legitimate guardian relationships through the claim-based parent linking flow.", href: "/admin/students", severity: "attention" })

      if (next.length === 0) next.push({ id: "healthy", title: "No pilot-critical operational alerts", detail: "Core school setup, attendance coverage and guardian relationships have no current alert condition.", href: "/admin", severity: "info" })
      setAlerts(next)
    } catch (cause) {
      console.error("Admin operational alerts failed", cause)
      setError(cause instanceof Error ? cause.message : "Operational alerts could not be loaded.")
    } finally {
      setLoading(false)
    }
  }

  const counts = useMemo(() => ({ critical: alerts.filter(row => row.severity === "critical").length, attention: alerts.filter(row => row.severity === "attention").length }), [alerts])

  if (loading) return <div aria-busy="true" style={{ minHeight: 220, borderRadius: 18, background: "#e2e8f0" }} />

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", display: "grid", gap: 16 }}>
      <header><h1 style={{ margin: 0, fontSize: 24 }}>Operational alerts</h1><p style={{ color: "#64748b", margin: "5px 0 0" }}>{counts.critical} critical · {counts.attention} need attention · every alert opens a useful school action.</p></header>
      {error && <div role="alert" style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 12, padding: 12 }}>{error}</div>}
      <section style={{ display: "grid", gap: 9 }}>
        {alerts.map(alert => <button key={alert.id} onClick={() => router.push(alert.href)} style={{ background: alert.severity === "critical" ? "#fef2f2" : alert.severity === "attention" ? "#fffbeb" : "white", border: `1px solid ${alert.severity === "critical" ? "#fecaca" : alert.severity === "attention" ? "#fde68a" : "#e2e8f0"}`, borderRadius: 14, padding: 14, textAlign: "left", cursor: "pointer" }}><strong>{alert.title}</strong><div style={{ color: "#64748b", fontSize: 13, lineHeight: 1.5, marginTop: 4 }}>{alert.detail}</div></button>)}
      </section>
    </main>
  )
}
