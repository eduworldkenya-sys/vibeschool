"use client"

import { useCallback, useEffect, useState } from "react"
import { hqSupabase } from "@/lib/hq/supabase"
import { HQPage, HQPanel, HQ_THEME as C } from "@/components/hq/HQShell"

type UserRow = {
  id: string
  full_name: string | null
  role: string | null
  account_status: string
  created_at: string
  school_id: string | null
  vc_id: string | null
  active_subscription_count: number
  last_sign_in_at: string | null
}

type UserMetrics = {
  total_users: number
  new_24h: number
  new_7d: number
  new_30d: number
  signed_in_24h: number
  signed_in_7d: number
  signed_in_30d: number
  never_signed_in: number
  active_accounts: number
  unaffiliated_profiles: number
  active_subscriptions: number
  trialing_subscriptions: number
  past_due_subscriptions: number
}

type ValueMetrics = {
  north_star: {
    learners_with_learning_evidence_7d: number
    learners_progressing_30d: number
    teachers_creating_learning_value_7d: number
  }
  activation: {
    teacher_profiles: number
    teachers_with_class: number
    student_profiles: number
    students_with_canonical_identity: number
    parent_profiles: number
    parents_linked_to_student: number
  }
  learning_7d: {
    active_learners: number
    student_learning_events: number
    content_learning_events: number
    reading_sessions: number
    adaptive_sessions: number
  }
  teaching_7d: {
    active_teachers: number
    lesson_plans_created: number
    homework_created: number
    homework_submissions: number
  }
  mastery_30d: {
    learners_progressing: number
    assessed_learners: number
    proficient_or_mastered_outcomes: number
    adaptive_mastery_gain_sessions: number
  }
  schools: {
    active_30d: number
    with_teacher_members: number
    with_learning_value_30d: number
  }
  coverage: {
    product_event_kernel_present: boolean
    learning_event_kernel_present: boolean
    mastery_evidence_present: boolean
    cohort_retention_instrumented: boolean
    acquisition_attribution_instrumented: boolean
    experiment_registry_instrumented: boolean
  }
}

const emptyUsers: UserMetrics = {
  total_users: 0,
  new_24h: 0,
  new_7d: 0,
  new_30d: 0,
  signed_in_24h: 0,
  signed_in_7d: 0,
  signed_in_30d: 0,
  never_signed_in: 0,
  active_accounts: 0,
  unaffiliated_profiles: 0,
  active_subscriptions: 0,
  trialing_subscriptions: 0,
  past_due_subscriptions: 0,
}

const emptyValue: ValueMetrics = {
  north_star: { learners_with_learning_evidence_7d: 0, learners_progressing_30d: 0, teachers_creating_learning_value_7d: 0 },
  activation: { teacher_profiles: 0, teachers_with_class: 0, student_profiles: 0, students_with_canonical_identity: 0, parent_profiles: 0, parents_linked_to_student: 0 },
  learning_7d: { active_learners: 0, student_learning_events: 0, content_learning_events: 0, reading_sessions: 0, adaptive_sessions: 0 },
  teaching_7d: { active_teachers: 0, lesson_plans_created: 0, homework_created: 0, homework_submissions: 0 },
  mastery_30d: { learners_progressing: 0, assessed_learners: 0, proficient_or_mastered_outcomes: 0, adaptive_mastery_gain_sessions: 0 },
  schools: { active_30d: 0, with_teacher_members: 0, with_learning_value_30d: 0 },
  coverage: { product_event_kernel_present: false, learning_event_kernel_present: false, mastery_evidence_present: false, cohort_retention_instrumented: false, acquisition_attribution_instrumented: false, experiment_registry_instrumented: false },
}

function relativeTime(value: string | null) {
  if (!value) return "Never"
  const milliseconds = Date.now() - new Date(value).getTime()
  const minutes = Math.floor(milliseconds / 60000)
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return days < 30 ? `${days}d ago` : new Date(value).toLocaleDateString()
}

function Metric({ label, value, sub, accent }: { label: string; value: number | string; sub?: string; accent?: string }) {
  return (
    <div style={{ padding: 14, border: `1px solid ${C.border}`, borderRadius: 12, background: C.panel, minWidth: 0 }}>
      <div style={{ fontSize: 10.5, color: C.muted, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4, color: accent ?? C.text }}>{value}</div>
      {sub ? <div style={{ fontSize: 10, color: C.muted, marginTop: 3, lineHeight: 1.45 }}>{sub}</div> : null}
    </div>
  )
}

function Ratio({ label, numerator, denominator }: { label: string; numerator: number; denominator: number }) {
  const percentage = denominator ? Math.round((numerator / denominator) * 100) : 0
  return (
    <div style={{ padding: "11px 0", borderTop: `1px solid ${C.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12 }}>
        <span>{label}</span>
        <b>{numerator}/{denominator} · {percentage}%</b>
      </div>
      <div style={{ height: 5, borderRadius: 999, background: "rgba(255,255,255,.06)", marginTop: 7, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(100, percentage)}%`, background: C.green }} />
      </div>
    </div>
  )
}

export default function HQUsers() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [metrics, setMetrics] = useState<UserMetrics>(emptyUsers)
  const [value, setValue] = useState<ValueMetrics>(emptyValue)
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setError("")
    const [directoryResult, userResult, valueResult] = await Promise.all([
      hqSupabase.rpc("hq_user_directory", { p_search: query || null, p_limit: 200 }),
      hqSupabase.rpc("hq_user_intelligence_overview"),
      hqSupabase.rpc("hq_founder_value_intelligence"),
    ])
    const failure = directoryResult.error ?? userResult.error ?? valueResult.error
    if (failure) {
      setError(failure.message || "Unable to load founder intelligence")
      return
    }
    setUsers((directoryResult.data || []) as UserRow[])
    setMetrics((userResult.data || emptyUsers) as UserMetrics)
    setValue((valueResult.data || emptyValue) as ValueMetrics)
  }, [query])

  useEffect(() => {
    void (async () => {
      await load()
      setLoading(false)
    })()
  }, [load])

  const signedInRate = metrics.total_users ? Math.round((metrics.signed_in_30d / metrics.total_users) * 100) : 0

  return (
    <HQPage
      title="User & value intelligence"
      description="Founder command view of growth, sign-in, activation, real teaching and learning evidence, mastery, school adoption and billing."
      actions={<button onClick={() => void load()} style={{ padding: "9px 12px", borderRadius: 9, border: `1px solid ${C.border}`, background: "transparent", color: C.text }}>Refresh</button>}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8 }}>
        <Metric label="Total users" value={metrics.total_users} />
        <Metric label="Signed in today" value={metrics.signed_in_24h} />
        <Metric label="Signed in 7d" value={metrics.signed_in_7d} />
        <Metric label="New 7d" value={metrics.new_7d} />
        <Metric label="30d sign-in reach" value={`${signedInRate}%`} sub={`${metrics.signed_in_30d} accounts`} />
        <Metric label="Need attention" value={metrics.never_signed_in + metrics.past_due_subscriptions} sub="Never signed in + past due" accent={(metrics.never_signed_in + metrics.past_due_subscriptions) > 0 ? C.amber : C.green} />
      </div>

      <div style={{ height: 12 }} />
      <HQPanel title="North Star · learning value" description="Value evidence, not page views. Login is intentionally kept separate from learning and teaching activity.">
        <div style={{ padding: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 8 }}>
          <Metric label="Learners active · 7d" value={value.north_star.learners_with_learning_evidence_7d} sub="Canonical learning evidence" accent={C.green} />
          <Metric label="Learners progressing · 30d" value={value.north_star.learners_progressing_30d} sub="Mastery gain or proficient/mastered evidence" accent={C.green} />
          <Metric label="Teachers creating value · 7d" value={value.north_star.teachers_creating_learning_value_7d} sub="Lesson plan or homework activity" accent={C.blue} />
          <Metric label="Active schools · 30d" value={value.schools.active_30d} sub="Learning or teaching activity" accent={C.violet} />
        </div>
      </HQPanel>

      <div style={{ height: 12 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12 }}>
        <HQPanel title="Activation">
          <div style={{ padding: "0 14px 14px" }}>
            <Ratio label="Teachers with a class" numerator={value.activation.teachers_with_class} denominator={value.activation.teacher_profiles} />
            <Ratio label="Students with canonical identity" numerator={value.activation.students_with_canonical_identity} denominator={value.activation.student_profiles} />
            <Ratio label="Parents linked to a learner" numerator={value.activation.parents_linked_to_student} denominator={value.activation.parent_profiles} />
          </div>
        </HQPanel>
        <HQPanel title="Teaching · 7 days">
          <div style={{ padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Metric label="Active teachers" value={value.teaching_7d.active_teachers} />
            <Metric label="Lesson plans" value={value.teaching_7d.lesson_plans_created} />
            <Metric label="Homework set" value={value.teaching_7d.homework_created} />
            <Metric label="Submissions" value={value.teaching_7d.homework_submissions} />
          </div>
        </HQPanel>
        <HQPanel title="Learning · 7 days">
          <div style={{ padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Metric label="Active learners" value={value.learning_7d.active_learners} />
            <Metric label="Learning events" value={value.learning_7d.student_learning_events} />
            <Metric label="Reading sessions" value={value.learning_7d.reading_sessions} />
            <Metric label="Adaptive sessions" value={value.learning_7d.adaptive_sessions} />
          </div>
        </HQPanel>
        <HQPanel title="Mastery · 30 days">
          <div style={{ padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Metric label="Learners progressing" value={value.mastery_30d.learners_progressing} accent={C.green} />
            <Metric label="Assessed learners" value={value.mastery_30d.assessed_learners} />
            <Metric label="Proficient/mastered" value={value.mastery_30d.proficient_or_mastered_outcomes} />
            <Metric label="Mastery-gain sessions" value={value.mastery_30d.adaptive_mastery_gain_sessions} />
          </div>
        </HQPanel>
      </div>

      <div style={{ height: 12 }} />
      <HQPanel title="Founder signals">
        <div style={{ padding: 14, display: "grid", gap: 7, fontSize: 12, lineHeight: 1.55 }}>
          <div><b>Authentication:</b> {metrics.total_users - metrics.never_signed_in} of {metrics.total_users} accounts have signed in at least once.</div>
          <div><b>School identity:</b> {metrics.unaffiliated_profiles} profiles are not attached to a school.</div>
          <div><b>Revenue:</b> {metrics.active_subscriptions} active, {metrics.trialing_subscriptions} trialing, {metrics.past_due_subscriptions} past due.</div>
          <div><b>Measurement coverage:</b> product events {value.coverage.product_event_kernel_present ? "present" : "missing"}; learning events {value.coverage.learning_event_kernel_present ? "present" : "missing"}; mastery evidence {value.coverage.mastery_evidence_present ? "present" : "missing"}.</div>
          {(!value.coverage.cohort_retention_instrumented || !value.coverage.acquisition_attribution_instrumented || !value.coverage.experiment_registry_instrumented) && (
            <div style={{ color: C.amber }}><b>Instrumentation debt:</b> cohort retention, acquisition attribution and governed experiments are not yet certified measurement sources. They are shown as missing rather than guessed.</div>
          )}
        </div>
      </HQPanel>

      <div style={{ height: 12 }} />
      <HQPanel>
        <div style={{ padding: 14 }}>
          <input
            aria-label="Search users"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") void load() }}
            placeholder="Search name or VibeSchool ID"
            style={{ width: "100%", boxSizing: "border-box", padding: 10, borderRadius: 9, border: `1px solid ${C.border}`, background: C.panel, color: C.text }}
          />
        </div>
      </HQPanel>

      <div style={{ height: 12 }} />
      <HQPanel title="Registered accounts">
        {error ? <div style={{ padding: 14, color: C.red }}>{error}</div> : loading ? <div style={{ padding: 14, color: C.muted }}>Loading…</div> : users.length === 0 ? <div style={{ padding: 14, color: C.muted }}>No users found.</div> : users.map((user) => (
          <div key={user.id} style={{ padding: "12px 14px", borderTop: `1px solid ${C.border}`, display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(120px,1fr) minmax(110px,1fr)", gap: 10, fontSize: 12 }}>
            <div style={{ minWidth: 0 }}>
              <b>{user.full_name || "Unnamed user"}</b>
              <div style={{ color: C.muted, fontSize: 10, overflowWrap: "anywhere" }}>{user.vc_id || user.id}</div>
            </div>
            <div>
              <div style={{ color: C.muted, fontSize: 10 }}>Last sign-in</div>
              <b>{relativeTime(user.last_sign_in_at)}</b>
              <div style={{ fontSize: 10, color: C.muted }}>{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "No recorded sign-in"}</div>
            </div>
            <div>
              <div style={{ color: user.account_status === "active" ? C.green : C.amber }}>{user.account_status}</div>
              <div style={{ fontSize: 10, marginTop: 3 }}>{user.role || "Role —"}</div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>{user.active_subscription_count > 0 ? `${user.active_subscription_count} billing record(s)` : "No active billing"}</div>
            </div>
          </div>
        ))}
      </HQPanel>
    </HQPage>
  )
}
