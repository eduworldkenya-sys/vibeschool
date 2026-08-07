'use client'

import { useRouter } from 'next/navigation'
import type { LearnerTwinState, TwinDecision } from '@/lib/student/twin'

type Props = {
  state: LearnerTwinState
  onTask: (taskId: string) => void
  launchingTaskId: string | null
}

function pct(value: number) { return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }
function actionLabel(decision: TwinDecision) {
  if (decision.actionLabel) return decision.actionLabel
  if (decision.decisionType === 'intervention') return 'Open teacher priority'
  if (decision.decisionType === 'recommendation') return 'Start revision'
  return 'Open task'
}

export default function TwinStateCard({ state, onTask, launchingTaskId }: Props) {
  const router = useRouter()
  const now = state.decision.now
  const next = state.decision.next[0] ?? null
  const weakest = state.mastery.outcomes[0] ?? null
  const mastery = state.prediction.averageEffectiveMastery
  const risk = state.prediction.averageForgettingRisk

  function openDecision(decision: TwinDecision) {
    if (decision.decisionType === 'task' && decision.taskId) return onTask(decision.taskId)
    router.push(decision.actionUrl ?? '/student/vibelearn')
  }

  return <section style={card}>
    <div style={header}>
      <div><div style={label}>VIBETWIN · LIVE LEARNER STATE</div><h2 style={title}>What matters now</h2></div>
      <div style={confidence}><strong>{pct(state.confidence)}</strong><span>STATE CONFIDENCE</span></div>
    </div>

    <div style={nowBox}>
      <div style={label}>NOW</div>
      <strong style={{ fontSize: 14 }}>{now?.title ?? 'No urgent learning action'}</strong>
      <div style={muted}>{now?.reason ?? (weakest ? `Keep ${weakest.outcomeText} active.` : 'Twin will recommend an action after enough learning evidence is available.')}</div>
      {(now?.reasonChain.length ?? 0) > 0 && <div style={chips}>{now?.reasonChain.map(item => <span key={item} style={chip}>{item}</span>)}</div>}
      {now && <button disabled={Boolean(launchingTaskId)} onClick={() => openDecision(now)} style={button}>{launchingTaskId === now.taskId ? 'Opening…' : actionLabel(now)}</button>}
    </div>

    <div style={metrics}>
      <Metric label="Effective mastery" value={mastery == null ? 'Building' : `${Math.round(mastery)}%`} />
      <Metric label="Forgetting risk" value={pct(risk)} />
      <Metric label="Verified evidence" value={state.evidence.competencyEvidenceCount} />
      <Metric label="Exam" value={state.exam.daysRemaining == null ? 'Not set' : `${state.exam.daysRemaining}d`} />
    </div>

    {weakest && <div style={focus}>
      <div><div style={label}>WHAT TWIN HAS NOTICED</div><strong>{weakest.outcomeCode ? `${weakest.outcomeCode} · ` : ''}{weakest.outcomeText}</strong><span style={muted}>{weakest.daysSinceEvidence == null ? 'Evidence recency unknown' : `${weakest.daysSinceEvidence} day${weakest.daysSinceEvidence === 1 ? '' : 's'} since evidence`} · forgetting risk {pct(weakest.forgettingRisk)}</span></div>
      <div style={{ textAlign: 'right', flex: '0 0 auto' }}><strong>{Math.round(weakest.effectiveMastery)}%</strong><span style={muted}>confidence {pct(weakest.confidence)}</span></div>
    </div>}

    {next && <div style={nextRow}><div><div style={label}>NEXT</div><strong style={{ fontSize: 11 }}>{next.title}</strong></div><span style={muted}>{next.subject ?? 'Learning task'}</span></div>}

    <div style={evidenceLine}>
      <span>{state.evidence.learningEventCount} learning events</span>
      <span>{state.evidence.taskReceiptCount} task receipts</span>
      <span>{state.evidence.verifiedCalibrationCount} verified calibrations</span>
      {state.evidence.meanAbsoluteError != null && <span>calibration error {state.evidence.meanAbsoluteError}</span>}
    </div>

    <div style={foot}>Prediction confidence {pct(state.prediction.confidence)} · {state.prediction.disclaimer ?? 'Based on verified Vibeschool evidence.'}</div>
  </section>
}

function Metric({ label: text, value }: { label: string; value: string | number }) { return <div style={metric}><span style={muted}>{text}</span><strong style={{ display: 'block', marginTop: 3, fontSize: 15 }}>{value}</strong></div> }

const card: React.CSSProperties = { padding: 15, borderRadius: 16, border: '1px solid var(--vs-border)', background: 'var(--vs-card)', marginTop: 12 }
const header: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }
const title: React.CSSProperties = { margin: '3px 0 0', fontSize: 14 }
const label: React.CSSProperties = { fontSize: 8.5, fontWeight: 900, letterSpacing: .7, color: '#4f46e5', textTransform: 'uppercase' }
const muted: React.CSSProperties = { display: 'block', marginTop: 3, fontSize: 9.5, color: 'var(--vs-muted)', lineHeight: 1.4 }
const confidence: React.CSSProperties = { textAlign: 'right', minWidth: 74 }
const nowBox: React.CSSProperties = { marginTop: 12, padding: 12, borderRadius: 12, background: 'var(--vs-soft)', border: '1px solid var(--vs-border)' }
const chips: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }
const chip: React.CSSProperties = { padding: '4px 7px', borderRadius: 999, background: '#eef2ff', color: '#4338ca', fontSize: 8.5, fontWeight: 800 }
const button: React.CSSProperties = { marginTop: 9, width: '100%', border: 0, borderRadius: 10, padding: '9px 11px', background: '#4f46e5', color: '#fff', fontFamily: 'inherit', fontWeight: 900, cursor: 'pointer' }
const metrics: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 7, marginTop: 10 }
const metric: React.CSSProperties = { minWidth: 0, padding: 9, borderRadius: 10, border: '1px solid var(--vs-border)', background: 'var(--vs-soft)' }
const focus: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--vs-border)', fontSize: 11 }
const nextRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginTop: 10, padding: '10px 0', borderTop: '1px solid var(--vs-border)' }
const evidenceLine: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8, fontSize: 8.5, color: 'var(--vs-muted)' }
const foot: React.CSSProperties = { marginTop: 9, fontSize: 8.5, lineHeight: 1.45, color: 'var(--vs-muted)' }
