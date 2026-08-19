"use client"
export const dynamic = "force-dynamic"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getAdminSchoolAuthority } from "@/lib/admin/authority"

type Tab = "overview" | "attendance" | "parents"
type StudentRow = { id: string; name: string; admission_number: string | null; gender: string | null; date_of_birth: string | null }
type EnrollmentRow = { class_id: string; joined_at: string | null; classes: { name: string; stream: string | null } | { name: string; stream: string | null }[] | null }
type AttendanceRow = { date: string; status: string }
type ParentLink = { parent_id: string; relationship: string; is_primary: boolean; can_pickup: boolean; receives_alerts: boolean; access_level: string | null }
type ParentView = ParentLink & { full_name: string; phone: string | null }

export default function AdminStudentDetailPage() {
  const router = useRouter()
  const params = useParams()
  const studentId = String(params.id ?? "")
  const [schoolId, setSchoolId] = useState("")
  const [student, setStudent] = useState<StudentRow | null>(null)
  const [enrollment, setEnrollment] = useState<EnrollmentRow | null>(null)
  const [attendance, setAttendance] = useState<AttendanceRow[]>([])
  const [parents, setParents] = useState<ParentView[]>([])
  const [tab, setTab] = useState<Tab>("overview")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [claim, setClaim] = useState<{ code: string; expiresAt: string } | null>(null)

  useEffect(() => { if (studentId) void bootstrap() }, [studentId])

  async function bootstrap() {
    setLoading(true)
    setError("")
    try {
      const authority = await getAdminSchoolAuthority()
      setSchoolId(authority.schoolId)
      await Promise.all([loadStudent(authority.schoolId), loadAttendance(authority.schoolId), loadParents(authority.schoolId)])
    } catch (cause) {
      console.error("Admin learner detail failed", cause)
      setError(cause instanceof Error ? cause.message : "Learner could not be loaded.")
    } finally {
      setLoading(false)
    }
  }

  async function loadStudent(sid: string) {
    const enrollmentRes = await supabase
      .from("student_classes")
      .select("class_id,joined_at,classes(name,stream)")
      .eq("school_id", sid)
      .eq("student_id", studentId)
      .eq("is_current", true)
      .limit(1)
      .maybeSingle()
    if (enrollmentRes.error) throw enrollmentRes.error
    if (!enrollmentRes.data) {
      setStudent(null)
      setEnrollment(null)
      return
    }
    const studentRes = await supabase
      .from("students")
      .select("id,name,admission_number,gender,date_of_birth")
      .eq("id", studentId)
      .is("deleted_at", null)
      .maybeSingle()
    if (studentRes.error) throw studentRes.error
    setStudent(studentRes.data as StudentRow | null)
    setEnrollment(enrollmentRes.data as unknown as EnrollmentRow)
  }

  async function loadAttendance(sid: string) {
    const { data, error: queryError } = await supabase
      .from("attendance")
      .select("date,status")
      .eq("school_id", sid)
      .eq("student_id", studentId)
      .order("date", { ascending: false })
      .limit(90)
    if (queryError) throw queryError
    setAttendance((data ?? []) as AttendanceRow[])
  }

  async function loadParents(sid: string) {
    const linkRes = await supabase
      .from("parent_student_links")
      .select("parent_id,relationship,is_primary,can_pickup,receives_alerts,access_level")
      .eq("school_id", sid)
      .eq("student_id", studentId)
      .neq("access_level", "none")
    if (linkRes.error) throw linkRes.error
    const links = (linkRes.data ?? []) as ParentLink[]
    if (links.length === 0) {
      setParents([])
      return
    }
    const profileRes = await supabase.from("profiles").select("id,full_name,phone").in("id", links.map(row => row.parent_id))
    if (profileRes.error) throw profileRes.error
    const profiles = new Map((profileRes.data ?? []).map(row => [row.id, row]))
    setParents(links.map(link => ({
      ...link,
      full_name: profiles.get(link.parent_id)?.full_name ?? "Guardian",
      phone: profiles.get(link.parent_id)?.phone ?? null,
    })))
  }

  async function generateClaim() {
    if (!schoolId || saving) return
    setSaving(true)
    setError("")
    try {
      const { data, error: rpcError } = await supabase.rpc(
        "admin_generate_parent_claim" as never,
        { p_school_id: schoolId, p_student_id: studentId } as never
      )
      if (rpcError) throw rpcError
      const rows = (data ?? []) as unknown as Array<{ claim_code: string; expires_at: string }>
      const row = rows[0]
      if (!row) throw new Error("Claim code was not created.")
      setClaim({ code: row.claim_code, expiresAt: row.expires_at })
    } catch (cause) {
      console.error("Admin parent claim generation failed", cause)
      setError(cause instanceof Error ? cause.message : "Parent claim could not be created.")
    } finally {
      setSaving(false)
    }
  }

  async function revokeParent(parentId: string) {
    if (!schoolId || saving) return
    setSaving(true)
    setError("")
    try {
      const { error: rpcError } = await supabase.rpc(
        "admin_revoke_parent_relationship" as never,
        { p_school_id: schoolId, p_student_id: studentId, p_parent_id: parentId } as never
      )
      if (rpcError) throw rpcError
      await loadParents(schoolId)
    } catch (cause) {
      console.error("Admin parent relationship revoke failed", cause)
      setError(cause instanceof Error ? cause.message : "Parent relationship could not be revoked.")
    } finally {
      setSaving(false)
    }
  }

  const classLabel = useMemo(() => {
    const joined = enrollment?.classes
    const row = Array.isArray(joined) ? joined[0] : joined
    return row ? `${row.name}${row.stream ? ` ${row.stream}` : ""}` : "Unknown class"
  }, [enrollment])

  const attendanceStats = useMemo(() => ({
    present: attendance.filter(row => row.status === "present").length,
    absent: attendance.filter(row => row.status === "absent").length,
    late: attendance.filter(row => row.status === "late").length,
    total: attendance.length,
  }), [attendance])

  if (loading) return <div aria-busy="true" style={{ minHeight: 280, borderRadius: 18, background: "#e2e8f0" }} />

  if (!student || !enrollment) {
    return (
      <main style={{ maxWidth: 720, margin: "0 auto", background: "white", border: "1px solid #fecaca", borderRadius: 16, padding: 22 }}>
        <h1 style={{ marginTop: 0, fontSize: 20 }}>Learner unavailable</h1>
        <p style={{ color: "#64748b" }}>This learner is not currently enrolled in your authorized school, or the record is unavailable.</p>
        <button onClick={() => router.push("/admin/students")} style={{ border: 0, borderRadius: 10, padding: "9px 13px", cursor: "pointer" }}>Back to learners</button>
      </main>
    )
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", display: "grid", gap: 16 }}>
      <header style={{ background: "#0a1628", color: "white", borderRadius: 20, padding: 20 }}>
        <button onClick={() => router.push("/admin/students")} style={{ border: 0, background: "transparent", color: "#cbd5e1", padding: 0, cursor: "pointer" }}>‹ Learners</button>
        <h1 style={{ margin: "10px 0 5px", fontSize: 24 }}>{student.name}</h1>
        <div style={{ color: "#cbd5e1", fontSize: 13 }}>{classLabel}{student.admission_number ? ` · #${student.admission_number}` : ""}</div>
      </header>

      {error && <div role="alert" style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 12, padding: 12 }}>{error}</div>}

      <nav style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 5, background: "#f1f5f9", padding: 4, borderRadius: 13 }}>
        {(["overview", "attendance", "parents"] as Tab[]).map(item => <button key={item} onClick={() => setTab(item)} style={{ border: 0, borderRadius: 10, padding: 10, background: tab === item ? "white" : "transparent", fontWeight: 720, textTransform: "capitalize", cursor: "pointer" }}>{item}</button>)}
      </nav>

      {tab === "overview" && (
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
          {[
            ["Current class", classLabel],
            ["Joined", enrollment.joined_at ? new Date(enrollment.joined_at).toLocaleDateString("en-KE") : "—"],
            ["Gender", student.gender || "Not specified"],
            ["Date of birth", student.date_of_birth || "Not recorded"],
            ["Active guardians", String(parents.length)],
            ["Attendance records", String(attendanceStats.total)],
          ].map(([label, value]) => <div key={label} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 14, padding: 14 }}><div style={{ color: "#64748b", fontSize: 12 }}>{label}</div><div style={{ fontWeight: 760, marginTop: 5 }}>{value}</div></div>)}
        </section>
      )}

      {tab === "attendance" && (
        <section style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
            {[["Present", attendanceStats.present], ["Absent", attendanceStats.absent], ["Late", attendanceStats.late]].map(([label, value]) => <div key={String(label)} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 13, padding: 13 }}><strong>{String(value)}</strong><div style={{ color: "#64748b", fontSize: 12 }}>{String(label)}</div></div>)}
          </div>
          {attendance.length === 0 ? <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 14, padding: 24, textAlign: "center", color: "#64748b" }}>No attendance records yet.</div> : attendance.map((row, index) => <div key={`${row.date}-${index}`} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, display: "flex", justifyContent: "space-between" }}><span>{row.date}</span><strong style={{ textTransform: "capitalize" }}>{row.status}</strong></div>)}
        </section>
      )}

      {tab === "parents" && (
        <section style={{ display: "grid", gap: 10 }}>
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 14, padding: 14 }}>
            <strong>Verified guardian linking</strong>
            <p style={{ color: "#64748b", fontSize: 13, lineHeight: 1.5 }}>Issue a short-lived claim code to the legitimate guardian. The guardian must sign in and redeem it themselves; knowing a learner name or UUID is not enough.</p>
            <button disabled={saving} onClick={() => void generateClaim()} style={{ border: 0, borderRadius: 10, padding: "9px 12px", background: "#10b981", color: "white", fontWeight: 740, cursor: "pointer" }}>{saving ? "Working…" : "Generate guardian claim"}</button>
            {claim && <div style={{ marginTop: 10, background: "white", border: "1px solid #86efac", borderRadius: 12, padding: 12 }}><div style={{ color: "#64748b", fontSize: 11 }}>CLAIM CODE</div><div style={{ fontFamily: "monospace", fontSize: 24, fontWeight: 850, letterSpacing: 2 }}>{claim.code}</div><div style={{ color: "#64748b", fontSize: 11 }}>Expires {new Date(claim.expiresAt).toLocaleString("en-KE")}</div></div>}
          </div>
          {parents.length === 0 ? <div style={{ background: "white", border: "1px solid #fde68a", borderRadius: 14, padding: 20 }}><strong>No active guardian relationship</strong><p style={{ color: "#64748b" }}>Generate a claim only after verifying the legitimate guardian through school procedure.</p></div> : parents.map(parent => (
            <article key={parent.parent_id} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 13, padding: 13, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div><strong>{parent.full_name}</strong><div style={{ color: "#64748b", fontSize: 12, marginTop: 3 }}>{parent.relationship}{parent.is_primary ? " · Primary" : ""}{parent.phone ? ` · ${parent.phone}` : ""}</div><div style={{ color: "#64748b", fontSize: 11, marginTop: 3 }}>{parent.can_pickup ? "Pickup permitted" : "No pickup"} · {parent.receives_alerts ? "Receives alerts" : "Alerts off"}</div></div>
              <button disabled={saving} onClick={() => void revokeParent(parent.parent_id)} style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", borderRadius: 9, padding: "7px 10px", cursor: "pointer" }}>Revoke access</button>
            </article>
          ))}
        </section>
      )}
    </main>
  )
}
