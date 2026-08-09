"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  loadHQNotifications,
  markHQNotificationRead,
  resolveHQNotification,
  type HQNotification,
} from "@/lib/hq/operating"

const tone: Record<HQNotification["severity"], string> = {
  info: "#60a5fa",
  success: "#34d399",
  warning: "#f59e0b",
  critical: "#ef4444",
}

function age(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  const minutes = Math.max(0, Math.floor(ms / 60000))
  if (minutes < 1) return "now"
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

export default function HQNotificationCenter({ unread, onChange }: { unread: number; onChange?: () => void }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<HQNotification[]>([])
  const visible = useMemo(() => items.filter(item => item.status !== "resolved"), [items])

  async function refresh() {
    setLoading(true)
    try { setItems(await loadHQNotifications()) } finally { setLoading(false) }
  }

  useEffect(() => {
    if (open) void refresh()
  }, [open])

  async function openItem(item: HQNotification) {
    if (item.status === "unread") {
      await markHQNotificationRead(item.id)
      setItems(current => current.map(n => n.id === item.id ? { ...n, status: "read" } : n))
      onChange?.()
    }
    if (item.route) router.push(item.route)
  }

  async function resolve(item: HQNotification) {
    await resolveHQNotification(item.id)
    setItems(current => current.map(n => n.id === item.id ? { ...n, status: "resolved" } : n))
    onChange?.()
  }

  return <>
    <button onClick={() => setOpen(true)} aria-label="HQ notifications" style={{ position: "relative", width: 40, height: 40, borderRadius: 12, border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.04)", color: "#fff", cursor: "pointer", fontSize: 18 }}>
      🔔
      {unread > 0 && <span style={{ position: "absolute", top: -5, right: -5, minWidth: 20, height: 20, borderRadius: 10, background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 900, display: "grid", placeItems: "center", padding: "0 5px" }}>{unread > 99 ? "99+" : unread}</span>}
    </button>

    {open && <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(0,0,0,.54)" }} />}
    <aside style={{ position: "fixed", zIndex: 910, top: 0, right: open ? 0 : "-440px", width: "min(420px,100vw)", height: "100dvh", background: "#0a1628", borderLeft: "1px solid rgba(255,255,255,.08)", transition: "right .22s ease", display: "flex", flexDirection: "column", boxShadow: "-18px 0 60px rgba(0,0,0,.35)" }}>
      <header style={{ padding: "18px", borderBottom: "1px solid rgba(255,255,255,.08)", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div><div style={{ fontWeight: 900, fontSize: 17 }}>HQ Notifications</div><div style={{ fontSize: 11, color: "rgba(255,255,255,.45)", marginTop: 3 }}>Operational events requiring awareness or action</div></div>
        <button onClick={() => setOpen(false)} style={{ border: 0, background: "transparent", color: "#fff", fontSize: 24, cursor: "pointer" }}>×</button>
      </header>
      <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,.45)" }}>{visible.length} active</span>
        <button disabled={loading} onClick={() => void refresh()} style={{ border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.04)", color: "#fff", borderRadius: 8, padding: "6px 10px", fontSize: 11, cursor: "pointer" }}>{loading ? "Refreshing…" : "Refresh"}</button>
      </div>
      <div style={{ overflowY: "auto", flex: 1, padding: "8px 14px 24px" }}>
        {!loading && visible.length === 0 && <div style={{ padding: "44px 12px", textAlign: "center", color: "rgba(255,255,255,.38)", fontSize: 13 }}>No active HQ notifications.</div>}
        {visible.map(item => <div key={item.id} style={{ borderBottom: "1px solid rgba(255,255,255,.07)", padding: "14px 2px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 9, background: tone[item.severity], flexShrink: 0 }} />
            <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".06em", color: tone[item.severity], fontWeight: 900 }}>{item.severity}</span>
            <span style={{ marginLeft: "auto", fontSize: 10, color: "rgba(255,255,255,.3)" }}>{age(item.created_at)}</span>
          </div>
          <button onClick={() => void openItem(item)} style={{ width: "100%", textAlign: "left", border: 0, background: "transparent", color: "inherit", padding: 0, cursor: item.route ? "pointer" : "default" }}>
            <div style={{ fontSize: 13, fontWeight: item.status === "unread" ? 850 : 650, color: "#fff" }}>{item.title}</div>
            {!!item.body && <div style={{ fontSize: 11.5, lineHeight: 1.5, color: "rgba(255,255,255,.5)", marginTop: 4 }}>{item.body}</div>}
          </button>
          <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
            {item.route && <button onClick={() => void openItem(item)} style={{ border: "1px solid rgba(16,185,129,.3)", background: "rgba(16,185,129,.1)", color: "#34d399", borderRadius: 8, padding: "6px 9px", fontSize: 10.5, fontWeight: 800, cursor: "pointer" }}>Open</button>}
            <button onClick={() => void resolve(item)} style={{ border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)", color: "rgba(255,255,255,.55)", borderRadius: 8, padding: "6px 9px", fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}>Resolve</button>
          </div>
        </div>)}
      </div>
    </aside>
  </>
}
