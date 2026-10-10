'use client'

import { useState } from 'react'
import { evidencePercentage, type OutcomeProgress } from '@/lib/learner-intelligence/progress-record'

export default function LearnerEvidenceChart({ outcomes }: { outcomes: OutcomeProgress[] }) {
  const [selected, setSelected] = useState('')
  const outcome = outcomes.find(row => row.key === selected) ?? outcomes[0]
  if (!outcome) return null
  const source = outcome.evidence[0]?.source
  const observations = outcome.evidence.filter(row => row.source === source && evidencePercentage(row) !== null).sort((a,b) => a.observedAt.localeCompare(b.observedAt)).slice(-6)
  return <section className="studio-evidence-chart" aria-label="Recorded outcome observations">
    <div className="studio-matrix-heading"><h2>Evidence over time</h2><select aria-label="Chart outcome" value={outcome.key} onChange={event => setSelected(event.target.value)}>{outcomes.map(row => <option key={row.key} value={row.key}>{row.outcomeText}</option>)}</select></div>
    <p>{outcome.outcomeText}</p>
    {observations.length ? <div className="studio-evidence-bars">{observations.map(row => <div key={row.id}><strong>{row.score} / {row.maxScore}</strong><div className="studio-evidence-bar-track"><span style={{height:`${Math.max(2, evidencePercentage(row)!)}%`}}/></div><small>{new Date(row.observedAt).toLocaleDateString('en-KE',{day:'numeric',month:'short',timeZone:'Africa/Nairobi'})}</small></div>)}</div> : <div className="studio-snapshot-empty">No numeric observations for this outcome yet. Qualitative evidence remains in the record below.</div>}
    <small>{source?.replaceAll('_',' ')} · Recorded scores; bars show percentage of available marks.</small>
    <div className="studio-evidence-trend">{outcome.trend === 'insufficient' ? 'More comparable evidence needed for a trend' : `${outcome.trend} · ${outcome.trendDelta! > 0 ? '+' : ''}${outcome.trendDelta} points · ${outcome.trendEvidenceCount} comparable observations`}</div>
  </section>
}
