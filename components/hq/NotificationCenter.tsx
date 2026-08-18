"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  acknowledgeHQNotification,
  loadHQNotifications,
  markHQNotificationRead,
  resolveHQNotification,
  type HQNotification,
  type HQNotificationClass,
} from "@/lib/hq/operating"

const tone: Record<HQNotification["severity"], string> = {
  info: "#60a5fa",
  success: "#34d399",
  warning: "#f59e0b",
  critical: "#ef4444",
}

const classLabel: Record<HQNotificationClass, string> = {
  critical: "Act now",
  action_required: "Action required",
  important: "Important",
  digest: "Digest",
}

const filters: Array<{ key: "all" | HQNotificationClass; label: string }> = [
  { key: "all", label: "All" },
  { key: "critical", label: "Critical" },
  { key: "action_required", label: "Action" },
  { key: "important", label: "Important" },
  { key: "digest", label: "Digest" },
]

function age(iso: string) {
  const m = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
  if (m < 1) return "now"
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`
}

export default function HQNotificationCenter() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<HQNotification[]>([])
  const [filter, setFilter] = useState<"all" | HQNotificationClass>("all")

  const active = useMemo(() => items.filter((item) => item.status !== "resolved"), [items])
  const visible = useMemo(
    () => active.filter((item) => filter === "all" || item.notification_class === filter),
    [active, filter],
  )
  const unread = active.filter((item) => item.status === "unread").length
  const urgent = active.filter(
    (item) => item.notification_class === "critical" || item.notification_class === "action_required",
  ).length

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      setItems(await loadHQNotifications())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load HQ notifications.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), 60000)
    return () => window.clearInterval(timer)
  }, [])

  async function openItem(item: HQNotification) {
    if (item.status === "unread") {
      await markHQNotificationRead(item.id)
      setItems((current) =>
        current.map((notification) =>
          notification.id === item.id ? { ...notification, status: "read" } : notification,
        ),
      )
    }
    if (item.route) router.push(item.route)
  }

  async function acknowledge(item: HQNotification) {
    await acknowledgeHQNotification(item.id)
    setItems((current) =>
      current.map((notification) =>
        notification.id === item.id
          ? {
              ...notification,
              status: notification.status === "unread" ? "read" : notification.status,
              acknowledged_at: notification.acknowledged_at ?? new Date().toISOString(),
            }
          : notification,
      ),
    )
  }

  async function resolve(item: HQNotification) {
    await resolveHQNotification(item.id)
    setItems((current) =>
      current.map((notification) =>
        notification.id === item.id ? { ...notification, status: "resolved" } : notification,
      ),
    )
  }

  return (
    <>
      <button
        onClick={() => {
          setOpen(true)
          void refresh()
        }}
        aria-label="HQ notifications"
        style={{
          position: "relative",
          height: 38,
          padding: "0 11px",
          borderRadius: 10,
          border: urgent > 0 ? "1px solid rgba(239,68,68,.5)" : "1px solid rgba(255,255,255,.09)",
          background: urgent > 0 ? "rgba(239,68,68,.12)" : "rgba(255,255,255,.04)",
          color: "#fff",
          fontSize: 11,
          fontWeight: 850,
          cursor: "pointer",
        }}
      >
        Alerts{unread > 0 ? ` · ${unread}` : ""}
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(0,0,0,.54)" }}
        />
      )}

      <aside
        aria-hidden={!open}
        style={{
          position: "fixed",
          zIndex: 910,
          top: 0,
          right: open ? 0 : "-480px",
          width: "min(460px,100vw)",
          height: "100dvh",
          background: "#0a1628",
          borderLeft: "1px solid rgba(255,255,255,.08)",
          transition: "right .22s ease",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header
          style={{
            padding: 18,
            borderBottom: "1px solid rgba(255,255,255,.08)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 900, fontSize: 17 }}>HQ Signal Center</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,.45)", marginTop: 3 }}>
              Exceptions, decisions and opportunities that deserve attention
            </div>
          </div>
          <button
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
            style={{ border: 0, background: "transparent", color: "#fff", fontSize: 24, cursor: "pointer" }}
          >
            ×
          </button>
        </header>

        <div
          style={{
            padding: "10px 14px",
            display: "flex",
            gap: 8,
            alignItems: "center",
            borderBottom: "1px solid rgba(255,255,255,.06)",
          }}
        >
          <span style={{ fontSize: 11, color: "rgba(255,255,255,.45)", marginRight: "auto" }}>
            {active.length} active · {urgent} need action
          </span>
          <button onClick={() => void refresh()} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <div
          style={{
            display: "flex",
            gap: 6,
            overflowX: "auto",
            padding: "10px 14px",
            borderBottom: "1px solid rgba(255,255,255,.06)",
          }}
        >
          {filters.map((option) => {
            const selected = filter === option.key
            return (
              <button
                key={option.key}
                onClick={() => setFilter(option.key)}
                style={{
                  whiteSpace: "nowrap",
                  borderRadius: 999,
                  border: selected ? "1px solid rgba(255,255,255,.34)" : "1px solid rgba(255,255,255,.08)",
                  background: selected ? "rgba(255,255,255,.12)" : "transparent",
                  color: selected ? "#fff" : "rgba(255,255,255,.55)",
                  padding: "6px 9px",
                  fontSize: 10.5,
                  cursor: "pointer",
                }}
              >
                {option.label}
              </button>
            )
          })}
        </div>

        <div style={{ overflowY: "auto", flex: 1, padding: "8px 14px 24px" }}>
          {error && (
            <div
              role="alert"
              style={{
                margin: "8px 0 12px",
                padding: 10,
                border: "1px solid rgba(239,68,68,.35)",
                borderRadius: 10,
                color: "#fecaca",
                fontSize: 11,
              }}
            >
              {error}
            </div>
          )}

          {!loading && !error && visible.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,.38)" }}>
              No active notifications in this view.
            </div>
          )}

          {visible.map((item) => {
            const needsAction =
              item.notification_class === "critical" || item.notification_class === "action_required"
            return (
              <article
                key={item.id}
                style={{
                  borderBottom: "1px solid rgba(255,255,255,.07)",
                  padding: "14px 2px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    fontSize: 10,
                    color: tone[item.severity],
                    fontWeight: 900,
                    textTransform: "uppercase",
                  }}
                >
                  <span>{classLabel[item.notification_class]}</span>
                  <span style={{ color: "rgba(255,255,255,.28)" }}>· {item.category}</span>
                  {item.occurrence_count > 1 && (
                    <span style={{ color: "rgba(255,255,255,.38)" }}>×{item.occurrence_count}</span>
                  )}
                  <span style={{ marginLeft: "auto", color: "rgba(255,255,255,.3)" }}>
                    {age(item.last_seen_at || item.created_at)}
                  </span>
                </div>

                <button
                  onClick={() => void openItem(item)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    border: 0,
                    background: "transparent",
                    color: "#fff",
                    padding: 0,
                    marginTop: 6,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: item.status === "unread" ? 850 : 650 }}>
                    {item.title}
                  </div>
                  {item.body && (
                    <div
                      style={{
                        fontSize: 11.5,
                        lineHeight: 1.5,
                        color: "rgba(255,255,255,.52)",
                        marginTop: 4,
                      }}
                    >
                      {item.body}
                    </div>
                  )}
                </button>

                <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
                  {item.route && (
                    <button onClick={() => void openItem(item)}>{item.action_label || "Open"}</button>
                  )}
                  {needsAction && !item.acknowledged_at && (
                    <button onClick={() => void acknowledge(item)}>Acknowledge</button>
                  )}
                  <button onClick={() => void resolve(item)}>Resolve</button>
                </div>
              </article>
            )
          })}
        </div>
      </aside>
    </>
  )
}
