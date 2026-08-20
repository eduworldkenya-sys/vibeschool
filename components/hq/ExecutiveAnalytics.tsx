"use client"

import { useEffect, useMemo, useState } from "react"
import { loadHQExecutiveAnalytics, type HQExecutiveAnalytics } from "@/lib/hq/operating"

const C = {
  panel: "#0d1b2f",
  border: "rgba(255,255,255,.08)",
  muted: "rgba(255,255,255,.46)",
}

type LiveHQExecutiveAnalytics = HQExecutiveAnalytics & {
  role_mix?: unknown
  school_status?: unknown
  daily?: unknown
  operations: HQExecutiveAnalytics["operations"] & {
    unreviewed_submissions?: number
    publication_reads?: number
  }
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
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
  const safeRows = asArray<{ name: string; value: number }>(rows)
  const total = Math.max(1, safeRows.reduce((sum, row) => sum + Number(row?.value ?? 0), 0))
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 13 }}>
      <div style={{ fontSize: 11, fontWeight: 900, marginBottom: 8 }}>{title}</div>
      {safeRows.map((row, index) => (
        <div key={`${row?.name ?? "unknown"}-${index}`} style={{ display: "flex", gap: 8, fontSize: 10.5, marginTop: 7 }}>
          <span style={{ flex: 1 }}>{row?.name ?? "Unknown"}</span>
          <strong>{Number(row?.value ?? 0)}</strong>
          <span style={{ width: 40, textAlign: "right", color: C.muted }}>
            {Math.round((Number(row?.value ?? 0) / total) * 100)}%
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
  const roles = useMemo(() => {
    if (!liveAnalytics) return []
    const source = Array.isArray(liveAnalytics.roles)
      ? liveAnalytics.roles
      : asArray<{ role: string; count: number }>(liveAnalytics.role_mix)
    return source.map((row) => ({ name: row?.role ?? "unknown", value: Number(row?.count ?? 0) }))
  }, [liveAnalytics])
  const schools = useMemo(() => {
    if (!liveAnalytics) return []
    const source = Array.isArray(liveAnalytics.schools)
      ? liveAnalytics.schools
      : asArray<{ status: string; count: number }>(liveAnalytics.school_status)
    return source.map((row) => ({ name: row?.status ?? "unknown", value: Number(row?.count ?? 0) }))
  }, [liveAnalytics])

  if (error) return <div style={{ color: "#fca5a5", fontSize: 11 }}>{error}</div>
  if (!liveAnalytics) return <div style={{ color: C.muted, fontSize: 11 }}>Loading executive analytics…</div>

  const publicationReads = liveAnalytics.content?.publication_reads ?? liveAnalytics.operations?.publication_reads ?? 0
  const markingBacklog = liveAnalytics.operations?.marking_backlog ?? liveAnalytics.operations?.unreviewed_submissions ?? 0
  const daily = asArray<{ date: string; signups: number; lesson_plans: number; homework: number; submissions: number }>(liveAnalytics.daily)

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 9 }}>
        <Card title="30d payments" value={`KES ${Number(liveAnalytics.finance?.payments_30d ?? 0).toLocaleString("en-KE")}`} />
        <Card title="30d expenses" value={`KES ${Number(liveAnalytics.finance?.expenses_30d ?? 0).toLocaleString("en-KE")}`} />
        <Card title="Marking backlog" value={Number(markingBacklog ?? 0)} />
        <Card title="Open incidents" value={Number(liveAnalytics.operations?.open_incidents ?? 0)} />
        <Card title="Publication reads" value={Number(publicationReads ?? 0)} />
        <Card title="Parent messages · 30d" value={Number(liveAnalytics.communications?.parent_messages_30d ?? 0)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 10, marginTop: 10 }}>
        <Breakdown title="User composition" rows={roles} />
        <Breakdown title="School operating status" rows={schools} />
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 13, marginTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 900, marginBottom: 8 }}>14-day operating activity</div>
        {daily.map((row, index) => (
          <div
            key={`${row?.date ?? "unknown"}-${index}`}
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
              {row?.date ? new Date(`${row.date}T00:00:00`).toLocaleDateString("en-KE", { month: "short", day: "numeric" }) : "—"}
            </span>
            <span>Users {Number(row?.signups ?? 0)}</span>
            <span>Plans {Number(row?.lesson_plans ?? 0)}</span>
            <span>HW {Number(row?.homework ?? 0)}</span>
            <span>Subs {Number(row?.submissions ?? 0)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
