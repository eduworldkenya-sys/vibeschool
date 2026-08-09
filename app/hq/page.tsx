"use client"
export const dynamic = "force-dynamic"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import HQTwinDrawer from "@/components/hq/TwinDrawer"
import HQNotificationCenter from "@/components/hq/NotificationCenter"
import { loadHQNotifications, loadHQSnapshot, runHQRules, type HQNotification, type HQSnapshot } from "@/lib/hq/operating"

const C = {
  bg: "#07111f",
  panel: "#0d1b2f",
  border: "rgba(255,255,255,.08)",
  text: "#f8fafc",
  muted: "rgba(255,255,255,.45)",
  green: "#34d399",
  blue: "#60a5fa",
  amber: "#f59e0b",
  red: "#ef4444",
  violet: "#a78bfa",
}

function fmt(value: number) { return new Intl.NumberFormat("en-KE").format(value ?? 0) }
function age(iso: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
  if (minutes < 1) return "now"
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`
  return `${Math.floor(minutes / 1440)}d ago`
}

function Metric({ value, label, note, tone = C.green }: { value: number | string; label: string; note?: string; tone?: string }) {
  return <div style={{ border: `1px solid ${C.border}`, background: "rgba(255,255,255,.025)", borderRadius: 15, padding: "14px 15px" }}>
    <div style={{ fontSize: 24, lineHeight: 1, fontWeight: 900, color: tone }}>{typeof value === "number" ? fmt(value) : value}</div>
    <div style={{ marginTop: 7, fontSize: 11.5, color: C.text, fontWeight: 750 }}>{label}</div>
    {note && <div style={{ marginTop: 4, fontSize: 10.5, color: C.muted }}>{note}</div>}
  </div>
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <section style={{ marginTop: 22 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
      <div style={{ fontSize: 10.5, fontWeight: 900, color: "rgba(255,255,255,.34)", textTransform: "uppercase", letterSpacing: ".08em" }}>{title}</div>
      {action}
    </div>
    {children}
  </section>
}

export default function HQOperatingPage() {
  const router = useRouter()
  const [snapshot, setSnapshot] = useState<HQSnapshot | null>(null)
  const [activity, setActivity] = useState<HQNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [twinOpen, setTwinOpen] = useState(false)
  const [runningRules, setRunningRules] = useState(false)

  const refresh = useCallback(async (runRules = false) => {
    setError("")
    try {
      if (runRules) await runHQRules()
      const [nextSnapshot, nextActivity] = await Promise.all([loadHQSnapshot(), loadHQNotifications(12)])
      setSnapshot(nextSnapshot)
      setActivity(nextActivity)
    } catch (e) {
      setError(e instanceof Error ? e.message : "HQ data could not be loaded.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh(true) }, [refresh])

  const attention = useMemo(() => activity.filter(item => item.severity === "critical" || item.severity === "warning").slice(0, 4), [activity])

  async function executeRules() {
    setRunningRules(true)
    try { await refresh(true) } finally { setRunningRules(false) }
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.replace("/hq/login")
  }

  if (loading && !snapshot) return <main style={{ minHeight: "100dvh", background: C.bg, color: C.text, display: "grid", placeItems: "center", fontFamily: "Inter,system-ui,sans-serif" }}>Loading HQ operating state…</main>

  return <main style={{ minHeight: "100dvh", background: C.bg, color: C.text, fontFamily: "Inter,system-ui,sans-serif" }}>
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 18px 70px" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 50, margin: "0 -18px", padding: "14px 18px", background: "rgba(7,17,31,.94)", backdropFilter: "blur(16px)", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 950 }}>VibeSchool HQ</div>
            <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>Live company operating system · deterministic intelligence</div>
          </div>
          <button onClick={() => void refresh(false)} style={{ height: 40, padding: "0 12px", borderRadius: 11, border: `1px solid ${C.border}`, background: "rgba(255,255,255,.04)", color: C.text, cursor: "pointer", fontSize: 11, fontWeight: 800 }}>Refresh</button>
          <HQNotificationCenter unread={snapshot?.notifications.unread ?? 0} onChange={() => void refresh(false)} />
          <button onClick={signOut} style={{ height: 40, padding: "0 12px", borderRadius: 11, border: "1px solid rgba(239,68,68,.2)", background: "rgba(239,68,68,.08)", color: "#f87171", cursor: "pointer", fontSize: 11, fontWeight: 800 }}>Sign out</button>
        </div>
      </header>

      {error && <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(239,68,68,.28)", background: "rgba(239,68,68,.08)", color: "#fca5a5", fontSize: 12 }}>{error}</div>}

      <Section title="Company pulse">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 9 }}>
          <Metric value={snapshot?.users.today ?? 0} label="New users today" note={`${fmt(snapshot?.users.total ?? 0)} total users`} tone={C.green} />
          <Metric value={snapshot?.schools.active ?? 0} label="Active schools" note={`${fmt(snapshot?.schools.total ?? 0)} total schools`} tone={C.blue} />
          <Metric value={snapshot?.teaching.lesson_plans_today ?? 0} label="Lesson plans today" note={`${fmt(snapshot?.teaching.lesson_plans_7d ?? 0)} in 7 days`} tone={C.violet} />
          <Metric value={snapshot?.teaching.lessons_taught_today ?? 0} label="Lessons taught today" tone={C.green} />
          <Metric value={snapshot?.teaching.submissions_today ?? 0} label="Submissions today" tone={C.blue} />
          <Metric value={snapshot?.events.last_hour ?? 0} label="Platform events / hour" note={`${fmt(snapshot?.events.today ?? 0)} today`} tone={C.amber} />
        </div>
      </Section>

      <Section title="Teaching operations">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 9 }}>
          <Metric value={snapshot?.users.teachers ?? 0} label="Registered teachers" />
          <Metric value={snapshot?.users.learners ?? 0} label="Learners" tone={C.blue} />
          <Metric value={snapshot?.teaching.homework_today ?? 0} label="Homework assigned today" tone={C.violet} />
          <Metric value={snapshot?.teaching.unreviewed_submissions ?? 0} label="Awaiting review" tone={(snapshot?.teaching.unreviewed_submissions ?? 0) >= 50 ? C.amber : C.green} />
        </div>
      </Section>

      <Section title="Content operations" action={<button onClick={() => router.push("/hq/studio")} style={{ border: 0, background: "transparent", color: C.green, fontSize: 11, fontWeight: 850, cursor: "pointer" }}>Open content studio →</button>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 9 }}>
          <Metric value={snapshot?.content.publications_live ?? 0} label="Published" tone={C.green} />
          <Metric value={snapshot?.content.publications_draft ?? 0} label="Draft publications" tone={C.amber} />
          <Metric value={snapshot?.content.publications_total ?? 0} label="All publications" tone={C.blue} />
          <Metric value={snapshot?.content.reads_total ?? 0} label="Publication reads" tone={C.violet} />
        </div>
      </Section>

      <Section title="Needs attention" action={<button disabled={runningRules} onClick={() => void executeRules()} style={{ border: `1px solid ${C.border}`, background: "rgba(255,255,255,.03)", color: C.muted, borderRadius: 8, padding: "5px 8px", fontSize: 10.5, cursor: "pointer" }}>{runningRules ? "Checking…" : "Run rules"}</button>}>
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 15, background: "rgba(255,255,255,.02)", overflow: "hidden" }}>
          {attention.length === 0 ? <div style={{ padding: 20, color: C.muted, fontSize: 12 }}>No deterministic warnings are active. Rules check marking backlog and unusual lesson-plan activity.</div> : attention.map((item, i) => <button key={item.id} onClick={() => item.route && router.push(item.route)} style={{ width: "100%", border: 0, borderBottom: i < attention.length - 1 ? `1px solid ${C.border}` : 0, padding: "13px 14px", background: "transparent", color: C.text, textAlign: "left", cursor: item.route ? "pointer" : "default", display: "flex", gap: 11 }}>
            <span style={{ width: 9, height: 9, marginTop: 4, borderRadius: 10, background: item.severity === "critical" ? C.red : C.amber, flexShrink: 0 }} />
            <span style={{ flex: 1 }}><span style={{ display: "block", fontSize: 12.5, fontWeight: 850 }}>{item.title}</span><span style={{ display: "block", fontSize: 11, color: C.muted, marginTop: 3, lineHeight: 1.45 }}>{item.body}</span></span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,.28)" }}>{age(item.created_at)}</span>
          </button>)}
        </div>
      </Section>

      <Section title="Recent operational activity">
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 15, background: "rgba(255,255,255,.02)", overflow: "hidden" }}>
          {activity.slice(0, 8).map((item, i) => <div key={item.id} style={{ padding: "12px 14px", borderBottom: i < Math.min(activity.length, 8) - 1 ? `1px solid ${C.border}` : 0, display: "flex", gap: 11, alignItems: "flex-start" }}>
            <span style={{ fontSize: 10, fontWeight: 900, textTransform: "uppercase", color: item.severity === "success" ? C.green : item.severity === "critical" ? C.red : item.severity === "warning" ? C.amber : C.blue, minWidth: 54 }}>{item.category}</span>
            <span style={{ flex: 1 }}><span style={{ display: "block", fontSize: 12, fontWeight: 800 }}>{item.title}</span><span style={{ display: "block", fontSize: 10.5, color: C.muted, marginTop: 3 }}>{item.body}</span></span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,.28)" }}>{age(item.created_at)}</span>
          </div>)}
          {activity.length === 0 && <div style={{ padding: 20, color: C.muted, fontSize: 12 }}>The event engine is active. New platform actions will begin appearing here automatically.</div>}
        </div>
      </Section>

      <Section title="HQ controls">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 9 }}>
          <button onClick={() => router.push("/hq/studio")} style={{ padding: 14, textAlign: "left", borderRadius: 14, border: `1px solid ${C.border}`, background: "rgba(255,255,255,.025)", color: C.text, cursor: "pointer" }}><div style={{ fontWeight: 850, fontSize: 12.5 }}>Content Studio</div><div style={{ fontSize: 10.5, color: C.muted, marginTop: 4 }}>Curriculum, Academy, Exam, Global and FunHub tools.</div></button>
          <button onClick={() => setTwinOpen(true)} style={{ padding: 14, textAlign: "left", borderRadius: 14, border: "1px solid rgba(52,211,153,.2)", background: "rgba(52,211,153,.06)", color: C.text, cursor: "pointer" }}><div style={{ fontWeight: 850, fontSize: 12.5 }}>HQ Twin</div><div style={{ fontSize: 10.5, color: C.muted, marginTop: 4 }}>Query platform state. Deterministic answers are used before any AI fallback.</div></button>
        </div>
      </Section>

      <div style={{ marginTop: 24, fontSize: 10, color: "rgba(255,255,255,.22)", textAlign: "center" }}>Snapshot generated {snapshot?.generated_at ? new Date(snapshot.generated_at).toLocaleString("en-KE") : "—"}</div>
    </div>

    <HQTwinDrawer open={twinOpen} onClose={() => setTwinOpen(false)} />
  </main>
}
