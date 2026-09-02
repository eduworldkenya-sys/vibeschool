export type ProgressBand = 'EE' | 'ME' | 'AE' | 'BE' | 'NE'

export type ProgressEvidence = {
  id: string
  studentId: string
  subjectId: string | null
  outcomeId: string | null
  outcomeText: string | null
  outcomeCode: string | null
  source: string
  sourceId: string | null
  observedAt: string
  score: number | null
  maxScore: number | null
  proficiency: string | null
  notes: string | null
  weight: number
}

export type OutcomeProgress = {
  outcomeId: string
  outcomeText: string
  outcomeCode: string | null
  band: ProgressBand
  evidenceCount: number
  latestObservedAt: string
  percentage: number | null
  trend: 'improving' | 'stable' | 'declining' | 'insufficient'
  evidence: ProgressEvidence[]
}

export type ProgressHistoryEvent = {
  id: string
  observedAt: string
  source: string
  subjectId: string | null
  outcomeId: string | null
  outcomeText: string
  outcomeCode: string | null
  band: ProgressBand
  percentage: number | null
  proficiency: string | null
  notes: string | null
}

const BAND_LABELS: Record<ProgressBand, string> = {
  EE: 'Exceeding expectation', ME: 'Meeting expectation', AE: 'Approaching expectation', BE: 'Below expectation', NE: 'Not enough evidence',
}

export function progressBandLabel(band: ProgressBand) { return BAND_LABELS[band] }

export function normalizeProgressBand(proficiency: string | null, percentage: number | null): ProgressBand {
  const value = (proficiency ?? '').trim().toLowerCase().replace(/[ _-]+/g, ' ')
  if (['ee', 'exceeding', 'exceeding expectation', 'exceeds expectation'].includes(value)) return 'EE'
  if (['me', 'meeting', 'meeting expectation', 'meets expectation', 'proficient', 'mastered'].includes(value)) return 'ME'
  if (['ae', 'approaching', 'approaching expectation', 'developing'].includes(value)) return 'AE'
  if (['be', 'below', 'below expectation', 'beginning', 'needs support'].includes(value)) return 'BE'
  if (percentage == null || !Number.isFinite(percentage)) return 'NE'
  if (percentage >= 80) return 'EE'
  if (percentage >= 60) return 'ME'
  if (percentage >= 40) return 'AE'
  return 'BE'
}

export function evidencePercentage(row: ProgressEvidence) {
  return row.score != null && row.maxScore != null && row.maxScore > 0 ? Math.round((row.score / row.maxScore) * 1000) / 10 : null
}

function weightedPercentage(rows: ProgressEvidence[]) {
  let numerator = 0, denominator = 0
  for (const row of rows) {
    const value = evidencePercentage(row)
    if (value == null) continue
    const weight = Number.isFinite(row.weight) && row.weight > 0 ? row.weight : 1
    numerator += value * weight
    denominator += weight
  }
  return denominator ? Math.round((numerator / denominator) * 10) / 10 : null
}

function trend(rows: ProgressEvidence[]): OutcomeProgress['trend'] {
  const scored = [...rows].sort((a,b) => a.observedAt.localeCompare(b.observedAt)).map(evidencePercentage).filter((v): v is number => v != null)
  if (scored.length < 2) return 'insufficient'
  const split = Math.max(1, Math.floor(scored.length / 2))
  const before = scored.slice(0, split).reduce((a,b) => a+b, 0) / split
  const recentRows = scored.slice(split)
  if (!recentRows.length) return 'insufficient'
  const recent = recentRows.reduce((a,b) => a+b, 0) / recentRows.length
  const delta = recent - before
  return delta >= 5 ? 'improving' : delta <= -5 ? 'declining' : 'stable'
}

export function buildOutcomeProgress(rows: ProgressEvidence[]): OutcomeProgress[] {
  const groups = new Map<string, ProgressEvidence[]>()
  for (const row of rows) {
    if (!row.outcomeId) continue
    const group = groups.get(row.outcomeId) ?? []
    group.push(row); groups.set(row.outcomeId, group)
  }
  return Array.from(groups.entries()).map(([outcomeId, evidence]) => {
    evidence.sort((a,b) => b.observedAt.localeCompare(a.observedAt))
    const percentage = weightedPercentage(evidence)
    const latest = evidence[0]
    return {
      outcomeId,
      outcomeText: latest.outcomeText || 'Curriculum outcome',
      outcomeCode: latest.outcomeCode,
      band: normalizeProgressBand(latest.proficiency, percentage),
      evidenceCount: evidence.length,
      latestObservedAt: latest.observedAt,
      percentage,
      trend: trend(evidence),
      evidence,
    }
  }).sort((a,b) => b.latestObservedAt.localeCompare(a.latestObservedAt))
}

export function buildProgressHistory(rows: ProgressEvidence[]): ProgressHistoryEvent[] {
  return [...rows]
    .sort((a,b) => b.observedAt.localeCompare(a.observedAt))
    .map(row => {
      const percentage = evidencePercentage(row)
      return {
        id: row.id,
        observedAt: row.observedAt,
        source: row.source,
        subjectId: row.subjectId,
        outcomeId: row.outcomeId,
        outcomeText: row.outcomeText || 'Curriculum outcome',
        outcomeCode: row.outcomeCode,
        band: normalizeProgressBand(row.proficiency, percentage),
        percentage,
        proficiency: row.proficiency,
        notes: row.notes,
      }
    })
}

export function progressSummary(outcomes: OutcomeProgress[]) {
  const counts: Record<ProgressBand, number> = { EE:0, ME:0, AE:0, BE:0, NE:0 }
  for (const item of outcomes) counts[item.band]++
  const assessed = outcomes.length - counts.NE
  return { counts, assessed, secure: counts.EE + counts.ME, needsSupport: counts.AE + counts.BE }
}
