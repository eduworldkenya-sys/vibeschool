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
  key: string
  studentId: string
  subjectId: string | null
  outcomeId: string
  outcomeText: string
  outcomeCode: string | null
  band: ProgressBand
  evidenceCount: number
  latestObservedAt: string
  percentage: number | null
  trend: 'improving' | 'stable' | 'declining' | 'insufficient'
  trendEvidenceCount: number
  trendSource: string | null
  trendDelta: number | null
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
  EE: 'Exceeding expectation', ME: 'Meeting expectation', AE: 'Approaching expectation', BE: 'Below expectation', NE: 'No recorded performance level',
}

export function progressBandLabel(band: ProgressBand) { return BAND_LABELS[band] }

export function normalizeProgressBand(proficiency: string | null, percentage: number | null): ProgressBand {
  const value = (proficiency ?? '').trim().toLowerCase().replace(/[ _-]+/g, ' ')
  if (['ee', 'exceeding', 'exceeding expectation', 'exceeding expectations', 'exceeds expectation'].includes(value)) return 'EE'
  if (['me', 'meeting', 'meeting expectation', 'meeting expectations', 'meets expectation', 'proficient', 'mastered'].includes(value)) return 'ME'
  if (['ae', 'approaching', 'approaching expectation', 'approaching expectations', 'developing'].includes(value)) return 'AE'
  if (['be', 'below', 'below expectation', 'below expectations', 'beginning', 'needs support', 'needs intervention'].includes(value)) return 'BE'
  // Scores remain visible, but a percentage alone cannot establish a CBE level.
  // Keep the argument for existing callers; grading belongs to the source policy.
  void percentage
  return 'NE'
}

export function evidencePercentage(row: ProgressEvidence) {
  return row.score != null && row.maxScore != null && Number.isFinite(row.score) && Number.isFinite(row.maxScore)
    && row.maxScore > 0 && row.score >= 0 && row.score <= row.maxScore
    ? Math.round((row.score / row.maxScore) * 1000) / 10 : null
}

/** Corrections to one source are one observation, never extra learning evidence. */
export function reconcileProgressEvidence(rows: ProgressEvidence[]): ProgressEvidence[] {
  const unique = new Map<string, ProgressEvidence>()
  for (const row of [...rows].sort((a,b) => Date.parse(b.observedAt) - Date.parse(a.observedAt) || b.id.localeCompare(a.id))) {
    if (!row.id || !row.studentId || !Number.isFinite(Date.parse(row.observedAt))) continue
    const key = JSON.stringify([row.studentId, row.subjectId, row.outcomeId, row.source, row.sourceId || row.id])
    if (!unique.has(key)) unique.set(key, row)
  }
  return Array.from(unique.values())
}

function trend(rows: ProgressEvidence[]): Pick<OutcomeProgress, 'trend' | 'trendEvidenceCount' | 'trendSource' | 'trendDelta'> {
  const pending = { trend: 'insufficient' as const, trendEvidenceCount: 0, trendSource: null, trendDelta: null }
  // Assessment response IDs identify items, not whole assessments. Until attempt
  // lineage is available, do not treat several responses as independent tests.
  const groups = new Map<string, ProgressEvidence[]>()
  for (const row of rows) {
    if (!row.subjectId || row.source === 'assessment_response' || evidencePercentage(row) == null) continue
    const group = groups.get(row.source) ?? []
    const day = new Date(Date.parse(row.observedAt) + 3 * 60 * 60 * 1000).toISOString().slice(0,10)
    if (!group.some(item => new Date(Date.parse(item.observedAt) + 3 * 60 * 60 * 1000).toISOString().slice(0,10) === day)) group.push(row)
    groups.set(row.source, group)
  }
  const selected = Array.from(groups.values()).filter(group => group.length >= 4)
    .sort((a,b) => Date.parse(b[0].observedAt) - Date.parse(a[0].observedAt) || a[0].source.localeCompare(b[0].source))[0]
  if (!selected) return pending
  const values = selected.slice(0,4).map(evidencePercentage)
  if (values.some(value => value == null)) return pending
  const delta = Math.round(((Number(values[0]) + Number(values[1]) - Number(values[2]) - Number(values[3])) / 2) * 10) / 10
  return { trend: delta >= 5 ? 'improving' : delta <= -5 ? 'declining' : 'stable', trendEvidenceCount: 4, trendSource: selected[0].source, trendDelta: delta }
}

export function buildOutcomeProgress(rows: ProgressEvidence[]): OutcomeProgress[] {
  const groups = new Map<string, ProgressEvidence[]>()
  for (const row of reconcileProgressEvidence(rows)) {
    if (!row.outcomeId) continue
    const key = JSON.stringify([row.studentId, row.subjectId, row.outcomeId])
    const group = groups.get(key) ?? []
    group.push(row); groups.set(key, group)
  }
  return Array.from(groups.entries()).map(([key, evidence]) => {
    evidence.sort((a,b) => Date.parse(b.observedAt) - Date.parse(a.observedAt) || b.id.localeCompare(a.id))
    const latest = evidence[0]
    const percentage = evidencePercentage(latest)
    return {
      key,
      studentId: latest.studentId,
      subjectId: latest.subjectId,
      outcomeId: latest.outcomeId!,
      outcomeText: latest.outcomeText || 'Curriculum outcome',
      outcomeCode: latest.outcomeCode,
      band: normalizeProgressBand(latest.proficiency, percentage),
      evidenceCount: evidence.length,
      latestObservedAt: latest.observedAt,
      percentage,
      ...trend(evidence),
      evidence,
    }
  }).sort((a,b) => Date.parse(b.latestObservedAt) - Date.parse(a.latestObservedAt) || a.key.localeCompare(b.key))
}

export function buildProgressHistory(rows: ProgressEvidence[]): ProgressHistoryEvent[] {
  return reconcileProgressEvidence(rows)
    .sort((a,b) => Date.parse(b.observedAt) - Date.parse(a.observedAt) || b.id.localeCompare(a.id))
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

/** Recorded CBC observations can request review without inventing outcome IDs. */
export function unlinkedSupportObservations(rows: ProgressEvidence[]): ProgressEvidence[] {
  const latest = new Map<string, ProgressEvidence>()
  for (const row of reconcileProgressEvidence(rows)) {
    if (row.outcomeId || row.source !== 'cbc_observation') continue
    const key = JSON.stringify([row.studentId, row.subjectId, row.outcomeText])
    if (!latest.has(key)) latest.set(key, row)
  }
  return Array.from(latest.values()).filter(row => {
    const band = normalizeProgressBand(row.proficiency, null)
    return band === 'AE' || band === 'BE'
  })
}
