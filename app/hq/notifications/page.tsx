"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { HQPage, HQPanel, HQ_THEME, hqButtonStyle } from "@/components/hq/HQShell"
import {
  acknowledgeHQNotification,
  loadHQFounderBrief,
  loadHQNotifications,
  markHQNotificationRead,
  openHQNotificationWorkroom,
  resolveHQNotification,
  setHQNotificationFeedback,
  type HQFounderBrief,
  type HQNotification,
  type HQNotificationClass,
} from "@/lib/hq/operating"

type View = "active" | "all" | "resolved" | "overdue" | "opportunities" | HQNotificationClass

const views: Array<{ key: View; label: string }> = [
  { key: "active", label: "Active" },
  { key: "critical", label: "Act now" },
  { key: "action_required", label: "Action required" },
  { key: "overdue", label: "Overdue" },
  { key: "opportunities", label: "Opportunities" },
  { key: "important", label: "Important" },
  { key: "digest", label: "Digest" },
  { key: "resolved", label: "Resolved" },
  { key: "all", label: "All" },
]

const classLabel: Record<HQNotificationClass, string> = {
  critical: "Act now",
  action_required: "Action required",
  important: "Important",
  digest: "Digest",
}

const severityColor: Record<HQNotification["severity"], string> = {
  info: HQ_THEME.blue,
  success: HQ_THEME.green,
  warning: HQ_THEME.amber,
  critical: HQ_THEME.red,
}

function formatTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function dueLabel(item: HQNotification) {
  if (!item.due_at || item.status === "resolved") return null
  const ms = new Date(item.due_at).getTime() - Date.now()
  const mins = Math.round(Math.abs(ms) / 60000)
  if (ms < 0) return `Overdue ${mins < 60 ? `${mins}m` : `${Math.round(mins / 60)}h`}`
  return `Due ${mins < 60 ? `${mins}m` : `${Math.round(mins / 60)}h`}`
}

function matchesView(item: HQNotification, view: View) {
  if (view === "all") return true
  if (view === "active") return item.status !== "resolved"
  if (view === "resolved") return item.status === "resolved"
  if (view === "overdue") return item.status !== "resolved" && !!item.due_at && new Date(item.due_at).getTime() < Date.now()
  if (view === "opportunities") return item.status !== "resolved" && typeof item.metadata?.opportunity_type === "string"
  return item.status !== "resolved" && item.notification_class === view
}

export default function HQNotificationsPage() {
  const router = useRouter()
  const [items, setItems] = useState<HQNotification[]>([])
  const [brief, setBrief] = useState<HQFounderBrief | null>(null)
  const [view, setView] = useState<View>("active")
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const [nextItems, nextBrief] = await Promise.all([loadHQNotifications(250), loadHQFounderBrief()])
      setItems(nextItems)
      setBrief(nextBrief)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load HQ signals.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), 60000)
    return () => window.clearInterval(timer)
  }, [])

  const summary = useMemo(() => {
    const active = items.filter((item) => item.status !== "resolved")
    return {
      active: active.length,
      critical: active.filter((item) => item.notification_class === "critical").length,
      action: active.filter((item) => item.notification_class === "action_required").length,
      overdue: active.filter((item) => item.due_at && new Date(item.due_at).getTime() < Date.now()).length,
    }
  }, [items])

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return items.filter((item) => {
      if (!matchesView(item, view)) return false
      if (!normalized) return true
      return `${item.title} ${item.body} ${item.category} ${item.owner_department ?? ""} ${item.source_type ?? ""}`.toLowerCase().includes(normalized)
    })
  }, [items, query, view])

  async function openSignal(item: HQNotification) {
    if (item.status === "unread") {
      await markHQNotificationRead(item.id)
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "read" } : entry))
    }
    if (item.route) router.push(item.route)
  }

  async function acknowledge(item: HQNotification) {
    await acknowledgeHQNotification(item.id)
    setItems((current) => current.map((entry) => entry.id === item.id ? {
      ...entry,
      status: entry.status === "unread" ? "read" : entry.status,
      acknowledged_at: entry.acknowledged_at ?? new Date().toISOString(),
    } : entry))
  }

  async function openWorkroom(item: HQNotification) {
    const workItemId = item.work_item_id ?? await openHQNotificationWorkroom(item.id)
    if (!workItemId) return
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, work_item_id: workItemId } : entry))
    router.push(`/hq/workroom/${workItemId}`)
  }

  async function feedback(item: HQNotification, value: "useful" | "noise") {
    await setHQNotificationFeedback(item.id, value)
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, feedback: value, feedback_at: new Date().toISOString() } : entry))
  }

  async function resolve(item: HQNotification) {
    await resolveHQNotification(item.id)
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "resolved" } : entry))
  }

  return (
    <HQPage
      title="Signal Center"
      description="Founder command view: what needs attention, who owns it, what is overdue, and where growth is emerging."
      actions={<button style={hqButtonStyle} onClick={() => void refresh()} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 14 }}>
        <Metric label="Active" value={summary.active} />
        <Metric label="Act now" value={summary.critical} accent={HQ_THEME.red} />
        <Metric label="Action required" value={summary.action} accent={HQ_THEME.amber} />
        <Metric label="Overdue" value={summary.overdue} accent={summary.overdue ? HQ_THEME.red : HQ_THEME.green} />
        <Metric label="Opportunities" value={brief?.headline.opportunities ?? 0} accent={HQ_THEME.green} />
      </div>

      {brief && (
        <HQPanel title="Founder brief" description={`Generated ${formatTime(brief.generated_at)}`}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
            <BriefStat label="New users today" value={brief.headline.new_users_today} note={`Yesterday ${brief.headline.new_users_yesterday}`} />
            <BriefStat label="Open incidents" value={brief.headline.open_incidents} />
            <BriefStat label="Payment failures · 24h" value={brief.headline.payment_failures_24h} />
            <BriefStat label="Founder opportunities" value={brief.headline.opportunities} />
          </div>
          {brief.opportunities.length > 0 && (
            <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
              {brief.opportunities.slice(0, 3).map((opportunity) => (
                <button key={opportunity.id} onClick={() => opportunity.route && router.push(opportunity.route)} style={{ ...hqButtonStyle, minHeight: 0, padding: 12, textAlign: "left" }}>
                  <div style={{ color: HQ_THEME.green, fontSize: 10, textTransform: "uppercase", fontWeight: 900 }}>Opportunity</div>
                  <div style={{ marginTop: 4 }}>{opportunity.title}</div>
                  <div style={{ marginTop: 3, color: HQ_THEME.muted, fontSize: 11, fontWeight: 500 }}>{opportunity.body}</div>
                </button>
              ))}
            </div>
          )}
        </HQPanel>
      )}

      <div style={{ height: 14 }} />
      <HQPanel>
        <div style={{ padding: 12, borderBottom: `1px solid ${HQ_THEME.border}`, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", flex: 1 }}>
            {views.map((option) => (
              <button key={option.key} onClick={() => setView(option.key)} style={{ ...hqButtonStyle, minHeight: 34, padding: "0 10px", whiteSpace: "nowrap", background: view === option.key ? "rgba(52,211,153,.1)" : hqButtonStyle.background, borderColor: view === option.key ? "rgba(52,211,153,.3)" : HQ_THEME.border }}>
                {option.label}
              </button>
            ))}
          </div>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search signals, owners, sources" aria-label="Search HQ signals" style={{ minHeight: 36, minWidth: 210, borderRadius: 10, border: `1px solid ${HQ_THEME.border}`, background: "rgba(255,255,255,.035)", color: HQ_THEME.text, padding: "0 11px", fontSize: 12 }} />
        </div>

        {error && <div role="alert" style={{ margin: 14, padding: 12, borderRadius: 10, border: "1px solid rgba(251,113,133,.35)", color: "#fecdd3" }}>{error}</div>}
        {!loading && !error && visible.length === 0 && <div style={{ padding: 44, textAlign: "center", color: HQ_THEME.muted }}>No signals in this view.</div>}

        <div>
          {visible.map((item) => {
            const needsAcknowledgement = (item.notification_class === "critical" || item.notification_class === "action_required") && !item.acknowledged_at && item.status !== "resolved"
            const due = dueLabel(item)
            return (
              <article key={item.id} style={{ padding: "16px", borderBottom: `1px solid ${HQ_THEME.border}`, display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 16 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 10, fontWeight: 900, textTransform: "uppercase", color: severityColor[item.severity] }}>
                    <span>{classLabel[item.notification_class]}</span>
                    <span style={{ color: HQ_THEME.muted }}>· {item.category}</span>
                    {item.owner_department && <span style={{ color: HQ_THEME.blue }}>Owner · {item.owner_department.replaceAll("_", " ")}</span>}
                    {due && <span style={{ color: due.startsWith("Overdue") ? HQ_THEME.red : HQ_THEME.muted }}>{due}</span>}
                    {item.escalation_level > 0 && <span style={{ color: HQ_THEME.red }}>Escalated L{item.escalation_level}</span>}
                    {item.occurrence_count > 1 && <span style={{ color: HQ_THEME.muted }}>×{item.occurrence_count}</span>}
                    {item.acknowledged_at && <span style={{ color: HQ_THEME.green }}>Acknowledged</span>}
                    {item.status === "resolved" && <span style={{ color: HQ_THEME.muted }}>Resolved</span>}
                  </div>
                  <h2 style={{ margin: "7px 0 4px", fontSize: 15, lineHeight: 1.35 }}>{item.title}</h2>
                  {item.body && <p style={{ margin: 0, color: "rgba(248,250,252,.62)", fontSize: 12, lineHeight: 1.55 }}>{item.body}</p>}
                  <div style={{ marginTop: 8, color: "rgba(248,250,252,.36)", fontSize: 10.5 }}>
                    Last seen {formatTime(item.last_seen_at || item.created_at)}{item.source_type ? ` · ${item.source_type}` : ""}
                    {item.feedback ? ` · Marked ${item.feedback}` : ""}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 7, alignItems: "flex-start", flexWrap: "wrap", justifyContent: "flex-end", maxWidth: 280 }}>
                  {item.route && item.status !== "resolved" && <button style={hqButtonStyle} onClick={() => void openSignal(item)}>{item.action_label || "Open"}</button>}
                  {(item.notification_class === "critical" || item.notification_class === "action_required") && item.status !== "resolved" && <button style={hqButtonStyle} onClick={() => void openWorkroom(item)}>Workroom</button>}
                  {needsAcknowledgement && <button style={hqButtonStyle} onClick={() => void acknowledge(item)}>Acknowledge</button>}
                  {item.status !== "resolved" && <button style={hqButtonStyle} onClick={() => void feedback(item, "useful")}>Useful</button>}
                  {item.status !== "resolved" && item.notification_class !== "critical" && item.notification_class !== "action_required" && <button style={hqButtonStyle} onClick={() => void feedback(item, "noise")}>Noise</button>}
                  {item.status !== "resolved" && <button style={hqButtonStyle} onClick={() => void resolve(item)}>Resolve</button>}
                </div>
              </article>
            )
          })}
        </div>
      </HQPanel>
    </HQPage>
  )
}

function Metric({ label, value, accent = HQ_THEME.text }: { label: string; value: number; accent?: string }) {
  return <div style={{ border: `1px solid ${HQ_THEME.border}`, borderRadius: 14, background: "rgba(255,255,255,.025)", padding: 14 }}><div style={{ color: HQ_THEME.muted, fontSize: 10.5, fontWeight: 800, textTransform: "uppercase" }}>{label}</div><div style={{ color: accent, fontSize: 26, fontWeight: 950, marginTop: 5 }}>{value}</div></div>
}

function BriefStat({ label, value, note }: { label: string; value: number; note?: string }) {
  return <div style={{ border: `1px solid ${HQ_THEME.border}`, borderRadius: 12, padding: 12, background: "rgba(255,255,255,.02)" }}><div style={{ fontSize: 10, color: HQ_THEME.muted, textTransform: "uppercase", fontWeight: 850 }}>{label}</div><div style={{ fontSize: 22, fontWeight: 950, marginTop: 4 }}>{value}</div>{note && <div style={{ color: HQ_THEME.muted, fontSize: 10.5, marginTop: 2 }}>{note}</div>}</div>
}
