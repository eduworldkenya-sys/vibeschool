"use client"

import { useEffect, useMemo, useState } from "react"
import { loadHQExecutiveAnalytics, type HQExecutiveAnalytics } from "@/lib/hq/operating"

const C = {
  panel: "#0d1b2f",
  border: "rgba(255,255,255,.08)",
  muted: "rgba(255,255,255,.46)",
}

type LiveHQExecutiveAnalytics = HQExecutiveAnalytics & {
  role_mix?: Array<{ role: string; count: number }>
  school_status?: Array<{ status: string; count: number }>
  operations: HQExecutiveAnalytics["operations"] & {
    unreviewed_submissions?: number
    publication_reads?: number
  }
}

function Card({ title, value }: { title: string; value: string | number }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 13 }}>
      <div style={{ fontSize: 21, fontWeight: 900 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 800, marginTop: 5 }}>{title}</div>
    </div>
  )
}

function Breakdown({ title, rows }: { title: string; rows: Array<{ name: string; value: number }> }) {
  const total = Math.max(1, rows.reduce((sum, row) => sum + row.value, 0))
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 13 }}>
      <div style={{ fontSize: 11, fontWeight: 900, marginBottom: 8 }}>{title}</div>
      {rows.map((row) => (
        <div key={row.name} style={{ display: "flex", gap: 8, fontSize: 10.5, marginTop: 7 }}>
          <span style={{ flex: 1 }}>{row.name}</span>
          <strong>{row.value}</strong>
          <span style={{ width: 40, textAlign: "right", color: C.muted }}>
            {Math.round((row.value / total) * 100)}%
          </span>
        </div>
      ))}
    </div>
  )
}

export default function HQExecutiveAnalytics() {
  const [analytics, setAnalytics] = useState<HQExecutiveAnalytics | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    loadHQExecutiveAnalytics()
      .then(setAnalytics)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Analytics unavailable"))
  }, [])

  const liveAnalytics = analytics as LiveHQExecutiveAnalytics | null
  const roles = useMemo(
    () => (liveAnalytics?.roles ?? liveAnalytics?.role_mix ?? []).map((row) => ({ name: row.role, value: row.count })),
    [liveAnalytics],
  )
  const schools = useMemo(
    () => (liveAnalytics?.schools ?? liveAnalytics?.school_status ?? []).map((row) => ({ name: row.status, value: row.count })),
    [liveAnalytics],
  )

  if (error) return <div style={{ color: "#fca5a5", fontSize: 11 }}>{error}</div>
  if (!liveAnalytics) return <div style={{ color: C.muted, fontSize: 11 }}>Loading executive analytics…</div>

  const publicationReads = liveAnalytics.content?.publication_reads ?? liveAnalytics.operations?.publication_reads ?? 0
  const markingBacklog = liveAnalytics.operations?.marking_backlog ?? liveAnalytics.operations?.unreviewed_submissions ?? 0

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 9 }}>
        <Card title="30d payments" value={`KES ${(liveAnalytics.finance?.payments_30d ?? 0).toLocaleString("en-KE")}`} />
        <Card title="30d expenses" value={`KES ${(liveAnalytics.finance?.expenses_30d ?? 0).toLocaleString("en-KE")}`} />
        <Card title="Marking backlog" value={markingBacklog} />
        <Card title="Open incidents" value={liveAnalytics.operations?.open_incidents ?? 0} />
        <Card title="Publication reads" value={publicationReads} />
        <Card title="Parent messages · 30d" value={liveAnalytics.communications?.parent_messages_30d ?? 0} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 10, marginTop: 10 }}>
        <Breakdown title="User composition" rows={roles} />
        <Breakdown title="School operating status" rows={schools} />
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 13, marginTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 900, marginBottom: 8 }}>14-day operating activity</div>
        {(liveAnalytics.daily ?? []).map((row) => (
          <div
            key={row.date}
            style={{
              display: "grid",
              gridTemplateColumns: "80px repeat(4,1fr)",
              gap: 8,
              fontSize: 10,
              padding: "5px 0",
              borderTop: `1px solid ${C.border}`,
            }}
          >
            <span style={{ color: C.muted }}>
              {new Date(`${row.date}T00:00:00`).toLocaleDateString("en-KE", { month: "short", day: "numeric" })}
            </span>
            <span>Users {row.signups}</span>
            <span>Plans {row.lesson_plans}</span>
            <span>HW {row.homework}</span>
            <span>Subs {row.submissions}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
