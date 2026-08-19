export type EvidenceStatus = "CERTIFIED" | "LIVE" | "CACHED" | "STALE" | "ESTIMATED" | "NOT INSTRUMENTED" | "UNAVAILABLE"
export type MetricIntent = "higher-is-better" | "lower-is-better" | "neutral"

export function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export function formatNumber(value: unknown, maximumFractionDigits = 1): string {
  const number = numberOrNull(value)
  return number === null ? "Unavailable" : new Intl.NumberFormat("en-KE", { maximumFractionDigits }).format(number)
}

export function formatPercent(value: unknown, valueIsRatio = false): string {
  const number = numberOrNull(value)
  if (number === null) return "Unavailable"
  const percent = valueIsRatio ? number * 100 : number
  return `${new Intl.NumberFormat("en-KE", { maximumFractionDigits: 1 }).format(percent)}%`
}

export function ageMinutes(iso: unknown, now = Date.now()): number | null {
  if (typeof iso !== "string") return null
  const timestamp = Date.parse(iso)
  return Number.isFinite(timestamp) ? Math.max(0, Math.floor((now - timestamp) / 60000)) : null
}

export function freshnessStatus(iso: unknown, cached = false, staleAfterMinutes = 30): EvidenceStatus {
  if (cached) return "CACHED"
  const age = ageMinutes(iso)
  if (age === null) return "UNAVAILABLE"
  return age > staleAfterMinutes ? "STALE" : "LIVE"
}

export function certificationStatus(iso: unknown, staleAfterMinutes = 24 * 60): EvidenceStatus {
  const age = ageMinutes(iso)
  if (age === null) return "UNAVAILABLE"
  return age > staleAfterMinutes ? "STALE" : "CERTIFIED"
}

export function deltaMeaning(delta: unknown, intent: MetricIntent): "positive" | "negative" | "neutral" | "unavailable" {
  const number = numberOrNull(delta)
  if (number === null) return "unavailable"
  if (number === 0 || intent === "neutral") return "neutral"
  if (intent === "higher-is-better") return number > 0 ? "positive" : "negative"
  return number < 0 ? "positive" : "negative"
}

export function relativeAge(iso: unknown): string {
  const minutes = ageMinutes(iso)
  if (minutes === null) return "freshness unavailable"
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
