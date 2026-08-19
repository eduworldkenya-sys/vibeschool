"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

type HomeworkRow = {
  id: string
  title: string
  subject: string | null
  instructions: string | null
  due_date: string | null
}

type SubmissionRow = {
  homework_id: string | null
  status: string | null
  mark: number | null
  feedback: string | null
}

type HomeworkItem = HomeworkRow & {
  submissionStatus: "not_started" | "draft" | "submitted" | "marked"
  mark: number | null
  feedback: string | null
}

function kenyaToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date())
}

function dueLabel(value: string | null) {
  if (!value) return "No due date"
  return new Date(`${value}T12:00:00+03:00`).toLocaleDateString("en-KE", {
    timeZone: "Africa/Nairobi", day: "numeric", month: "short", year: "numeric",
  })
}

function statusInfo(item: HomeworkItem) {
  if (item.submissionStatus === "marked") return { label: "Marked", rank: 4, detail: "Teacher feedback is available." }
  if (item.submissionStatus === "submitted") return { label: "Submitted", rank: 3, detail: "Work was submitted and is awaiting any further teacher action." }
  if (item.submissionStatus === "draft") return { label: "Started", rank: 2, detail: "The learner has started this work but has not submitted it yet." }
  if (item.due_date && item.due_date < kenyaToday()) return { label: "Overdue", rank: 0, detail: "No submitted work is recorded and the due date has passed." }
  if (item.due_date) {
    const due = new Date(`${item.due_date}T12:00:00+03:00`).getTime()
    const now = new Date(`${kenyaToday()}T12:00:00+03:00`).getTime()
    if (due - now <= 2 * 86400000) return { label: "Due soon", rank: 1, detail: "No submitted work is recorded yet." }
  }
  return { label: "Assigned", rank: 2, detail: "No submitted work is recorded yet." }
}

export default function ParentChildHomeworkPage() {
  const params = useParams()
  const router = useRouter()
  const childId = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : ""
  const requestVersion = useRef(0)

  const [childName, setChildName] = useState("")
  const [items, setItems] = useState<HomeworkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [unauthorized, setUnauthorized] = useState(false)

  const load = useCallback(async () => {
    const version = ++requestVersion.current
    setChildName("")
    setItems([])
    setUnauthorized(false)
    setError(null)
    setLoading(true)

    if (!childId) {
      if (version === requestVersion.current) { setUnauthorized(true); setLoading(false) }
      return
    }

    const isStale = () => version !== requestVersion.current
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (isStale()) return
    if (authError || !authData.user) { router.replace("/login"); return }

    const { data: student, error: studentError } = await supabase
      .from("students").select("id, name, class_id").eq("id", childId).maybeSingle()
    if (isStale()) return
    if (studentError) {
      setError("Homework could not be loaded safely. Check your connection and try again.")
      setLoading(false)
      return
    }
    if (!student) { setUnauthorized(true); setLoading(false); return }

    setChildName(student.name)
    if (!student.class_id) { setLoading(false); return }

    const [homeworkRes, submissionsRes] = await Promise.all([
      supabase.from("homework").select("id, title, subject, instructions, due_date").eq("class_id", student.class_id).order("due_date", { ascending: true }),
      supabase.from("homework_submissions").select("homework_id, status, mark, feedback").eq("student_id", childId),
    ])
    if (isStale()) return
    if (homeworkRes.error || submissionsRes.error) {
      setError("Homework is temporarily unavailable. No cached data from another learner has been shown.")
      setLoading(false)
      return
    }

    const byHomework = new Map<string, SubmissionRow>()
    for (const submission of submissionsRes.data ?? []) if (submission.homework_id) byHomework.set(submission.homework_id, submission)

    const nextItems: HomeworkItem[] = (homeworkRes.data ?? []).map(row => {
      const submission = byHomework.get(row.id)
      const raw = submission?.status
      const submissionStatus: HomeworkItem["submissionStatus"] = raw === "marked" || raw === "submitted" || raw === "draft" ? raw : "not_started"
      return { ...row, submissionStatus, mark: submission?.mark ?? null, feedback: submission?.feedback ?? null }
    })
    if (isStale()) return
    setItems(nextItems)
    setLoading(false)
  }, [childId, router])

  useEffect(() => {
    void load()
    return () => { requestVersion.current += 1 }
  }, [load])

  const orderedItems = useMemo(() => [...items].sort((a, b) => {
    const aInfo = statusInfo(a)
    const bInfo = statusInfo(b)
    if (aInfo.rank !== bInfo.rank) return aInfo.rank - bInfo.rank
    return (a.due_date ?? "9999-12-31").localeCompare(b.due_date ?? "9999-12-31")
  }), [items])

  if (loading) {
    return <main className="mx-auto min-h-screen max-w-xl bg-slate-50 p-4" aria-busy="true"><div className="h-24 animate-pulse rounded-3xl bg-slate-200" /><div className="mt-4 h-32 animate-pulse rounded-2xl bg-slate-200" /></main>
  }

  if (unauthorized) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center bg-slate-50 p-4">
        <section className="w-full rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-950">Homework not available</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">This learner is not linked to your active parent account, or that relationship is no longer active.</p>
          <button onClick={() => router.replace("/parent")} className="mt-5 min-h-11 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Return to Parent Home</button>
        </section>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl bg-slate-50 px-4 pb-28 pt-4 text-slate-950">
      <button onClick={() => router.push(`/parent/child/${childId}`)} className="mb-3 min-h-11 text-sm font-semibold text-slate-600">← {childName || "Learner"}</button>

      <section className="rounded-3xl bg-slate-950 p-5 text-white shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">Schoolwork · Homework</p>
        <h1 className="mt-2 text-2xl font-bold">{childName}</h1>
        <p className="mt-1 text-sm text-slate-300">Due work first, with this learner&apos;s real submission state.</p>
      </section>

      {error && <div role="alert" className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><p>{error}</p><button onClick={() => void load()} className="mt-3 min-h-11 rounded-xl border border-amber-300 bg-white px-4 py-2 font-semibold">Try again</button></div>}

      <section className="mt-4 space-y-3">
        {orderedItems.length === 0 && !error ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
            <h2 className="font-bold">No current homework</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">There are no teacher assignments currently visible for {childName || "this learner"}.</p>
          </div>
        ) : orderedItems.map(item => {
          const info = statusInfo(item)
          const needsAttention = info.label === "Overdue" || info.label === "Due soon"
          return (
            <article key={item.id} className={`rounded-2xl border bg-white p-5 shadow-sm ${needsAttention ? "border-amber-300" : "border-slate-200"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">{item.subject ?? "Subject"}</p>
                  <h2 className="mt-1 font-bold">{item.title}</h2>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${needsAttention ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}`}>{info.label}</span>
              </div>
              <p className="mt-2 text-sm text-slate-600">{item.due_date ? `Due ${dueLabel(item.due_date)}` : "No due date provided"}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{info.detail}</p>
              {item.instructions && <p className="mt-3 text-sm leading-6 text-slate-700">{item.instructions}</p>}
              {(item.mark !== null || item.feedback) && (
                <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-950">
                  {item.mark !== null && <p className="font-bold">Teacher mark: {item.mark}</p>}
                  {item.feedback && <p className="mt-1 leading-6">{item.feedback}</p>}
                </div>
              )}
            </article>
          )
        })}
      </section>
    </main>
  )
}