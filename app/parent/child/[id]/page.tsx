"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

type ChildDetail = {
  id: string
  name: string
  className: string
  schoolName: string
}

type AttendanceRow = {
  id: string
  date: string
  status: string
}

function todayStr() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

function statusCopy(status: string) {
  if (status === "present") return "Present"
  if (status === "absent") return "Absent"
  if (status === "late") return "Late"
  if (status === "excused") return "Excused absence"
  return "Attendance recorded"
}

export default function ParentChildPage() {
  const params = useParams()
  const router = useRouter()
  const childId = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : ""

  const [child, setChild] = useState<ChildDetail | null>(null)
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRow[]>([])
  const [termAttendancePct, setTermAttendancePct] = useState<number | null>(null)
  const [termCountedRecords, setTermCountedRecords] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!childId) return
    setLoading(true)
    setError(null)

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) {
      router.replace("/login")
      return
    }

    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, name, class_id")
      .eq("id", childId)
      .maybeSingle()

    if (studentError) {
      setError("We could not load this learner safely. Check your connection and try again.")
      setLoading(false)
      return
    }

    if (!student) {
      setChild(null)
      setLoading(false)
      return
    }

    let className = "Class not assigned"
    let schoolName = "School not available"

    if (student.class_id) {
      const { data: cls } = await supabase
        .from("classes")
        .select("id, name, stream, school_id")
        .eq("id", student.class_id)
        .maybeSingle()

      if (cls) {
        className = `${cls.name}${cls.stream ? ` ${cls.stream}` : ""}`
        if (cls.school_id) {
          const { data: school } = await supabase.from("schools").select("name").eq("id", cls.school_id).maybeSingle()
          if (school?.name) schoolName = school.name
        }
      }
    }

    const [todayRes, termRes] = await Promise.all([
      supabase.from("attendance").select("id, date, status").eq("student_id", childId).eq("date", todayStr()).order("created_at", { ascending: true }),
      supabase.from("attendance").select("id, status").eq("student_id", childId),
    ])

    if (todayRes.error || termRes.error) setError("Attendance is temporarily unavailable. No other learner's data has been substituted.")

    const termRows = termRes.data ?? []
    const countedRows = termRows.filter(row => row.status === "present" || row.status === "late" || row.status === "absent")
    const attended = countedRows.filter(row => row.status === "present" || row.status === "late").length
    const pct = countedRows.length > 0 ? Math.round((attended / countedRows.length) * 100) : null

    setChild({ id: student.id, name: student.name, className, schoolName })
    setTodayAttendance((todayRes.data ?? []) as AttendanceRow[])
    setTermAttendancePct(pct)
    setTermCountedRecords(countedRows.length)
    setLoading(false)
  }, [childId, router])

  useEffect(() => { void load() }, [load])

  if (loading) return (
    <main className="mx-auto min-h-screen max-w-xl bg-slate-50 p-4" aria-busy="true">
      <div className="h-36 animate-pulse rounded-3xl bg-slate-200" />
      <div className="mt-4 h-40 animate-pulse rounded-2xl bg-slate-200" />
    </main>
  )

  if (!child) return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center bg-slate-50 p-4">
      <section className="w-full rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-bold text-slate-950">Learner not available</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">This learner is not linked to your current parent account, or the relationship is no longer active.</p>
        <button type="button" onClick={() => router.replace("/parent")} className="mt-5 min-h-11 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Return to Parent Home</button>
      </section>
    </main>
  )

  const firstName = child.name.split(" ")[0]

  return (
    <main className="mx-auto min-h-screen max-w-xl bg-slate-50 px-4 pb-28 pt-4 text-slate-950">
      <button type="button" onClick={() => router.push("/parent")} className="mb-3 min-h-11 text-sm font-semibold text-slate-600">← Parent Home</button>

      <section className="rounded-3xl bg-slate-950 p-5 text-white shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">Viewing learner</p>
        <h1 className="mt-2 text-2xl font-bold">{child.name}</h1>
        <p className="mt-1 text-sm text-slate-300">{child.className} · {child.schoolName}</p>
      </section>

      {error && <div role="alert" className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><p>{error}</p><button type="button" onClick={() => void load()} className="mt-3 min-h-11 rounded-xl border border-amber-300 bg-white px-4 py-2 font-semibold text-amber-950">Try again</button></div>}

      <section className="mt-4 grid grid-cols-2 gap-3" aria-label={`${firstName}'s family actions`}>
        <button type="button" onClick={() => router.push(`/parent/child/${child.id}/homework`)} className="min-h-24 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm">
          <span className="block text-lg" aria-hidden="true">📚</span><span className="mt-2 block text-sm font-bold">Homework</span><span className="mt-1 block text-xs leading-5 text-slate-500">Tasks, due dates and submission status</span>
        </button>
        <button type="button" onClick={() => router.push(`/parent/assessments?studentId=${child.id}`)} className="min-h-24 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm">
          <span className="block text-lg" aria-hidden="true">📊</span><span className="mt-2 block text-sm font-bold">Results</span><span className="mt-1 block text-xs leading-5 text-slate-500">Released assessment results only</span>
        </button>
        <button type="button" onClick={() => router.push(`/parent/child/${child.id}/progress`)} className="min-h-24 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm">
          <span className="block text-lg" aria-hidden="true">🌱</span><span className="mt-2 block text-sm font-bold">Learning progress</span><span className="mt-1 block text-xs leading-5 text-slate-500">Published strengths, focus areas and teacher comments</span>
        </button>
        <button type="button" onClick={() => router.push(`/parent/child/${child.id}/messages`)} className="min-h-24 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm">
          <span className="block text-lg" aria-hidden="true">💬</span><span className="mt-2 block text-sm font-bold">Messages</span><span className="mt-1 block text-xs leading-5 text-slate-500">Child-scoped school communication</span>
        </button>
      </section>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Today’s attendance</p>
            {todayAttendance.length === 0 ? <p className="mt-2 text-sm leading-6 text-slate-600">No attendance has been recorded yet today. This does not mean {firstName} was absent.</p> : <div className="mt-2 space-y-2">{todayAttendance.map(row => <p key={row.id} className="text-sm font-semibold text-slate-800">{statusCopy(row.status)}</p>)}</div>}
          </div>
          <div className="rounded-2xl bg-slate-100 px-4 py-3 text-center"><p className="text-xl font-bold">{termAttendancePct === null ? "—" : `${termAttendancePct}%`}</p><p className="mt-1 text-[11px] font-semibold text-slate-500">Recorded attendance</p></div>
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">{termCountedRecords === 0 ? "No present/late/absent records are available for an attendance rate yet. Excused or non-applicable records are not treated as absence." : `Based on ${termCountedRecords} present, late or absent ${termCountedRecords === 1 ? "record" : "records"}. Excused records are not counted as absence.`}</p>
      </section>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold">More about {firstName}</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => router.push(`/parent/child/${child.id}/profile`)} className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold">Profile</button>
          <button type="button" onClick={() => router.push(`/parent/child/${child.id}/finance`)} className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold">Finance</button>
        </div>
      </section>
    </main>
  )
}
