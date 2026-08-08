'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStudent } from '@/lib/student-context'
import { useTwinBrain } from '@/components/student/VibeTwin/TwinWorkspaceProvider'
import VibeTwin from '@/components/student/VibeTwin'
import {
  answerAdaptivePracticeQuestion,
  generateAdaptivePracticeQuestion,
  getAdaptiveTeachingTurn,
  type AdaptivePracticeQuestion,
  type AdaptiveTeachingTurn,
} from '@/lib/student/twin'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'

type Layer = 'now' | 'learn' | 'grow'
type TutorMode = 'explain' | 'practice' | 'homework' | 'revision' | 'exam' | 'challenge'
type Pace = 'gentle' | 'steady' | 'fast'
type TutorServiceSummary = {
  revisionPlan: Array<{ id: string; planDate: string; subject: string; topic: string; activityType: string; targetMinutes: number; priority: number; reason: string; actionUrl: string; status: string }>
  capabilities: Record<string, boolean>
}
type RpcResult<T> = { data: T | null; error: { message?: string } | null }
type Rpc = <T>(name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult<T>>
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc

function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {} }
function text(value: unknown): string | null { return typeof value === 'string' ? value : null }
function num(value: unknown): number { const n = Number(value); return Number.isFinite(n) ? n : 0 }
function bool(value: unknown): boolean { return value === true }
function cleanLearningText(value: string | null | undefined): string {
  return (value ?? '').replace(/^\s*\[SYNTHETIC TWIN TEST\]\s*/i, '').replace(/^\s*TWIN-SEED-[A-Z0-9-]+\s*[:·-]?\s*/i, '').trim()
}

async function getTutorServiceSummary(): Promise<TutorServiceSummary> {
  const { data, error } = await rpc<Json>('student_get_adaptive_tutor_service_summary')
  if (error) throw new Error(error.message || 'Adaptive Tutor services could not be loaded.')
  const row = record(data)
  const revisionPlan = Array.isArray(row.revision_plan) ? row.revision_plan.map(value => {
    const item = record(value)
    return {
      id: text(item.id) ?? '', planDate: text(item.plan_date) ?? '', subject: text(item.subject) ?? 'Learning',
      topic: cleanLearningText(text(item.topic) ?? 'Revision'), activityType: text(item.activity_type) ?? 'revision',
      targetMinutes: num(item.target_minutes), priority: num(item.priority), reason: text(item.reason) ?? 'Scheduled from your learning evidence.',
      actionUrl: text(item.action_url) ?? '/student/vibelearn/revision', status: text(item.status) ?? 'planned',
    }
  }) : []
  const capabilities = Object.fromEntries(Object.entries(record(row.capabilities)).map(([key, value]) => [key, bool(value)]))
  return { revisionPlan, capabilities }
}

const MODES: Array<{ id: TutorMode; label: string; detail: string }> = [
  { id: 'explain', label: 'Explain', detail: 'Learn it step by step' },
  { id: 'practice', label: 'Practice', detail: 'Adaptive questions' },
  { id: 'homework', label: 'Homework', detail: 'Guided, not copied' },
  { id: 'revision', label: 'Revision', detail: 'Recall before forgetting' },
  { id: 'exam', label: 'Exam', detail: 'Prepare under pressure' },
  { id: 'challenge', label: 'Challenge', detail: 'Stretch what you know' },
]
const PACE: Record<Pace, { label: string; multiplier: number; copy: string }> = {
  gentle: { label: 'Gentle', multiplier: .7, copy: 'More explanation, fewer steps at once.' },
  steady: { label: 'Steady', multiplier: 1, copy: 'Balanced explanation and practice.' },
  fast: { label: 'Fast', multiplier: 1.3, copy: 'Skip what is already secure and move faster.' },
}

export default function VibeTwinLearningOS() {
  const router = useRouter()
  const { identity } = useStudent()
  const { state, loading, error, refresh } = useTwinBrain()
  const [summary, setSummary] = useState<TutorServiceSummary | null>(null)
  const [layer, setLayer] = useState<Layer>('now')
  const [mode, setMode] = useState<TutorMode>('practice')
  const [pace, setPace] = useState<Pace>('steady')
  const [practice, setPractice] = useState<AdaptivePracticeQuestion | null>(null)
  const [coach, setCoach] = useState<AdaptiveTeachingTurn | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [note, setNote] = useState('')
  const [noteStatus, setNoteStatus] = useState('')

  useEffect(() => {
    let cancelled = false
    void getTutorServiceSummary().then(value => { if (!cancelled) setSummary(value) }).catch(() => undefined)
    return () => { cancelled = true }
  }, [])

  const outcomes = state?.mastery.outcomes ?? []
  const weakest = useMemo(() => [...outcomes].sort((a, b) => a.effectiveMastery - b.effectiveMastery || b.forgettingRisk - a.forgettingRisk)[0] ?? null, [outcomes])
  const strongest = useMemo(() => [...outcomes].sort((a, b) => b.effectiveMastery - a.effectiveMastery)[0] ?? null, [outcomes])
  const forgetting = useMemo(() => [...outcomes].sort((a, b) => b.forgettingRisk - a.forgettingRisk)[0] ?? null, [outcomes])
  const now = state?.decision.now
  const confidence = Math.round((state?.confidence ?? 0) * 100)
  const mastery = Math.round(state?.prediction.averageEffectiveMastery ?? 0)
  const risk = Math.round((state?.prediction.averageForgettingRisk ?? 0) * 100)
  const baseMinutes = state?.studyTime.sessionMinutes ?? 25
  const sessionMinutes = Math.max(10, Math.round(baseMinutes * PACE[pace].multiplier))

  async function startPractice(outcomeId?: string | null) {
    if (busy) return
    setBusy(true); setFeedback(null); setCoach(null)
    try {
      setPractice(await generateAdaptivePracticeQuestion(outcomeId ?? weakest?.outcomeId ?? null))
      setMode('practice'); setLayer('learn')
    } catch {
      setFeedback('I could not prepare a new question right now. Your learning state is safe; try again or use coaching mode.')
    } finally { setBusy(false) }
  }

  async function coachMe() {
    if (!practice || busy) return
    setBusy(true)
    try { setCoach(await getAdaptiveTeachingTurn(practice.outcomeId, coach?.nextStage ?? 0)) }
    catch { setFeedback('Coaching is temporarily limited. Try the next question or ask Twin to explain the skill in another way.') }
    finally { setBusy(false) }
  }

  async function answer(index: number) {
    if (!practice || busy) return
    setBusy(true); setFeedback(null)
    try {
      const result = await answerAdaptivePracticeQuestion({ questionId: practice.id, selectedIndex: index })
      const delta = result.effectiveMasteryAfter == null ? '' : ` Your effective mastery is now ${Math.round(result.effectiveMasteryAfter)}%.`
      setFeedback(result.correct ? `Correct. ${result.explanation}${delta}` : `Not yet. ${result.explanation}${delta}`)
      setPractice(result.nextQuestion); setCoach(null); await refresh()
    } catch { setFeedback('I could not record that answer. Keep your reasoning; your verified learning record was not changed.') }
    finally { setBusy(false) }
  }

  async function saveNote() {
    const value = note.trim(); if (!value) return
    setNoteStatus('Saving…')
    const subject = now?.subject ?? 'Learning'
    const topic = cleanLearningText(practice?.outcomeText ?? weakest?.outcomeText ?? now?.title ?? 'Current learning')
    const { error: noteError } = await rpc<Json>('student_save_topic_note', { p_subject: subject, p_topic: topic, p_note_text: value })
    setNoteStatus(noteError ? 'Could not save note.' : 'Saved to your learning notebook.')
    if (!noteError) setNote('')
  }

  function selectMode(nextMode: TutorMode) {
    setMode(nextMode); setLayer('learn')
    if (nextMode === 'practice' || nextMode === 'challenge') void startPractice()
    if (nextMode === 'homework') router.push('/student/tasks')
    if (nextMode === 'revision') router.push('/student/vibelearn/revision')
    if (nextMode === 'exam') router.push('/student/vibelearn/exams')
    if (nextMode === 'explain') setChatOpen(true)
  }

  if (loading && !state) return <main style={shell}><div style={loadingCard}>Preparing your learning journey…</div></main>

  return <main style={shell}>
    <header style={topbar}>
      <div><div style={brand}>✦ VibeTwin</div><div style={subtitle}>{identity?.firstName ? `${identity.firstName}'s learning journey` : 'Your learning journey'}</div></div>
      <div style={confidencePill}>{confidence}% confidence</div>
    </header>

    <nav aria-label="VibeTwin workspace" style={layerNav}>
      {(['now','learn','grow'] as Layer[]).map(item => <button key={item} onClick={() => setLayer(item)} aria-pressed={layer === item} style={{ ...layerButton, ...(layer === item ? layerButtonActive : {}) }}>{item === 'now' ? 'Now' : item === 'learn' ? 'Learn' : 'Grow'}</button>)}
    </nav>

    {error && <div role="status" style={degraded}>Twin is in limited mode. The rest of your learning workspace still works. <button style={textButton} onClick={() => void refresh()}>Try again</button></div>}

    {layer === 'now' && <div style={stack}>
      <section style={hero}>
        <div style={eyebrow}>YOUR NEXT BEST MOVE</div>
        <h1 style={heroTitle}>{cleanLearningText(now?.title) || 'Let’s build your next learning signal'}</h1>
        <p style={heroBody}>{now?.reason ?? 'I am waiting for enough verified evidence to choose a learner-specific next step.'}</p>
        {(now?.reasonChain.length ?? 0) > 0 && <div style={chips}>{now?.reasonChain.map(reason => <span key={reason} style={chip}>{reason}</span>)}</div>}
        <div style={actions}>{now?.actionUrl && <button style={primary} onClick={() => router.push(now.actionUrl!)}>{now.actionLabel ?? 'Start now'} →</button>}<button style={secondary} onClick={() => setChatOpen(true)}>Talk it through</button></div>
      </section>

      <section style={card}>
        <div style={sectionHead}><div><div style={eyebrowDark}>LEARN AT YOUR PACE</div><h2 style={sectionTitle}>{sessionMinutes}-minute session</h2></div><span style={muted}>{PACE[pace].copy}</span></div>
        <div style={paceRow}>{(Object.keys(PACE) as Pace[]).map(item => <button key={item} onClick={() => setPace(item)} style={{ ...paceButton, ...(pace === item ? paceButtonActive : {}) }}>{PACE[item].label}</button>)}</div>
        <div style={sessionFlow}><Step n="1" label="Understand" /><Step n="2" label="Try" /><Step n="3" label="Reflect" /><Step n="4" label="Revisit" /></div>
      </section>

      <section style={card}><div style={eyebrowDark}>CHOOSE HOW TO LEARN</div><div style={modeGrid}>{MODES.map(item => <button key={item.id} onClick={() => selectMode(item.id)} style={modeButton}><strong>{item.label}</strong><span>{item.detail}</span></button>)}</div></section>
    </div>}

    {layer === 'learn' && <div style={stack}>
      <section style={learnHero}><div><div style={eyebrow}>CURRENT FOCUS</div><h2 style={heroTitle}>{cleanLearningText(practice?.outcomeText ?? weakest?.outcomeText) || 'Choose a skill to begin'}</h2><p style={heroBody}>Twin will slow down, speed up, reteach prerequisites, or increase difficulty based on your verified responses.</p></div><button style={primary} onClick={() => void startPractice()}>{busy ? 'Preparing…' : practice ? 'New question' : 'Start adaptive practice'}</button></section>

      {practice && <section style={card}>
        <div style={chips}><span style={chip}>{practice.difficulty}</span><span style={chip}>{Math.round(practice.forgettingRisk * 100)}% forgetting risk</span></div>
        <h3 style={question}>{cleanLearningText(practice.prompt)}</h3>
        {coach && <div style={coachBox}><div style={eyebrowDark}>{coach.mode.replaceAll('_',' ')}</div><p style={body}>{coach.prompt}</p></div>}
        <div style={optionGrid}>{practice.options.map((option, index) => <button key={`${practice.id}-${index}`} disabled={busy} onClick={() => void answer(index)} style={optionButton}><strong>{String.fromCharCode(65 + index)}.</strong> {cleanLearningText(option)}</button>)}</div>
        <div style={actions}><button style={secondary} onClick={() => void coachMe()} disabled={busy}>{coach ? 'Next hint' : 'Coach me first'}</button><button style={secondary} onClick={() => setChatOpen(true)}>Explain another way</button></div>
        {feedback && <div role="status" style={feedbackBox}>{feedback}</div>}
      </section>}

      <section style={card}><div style={eyebrowDark}>MY LEARNING NOTEBOOK</div><h2 style={sectionTitle}>Capture what finally made sense</h2><textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Write the idea in your own words…" style={noteBox} /><div style={actions}><button style={primarySmall} onClick={() => void saveNote()} disabled={!note.trim()}>Save note</button><button style={secondary} onClick={() => router.push('/student/vibelearn/mistakes')}>Review my mistakes</button></div>{noteStatus && <div style={muted}>{noteStatus}</div>}</section>
    </div>}

    {layer === 'grow' && <div style={stack}>
      <section style={metrics}><Metric label="Effective mastery" value={`${mastery}%`} /><Metric label="Forgetting risk" value={`${risk}%`} /><Metric label="Evidence" value={state?.evidence.competencyEvidenceCount ?? 0} /><Metric label="Streak" value={`${state?.streak.current ?? 0}d`} /></section>
      <section style={grid2}>
        <div style={card}><div style={eyebrowDark}>MASTERY MAP</div><Signal label="Needs attention" value={cleanLearningText(weakest?.outcomeText) || 'Building'} meta={weakest ? `${Math.round(weakest.effectiveMastery)}% mastery · ${Math.round(weakest.confidence * 100)}% confidence` : 'More evidence needed'} /><Signal label="Strongest" value={cleanLearningText(strongest?.outcomeText) || 'Building'} meta={strongest ? `${Math.round(strongest.effectiveMastery)}% mastery` : 'More evidence needed'} /><Signal label="Review before forgetting" value={cleanLearningText(forgetting?.outcomeText) || 'No urgent review'} meta={forgetting ? `${Math.round(forgetting.forgettingRisk * 100)}% forgetting risk` : 'Twin will schedule recall as evidence ages'} /></div>
        <div style={card}><div style={eyebrowDark}>WHAT TWIN REMEMBERS</div>{(state?.memory.claims ?? []).slice(0,4).map(claim => <div key={claim.id} style={memoryRow}><strong>{cleanLearningText(claim.claim)}</strong><span style={muted}>{claim.evidenceCount} signals · {Math.round(claim.confidence * 100)}% confidence</span></div>)}{(state?.memory.claims.length ?? 0) === 0 && <p style={body}>Twin only forms durable memory when evidence supports it.</p>}</div>
      </section>
      <section style={card}><div style={eyebrowDark}>REVISION TIMELINE</div>{(summary?.revisionPlan ?? []).slice(0,5).map(item => <button key={item.id} style={timelineItem} onClick={() => router.push(item.actionUrl)}><div><strong>{cleanLearningText(item.topic)}</strong><div style={muted}>{item.subject} · {item.targetMinutes} min</div></div><span>→</span></button>)}{(summary?.revisionPlan.length ?? 0) === 0 && <p style={body}>Your spaced-revision timeline will appear as Twin gathers enough evidence.</p>}</section>
    </div>}

    <button style={askDock} onClick={() => setChatOpen(true)}>✦ Ask Twin anything about what you are learning</button>
    <VibeTwin isOpen={chatOpen} onClose={() => setChatOpen(false)} userName={identity?.firstName ?? 'Learner'} learnerState={state} />
  </main>
}

function Step({ n, label }: { n: string; label: string }) { return <div style={step}><span>{n}</span><strong>{label}</strong></div> }
function Metric({ label, value }: { label: string; value: string | number }) { return <div style={metric}><strong>{value}</strong><span>{label}</span></div> }
function Signal({ label, value, meta }: { label: string; value: string; meta: string }) { return <div style={signal}><span style={eyebrowDark}>{label}</span><strong>{value}</strong><small>{meta}</small></div> }

const shell: React.CSSProperties = { display:'grid', gap:14, paddingBottom:110, maxWidth:1100, margin:'0 auto' }
const topbar: React.CSSProperties = { position:'sticky', top:0, zIndex:20, margin:'0 -16px', padding:'14px 16px', display:'flex', justifyContent:'space-between', gap:12, alignItems:'center', background:'color-mix(in srgb, var(--vs-bg) 92%, transparent)', backdropFilter:'blur(16px)', borderBottom:'1px solid var(--vs-border)' }
const brand: React.CSSProperties = { fontSize:22, fontWeight:950, letterSpacing:-.5 }
const subtitle: React.CSSProperties = { marginTop:2, fontSize:11.5, color:'var(--vs-muted)' }
const confidencePill: React.CSSProperties = { padding:'7px 10px', borderRadius:999, background:'var(--vs-accent-soft)', color:'var(--vs-accent)', fontSize:10.5, fontWeight:850 }
const layerNav: React.CSSProperties = { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, padding:5, borderRadius:16, background:'var(--vs-surface)', border:'1px solid var(--vs-border)', position:'sticky', top:67, zIndex:15 }
const layerButton: React.CSSProperties = { border:0, borderRadius:12, padding:'11px 8px', background:'transparent', color:'var(--vs-muted)', fontWeight:850, cursor:'pointer' }
const layerButtonActive: React.CSSProperties = { background:'var(--vs-accent)', color:'white', boxShadow:'0 8px 20px rgba(91,78,232,.25)' }
const stack: React.CSSProperties = { display:'grid', gap:14 }
const hero: React.CSSProperties = { borderRadius:26, padding:'24px 20px', background:'linear-gradient(140deg,#201a63,#5b4ee8 58%,#7b72ff)', color:'white', boxShadow:'0 18px 50px rgba(91,78,232,.24)' }
const learnHero: React.CSSProperties = { ...hero, display:'flex', justifyContent:'space-between', gap:18, alignItems:'center', flexWrap:'wrap' }
const heroTitle: React.CSSProperties = { margin:'6px 0 8px', fontSize:'clamp(24px,5vw,38px)', lineHeight:1.06, letterSpacing:-1.1 }
const heroBody: React.CSSProperties = { margin:0, lineHeight:1.6, color:'rgba(255,255,255,.82)', maxWidth:720 }
const eyebrow: React.CSSProperties = { fontSize:10.5, fontWeight:900, letterSpacing:1.4, textTransform:'uppercase', opacity:.78 }
const eyebrowDark: React.CSSProperties = { fontSize:10, fontWeight:900, letterSpacing:1.15, textTransform:'uppercase', color:'var(--vs-muted)' }
const card: React.CSSProperties = { border:'1px solid var(--vs-border)', background:'var(--vs-card)', borderRadius:22, padding:18, boxShadow:'0 10px 28px rgba(15,15,26,.07)' }
const sectionHead: React.CSSProperties = { display:'flex', justifyContent:'space-between', gap:12, alignItems:'flex-start', flexWrap:'wrap' }
const sectionTitle: React.CSSProperties = { margin:'5px 0 8px', fontSize:19, letterSpacing:-.3 }
const body: React.CSSProperties = { color:'var(--vs-muted)', lineHeight:1.6 }
const muted: React.CSSProperties = { color:'var(--vs-muted)', fontSize:11.5, lineHeight:1.5 }
const chips: React.CSSProperties = { display:'flex', gap:7, flexWrap:'wrap', marginTop:12 }
const chip: React.CSSProperties = { borderRadius:999, padding:'5px 8px', background:'rgba(255,255,255,.12)', fontSize:10, fontWeight:800 }
const actions: React.CSSProperties = { display:'flex', gap:9, flexWrap:'wrap', marginTop:14 }
const primary: React.CSSProperties = { border:0, borderRadius:14, padding:'12px 16px', background:'var(--vs-accent)', color:'white', fontWeight:900, cursor:'pointer' }
const primarySmall: React.CSSProperties = { ...primary, padding:'9px 12px', fontSize:12 }
const secondary: React.CSSProperties = { border:'1px solid var(--vs-border)', borderRadius:14, padding:'11px 14px', background:'var(--vs-card)', color:'var(--vs-text)', fontWeight:800, cursor:'pointer' }
const textButton: React.CSSProperties = { border:0, background:'transparent', color:'inherit', textDecoration:'underline', cursor:'pointer', fontWeight:800 }
const degraded: React.CSSProperties = { border:'1px solid #f59e0b', background:'#fffbeb', color:'#92400e', borderRadius:14, padding:'10px 12px', fontSize:12 }
const paceRow: React.CSSProperties = { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginTop:12 }
const paceButton: React.CSSProperties = { border:'1px solid var(--vs-border)', borderRadius:12, padding:'10px', background:'var(--vs-card)', color:'var(--vs-text)', fontWeight:800, cursor:'pointer' }
const paceButtonActive: React.CSSProperties = { borderColor:'var(--vs-accent)', background:'var(--vs-accent-soft)', color:'var(--vs-accent)' }
const sessionFlow: React.CSSProperties = { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginTop:14 }
const step: React.CSSProperties = { display:'grid', gap:4, padding:'10px 8px', borderRadius:12, background:'var(--vs-surface)', textAlign:'center', fontSize:11 }
const modeGrid: React.CSSProperties = { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(145px,1fr))', gap:9, marginTop:12 }
const modeButton: React.CSSProperties = { display:'grid', gap:3, textAlign:'left', border:'1px solid var(--vs-border)', borderRadius:15, padding:13, background:'var(--vs-card)', color:'var(--vs-text)', cursor:'pointer' }
const question: React.CSSProperties = { fontSize:18, lineHeight:1.55, margin:'14px 0' }
const coachBox: React.CSSProperties = { padding:14, borderRadius:15, background:'var(--vs-accent-soft)', border:'1px solid var(--vs-accent)' }
const optionGrid: React.CSSProperties = { display:'grid', gap:9, marginTop:14 }
const optionButton: React.CSSProperties = { textAlign:'left', border:'1px solid var(--vs-border)', borderRadius:14, padding:'13px 14px', background:'var(--vs-surface)', color:'var(--vs-text)', cursor:'pointer', lineHeight:1.5 }
const feedbackBox: React.CSSProperties = { marginTop:12, borderRadius:14, padding:13, background:'var(--vs-accent-soft)', lineHeight:1.55, fontSize:12.5 }
const noteBox: React.CSSProperties = { width:'100%', minHeight:100, resize:'vertical', border:'1px solid var(--vs-border)', borderRadius:14, padding:13, background:'var(--vs-surface)', color:'var(--vs-text)', font:'inherit', lineHeight:1.5, boxSizing:'border-box' }
const metrics: React.CSSProperties = { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:9 }
const metric: React.CSSProperties = { ...card, display:'grid', gap:3, textAlign:'center', padding:14 }
const grid2: React.CSSProperties = { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:14 }
const signal: React.CSSProperties = { display:'grid', gap:5, padding:'12px 0', borderBottom:'1px solid var(--vs-border)' }
const memoryRow: React.CSSProperties = { display:'grid', gap:4, padding:'11px 0', borderBottom:'1px solid var(--vs-border)' }
const timelineItem: React.CSSProperties = { width:'100%', border:0, borderBottom:'1px solid var(--vs-border)', background:'transparent', color:'var(--vs-text)', padding:'12px 0', display:'flex', justifyContent:'space-between', alignItems:'center', textAlign:'left', cursor:'pointer' }
const askDock: React.CSSProperties = { position:'fixed', left:'max(16px,calc((100vw - 1100px)/2 + 16px))', right:16, bottom:'calc(76px + env(safe-area-inset-bottom))', zIndex:25, border:0, borderRadius:18, padding:'14px 16px', background:'var(--vs-accent)', color:'white', fontWeight:900, boxShadow:'0 14px 36px rgba(91,78,232,.3)', cursor:'pointer' }
const loadingCard: React.CSSProperties = { ...card, textAlign:'center', padding:40, color:'var(--vs-muted)' }
