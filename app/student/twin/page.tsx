'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStudent } from '@/lib/student-context'
import { useTwinBrain, useTwinWorkspace } from '@/components/student/VibeTwin/TwinWorkspaceProvider'
import {
  generateAdaptivePracticeQuestion,
  getAdaptiveTeachingTurn,
  type AdaptivePracticeQuestion,
  type AdaptiveTeachingTurn,
} from '@/lib/student/twin'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'

type TutorMode = 'today' | 'explain' | 'practice' | 'exam' | 'homework' | 'revision' | 'challenge'
type TutorServiceSummary = {
  revisionPlan: Array<{ id: string; planDate: string; subject: string; topic: string; activityType: string; targetMinutes: number; priority: number; reason: string; actionUrl: string; status: string }>
  selectedIntervention: Record<string, unknown>
  capabilities: Record<string, boolean>
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
function text(value: unknown): string | null { return typeof value === 'string' ? value : null }
function num(value: unknown): number { const n = Number(value); return Number.isFinite(n) ? n : 0 }
function bool(value: unknown): boolean { return value === true }

async function getTutorServiceSummary(): Promise<TutorServiceSummary> {
  const { data, error } = await supabase.rpc('student_get_adaptive_tutor_service_summary') as { data: Json | null; error: { message?: string } | null }
  if (error) throw new Error(error.message || 'Adaptive Tutor services could not be loaded.')
  const row = record(data)
  const revisionPlan = Array.isArray(row.revision_plan) ? row.revision_plan.map(value => {
    const item = record(value)
    return {
      id: text(item.id) ?? '', planDate: text(item.plan_date) ?? '', subject: text(item.subject) ?? 'Learning',
      topic: text(item.topic) ?? 'Revision', activityType: text(item.activity_type) ?? 'revision', targetMinutes: num(item.target_minutes),
      priority: num(item.priority), reason: text(item.reason) ?? 'Scheduled from your learning evidence.', actionUrl: text(item.action_url) ?? '/student/vibelearn/revision', status: text(item.status) ?? 'planned',
    }
  }) : []
  const capabilities = Object.fromEntries(Object.entries(record(row.capabilities)).map(([key, value]) => [key, bool(value)]))
  return { revisionPlan, selectedIntervention: record(row.selected_intervention), capabilities }
}

const MODES: Array<{ id: TutorMode; label: string; hint: string }> = [
  { id: 'today', label: 'Today', hint: 'Best next action' },
  { id: 'explain', label: 'Explain', hint: 'Teach a concept' },
  { id: 'practice', label: 'Practice', hint: 'Adaptive questions' },
  { id: 'exam', label: 'Exam', hint: 'Exam readiness' },
  { id: 'homework', label: 'Homework', hint: 'Guided support' },
  { id: 'revision', label: 'Revision', hint: 'Spaced recall' },
  { id: 'challenge', label: 'Challenge', hint: 'Stretch mastery' },
]

export default function AdaptiveTutorPage() {
  const router = useRouter()
  const { identity } = useStudent()
  const { openTwin, refreshTwin } = useTwinWorkspace()
  const { state, loading: brainLoading, error: brainError } = useTwinBrain()
  const [summary, setSummary] = useState<TutorServiceSummary | null>(null)
  const [summaryError, setSummaryError] = useState('')
  const [mode, setMode] = useState<TutorMode>('today')
  const [practice, setPractice] = useState<AdaptivePracticeQuestion | null>(null)
  const [coach, setCoach] = useState<AdaptiveTeachingTurn | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void getTutorServiceSummary().then(value => { if (!cancelled) setSummary(value) }).catch(cause => { if (!cancelled) setSummaryError(cause instanceof Error ? cause.message : 'Tutor services could not be loaded.') })
    return () => { cancelled = true }
  }, [])

  const weakest = useMemo(() => [...(state?.mastery.outcomes ?? [])].sort((a, b) => a.effectiveMastery - b.effectiveMastery || b.forgettingRisk - a.forgettingRisk)[0] ?? null, [state])
  const strongest = useMemo(() => [...(state?.mastery.outcomes ?? [])].sort((a, b) => b.effectiveMastery - a.effectiveMastery)[0] ?? null, [state])
  const forgetting = useMemo(() => [...(state?.mastery.outcomes ?? [])].sort((a, b) => b.forgettingRisk - a.forgettingRisk)[0] ?? null, [state])
  const memory = state?.memory.claims.slice(0, 4) ?? []
  const next = state?.decision.now
  const evidence = state?.evidence.competencyEvidenceCount ?? 0
  const confidence = Math.round((state?.confidence ?? 0) * 100)
  const mastery = Math.round(state?.prediction.averageEffectiveMastery ?? 0)
  const risk = Math.round((state?.prediction.averageForgettingRisk ?? 0) * 100)

  async function startPractice() {
    if (busy) return
    setBusy(true); setCoach(null)
    try { setPractice(await generateAdaptivePracticeQuestion(weakest?.outcomeId ?? null)); setMode('practice') }
    catch (cause) { setSummaryError(cause instanceof Error ? cause.message : 'Practice could not be prepared.') }
    finally { setBusy(false) }
  }

  async function coachMe() {
    if (!practice || busy) return
    setBusy(true)
    try { setCoach(await getAdaptiveTeachingTurn(practice.outcomeId, coach?.nextStage ?? 0)) }
    catch (cause) { setSummaryError(cause instanceof Error ? cause.message : 'Coaching could not be prepared.') }
    finally { setBusy(false) }
  }

  if (brainLoading && !state) return <div style={{ display: 'grid', gap: 12 }}><div style={skeleton(220)} /><div style={skeleton(130)} /><div style={skeleton(260)} /></div>

  return <div style={{ display: 'grid', gap: 14, animation: 'slideIn .22s ease' }}>
    <section style={hero}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
        <div>
          <div style={eyebrow}>VIBETWIN · ADAPTIVE TUTOR</div>
          <h1 style={{ fontSize: 27, margin: '6px 0 5px', letterSpacing: -0.6 }}>Learn with a Tutor that learns you.</h1>
          <p style={heroText}>{identity?.firstName ? `${identity.firstName}, ` : ''}your Twin uses verified evidence, curriculum mastery, forgetting risk and what has worked for you before to choose the next teaching move.</p>
        </div>
        <div style={confidenceBadge}><strong>{confidence}%</strong><span>Twin confidence</span></div>
      </div>
      <div style={heroMetrics}>
        <HeroMetric label="Effective mastery" value={`${mastery}%`} />
        <HeroMetric label="Forgetting risk" value={`${risk}%`} />
        <HeroMetric label="Verified evidence" value={evidence} />
        <HeroMetric label="Study session" value={`${state?.studyTime.sessionMinutes ?? 25}m`} />
      </div>
    </section>

    {(brainError || summaryError) && <section style={{ ...card, borderColor: '#fecaca', color: '#b91c1c' }}>{brainError || summaryError}<button onClick={() => { setSummaryError(''); void refreshTwin() }} style={linkButton}>Retry</button></section>}

    <section style={card}>
      <div style={sectionTop}><div><div style={eyebrowDark}>LEARNING MODE</div><h2 style={sectionTitle}>Choose how Twin should help</h2></div><button onClick={() => openTwin('ask')} style={askButton}>Ask Twin ✦</button></div>
      <div style={modeGrid}>{MODES.map(item => <button key={item.id} onClick={() => setMode(item.id)} style={{ ...modeButton, borderColor: mode === item.id ? 'var(--vs-accent)' : 'var(--vs-border)', background: mode === item.id ? 'var(--vs-accent-soft)' : 'var(--vs-card)' }}><strong>{item.label}</strong><span>{item.hint}</span></button>)}</div>
    </section>

    <section style={{ ...card, background: 'linear-gradient(135deg,var(--vs-accent-soft),var(--vs-card))' }}>
      <div style={eyebrowDark}>WHAT SHOULD I DO NOW?</div>
      <h2 style={{ ...sectionTitle, fontSize: 22 }}>{next?.title ?? 'Build your next verified learning signal'}</h2>
      <p style={body}>{next?.reason ?? 'Twin is waiting for enough verified evidence to make a learner-specific NOW decision.'}</p>
      {(next?.reasonChain.length ?? 0) > 0 && <div style={chips}>{next?.reasonChain.map(reason => <span key={reason} style={chip}>{reason}</span>)}</div>}
      <div style={actions}>
        {next?.actionUrl && <button onClick={() => router.push(next.actionUrl!)} style={primaryButton}>{next.actionLabel ?? 'Start now'} →</button>}
        <button onClick={() => openTwin('ask')} style={secondaryButton}>Talk it through</button>
      </div>
    </section>

    <section style={grid2}>
      <div style={card}>
        <div style={eyebrowDark}>LEARNER MODEL</div>
        <h2 style={sectionTitle}>What Twin knows today</h2>
        <Signal label="Needs attention" value={weakest?.outcomeText ?? 'Waiting for evidence'} meta={weakest ? `${Math.round(weakest.effectiveMastery)}% effective mastery · ${Math.round(weakest.confidence * 100)}% confidence` : 'Complete marked work to build this signal.'} />
        <Signal label="Strongest" value={strongest?.outcomeText ?? 'Building'} meta={strongest ? `${Math.round(strongest.effectiveMastery)}% effective mastery` : 'No verified mastery yet.'} />
        <Signal label="Review before forgetting" value={forgetting?.outcomeText ?? 'No review risk yet'} meta={forgetting ? `${Math.round(forgetting.forgettingRisk * 100)}% forgetting risk` : 'Twin will schedule recall as evidence ages.'} />
      </div>
      <div style={card}>
        <div style={eyebrowDark}>TWIN MEMORY</div>
        <h2 style={sectionTitle}>Evidence-backed memory</h2>
        {memory.length === 0 ? <p style={body}>Twin has not formed durable learner claims yet. It will only remember patterns supported by evidence.</p> : <div style={{ display: 'grid', gap: 9 }}>{memory.map(claim => <div key={claim.id} style={memoryRow}><div><strong>{claim.claim}</strong><div style={muted}>{claim.evidenceCount} evidence signals · {Math.round(claim.confidence * 100)}% confidence</div></div><span style={memoryType}>{claim.permanence}</span></div>)}</div>}
      </div>
    </section>

    <section style={card}>
      <div style={sectionTop}><div><div style={eyebrowDark}>ADAPTIVE PRACTICE</div><h2 style={sectionTitle}>Right difficulty, right intervention</h2></div><button onClick={() => void startPractice()} disabled={busy} style={primarySmall}>{busy ? 'Preparing…' : practice ? 'New question' : 'Start practice'}</button></div>
      {!practice ? <p style={body}>Twin will select a curriculum outcome using mastery, forgetting risk and evidence confidence, then adjust difficulty as your state changes.</p> : <div style={practiceCard}>
        <div style={chips}><span style={chip}>{practice.difficulty}</span><span style={chip}>{practice.outcomeCode ?? 'Curriculum outcome'}</span><span style={chip}>{Math.round(practice.forgettingRisk * 100)}% forgetting risk</span></div>
        <h3 style={{ fontSize: 16, lineHeight: 1.5, marginTop: 10 }}>{practice.prompt}</h3>
        <p style={muted}>{practice.outcomeText}</p>
        {coach && <div style={coachBox}><div style={eyebrowDark}>{coach.mode.replaceAll('_', ' ')}</div><p style={{ ...body, marginTop: 5 }}>{coach.prompt}</p>{coach.intervention.interventionKey && <div style={muted}>Selected strategy: {coach.intervention.interventionKey.replaceAll('_', ' ')}</div>}</div>}
        <div style={actions}><button onClick={() => void coachMe()} disabled={busy} style={secondaryButton}>{coach ? 'Next coaching step' : 'Coach me first'}</button><button onClick={() => openTwin('ask')} style={secondaryButton}>Ask about this skill</button></div>
      </div>}
    </section>

    <section style={grid2}>
      <div style={card}><div style={eyebrowDark}>EXAM INTELLIGENCE</div><h2 style={sectionTitle}>{state?.exam.examName ?? 'Exam'} readiness</h2><div style={bigStat}>{state?.exam.daysRemaining ?? '—'}</div><div style={muted}>days remaining</div><div style={{ marginTop: 12 }}><Signal label="Target" value={state?.exam.targetGrade ?? 'Not set'} meta={`${state?.exam.dailyRevisionMinutes ?? 90} recommended revision minutes/day`} /></div><button onClick={() => router.push('/student/vibelearn/exams')} style={secondaryButton}>Open exams</button></div>
      <div style={card}><div style={eyebrowDark}>REVISION QUEUE</div><h2 style={sectionTitle}>Next 7 days</h2>{(summary?.revisionPlan.length ?? 0) === 0 ? <p style={body}>No planned spaced-revision item is active yet.</p> : <div style={{ display: 'grid', gap: 8 }}>{summary?.revisionPlan.slice(0, 4).map(item => <button key={item.id} onClick={() => router.push(item.actionUrl)} style={revisionRow}><span><strong>{item.subject}</strong><small>{item.topic} · {item.targetMinutes} min</small></span><span>→</span></button>)}</div>}<button onClick={() => router.push('/student/vibelearn/revision')} style={{ ...secondaryButton, marginTop: 10 }}>Open revision</button></div>
    </section>

    <section style={card}>
      <div style={eyebrowDark}>WHY TWIN CHOSE THIS</div><h2 style={sectionTitle}>Transparent adaptation</h2>
      <div style={capGrid}>{Object.entries(summary?.capabilities ?? {}).filter(([, enabled]) => enabled).slice(0, 12).map(([name]) => <span key={name} style={capability}>✓ {name.replaceAll('_', ' ')}</span>)}</div>
      <p style={{ ...body, marginTop: 12 }}>Twin never treats a single chat message as durable truth. Its learner model is built from verified tasks, assessments, curriculum evidence, repeated mistakes, intervention outcomes and calibrated confidence.</p>
    </section>

    <section style={quickGrid}>
      <Quick title="Read with Twin" body="Open VibeLearn, highlight content and ask for an explanation or practice." onClick={() => router.push('/student/vibelearn')} />
      <Quick title="Homework coach" body="Get guidance without silently replacing teacher authority or fabricating completion." onClick={() => router.push('/student/tasks')} />
      <Quick title="Review mistakes" body="Turn errors into misconception recovery and targeted revision." onClick={() => router.push('/student/vibelearn/revision')} />
      <Quick title="Ask anything" body="Use the bounded Tutor with your current learner model already in context." onClick={() => openTwin('ask')} />
    </section>
  </div>
}

function HeroMetric({ label, value }: { label: string; value: string | number }) { return <div style={heroMetric}><strong>{value}</strong><span>{label}</span></div> }
function Signal({ label, value, meta }: { label: string; value: string; meta: string }) { return <div style={signal}><div style={eyebrowDark}>{label}</div><strong>{value}</strong><div style={muted}>{meta}</div></div> }
function Quick({ title, body, onClick }: { title: string; body: string; onClick: () => void }) { return <button onClick={onClick} style={quick}><strong>{title}</strong><span>{body}</span><b>Open →</b></button> }
function skeleton(h: number): React.CSSProperties { return { height: h, borderRadius: 18, background: 'linear-gradient(90deg,var(--vs-card),var(--vs-accent-soft),var(--vs-card))', backgroundSize: '200% 100%', animation: 'shimmer 1.3s infinite' } }

const hero: React.CSSProperties = { borderRadius: 24, padding: 22, background: 'linear-gradient(135deg,#111827,#312e81 58%,#5b21b6)', color: '#fff', boxShadow: '0 18px 50px rgba(49,46,129,.22)' }
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 900, letterSpacing: 1.15, color: '#c4b5fd' }
const eyebrowDark: React.CSSProperties = { fontSize: 10, fontWeight: 900, letterSpacing: 1.05, color: 'var(--vs-accent)', textTransform: 'uppercase' }
const heroText: React.CSSProperties = { color: '#ddd6fe', fontSize: 13, lineHeight: 1.65, maxWidth: 580 }
const confidenceBadge: React.CSSProperties = { minWidth: 96, padding: 12, borderRadius: 16, background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.15)', display: 'grid', gap: 2, textAlign: 'right' }
const heroMetrics: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8, marginTop: 18 }
const heroMetric: React.CSSProperties = { display: 'grid', gap: 3, padding: 11, borderRadius: 13, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.09)' }
const card: React.CSSProperties = { background: 'var(--vs-card)', border: '1px solid var(--vs-border)', borderRadius: 18, padding: 16, boxShadow: '0 8px 26px rgba(15,15,26,.06)' }
const sectionTop: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }
const sectionTitle: React.CSSProperties = { fontSize: 18, margin: '5px 0 10px', letterSpacing: -.2 }
const body: React.CSSProperties = { fontSize: 12.5, lineHeight: 1.65, color: 'var(--vs-muted)' }
const muted: React.CSSProperties = { fontSize: 11, lineHeight: 1.5, color: 'var(--vs-muted)' }
const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(270px,1fr))', gap: 14 }
const modeGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(105px,1fr))', gap: 8 }
const modeButton: React.CSSProperties = { minHeight: 70, padding: 10, border: '1px solid var(--vs-border)', borderRadius: 13, color: 'var(--vs-text)', display: 'grid', gap: 4, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }
const askButton: React.CSSProperties = { border: 0, borderRadius: 12, padding: '10px 13px', background: 'var(--vs-accent)', color: '#fff', fontWeight: 900, cursor: 'pointer' }
const actions: React.CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 13 }
const primaryButton: React.CSSProperties = { border: 0, borderRadius: 12, padding: '11px 14px', background: 'var(--vs-accent)', color: '#fff', fontWeight: 900, cursor: 'pointer' }
const primarySmall: React.CSSProperties = { ...primaryButton, padding: '9px 11px', fontSize: 11 }
const secondaryButton: React.CSSProperties = { border: '1px solid var(--vs-border)', borderRadius: 11, padding: '10px 12px', background: 'var(--vs-card)', color: 'var(--vs-text)', fontWeight: 800, cursor: 'pointer' }
const linkButton: React.CSSProperties = { marginLeft: 10, border: 0, background: 'transparent', color: 'var(--vs-accent)', fontWeight: 850, cursor: 'pointer' }
const chips: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }
const chip: React.CSSProperties = { fontSize: 9.5, padding: '5px 7px', borderRadius: 999, background: 'var(--vs-accent-soft)', color: 'var(--vs-accent)', fontWeight: 800 }
const signal: React.CSSProperties = { padding: '11px 0', borderTop: '1px solid var(--vs-border)', display: 'grid', gap: 4 }
const memoryRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 10, padding: 10, borderRadius: 12, background: 'var(--vs-accent-soft)' }
const memoryType: React.CSSProperties = { fontSize: 9, color: 'var(--vs-accent)', fontWeight: 900, textTransform: 'uppercase' }
const practiceCard: React.CSSProperties = { padding: 14, borderRadius: 14, border: '1px solid var(--vs-border)', background: 'var(--vs-bg)' }
const coachBox: React.CSSProperties = { marginTop: 11, padding: 11, borderRadius: 12, background: 'var(--vs-accent-soft)', border: '1px solid var(--vs-border)' }
const bigStat: React.CSSProperties = { fontSize: 40, fontWeight: 950, letterSpacing: -1.5, color: 'var(--vs-accent)' }
const revisionRow: React.CSSProperties = { border: '1px solid var(--vs-border)', borderRadius: 11, background: 'var(--vs-card)', color: 'var(--vs-text)', padding: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', cursor: 'pointer' }
const capGrid: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 7 }
const capability: React.CSSProperties = { fontSize: 10.5, padding: '6px 8px', borderRadius: 999, background: 'var(--vs-accent-soft)', color: 'var(--vs-accent)', fontWeight: 750 }
const quickGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 }
const quick: React.CSSProperties = { minHeight: 135, border: '1px solid var(--vs-border)', borderRadius: 17, background: 'var(--vs-card)', color: 'var(--vs-text)', padding: 15, textAlign: 'left', display: 'grid', alignContent: 'space-between', gap: 9, cursor: 'pointer', fontFamily: 'inherit' }
