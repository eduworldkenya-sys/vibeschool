"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

type ParentEvent = {
  id: string
  student_id: string | null
  category: string
  severity: string
  title: string
  body: string | null
  action_href: string | null
  metadata: Record<string, unknown> | null
  occurred_at: string
  read_at: string | null
  acknowledged_at: string | null
}

type FamilyGroup = "action" | "child" | "school" | "system"
const C = { dark: "#1e1b4b", green: "#059669", border: "#e2e8f0", muted: "#64748b" }

function groupFor(event: ParentEvent): FamilyGroup {
  const requiresConfirmation = Boolean(event.metadata?.requires_ack) && !event.acknowledged_at
  if (event.severity === "urgent" || event.severity === "warning" || requiresConfirmation) return "action"
  if (event.category === "school_notice") return "school"
  if (["attendance", "homework", "assessment", "report", "teacher_message", "learning"].includes(event.category)) return "child"
  return "system"
}

const GROUPS: Array<{ id: FamilyGroup; label: string; help: string }> = [
  { id: "action", label: "Action needed", help: "Items that may need your attention or confirmation." },
  { id: "child", label: "Child updates", help: "Attendance, schoolwork, results and teacher updates." },
  { id: "school", label: "School notices", help: "General communication from the school." },
  { id: "system", label: "Account & other updates", help: "Relationship, finance or account information." },
]

function icon(category: string) {
  if (category === "attendance") return "A"
  if (category === "homework") return "H"
  if (category === "assessment" || category === "report") return "R"
  if (category === "teacher_message") return "T"
  if (category === "school_notice") return "S"
  return "i"
}

function safeParentHref(href: string | null) {
  if (!href) return null
  if (!href.startsWith("/parent")) return null
  if (href.startsWith("//")) return null
  return href
}

function schoolName(event: ParentEvent) {
  const value = event.metadata?.school_name
  return typeof value === "string" && value.trim() ? value.trim() : null
}

export default function ParentInboxPage() {
  const router = useRouter()
  const [events, setEvents] = useState<ParentEvent[]>([])
  const [students, setStudents] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState<"unread" | "all">("unread")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.replace("/"); return }
        const { data, error: eventError } = await supabase
          .from("parent_events")
          .select("id, student_id, category, severity, title, body, action_href, metadata, occurred_at, read_at, acknowledged_at")
          .eq("parent_id", user.id)
          .order("occurred_at", { ascending: false })
          .limit(100)
        if (eventError) throw eventError
        const normalized = (data ?? []) as ParentEvent[]
        if (cancelled) return
        setEvents(normalized)

        const ids = Array.from(new Set(normalized.map(row => row.student_id).filter((value): value is string => Boolean(value))))
        if (ids.length) {
          const { data: rows, error: studentError } = await supabase.from("students").select("id, name").in("id", ids)
          if (studentError) throw studentError
          const names: Record<string, string> = {}
          for (const row of rows ?? []) names[row.id] = row.name
          if (!cancelled) setStudents(names)
        }
      } catch (cause) {
        if (!cancelled) setError("Family updates are temporarily unavailable. Check your connection and try again.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [router])

  const unreadCount = events.filter(event => !event.read_at).length
  const visible = useMemo(() => filter === "unread" ? events.filter(event => !event.read_at) : events, [events, filter])
  const grouped = useMemo(() => GROUPS.map(group => ({ ...group, events: visible.filter(event => groupFor(event) === group.id) })).filter(group => group.events.length), [visible])

  async function markRead(event: ParentEvent, follow = false) {
    if (!event.read_at) {
      const now = new Date().toISOString()
      const { error: updateError } = await supabase.from("parent_events").update({ read_at: now }).eq("id", event.id)
      if (updateError) { setError("This update could not be marked as read. Try again."); return }
      setEvents(current => current.map(row => row.id === event.id ? { ...row, read_at: now } : row))
    }
    const href = safeParentHref(event.action_href)
    if (follow && href) router.push(href)
  }

  async function markAllRead() {
    const ids = events.filter(event => !event.read_at).map(event => event.id)
    if (!ids.length) return
    const now = new Date().toISOString()
    const { error: updateError } = await supabase.from("parent_events").update({ read_at: now }).in("id", ids)
    if (updateError) { setError("Updates could not be marked as read. Try again."); return }
    setEvents(current => current.map(row => ids.includes(row.id) ? { ...row, read_at: now } : row))
  }

  if (loading) return <section role="status" style={card}>Loading family updates…</section>

  return (
    <div>
      <section style={{ background: `linear-gradient(145deg,#0f172a,${C.dark})`, color: "#fff", borderRadius: 20, padding: 18, marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: "#a7f3d0", fontWeight: 900, textTransform: "uppercase", letterSpacing: 1 }}>Messages & updates</div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "end" }}>
          <div><h1 style={{ margin: "5px 0 3px", fontSize: 21 }}>Family inbox</h1><p style={{ margin: 0, color: "#cbd5e1", fontSize: 12 }}>Important child and school information, grouped by what it means for you.</p></div>
          <div style={{ minWidth: 54, textAlign: "center", border: "1px solid rgba(255,255,255,.16)", background: "rgba(255,255,255,.08)", borderRadius: 12, padding: 8 }}><div style={{ fontSize: 18, fontWeight: 900 }}>{unreadCount}</div><div style={{ fontSize: 9, color: "#cbd5e1" }}>unread</div></div>
        </div>
      </section>

      {error && <div role="alert" style={errorBox}>{error}</div>}

      <section style={{ ...card, padding: 10 }}>
        <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
          <button type="button" onClick={() => setFilter("unread")} aria-pressed={filter === "unread"} style={filterButton(filter === "unread")}>Unread</button>
          <button type="button" onClick={() => setFilter("all")} aria-pressed={filter === "all"} style={filterButton(filter === "all")}>All</button>
          <div style={{ flex: 1 }} />
          {unreadCount > 0 && <button type="button" onClick={() => void markAllRead()} style={{ minHeight: 44, border: "none", background: "transparent", color: C.green, fontSize: 10, fontWeight: 900, cursor: "pointer" }}>Mark all read</button>}
        </div>
      </section>

      {visible.length === 0 ? (
        <section style={{ ...card, textAlign: "center", padding: 26 }}>
          <div aria-hidden="true" style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
          <h2 style={{ margin: "0 0 5px", fontSize: 16 }}>{filter === "unread" ? "You are caught up" : "No family updates yet"}</h2>
          <p style={{ margin: 0, color: C.muted, fontSize: 11 }}>{filter === "unread" ? "New meaningful school and child updates will appear here." : "There are no recorded updates for this account yet."}</p>
        </section>
      ) : grouped.map(group => (
        <section key={group.id} aria-labelledby={`group-${group.id}`} style={{ marginBottom: 16 }}>
          <h2 id={`group-${group.id}`} style={{ margin: "0 0 2px", fontSize: 16 }}>{group.label}</h2>
          <p style={{ margin: "0 0 8px", color: C.muted, fontSize: 10 }}>{group.help}</p>
          <div style={{ display: "grid", gap: 8 }}>
            {group.events.map(event => {
              const childName = event.student_id ? students[event.student_id] : null
              const needsConfirmation = Boolean(event.metadata?.requires_ack) && !event.acknowledged_at
              const href = safeParentHref(event.action_href)
              const school = schoolName(event)
              return (
                <button key={event.id} type="button" onClick={() => void markRead(event, Boolean(href))} style={{ minHeight: 68, border: `1px solid ${event.read_at ? C.border : group.id === "action" ? "#fde68a" : C.border}`, background: group.id === "action" && !event.read_at ? "#fffbeb" : "#fff", borderRadius: 14, padding: 12, display: "flex", gap: 11, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                  <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 11, background: "#f1f5f9", color: C.dark, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, flexShrink: 0 }}>{icon(event.category)}</span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <strong style={{ fontSize: 12 }}>{event.title}</strong>
                      {!event.read_at && <span aria-label="Unread" style={{ width: 6, height: 6, borderRadius: "50%", background: C.green }} />}
                      {needsConfirmation && <span style={{ fontSize: 8, fontWeight: 900, background: "#fef3c7", color: "#92400e", borderRadius: 999, padding: "2px 6px" }}>Needs your confirmation</span>}
                    </span>
                    <span style={{ display: "block", marginTop: 3, color: C.muted, fontSize: 10, lineHeight: 1.45 }}>{event.body || "Open for details."}</span>
                    <span style={{ display: "block", marginTop: 5, color: "#94a3b8", fontSize: 9 }}>{childName ? `${childName} · ` : ""}{school ? `${school} · ` : ""}{new Date(event.occurred_at).toLocaleString("en-KE", { timeZone: "Africa/Nairobi", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                  </span>
                  {href && <span aria-hidden="true" style={{ color: "#94a3b8", fontSize: 18, alignSelf: "center" }}>›</span>}
                </button>
              )
            })}
          </div>
        </section>
      ))}

      <section style={{ ...card, marginTop: 12 }}>
        <h2 style={{ margin: "0 0 5px", fontSize: 16 }}>Conversations & school notices</h2>
        <p style={{ margin: "0 0 10px", color: C.muted, fontSize: 11, lineHeight: 1.5 }}>The inbox above is your update history. Open conversations when you need to read or send a permitted message in the correct child and school context.</p>
        <button type="button" onClick={() => router.push("/parent/messages")} style={primaryButton}>Open conversations</button>
      </section>
    </div>
  )
}

const card: React.CSSProperties = { background: "#fff", border: `1px solid ${C.border}`, borderRadius: 15, padding: 14, marginBottom: 10 }
const errorBox: React.CSSProperties = { border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", borderRadius: 12, padding: 11, marginBottom: 10, fontSize: 11 }
const primaryButton: React.CSSProperties = { width: "100%", minHeight: 46, border: "none", borderRadius: 11, background: C.green, color: "#fff", padding: 11, fontWeight: 900, fontFamily: "inherit", cursor: "pointer" }
function filterButton(active: boolean): React.CSSProperties { return { minHeight: 44, border: `1px solid ${active ? C.green : C.border}`, background: active ? "#ecfdf5" : "#fff", color: active ? "#065f46" : C.muted, borderRadius: 999, padding: "6px 12px", fontSize: 10, fontWeight: 900, cursor: "pointer", fontFamily: "inherit" } }
