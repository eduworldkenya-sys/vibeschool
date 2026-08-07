'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { C } from '@/components/teacher/ui'
import { getTeacherTwinState, type TeacherTwinDecision, type TeacherTwinState } from '@/lib/teacher/twin'

function pct(value: number) { return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }
function firstName(name: string) { return name.trim().split(/\s+/)[0] || 'Teacher' }
function deadline(days: number | null) {
  if (days == null) return 'Not configured'
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return 'Due today'
  return `Due in ${days}d`
}

export default function TeacherTwinPage() {
  const router = useRouter()
  const [state, setState] = useState<TeacherTwinState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setState(await getTeacherTwinState()) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Teacher Twin could not be loaded.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  if (loading && !state) return <div style={page}><div style={{ ...card, minHeight: 180 }}>Loading verified Teacher Twin state…</div></div>

  const now = state?.decision.now
  const next = state?.decision.next.filter(item => (item.count ?? 1) > 0) ?? []
  const later = state?.decision.later.filter(item => (item.count ?? 1) > 0) ?? []
  const memory = state?.memory.claims.filter(claim => claim.importance >= 0.7) ?? []

  return <div style={page}>
    <section style={hero}>
      <div>
        <div style={eyebrow}>VIBETWIN · TEACHER STATE</div>
        <h1 style={{ margin: '5px 0 3px', fontSize: 24 }}>{state ? `${firstName(state.fullName)}'s Teacher Twin` : 'Teacher Twin'}</h1>
        <p style={heroSub}>Verified teaching state, learner signals and next-best workflow actions.</p>
      </div>
      <div style={{ textAlign: 'right' }}><strong style={{ fontSize: 20 }}>{pct(state?.confidence ?? 0)}</strong><div style={eyebrow}>STATE CONFIDENCE</div></div>
    </section>

    {error && <section style={{ ...card, borderColor: '#fecaca', color: '#991b1b' }}>{error}<button onClick={() => void load()} style={linkButton}>Retry</button></section>}

    <section style={card}>
      <div style={eyebrow}>NOW</div>
      <h2 style={sectionTitle}>{now?.title ?? 'Teaching workflow is on track'}</h2>
      <p style={body}>{now?.reason ?? 'No higher-priority verified action is currently detected.'}</p>
      {(now?.reasonChain.length ?? 0) > 0 && <div style={chips}>{now?.reasonChain.map(item => <span key={item} style={chip}>{item}</span>)}</div>}
      {now?.actionUrl && <button onClick={() => router.push(now.actionUrl!)} style={primaryButton}>{now.actionLabel ?? 'Open action'}</button>}
    </section>

    <section style={metrics}>
      <Metric label="Attendance pending" value={state?.evidence.attendancePending ?? 0} />
      <Metric label="Marking waiting" value={state?.evidence.pendingMarking ?? 0} />
      <Metric label="Student Twin attention" value={state?.evidence.studentTwinAttention ?? 0} />
      <Metric label="Scheme overdue" value={state?.evidence.overdueSchemeItems ?? 0} />
      <Metric label="Reflection gaps" value={state?.evidence.reflectionGaps7d ?? 0} />
      <Metric label="Assigned classes" value={state?.evidence.assignedClasses ?? 0} />
    </section>

    <section style={card}>
      <div style={rowHeader}><div><div style={eyebrow}>LIVE CONTEXT</div><h2 style={sectionTitle}>Operational teacher state</h2></div><button onClick={() => void load()} style={linkButton}>Refresh</button></div>
      <div style={contextGrid}>
        <Metric label="Today's lessons" value={state?.context.todaySchedule.length ?? 0} />
        <Metric label="Attendance streak" value={`${state?.context.attendanceStreak ?? 0}d`} />
        <Metric label="At-risk learners" value={state?.context.atRiskStudents.length ?? 0} />
        <Metric label="Homework due" value={state?.context.homeworkDue.length ?? 0} />
        <Metric label="Unread threads" value={state?.context.unreadThreads ?? 0} />
        <Metric label="TPAD" value={deadline(state?.context.tpadDays ?? null)} />
        <Metric label="Credits" value={state?.context.creditBalance ?? '—'} />
      </div>
    </section>

    <section style={card}>
      <div style={eyebrow}>NEXT</div><h2 style={sectionTitle}>What follows after NOW</h2>
      {next.length === 0 ? <Empty text="No additional active workflow gaps detected." /> : <div style={list}>{next.map((item, index) => <DecisionRow key={`${item.decisionType}:${index}`} decision={item} onOpen={() => item.actionUrl && router.push(item.actionUrl)} />)}</div>}
    </section>

    <section style={card}>
      <div style={eyebrow}>WHAT TWIN HAS LEARNED</div>
      <h2 style={sectionTitle}>Evidence-derived teacher memory</h2>
      {memory.length === 0 ? <Empty text="Teacher memory is still building from verified workflow evidence." /> : <div style={list}>{memory.map(claim => <div key={claim.claimKey} style={memoryRow}><div><strong style={{ fontSize: 12 }}>{claim.claim}</strong><div style={muted}>{claim.type.replaceAll('_', ' ')} · {claim.evidenceCount} evidence signal{claim.evidenceCount === 1 ? '' : 's'}</div></div><span style={confidence}>{pct(claim.confidence)}</span></div>)}</div>}
    </section>

    <section style={card}>
      <div style={eyebrow}>LATER</div>
      <h2 style={sectionTitle}>Close the teaching loop</h2>
      {later.length === 0 ? <Empty text="No later-stage loop closures are currently pending." /> : <div style={list}>{later.map((item, index) => <DecisionRow key={`${item.decisionType}:later:${index}`} decision={item} onOpen={() => item.actionUrl && router.push(item.actionUrl)} />)}</div>}
    </section>

    <section style={card}>
      <div style={eyebrow}>INTERVENTION EFFECTIVENESS</div>
      <h2 style={sectionTitle}>{state?.evidence.evaluatedInterventions ?? 0} evaluated intervention{state?.evidence.evaluatedInterventions === 1 ? '' : 's'}</h2>
      <p style={body}>{state?.evidence.meanInterventionMasteryChange == null ? 'Twin will learn which teacher interventions work after before/after mastery evidence is evaluated.' : `Average measured learner mastery change: ${state.evidence.meanInterventionMasteryChange > 0 ? '+' : ''}${state.evidence.meanInterventionMasteryChange} points.`}</p>
      <button onClick={() => router.push('/teacher/assessment')} style={secondaryButton}>Review intervention evidence</button>
    </section>

    <section style={footCard}>
      <strong>Authority rule</strong>
      <span>{state?.decision.rule?.replaceAll('_', ' → ') ?? 'Verified workflow evidence decides; AI explains.'}</span>
      <span>AI is not state authority. Teacher records are never silently changed.</span>
    </section>
  </div>
}

function DecisionRow({ decision, onOpen }: { decision: TeacherTwinDecision; onOpen: () => void }) {
  return <button onClick={onOpen} disabled={!decision.actionUrl} style={decisionRow}>
    <div style={{ textAlign: 'left', minWidth: 0 }}><strong style={{ fontSize: 12 }}>{decision.title}</strong><span style={muted}>{decision.count != null ? `${decision.count} active` : decision.reason ?? decision.decisionType.replaceAll('_', ' ')}</span></div>
    <span style={{ fontSize: 16 }}>›</span>
  </button>
}
function Metric({ label, value }: { label: string; value: string | number }) { return <div style={metric}><span style={muted}>{label}</span><strong style={{ display: 'block', marginTop: 4, fontSize: 18 }}>{value}</strong></div> }
function Empty({ text }: { text: string }) { return <p style={{ ...body, margin: '10px 0 0' }}>{text}</p> }

const page: React.CSSProperties = { maxWidth: 760, margin: '0 auto', padding: '18px 16px 110px' }
const hero: React.CSSProperties = { background: 'linear-gradient(135deg,#0f172a,#1e1b4b 60%,#064e3b)', color: '#fff', borderRadius: 22, padding: 20, display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start', marginBottom: 12 }
const heroSub: React.CSSProperties = { margin: 0, color: 'rgba(255,255,255,.72)', fontSize: 12, lineHeight: 1.5 }
const eyebrow: React.CSSProperties = { fontSize: 9, fontWeight: 900, letterSpacing: 1, color: C.accent, textTransform: 'uppercase' }
const card: React.CSSProperties = { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 18, padding: 16, marginBottom: 12, boxShadow: C.shadow }
const sectionTitle: React.CSSProperties = { margin: '5px 0 4px', fontSize: 16, color: C.textPrimary }
const body: React.CSSProperties = { color: C.textMuted, fontSize: 12, lineHeight: 1.55, margin: '5px 0' }
const chips: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }
const chip: React.CSSProperties = { background: '#ecfdf5', color: '#047857', borderRadius: 999, padding: '5px 8px', fontSize: 9, fontWeight: 800 }
const primaryButton: React.CSSProperties = { width: '100%', marginTop: 12, border: 0, borderRadius: 11, background: C.accent, color: '#fff', padding: '10px 12px', fontWeight: 900, cursor: 'pointer' }
const secondaryButton: React.CSSProperties = { marginTop: 9, border: `1px solid ${C.border}`, borderRadius: 10, background: C.surface, color: C.textPrimary, padding: '8px 10px', fontWeight: 800, cursor: 'pointer' }
const linkButton: React.CSSProperties = { border: 0, background: 'none', color: C.accent, fontWeight: 800, cursor: 'pointer', marginLeft: 8 }
const metrics: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8, marginBottom: 12 }
const contextGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8, marginTop: 10 }
const metric: React.CSSProperties = { minWidth: 0, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: 12, boxShadow: C.shadow }
const muted: React.CSSProperties = { display: 'block', color: C.textMuted, fontSize: 9.5, lineHeight: 1.45, marginTop: 3 }
const list: React.CSSProperties = { display: 'grid', gap: 8, marginTop: 10 }
const decisionRow: React.CSSProperties = { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, border: `1px solid ${C.border}`, background: C.surface, borderRadius: 12, padding: '10px 12px', color: C.textPrimary, cursor: 'pointer' }
const memoryRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', borderTop: `1px solid ${C.border}`, paddingTop: 9 }
const confidence: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: C.accent, flexShrink: 0 }
const rowHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }
const footCard: React.CSSProperties = { display: 'grid', gap: 5, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 13, color: C.textMuted, fontSize: 10, lineHeight: 1.5 }
