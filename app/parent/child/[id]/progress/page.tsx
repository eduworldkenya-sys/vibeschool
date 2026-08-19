"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

type ProgressSummary = {
  id: string
  period_start: string
  period_end: string
  strengths: string[] | null
  focus_areas: string[] | null
  teacher_comment: string | null
}

function dateLabel(value: string) {
  return new Date(`${value}T12:00:00+03:00`).toLocaleDateString("en-KE", { timeZone: "Africa/Nairobi", day: "numeric", month: "short", year: "numeric" })
}

export default function ParentChildProgressPage() {
  const params = useParams()
  const router = useRouter()
  const childId = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : ""
  const [childName, setChildName] = useState("")
  const [className, setClassName] = useState("Class not confirmed")
  const [summaries, setSummaries] = useState<ProgressSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setUnavailable(false)
    setError("")
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) { router.replace("/"); return }

      // RLS is the first child-scoped authority gate. A guessed or revoked ID
      // must resolve to no learner before any progress query is made.
      const { data: student, error: studentError } = await supabase
        .from("students")
        .select("id, name, class_id, classes(name, stream)")
        .eq("id", childId)
        .maybeSingle()
      if (studentError) throw new Error("student-read")
      if (!student) { setUnavailable(true); return }

      setChildName(student.name)
      const cls = student.classes as unknown as { name: string; stream: string | null } | null
      if (cls) setClassName(`${cls.name}${cls.stream ? ` ${cls.stream}` : ""}`)

      const { data, error: progressError } = await supabase
        .from("parent_learning_summaries")
        .select("id, period_start, period_end, strengths, focus_areas, teacher_comment")
        .eq("student_id", childId)
        .eq("status", "published")
        .order("period_end", { ascending: false })
        .limit(8)
      if (progressError) throw new Error("progress-read")
      setSummaries((data ?? []) as ProgressSummary[])
    } catch {
      setError("Learning progress is temporarily unavailable. No information from another learner has been shown.")
    } finally {
      setLoading(false)
    }
  }, [childId, router])

  useEffect(() => { void load() }, [load])

  if (loading) return <section role="status" className="space-y-3"><div className="h-28 animate-pulse rounded-3xl bg-slate-200" /><div className="h-36 animate-pulse rounded-2xl bg-slate-200" /></section>

  if (unavailable) return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 text-center">
      <h1 className="text-xl font-bold text-slate-950">Learning progress not available</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">This learner is not linked to your active parent account, or the relationship is no longer active.</p>
      <button type="button" onClick={() => router.replace("/parent")} className="mt-5 min-h-11 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Return to Parent Home</button>
    </section>
  )

  return (
    <div>
      <section className="rounded-3xl bg-slate-950 p-5 text-white">
        <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">Learning progress</p>
        <h1 className="mt-2 text-2xl font-bold">{childName || "Learner"}</h1>
        <p className="mt-1 text-sm text-slate-300">{className} · published family-facing summaries only</p>
      </section>

      {error && <div role="alert" className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><p>{error}</p><button type="button" onClick={() => void load()} className="mt-3 min-h-11 rounded-xl border border-amber-300 bg-white px-4 py-2 font-semibold">Try again</button></div>}

      <section className="mt-4 space-y-3">
        {!error && summaries.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
            <h2 className="font-bold">No published progress summary yet</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">This means no family-facing learning summary is available yet; it does not mean the learner is falling behind.</p>
          </div>
        ) : summaries.map(summary => (
          <article key={summary.id} className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dateLabel(summary.period_start)} – {dateLabel(summary.period_end)}</p>
            {(summary.strengths ?? []).length > 0 && <div className="mt-3"><h2 className="text-sm font-bold">Doing well</h2><p className="mt-1 text-sm leading-6 text-slate-600">{(summary.strengths ?? []).join(" · ")}</p></div>}
            {(summary.focus_areas ?? []).length > 0 && <div className="mt-3"><h2 className="text-sm font-bold">Focus next</h2><p className="mt-1 text-sm leading-6 text-slate-600">{(summary.focus_areas ?? []).join(" · ")}</p></div>}
            {summary.teacher_comment && <div className="mt-3 rounded-xl bg-slate-50 p-3"><h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Teacher comment</h2><p className="mt-1 text-sm leading-6 text-slate-700">{summary.teacher_comment}</p></div>}
          </article>
        ))}
      </section>

      <button type="button" onClick={() => router.push(`/parent/assessments?studentId=${childId}`)} className="mt-4 min-h-11 w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white">View released results</button>
      <button type="button" onClick={() => router.push(`/parent/child/${childId}`)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold">Back to {childName || "learner"}</button>
    </div>
  )
}
