'use client'

import { useEffect, useMemo, useState } from 'react'
import { progressBandLabel, type OutcomeProgress, type ProgressBand } from '@/lib/learner-intelligence/progress-record'

const symbols: Record<ProgressBand, string> = { EE: '✓+', ME: '✓', AE: '◐', BE: '!', NE: '—' }
type Learner = { id: string; name: string; outcomes: OutcomeProgress[] }

export default function OutcomeMatrix({ learners, onOpenLearner }: { learners: Learner[]; onOpenLearner: (id: string) => void }) {
  const [selected, setSelected] = useState<{ learner: string; outcome: OutcomeProgress | null; label: string } | null>(null)
  const [page, setPage] = useState(0)
  useEffect(() => { setSelected(null); setPage(0) }, [learners])
  const columns = useMemo(() => {
    const map = new Map<string, { key: string; label: string }>()
    for (const learner of learners) for (const outcome of learner.outcomes) map.set(JSON.stringify([outcome.subjectId, outcome.outcomeId]), { key: JSON.stringify([outcome.subjectId, outcome.outcomeId]), label: outcome.outcomeText })
    return [...map.values()]
  }, [learners])
  const maxPage = Math.max(0, Math.ceil(columns.length / 4) - 1)
  const safePage = Math.min(page, maxPage)
  const visibleColumns = columns.slice(safePage * 4, safePage * 4 + 4)
  if (!columns.length) return <section className="studio-matrix-empty"><h2>Outcome evidence</h2><p>No linked outcome evidence in this view yet. Recorded learner evidence will populate the map.</p></section>
  return <section className="studio-matrix" aria-label="Learner outcome evidence map">
    <div className="studio-matrix-heading"><div><h2>Learning map</h2><small>Tap a cell to inspect its evidence</small></div>{columns.length > 4 && <div><button disabled={safePage === 0} onClick={() => setPage(safePage - 1)} aria-label="Previous outcomes">←</button><span>{safePage + 1} / {maxPage + 1}</span><button disabled={safePage === maxPage} onClick={() => setPage(safePage + 1)} aria-label="Next outcomes">→</button></div>}</div>
    <div className="studio-matrix-scroll"><table><thead><tr><th scope="col">Learner</th>{visibleColumns.map(column => <th scope="col" key={column.key}>{column.label}</th>)}</tr></thead><tbody>{learners.map(learner => <tr key={learner.id}><th scope="row"><button className="studio-matrix-name" onClick={() => onOpenLearner(learner.id)}>{learner.name}</button></th>{visibleColumns.map(column => { const outcome = learner.outcomes.find(item => JSON.stringify([item.subjectId, item.outcomeId]) === column.key) ?? null; const band = outcome?.band ?? 'NE'; return <td key={column.key}><button className={`studio-matrix-cell studio-band-${band}`} aria-label={`${learner.name}, ${column.label}, ${progressBandLabel(band)}`} onClick={() => setSelected({ learner: learner.name, outcome, label: column.label })}>{symbols[band]}</button></td> })}</tr>)}</tbody></table></div>
    <div className="studio-matrix-legend">{(['EE','ME','AE','BE','NE'] as const).map(band => <span key={band}><b className={`studio-band-${band}`}>{symbols[band]}</b>{progressBandLabel(band)}</span>)}</div>
    {selected && <article className="studio-matrix-detail" aria-live="polite"><div className="studio-matrix-heading"><h3>{selected.learner} · {selected.label}</h3><button onClick={() => setSelected(null)}>Close</button></div>{selected.outcome ? <><p>{progressBandLabel(selected.outcome.band)} · {selected.outcome.evidenceCount} evidence items</p>{selected.outcome.evidence.map(row => <div key={row.id}><strong>{row.source.replaceAll('_', ' ')}</strong><small>{new Date(row.observedAt).toLocaleDateString('en-KE', { timeZone: 'Africa/Nairobi' })}</small>{row.score !== null && row.maxScore !== null && <p>{row.score} / {row.maxScore}</p>}{row.proficiency && <p>{row.proficiency}</p>}{row.notes && <p>{row.notes}</p>}</div>)}</> : <p>No recorded evidence for this learner and outcome in the selected view.</p>}</article>}
  </section>
}
