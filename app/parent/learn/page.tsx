"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

type Child = {
  id: string
  name: string
  classId: string | null
  className: string
}

type Homework = {
  id: string
  title: string
  subject: string
  instructions: string | null
  dueDate: string | null
  status: "not_started" | "draft" | "submitted" | "marked"
  mark: number | null
  feedback: string | null
}

type Assessment = {
  id: string
  title: string
  subject: string
  score: number | null
  maxScore: number | null
  percentage: number | null
  releasedAt: string
}

type Progress = {
  id: string
  periodStart: string
  periodEnd: string
  strengths: string[]
  focusAreas: string[]
  teacherComment: string | null
}

type ViewState = {
  homework: Homework[]
  assessments: Assessment[]
  progress: Progress[]
}

const EMPTY: ViewState = { homework: [], assessments: [], progress: [] }

function dateLabel(value: string | null) {
  if (!value) return "No due date"
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function statusLabel(status: Homework["status"]) {
  if (status === "marked") return "Marked"
  if (status === "submitted") return "Submitted"
  if (status === "draft") return "Started"
  return "Not started"
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-500">{body}</p>
    </div>
  )
}

export default function ParentLearnPage() {
  const router = useRouter()
  const requestVersion = useRef(0)
  const [children, setChildren] = useState<Child[]>([])
  const [activeChildId, setActiveChildId] = useState("")
  const [tab, setTab] = useState<"homework" | "progress" | "results">("homework")
  const [state, setState] = useState<ViewState>(EMPTY)
  const [loadingChildren, setLoadingChildren] = useState(true)
  const [loadingChild, setLoadingChild] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeChild = useMemo(
    () => children.find(child => child.id === activeChildId) ?? null,
    [children, activeChildId],
  )

  useEffect(() => {
    let alive = true

    async function loadChildren() {
      setLoadingChildren(true)
      setError(null)

      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (!alive) return
      if (authError || !authData.user) {
        router.replace("/login")
        return
      }

      const { data: links, error: linksError } = await supabase
        .from("parent_student_links")
        .select("student_id, students(id, name, class_id, classes(name, stream))")
        .eq("parent_id", authData.user.id)

      if (!alive) return
      if (linksError) {
        setError("We could not load your verified children. Check your connection and try again.")
        setLoadingChildren(false)
        return
      }

      const nextChildren: Child[] = (links ?? [])
        .map(link => {
          const student = link.students as unknown as {
            id: string
            name: string
            class_id: string | null
            classes: { name: string; stream: string | null } | null
          } | null
          if (!student) return null
          return {
            id: student.id,
            name: student.name,
            classId: student.class_id,
            className: student.classes
              ? `${student.classes.name}${student.classes.stream ? ` ${student.classes.stream}` : ""}`
              : "Class not assigned",
          }
        })
        .filter((child): child is Child => child !== null)

      setChildren(nextChildren)
      setActiveChildId(nextChildren[0]?.id ?? "")
      setLoadingChildren(false)
    }

    void loadChildren()
    return () => { alive = false }
  }, [router])

  const loadChild = useCallback(async (child: Child) => {
    const version = ++requestVersion.current

    // Privacy invariant: clear every child-scoped value before any network
    // request. Child A must never remain visible under Child B's heading.
    setState(EMPTY)
    setError(null)
    setLoadingChild(true)

    if (!child.classId) {
      if (version === requestVersion.current) setLoadingChild(false)
      return
    }

    const [homeworkRes, submissionsRes, assessmentsRes, progressRes] = await Promise.all([
      supabase
        .from("homework")
        .select("id, title, subject, instructions, due_date")
        .eq("class_id", child.classId)
        .order("due_date", { ascending: true }),
      supabase
        .from("homework_submissions")
        .select("id, homework_id, status, mark, feedback")
        .eq("student_id", child.id),
      supabase
        .from("assessment_gradebook_entries")
        .select("attempt_id, assessment_title, subject_id, score, max_score, percentage, released_at, subjects(name)")
        .eq("student_id", child.id)
        .not("released_at", "is", null)
        .order("released_at", { ascending: false }),
      supabase
        .from("parent_learning_summaries")
        .select("id, period_start, period_end, strengths, focus_areas, teacher_comment")
        .eq("student_id", child.id)
        .eq("status", "published")
        .order("period_end", { ascending: false })
        .limit(6),
    ])

    if (version !== requestVersion.current) return

    const firstError = homeworkRes.error ?? submissionsRes.error ?? assessmentsRes.error ?? progressRes.error
    if (firstError) {
      setState(EMPTY)
      setError("Some learning information could not be loaded. No cached child data has been shown. Try again.")
      setLoadingChild(false)
      return
    }

    const submissions = new Map<string, { status: string; mark: number | null; feedback: string | null }>()
    for (const row of submissionsRes.data ?? []) {
      if (row.homework_id) submissions.set(row.homework_id, row)
    }

    const homework: Homework[] = (homeworkRes.data ?? []).map(row => {
      const submission = submissions.get(row.id)
      const rawStatus = submission?.status ?? "not_started"
      const status: Homework["status"] =
        rawStatus === "marked" || rawStatus === "submitted" || rawStatus === "draft"
          ? rawStatus
          : "not_started"
      return {
        id: row.id,
        title: row.title,
        subject: row.subject ?? "Subject",
        instructions: row.instructions,
        dueDate: row.due_date,
        status,
        mark: submission?.mark ?? null,
        feedback: submission?.feedback ?? null,
      }
    })

    const assessments: Assessment[] = (assessmentsRes.data ?? [])
      .filter(row => Boolean(row.released_at))
      .map(row => ({
        id: row.attempt_id,
        title: row.assessment_title ?? "Assessment",
        subject: (row.subjects as unknown as { name: string } | null)?.name ?? "Subject",
        score: row.score,
        maxScore: row.max_score,
        percentage: row.percentage,
        releasedAt: row.released_at as string,
      }))

    const progress: Progress[] = (progressRes.data ?? []).map(row => ({
      id: row.id,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      strengths: row.strengths ?? [],
      focusAreas: row.focus_areas ?? [],
      teacherComment: row.teacher_comment,
    }))

    setState({ homework, assessments, progress })
    setLoadingChild(false)
  }, [])

  useEffect(() => {
    if (!activeChild) {
      requestVersion.current += 1
      setState(EMPTY)
      setLoadingChild(false)
      return
    }
    void loadChild(activeChild)
  }, [activeChild, loadChild])

  const switchChild = (childId: string) => {
    if (childId === activeChildId) return
    requestVersion.current += 1
    setState(EMPTY)
    setError(null)
    setLoadingChild(true)
    setTab("homework")
    setActiveChildId(childId)
  }

  const refresh = () => {
    if (activeChild && !loadingChild) void loadChild(activeChild)
  }

  if (loadingChildren) {
    return (
      <main className="mx-auto min-h-screen max-w-xl bg-slate-50 p-4">
        <div className="h-20 animate-pulse rounded-2xl bg-slate-200" />
        <div className="mt-4 h-40 animate-pulse rounded-2xl bg-slate-200" />
      </main>
    )
  }

  if (children.length === 0) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center bg-slate-50 p-4">
        <div className="w-full rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">Connect a child first</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            No active verified child relationship is available on this parent account. A pending, revoked or unverified relationship does not grant learner access.
          </p>
          <button
            onClick={() => router.push("/parent/connect-child")}
            className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
          >
            Connect a child
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl bg-slate-50 px-4 pb-28 pt-4 text-slate-900">
      <section className="rounded-3xl bg-slate-900 p-5 text-white shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Learning & progress</p>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{activeChild?.name ?? "Child"}</h1>
            <p className="mt-1 text-sm text-slate-300">{activeChild?.className}</p>
          </div>
          <button
            onClick={refresh}
            disabled={loadingChild}
            className="rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold disabled:opacity-50"
          >
            {loadingChild ? "Loading…" : "Refresh"}
          </button>
        </div>
      </section>

      {children.length > 1 && (
        <section className="mt-4" aria-label="Choose child">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Viewing child</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {children.map(child => (
              <button
                key={child.id}
                onClick={() => switchChild(child.id)}
                aria-pressed={child.id === activeChildId}
                className={`min-w-32 rounded-2xl border px-4 py-3 text-left ${
                  child.id === activeChildId
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <span className="block text-sm font-semibold">{child.name.split(" ")[0]}</span>
                <span className="mt-1 block text-xs text-slate-500">{child.className}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <nav className="mt-4 grid grid-cols-3 rounded-2xl border border-slate-200 bg-white p-1" aria-label="Learning sections">
        {(["homework", "progress", "results"] as const).map(item => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`rounded-xl px-2 py-3 text-sm font-semibold capitalize ${tab === item ? "bg-slate-900 text-white" : "text-slate-600"}`}
          >
            {item}
          </button>
        ))}
      </nav>

      {error && (
        <div role="alert" className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          {error}
        </div>
      )}

      {loadingChild ? (
        <section className="mt-4 space-y-3" aria-label="Loading selected child">
          <div className="h-28 animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-28 animate-pulse rounded-2xl bg-slate-200" />
        </section>
      ) : (
        <section className="mt-4 space-y-3">
          {tab === "homework" && (
            state.homework.length ? state.homework.map(item => (
              <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{item.subject}</p>
                    <h2 className="mt-1 font-semibold text-slate-900">{item.title}</h2>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{statusLabel(item.status)}</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">Due {dateLabel(item.dueDate)}</p>
                {item.instructions && <p className="mt-3 text-sm leading-6 text-slate-700">{item.instructions}</p>}
                {item.status === "marked" && (
                  <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
                    {item.mark !== null && <p className="font-semibold">Mark: {item.mark}</p>}
                    {item.feedback && <p className="mt-1">{item.feedback}</p>}
                  </div>
                )}
              </article>
            )) : <EmptyState title="No homework right now" body="There is no homework currently visible for this child. New teacher assignments will appear here." />
          )}

          {tab === "progress" && (
            state.progress.length ? state.progress.map(item => (
              <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {dateLabel(item.periodStart)} – {dateLabel(item.periodEnd)}
                </p>
                {item.strengths.length > 0 && (
                  <div className="mt-3">
                    <h2 className="text-sm font-semibold text-slate-900">Doing well</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{item.strengths.join(" · ")}</p>
                  </div>
                )}
                {item.focusAreas.length > 0 && (
                  <div className="mt-3">
                    <h2 className="text-sm font-semibold text-slate-900">Focus next</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{item.focusAreas.join(" · ")}</p>
                  </div>
                )}
                {item.teacherComment && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">{item.teacherComment}</p>}
              </article>
            )) : <EmptyState title="No published progress summary yet" body="Progress appears after the school or teacher publishes a family-facing learning summary." />
          )}

          {tab === "results" && (
            state.assessments.length ? state.assessments.map(item => (
              <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">{item.subject}</p>
                    <h2 className="mt-1 font-semibold text-slate-900">{item.title}</h2>
                  </div>
                  {item.percentage !== null && <span className="text-lg font-bold text-slate-900">{Math.round(item.percentage)}%</span>}
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Released {new Date(item.releasedAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                </p>
                {item.score !== null && item.maxScore !== null && <p className="mt-2 text-sm font-medium text-slate-700">Score {item.score} / {item.maxScore}</p>}
              </article>
            )) : <EmptyState title="No released results" body="Draft or unreleased assessment results are never shown here. Published results will appear when the teacher releases them." />
          )}
        </section>
      )}
    </main>
  )
}
