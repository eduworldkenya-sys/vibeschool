"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getParentAssessmentSummary } from "@/lib/assessment/integration"

type Child = {
  id: string
  name: string
  className: string
  schoolName: string
  attendancePct: number | null
  attendanceRecords: number
  todayAttendance: string | null
  homeworkOpen: number
  homeworkOverdue: number
  latestResult: number | null
  latestAssessment: string | null
  recentMessages: number
}

type Attention = {
  id: string
  childId: string
  childName: string
  title: string
  detail: string
  href: string
  priority: number
}

const C = { dark: "#1e1b4b", green: "#059669", muted: "#64748b", border: "#e2e8f0" }

function kenyaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date())
}

function daysAgoDate(days: number) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit",
  })
  return formatter.format(new Date(Date.now() - days * 86400000))
}

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Nairobi", hour: "2-digit", hour12: false }).format(new Date()))
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

function attendanceLabel(status: string | null) {
  if (status === "present") return "Present today"
  if (status === "late") return "Late today"
  if (status === "absent") return "Absent today"
  if (status === "excused") return "Excused today"
  return "Attendance not recorded yet"
}

function ChildCard({ child }: { child: Child }) {
  const router = useRouter()
  return (
    <button type="button" onClick={() => router.push(`/parent/child/${child.id}`)} aria-label={`Open ${child.name}`} style={{
      width: "100%", minHeight: 132, textAlign: "left", border: `1px solid ${C.border}`, borderRadius: 18,
      background: "#fff", padding: 16, cursor: "pointer", fontFamily: "inherit", color: "#0f172a",
      boxShadow: "0 2px 10px rgba(15,23,42,.05)",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <strong style={{ display: "block", fontSize: 17 }}>{child.name}</strong>
          <span style={{ display: "block", marginTop: 3, color: C.muted, fontSize: 11 }}>{child.className} · {child.schoolName}</span>
        </div>
        <span aria-hidden="true" style={{ color: "#94a3b8", fontSize: 22 }}>›</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
        <div style={{ background: "#f8fafc", borderRadius: 11, padding: 10 }}>
          <span style={{ display: "block", color: C.muted, fontSize: 10, fontWeight: 700 }}>Today</span>
          <strong style={{ display: "block", marginTop: 3, fontSize: 12 }}>{attendanceLabel(child.todayAttendance)}</strong>
        </div>
        <div style={{ background: "#f8fafc", borderRadius: 11, padding: 10 }}>
          <span style={{ display: "block", color: C.muted, fontSize: 10, fontWeight: 700 }}>Recorded attendance</span>
          <strong style={{ display: "block", marginTop: 3, fontSize: 12 }}>{child.attendancePct === null ? "No rate yet" : `${child.attendancePct}%`}</strong>
        </div>
      </div>
    </button>
  )
}

export default function ParentHomePage() {
  const router = useRouter()
  const [firstName, setFirstName] = useState("Parent")
  const [children, setChildren] = useState<Child[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(false)
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) { router.replace("/"); return }

        const [{ data: profile }, { data: links, error: linkError }] = await Promise.all([
          supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
          supabase.from("parent_student_links").select("student_id, is_primary").eq("parent_id", user.id).order("is_primary", { ascending: false }),
        ])
        if (linkError) throw linkError
        if (cancelled) return
        setFirstName(profile?.full_name?.trim()?.split(/\s+/)[0] || "Parent")

        const ids = (links ?? []).map(link => link.student_id).filter((id): id is string => Boolean(id))
        if (ids.length === 0) { setChildren([]); return }

        const { data: students, error: studentError } = await supabase.from("students").select("id, name, class_id").in("id", ids)
        if (studentError) throw studentError
        const orderedStudents = ids.flatMap(id => {
          const student = (students ?? []).find(row => row.id === id)
          return student ? [student] : []
        })
        const classIds = Array.from(new Set(orderedStudents.map(row => row.class_id).filter((id): id is string => Boolean(id))))
        const { data: classes, error: classError } = classIds.length
          ? await supabase.from("classes").select("id, name, stream, school_id").in("id", classIds)
          : { data: [], error: null }
        if (classError) throw classError
        const schoolIds = Array.from(new Set((classes ?? []).map(row => row.school_id).filter((id): id is string => Boolean(id))))
        const { data: schools, error: schoolError } = schoolIds.length
          ? await supabase.from("schools").select("id, name").in("id", schoolIds)
          : { data: [], error: null }
        if (schoolError) throw schoolError

        const today = kenyaDate()
        const [attendanceRes, homeworkRes, submissionsRes, messagesRes] = await Promise.all([
          supabase.from("attendance").select("student_id, status, is_late, date").in("student_id", ids).gte("date", daysAgoDate(90)),
          classIds.length ? supabase.from("homework").select("id, class_id, due_date").in("class_id", classIds).gte("due_date", daysAgoDate(30)) : Promise.resolve({ data: [], error: null }),
          supabase.from("homework_submissions").select("homework_id, student_id, status").in("student_id", ids),
          supabase.from("parent_messages").select("id, student_id, sent_at").in("student_id", ids).not("sent_at", "is", null).gte("sent_at", new Date(Date.now() - 7 * 86400000).toISOString()),
        ])
        if (attendanceRes.error || homeworkRes.error || submissionsRes.error || messagesRes.error) throw attendanceRes.error || homeworkRes.error || submissionsRes.error || messagesRes.error

        const completed = new Set((submissionsRes.data ?? []).filter(row => row.status === "submitted" || row.status === "marked").map(row => `${row.student_id}:${row.homework_id}`))
        const resultMap = new Map<string, { score: number | null; title: string | null }>()
        await Promise.all(orderedStudents.map(async student => {
          try {
            const assessment = await getParentAssessmentSummary(student.id)
            const latest = [...assessment.results].filter(result => Boolean(result.releasedAt)).sort((a, b) => new Date(b.releasedAt).getTime() - new Date(a.releasedAt).getTime())[0]
            resultMap.set(student.id, { score: latest?.percentage ?? null, title: latest?.assessmentTitle ?? null })
          } catch {
            resultMap.set(student.id, { score: null, title: null })
          }
        }))
        if (cancelled) return

        setChildren(orderedStudents.map(student => {
          const cls = (classes ?? []).find(row => row.id === student.class_id)
          const school = (schools ?? []).find(row => row.id === cls?.school_id)
          const attendance = (attendanceRes.data ?? []).filter(row => row.student_id === student.id)
          const countableAttendance = attendance.filter(row => row.status === "present" || row.status === "late" || row.status === "absent")
          const attended = countableAttendance.filter(row => row.status === "present" || row.status === "late").length
          const todayRow = attendance.find(row => row.date === today)
          const classHomework = (homeworkRes.data ?? []).filter(row => row.class_id === student.class_id)
          const open = classHomework.filter(row => !completed.has(`${student.id}:${row.id}`))
          const latest = resultMap.get(student.id) ?? { score: null, title: null }
          return {
            id: student.id,
            name: student.name,
            className: cls ? `${cls.name}${cls.stream ? ` ${cls.stream}` : ""}` : "Class not confirmed",
            schoolName: school?.name ?? "School not confirmed",
            attendancePct: countableAttendance.length ? Math.round(attended / countableAttendance.length * 100) : null,
            attendanceRecords: countableAttendance.length,
            todayAttendance: todayRow?.is_late ? "late" : todayRow?.status ?? null,
            homeworkOpen: open.length,
            homeworkOverdue: open.filter(row => row.due_date && row.due_date < today).length,
            latestResult: latest.score,
            latestAssessment: latest.title,
            recentMessages: (messagesRes.data ?? []).filter(row => row.student_id === student.id).length,
          }
        }))
      } catch (loadError) {
        console.error("[ParentHome] load failed", loadError)
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [router])

  const attention = useMemo(() => {
    const rows: Attention[] = []
    for (const child of children) {
      if (child.todayAttendance === "absent") rows.push({ id: `absent-${child.id}`, childId: child.id, childName: child.name, title: "Absent today", detail: "The school recorded an absence today.", href: `/parent/child/${child.id}`, priority: 0 })
      if (child.todayAttendance === "late") rows.push({ id: `late-${child.id}`, childId: child.id, childName: child.name, title: "Late arrival today", detail: "The school recorded a late arrival today.", href: `/parent/child/${child.id}`, priority: 1 })
      if (child.homeworkOverdue > 0) rows.push({ id: `homework-${child.id}`, childId: child.id, childName: child.name, title: `${child.homeworkOverdue} overdue ${child.homeworkOverdue === 1 ? "task" : "tasks"}`, detail: "No submitted work is recorded for these past-due tasks.", href: `/parent/child/${child.id}/homework`, priority: 1 })
      if (child.recentMessages > 0) rows.push({ id: `messages-${child.id}`, childId: child.id, childName: child.name, title: `${child.recentMessages} recent ${child.recentMessages === 1 ? "message" : "messages"}`, detail: "Teacher or school communication from the last seven days.", href: `/parent/child/${child.id}/messages`, priority: 2 })
    }
    return rows.sort((a, b) => a.priority - b.priority).slice(0, 8)
  }, [children])

  if (loading) return <div role="status" aria-label="Loading Parent Home" style={{ display: "grid", gap: 12 }}>{[112, 92, 160].map((height, i) => <div key={i} style={{ height, borderRadius: 18, background: "#e2e8f0" }} />)}</div>

  if (error) return (
    <section role="alert" style={{ background: "#fff", border: "1px solid #fecaca", borderRadius: 18, padding: 20 }}>
      <h1 style={{ margin: 0, color: "#991b1b", fontSize: 19 }}>Parent Home is temporarily unavailable</h1>
      <p style={{ margin: "8px 0 14px", color: C.muted, fontSize: 13 }}>Your child relationships have not been changed. Check your connection and try again.</p>
      <button type="button" onClick={() => window.location.reload()} style={{ minHeight: 44, border: 0, borderRadius: 10, padding: "0 16px", background: C.dark, color: "#fff", fontWeight: 800 }}>Try again</button>
    </section>
  )

  if (children.length === 0) return (
    <section style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 20, padding: "28px 20px", textAlign: "center" }}>
      <div aria-hidden="true" style={{ fontSize: 40 }}>👨‍👩‍👧</div>
      <h1 style={{ margin: "10px 0 6px", color: C.dark, fontSize: 21 }}>No verified child is linked yet</h1>
      <p style={{ margin: "0 auto 16px", maxWidth: 430, color: C.muted, fontSize: 13, lineHeight: 1.6 }}>For child privacy, a school-authorized relationship is required before learner information can appear here.</p>
      <button type="button" onClick={() => router.push("/parent/link-child")} style={{ minHeight: 46, border: 0, borderRadius: 11, padding: "0 17px", background: C.green, color: "#fff", fontWeight: 800 }}>Link or request access</button>
    </section>
  )

  return (
    <div>
      <section style={{ borderRadius: 22, padding: 19, marginBottom: 14, background: `linear-gradient(145deg,#0f172a,${C.dark})`, color: "#fff" }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#a7f3d0", textTransform: "uppercase", letterSpacing: .8 }}>Parent Home</div>
        <h1 style={{ margin: "5px 0 3px", fontSize: 23 }}>{greeting()}, {firstName}</h1>
        <p style={{ margin: 0, color: "#cbd5e1", fontSize: 12 }}>Important family-school updates first. Tap a child for full context.</p>
      </section>

      <section aria-labelledby="attention-heading" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <h2 id="attention-heading" style={{ margin: 0, fontSize: 17, color: "#0f172a" }}>Needs attention</h2>
          <button type="button" onClick={() => router.push("/parent/inbox")} style={{ minHeight: 44, border: 0, background: "transparent", color: C.green, fontWeight: 800 }}>All messages</button>
        </div>
        {attention.length === 0 ? <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 14, padding: 14, color: "#166534", fontSize: 13 }}>No current attendance, homework or message item needs your attention.</div>
          : <div style={{ display: "grid", gap: 8 }}>{attention.map(item => (
            <button key={item.id} type="button" onClick={() => router.push(item.href)} style={{ width: "100%", minHeight: 66, textAlign: "left", border: `1px solid ${item.priority <= 1 ? "#fde68a" : C.border}`, borderRadius: 14, background: item.priority <= 1 ? "#fffbeb" : "#fff", padding: 12, cursor: "pointer" }}>
              <strong style={{ display: "block", color: "#0f172a", fontSize: 13 }}>{item.childName} · {item.title}</strong>
              <span style={{ display: "block", marginTop: 3, color: C.muted, fontSize: 11, lineHeight: 1.45 }}>{item.detail}</span>
            </button>
          ))}</div>}
      </section>

      <section aria-labelledby="children-heading">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <h2 id="children-heading" style={{ margin: 0, fontSize: 17 }}>Your children</h2>
          <button type="button" onClick={() => router.push("/parent/students")} style={{ minHeight: 44, border: 0, background: "transparent", color: C.green, fontWeight: 800 }}>Manage</button>
        </div>
        <div style={{ display: "grid", gap: 10 }}>{children.map(child => <ChildCard key={child.id} child={child} />)}</div>
      </section>
    </div>
  )
}