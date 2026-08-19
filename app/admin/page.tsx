"use client"
export const dynamic = "force-dynamic"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getAdminSchoolAuthority } from "@/lib/admin/authority"
import { nairobiDateStr } from "@/lib/time"

interface HomeState {
  adminName: string
  schoolName: string
  students: number
  teachers: number
  classes: number
  subjects: number
  attendanceRows: number
  classesWithAttendance: number
  teachingScheduled: number
  teachingCompleted: number
  assessments: number
  unlinkedStudents: number
  activeTerm: string | null
  notices: number
}

interface ActionCard {
  title: string
  value: string
  detail: string
  href: string
  priority: "normal" | "attention" | "critical"
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 16,
  textAlign: "left",
  width: "100%",
  cursor: "pointer",
}

export default function AdminHomePage() {
  const router = useRouter()
  const [state, setState] = useState<HomeState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    setLoading(true)
    setError("")
    try {
      const authority = await getAdminSchoolAuthority()
      const sid = authority.schoolId
      const today = nairobiDateStr()

      const [
        profileRes,
        schoolRes,
        studentsRes,
        teachersRes,
        classesRes,
        subjectsRes,
        attendanceRes,
        teachingRes,
        assessmentRes,
        parentLinksRes,
        termRes,
        noticesRes,
      ] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", authority.userId).single(),
        supabase.from("schools").select("name").eq("id", sid).single(),
        supabase.from("student_classes").select("student_id").eq("school_id", sid).eq("is_current", true),
        supabase.from("school_members").select("profile_id").eq("school_id", sid).eq("role", "teacher"),
        supabase.from("classes").select("id").eq("school_id", sid),
        supabase.from("subjects").select("id").eq("school_id", sid),
        supabase.from("attendance").select("class_id,student_id,status").eq("school_id", sid).eq("date", today),
        supabase.from("teaching_occurrences").select("id,lifecycle,class_id").eq("school_id", sid).eq("occurrence_date", today),
        supabase.from("assessment_definitions").select("id,status").eq("school_id", sid).neq("status", "archived"),
        supabase.from("parent_student_links").select("student_id,access_level").eq("school_id", sid),
        supabase.from("academic_terms").select("name,term,academic_year").eq("school_id", sid).eq("status", "active").limit(1).maybeSingle(),
        supabase.from("vc_circulars").select("id", { count: "exact", head: true }).eq("school_id", sid).gte("sent_at", `${today}T00:00:00+03:00`),
      ])

      const failures = [
        profileRes.error,
        schoolRes.error,
        studentsRes.error,
        teachersRes.error,
        classesRes.error,
        subjectsRes.error,
        attendanceRes.error,
        teachingRes.error,
        assessmentRes.error,
        parentLinksRes.error,
        termRes.error,
        noticesRes.error,
      ].filter(Boolean)

      if (failures.length > 0) {
        throw new Error(failures[0]?.message ?? "School operations could not be loaded.")
      }

      const studentIds = new Set((studentsRes.data ?? []).map(row => row.student_id))
      const linkedStudents = new Set(
        (parentLinksRes.data ?? [])
          .filter(row => (row.access_level ?? "full") !== "none")
          .map(row => row.student_id)
      )
      const classesWithAttendance = new Set((attendanceRes.data ?? []).map(row => row.class_id)).size
      const teachingRows = teachingRes.data ?? []
      const term = termRes.data

      setState({
        adminName: profileRes.data?.full_name ?? "School Admin",
        schoolName: schoolRes.data?.name ?? "School",
        students: studentIds.size,
        teachers: new Set((teachersRes.data ?? []).map(row => row.profile_id)).size,
        classes: (classesRes.data ?? []).length,
        subjects: (subjectsRes.data ?? []).length,
        attendanceRows: (attendanceRes.data ?? []).length,
        classesWithAttendance,
        teachingScheduled: teachingRows.length,
        teachingCompleted: teachingRows.filter(row => row.lifecycle === "completed").length,
        assessments: (assessmentRes.data ?? []).length,
        unlinkedStudents: Array.from(studentIds).filter(id => !linkedStudents.has(id)).length,
        activeTerm: term ? `${term.name} · ${term.academic_year}` : null,
        notices: noticesRes.count ?? 0,
      })
    } catch (cause) {
      console.error("Admin home load failed", cause)
      setError(cause instanceof Error ? cause.message : "School operations could not be loaded.")
    } finally {
      setLoading(false)
    }
  }

  const actions = useMemo<ActionCard[]>(() => {
    if (!state) return []
    const missingAttendance = Math.max(state.classes - state.classesWithAttendance, 0)
    const incompleteTeaching = Math.max(state.teachingScheduled - state.teachingCompleted, 0)

    return [
      {
        title: "Attendance today",
        value: state.classes === 0 ? "Set up classes" : `${state.classesWithAttendance}/${state.classes} classes`,
        detail: missingAttendance > 0 ? `${missingAttendance} class${missingAttendance === 1 ? "" : "es"} still missing attendance.` : "Captured classes are visible from teacher records.",
        href: "/admin/attendance",
        priority: missingAttendance > 0 ? "attention" : "normal",
      },
      {
        title: "Teaching today",
        value: state.teachingScheduled === 0 ? "No sessions yet" : `${state.teachingCompleted}/${state.teachingScheduled} completed`,
        detail: incompleteTeaching > 0 ? `${incompleteTeaching} scheduled teaching session${incompleteTeaching === 1 ? "" : "s"} not completed.` : "Teaching evidence is up to date for today's generated sessions.",
        href: "/admin/academics",
        priority: incompleteTeaching > 0 ? "attention" : "normal",
      },
      {
        title: "Parent relationships",
        value: state.unlinkedStudents === 0 ? "Covered" : `${state.unlinkedStudents} unresolved`,
        detail: state.unlinkedStudents > 0 ? "Learners without an active verified guardian relationship need attention." : "Every enrolled learner has at least one active parent relationship.",
        href: "/admin/students",
        priority: state.unlinkedStudents > 0 ? "attention" : "normal",
      },
      {
        title: "Assessments",
        value: `${state.assessments} active`,
        detail: "Review assessment and result progress for this school only.",
        href: "/admin/academics/gradebook",
        priority: "normal",
      },
    ]
  }, [state])

  if (loading) {
    return (
      <div aria-busy="true" style={{ display: "grid", gap: 12 }}>
        {[160, 110, 110, 110].map((height, index) => (
          <div key={index} style={{ height, borderRadius: 18, background: "#e2e8f0" }} />
        ))}
      </div>
    )
  }

  if (error || !state) {
    return (
      <section style={{ maxWidth: 720, margin: "0 auto", background: "#fff", border: "1px solid #fecaca", borderRadius: 18, padding: 20 }}>
        <h1 style={{ marginTop: 0, fontSize: 20 }}>School operations unavailable</h1>
        <p style={{ color: "#64748b" }}>{error || "Your authorized school could not be resolved."}</p>
        <button onClick={() => void load()} style={{ border: 0, borderRadius: 12, padding: "10px 16px", fontWeight: 700, cursor: "pointer" }}>Retry</button>
      </section>
    )
  }

  const setupIncomplete = state.classes === 0 || state.subjects === 0 || !state.activeTerm

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: 18 }}>
      <section style={{ background: "#0a1628", color: "white", borderRadius: 22, padding: 22 }}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>{state.schoolName}</div>
        <h1 style={{ margin: "5px 0 8px", fontSize: "clamp(22px,5vw,30px)" }}>School operations</h1>
        <p style={{ margin: 0, opacity: 0.72, lineHeight: 1.5 }}>
          {state.activeTerm ?? "Academic term not configured"} · {state.adminName}
        </p>
      </section>

      {setupIncomplete && (
        <button onClick={() => router.push("/admin/settings")} style={{ ...cardStyle, borderColor: "#f59e0b", background: "#fffbeb" }}>
          <strong>Complete pilot school setup</strong>
          <div style={{ color: "#92400e", fontSize: 13, marginTop: 5 }}>
            {!state.activeTerm ? "Add an active academic term. " : ""}
            {state.classes === 0 ? "Add classes/streams. " : ""}
            {state.subjects === 0 ? "Configure subjects. " : ""}
            Open Settings to continue.
          </div>
        </button>
      )}

      <section aria-label="School totals" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(135px,1fr))", gap: 10 }}>
        {[
          ["Learners", state.students, "/admin/students"],
          ["Teachers", state.teachers, "/admin/staff"],
          ["Classes", state.classes, "/admin/settings/classes"],
          ["Subjects", state.subjects, "/admin/academics/curriculum"],
        ].map(([label, value, href]) => (
          <button key={String(label)} onClick={() => router.push(String(href))} style={cardStyle}>
            <div style={{ fontSize: 25, fontWeight: 850 }}>{String(value)}</div>
            <div style={{ color: "#64748b", marginTop: 3 }}>{String(label)}</div>
          </button>
        ))}
      </section>

      <section>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Needs attention</h2>
          <span style={{ color: "#64748b", fontSize: 12 }}>{nairobiDateStr()}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
          {actions.map(action => (
            <button
              key={action.title}
              onClick={() => router.push(action.href)}
              style={{
                ...cardStyle,
                borderColor: action.priority === "critical" ? "#ef4444" : action.priority === "attention" ? "#f59e0b" : "#e2e8f0",
              }}
            >
              <div style={{ color: "#64748b", fontSize: 12 }}>{action.title}</div>
              <div style={{ fontSize: 20, fontWeight: 820, margin: "5px 0" }}>{action.value}</div>
              <div style={{ color: "#64748b", fontSize: 13, lineHeight: 1.45 }}>{action.detail}</div>
            </button>
          ))}
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
        <button onClick={() => router.push("/admin/communication")} style={cardStyle}>
          <strong>School communications</strong>
          <div style={{ color: "#64748b", fontSize: 13, marginTop: 5 }}>{state.notices} notice{state.notices === 1 ? "" : "s"} sent today · open messages and circulars.</div>
        </button>
        <button onClick={() => router.push("/admin/reports")} style={cardStyle}>
          <strong>Reports</strong>
          <div style={{ color: "#64748b", fontSize: 13, marginTop: 5 }}>Enrollment, attendance, teaching and results should reconcile to the same school identities.</div>
        </button>
        <button onClick={() => router.push("/admin/settings")} style={cardStyle}>
          <strong>School settings</strong>
          <div style={{ color: "#64748b", fontSize: 13, marginTop: 5 }}>Manage school setup separately from personal account and platform controls.</div>
        </button>
      </section>
    </main>
  )
}
