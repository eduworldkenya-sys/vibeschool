export type WatchdogSnapshot = {
  nowMs?: number
  lastTelemetryAt?: string | null
  lastWorkerHeartbeatAt?: string | null
  maximumTelemetryAgeSeconds: number
  maximumHeartbeatAgeSeconds: number
}

export type WatchdogFinding = { code: "TELEMETRY_STALE" | "WORKER_HEARTBEAT_STALE" | "TELEMETRY_MISSING" | "WORKER_HEARTBEAT_MISSING"; severity: "critical"; ageSeconds?: number }

function ageSeconds(value: string, now: number) { return Math.max(0, Math.floor((now - Date.parse(value)) / 1000)) }

export function evaluateIndependentWatchdog(snapshot: WatchdogSnapshot): WatchdogFinding[] {
  const now = snapshot.nowMs ?? Date.now()
  const findings: WatchdogFinding[] = []
  if (!snapshot.lastTelemetryAt) findings.push({ code: "TELEMETRY_MISSING", severity: "critical" })
  else { const age = ageSeconds(snapshot.lastTelemetryAt, now); if (!Number.isFinite(age) || age > snapshot.maximumTelemetryAgeSeconds) findings.push({ code: "TELEMETRY_STALE", severity: "critical", ageSeconds: age }) }
  if (!snapshot.lastWorkerHeartbeatAt) findings.push({ code: "WORKER_HEARTBEAT_MISSING", severity: "critical" })
  else { const age = ageSeconds(snapshot.lastWorkerHeartbeatAt, now); if (!Number.isFinite(age) || age > snapshot.maximumHeartbeatAgeSeconds) findings.push({ code: "WORKER_HEARTBEAT_STALE", severity: "critical", ageSeconds: age }) }
  return findings
}
