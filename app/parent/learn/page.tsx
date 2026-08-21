"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import "./parent-learn.css"

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
    <div className="parent-learn-empty">
      <p className="parent-learn-empty-title">{title}</p>
      <p className="parent-learn-empty-body">{body}</p>
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
      <main className="parent-learn-page">
        <div className="parent-learn-card">Loading children…</div>
      </main>
    )
  }

  if (children.length === 0) {
    return (
      <main className="parent-learn-page">
        <div className="parent-learn-empty">
          <h1 className="parent-learn-title">Connect a child first</h1>
          <p className="parent-learn-empty-body">
            No active verified child relationship is available on this parent account. A pending, revoked or unverified relationship does not grant learner access.
          </p>
          <button onClick={() => router.push("/parent/connect-child")} className="parent-learn-tab" aria-selected="true">
            Connect a child
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="parent-learn-page">
      <section className="parent-learn-hero">
        <p className="parent-learn-eyebrow">Learning & progress</p>
        <div className="parent-learn-hero-row">
          <div>
            <h1 className="parent-learn-title">{activeChild?.name ?? "Child"}</h1>
            <p className="parent-learn-subtitle">{activeChild?.className}</p>
          </div>
          <button onClick={refresh} disabled={loadingChild} className="parent-learn-refresh">
            {loadingChild ? "Loading…" : "Refresh"}
          </button>
        </div>
      </section>

      {children.length > 1 && (
        <section className="parent-learn-content" aria-label="Choose child">
          {children.map(child => (
            <button key={child.id} onClick={() => switchChild(child.id)} aria-pressed={child.id === activeChildId} className="parent-learn-card">
              <strong>{child.name.split(" ")[0]}</strong> · {child.className}
            </button>
          ))}
        </section>
      )}

      <nav className="parent-learn-tabs" aria-label="Learning sections">
        {(["homework", "progress", "results"] as const).map(item => (
          <button key={item} onClick={() => setTab(item)} className="parent-learn-tab" aria-selected={tab === item}>
            {item}
          </button>
        ))}
      </nav>

      {error && <div role="alert" className="parent-learn-alert">{error}</div>}

      {loadingChild ? (
        <section className="parent-learn-content" aria-label="Loading selected child">
          <div className="parent-learn-card">Loading learning information…</div>
        </section>
      ) : (
        <section className="parent-learn-content">
          {tab === "homework" && (
            state.homework.length ? state.homework.map(item => (
              <article key={item.id} className="parent-learn-card">
                <p><strong>{item.subject}</strong></p>
                <h2>{item.title}</h2>
                <p>Due {dateLabel(item.dueDate)} · {statusLabel(item.status)}</p>
                {item.instructions && <p>{item.instructions}</p>}
                {item.status === "marked" && (
                  <div>
                    {item.mark !== null && <p><strong>Mark: {item.mark}</strong></p>}
                    {item.feedback && <p>{item.feedback}</p>}
                  </div>
                )}
              </article>
            )) : <EmptyState title="No homework right now" body="There is no homework currently visible for this child. New teacher assignments will appear here." />
          )}

          {tab === "progress" && (
            state.progress.length ? state.progress.map(item => (
              <article key={item.id} className="parent-learn-card">
                <p>{dateLabel(item.periodStart)} – {dateLabel(item.periodEnd)}</p>
                {item.strengths.length > 0 && <p><strong>Doing well:</strong> {item.strengths.join(" · ")}</p>}
                {item.focusAreas.length > 0 && <p><strong>Focus next:</strong> {item.focusAreas.join(" · ")}</p>}
                {item.teacherComment && <p>{item.teacherComment}</p>}
              </article>
            )) : <EmptyState title="No published progress summary yet" body="Progress appears after the school or teacher publishes a family-facing learning summary." />
          )}

          {tab === "results" && (
            state.assessments.length ? state.assessments.map(item => (
              <article key={item.id} className="parent-learn-card">
                <p><strong>{item.subject}</strong></p>
                <h2>{item.title}</h2>
                {item.percentage !== null && <p><strong>{Math.round(item.percentage)}%</strong></p>}
                <p>Released {new Date(item.releasedAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}</p>
                {item.score !== null && item.maxScore !== null && <p>Score {item.score} / {item.maxScore}</p>}
              </article>
            )) : <EmptyState title="No released results" body="Draft or unreleased assessment results are never shown here. Published results will appear when the teacher releases them." />
          )}
        </section>
      )}
    </main>
  )
}
