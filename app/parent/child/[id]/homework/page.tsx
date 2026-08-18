"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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
  status: string
  mark: number | null
  feedback: string | null
}

function dueLabel(value: string | null) {
  if (!value) return "No due date"
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
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

    // Fail closed immediately when child context changes. Never leave a sibling's
    // name, homework, error, or authorization state on screen while new requests run.
    setChildName("")
    setItems([])
    setUnauthorized(false)
    setError(null)
    setLoading(true)

    if (!childId) {
      if (version === requestVersion.current) {
        setUnauthorized(true)
        setLoading(false)
      }
      return
    }

    const isStale = () => version !== requestVersion.current

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (isStale()) return
    if (authError || !authData.user) {
      router.replace("/login")
      return
    }

    // RLS on students is the deep-link relationship gate.
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, name, class_id")
      .eq("id", childId)
      .maybeSingle()

    if (isStale()) return
    if (studentError) {
      setError("Homework could not be loaded safely. Check your connection and try again.")
      setLoading(false)
      return
    }

    if (!student) {
      setUnauthorized(true)
      setLoading(false)
      return
    }

    setChildName(student.name)
    if (!student.class_id) {
      setLoading(false)
      return
    }

    const [homeworkRes, submissionsRes] = await Promise.all([
      supabase
        .from("homework")
        .select("id, title, subject, instructions, due_date")
        .eq("class_id", student.class_id)
        .order("due_date", { ascending: true }),
      supabase
        .from("homework_submissions")
        .select("homework_id, status, mark, feedback")
        .eq("student_id", childId),
    ])

    if (isStale()) return
    if (homeworkRes.error || submissionsRes.error) {
      setError("Homework is temporarily unavailable. No cached data from another learner has been shown.")
      setLoading(false)
      return
    }

    const byHomework = new Map<string, SubmissionRow>()
    for (const submission of submissionsRes.data ?? []) {
      if (submission.homework_id) byHomework.set(submission.homework_id, submission)
    }

    const nextItems = (homeworkRes.data ?? []).map(row => {
      const submission = byHomework.get(row.id)
      return {
        ...row,
        status: submission?.status ?? "not_started",
        mark: submission?.mark ?? null,
        feedback: submission?.feedback ?? null,
      }
    })

    if (isStale()) return
    setItems(nextItems)
    setLoading(false)
  }, [childId, router])

  useEffect(() => {
    void load()
    return () => {
      requestVersion.current += 1
    }
  }, [load])

  if (loading) {
    return (
      <main className="mx-auto min-h-screen max-w-xl bg-slate-50 p-4">
        <div className="h-24 animate-pulse rounded-3xl bg-slate-200" />
        <div className="mt-4 h-32 animate-pulse rounded-2xl bg-slate-200" />
      </main>
    )
  }

  if (unauthorized) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center bg-slate-50 p-4">
        <section className="w-full rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-950">Homework not available</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">This learner is not linked to your active parent account.</p>
          <button onClick={() => router.replace("/parent")} className="mt-5 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Return to Parent Home</button>
        </section>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl bg-slate-50 px-4 pb-28 pt-4 text-slate-950">
      <button onClick={() => router.push(`/parent/child/${childId}`)} className="mb-3 min-h-11 text-sm font-semibold text-slate-600">← {childName || "Learner"}</button>

      <section className="rounded-3xl bg-slate-950 p-5 text-white shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">Homework</p>
        <h1 className="mt-2 text-2xl font-bold">{childName}</h1>
        <p className="mt-1 text-sm text-slate-300">Teacher assignments and this learner’s submission status</p>
      </section>

      {error && <div role="alert" className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">{error}</div>}

      <section className="mt-4 space-y-3">
        {items.length === 0 && !error ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
            <h2 className="font-bold">No homework right now</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">There are no teacher assignments currently visible for this learner.</p>
          </div>
        ) : items.map(item => (
          <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">{item.subject ?? "Subject"}</p>
                <h2 className="mt-1 font-bold">{item.title}</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{item.status.replaceAll("_", " ")}</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">Due {dueLabel(item.due_date)}</p>
            {item.instructions && <p className="mt-3 text-sm leading-6 text-slate-700">{item.instructions}</p>}
            {(item.mark !== null || item.feedback) && (
              <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-950">
                {item.mark !== null && <p className="font-bold">Mark: {item.mark}</p>}
                {item.feedback && <p className="mt-1 leading-6">{item.feedback}</p>}
              </div>
            )}
          </article>
        ))}
      </section>
    </main>
  )
}
