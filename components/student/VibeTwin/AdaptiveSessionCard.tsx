'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'
import { useTwinBrain } from './TwinWorkspaceProvider'

type Pace = 'gentle' | 'steady' | 'fast'
type SessionStatus = 'planned' | 'active' | 'completed'
type SessionPlan = {
  id: string
  recommendedPace: Pace
  chosenPace: Pace
  plannedMinutes: number
  reason: string
  status: SessionStatus
  resumed: boolean
}
type RpcResult<T> = { data: T | null; error: { message?: string } | null }
type Rpc = <T>(name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult<T>>
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc

const COPY: Record<Pace, string> = {
  gentle: 'More explanation and smaller steps.',
  steady: 'Balanced explanation, practice and recall.',
  fast: 'Move quickly through what is already secure.',
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
function asText(value: unknown): string { return typeof value === 'string' ? value : '' }
function asNumber(value: unknown): number { const n = Number(value); return Number.isFinite(n) ? n : 0 }
function asPace(value: unknown): Pace { return value === 'gentle' || value === 'fast' ? value : 'steady' }
function asStatus(value: unknown): SessionStatus { return value === 'active' || value === 'completed' ? value : 'planned' }
function parsePlan(value: unknown): SessionPlan {
  const row = asRecord(value)
  return {
    id: asText(row.id),
    recommendedPace: asPace(row.recommended_pace),
    chosenPace: asPace(row.chosen_pace),
    plannedMinutes: asNumber(row.planned_minutes) || 25,
    reason: asText(row.reason) || 'Twin is balancing your current mastery, forgetting risk and available study time.',
    status: asStatus(row.status),
    resumed: row.resumed === true,
  }
}

export default function AdaptiveSessionCard() {
  const { refresh } = useTwinBrain()
  const [plan, setPlan] = useState<SessionPlan | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    void planSession(null).then(value => { if (!cancelled) setPlan(value) }).catch(() => { if (!cancelled) setMessage('Twin could not plan this session. You can still continue learning normally.') })
    return () => { cancelled = true }
  }, [])

  async function planSession(pace: Pace | null): Promise<SessionPlan> {
    const { data, error } = await rpc<Json>('student_plan_adaptive_session', { p_pace_override: pace, p_mode: 'practice' })
    if (error) throw new Error(error.message || 'Session planning failed.')
    return parsePlan(data)
  }

  async function choosePace(pace: Pace) {
    if (busy || plan?.status === 'active') return
    setBusy(true); setMessage('')
    try { setPlan(await planSession(pace)) }
    catch { setMessage('That pace could not be saved. Your previous plan is still safe.') }
    finally { setBusy(false) }
  }

  async function startSession() {
    if (!plan || busy || plan.status !== 'planned') return
    setBusy(true); setMessage('')
    const { error } = await rpc<Json>('student_start_adaptive_session', { p_session_id: plan.id })
    if (error) setMessage('The session could not start. Try again; your learning record is safe.')
    else { setPlan({ ...plan, status: 'active' }); setMessage('Session started. Twin will adapt as you work.') }
    setBusy(false)
  }

  async function finishSession() {
    if (!plan || busy || plan.status !== 'active') return
    setBusy(true); setMessage('')
    const { data, error } = await rpc<Json>('student_complete_adaptive_session', { p_session_id: plan.id, p_reflection: null })
    if (error) setMessage('Twin could not close the session yet. Keep learning; no verified evidence was lost.')
    else {
      const row = asRecord(data)
      const before = asNumber(row.evidence_count_before)
      const after = asNumber(row.evidence_count_after)
      setPlan({ ...plan, status: 'completed' })
      setMessage(after > before ? `Session complete. Twin observed ${after - before} new verified evidence signal${after - before === 1 ? '' : 's'}.` : 'Session complete. Twin recorded the session without inventing new mastery evidence.')
      await refresh()
    }
    setBusy(false)
  }

  if (!plan) return <section style={card}><div style={eyebrow}>LEARN AT YOUR PACE</div><h2 style={title}>Planning your session…</h2><p style={muted}>{message || 'Twin is checking mastery, forgetting risk and study time.'}</p></section>

  const locked = plan.status === 'active' || plan.status === 'completed'
  return <section style={card}>
    <div style={head}>
      <div><div style={eyebrow}>LEARN AT YOUR PACE</div><h2 style={title}>{plan.plannedMinutes}-minute session</h2></div>
      <span style={badge}>{plan.status === 'active' ? 'In progress' : plan.status === 'completed' ? 'Completed' : plan.resumed ? 'Resumed' : 'Twin planned'}</span>
    </div>
    <p style={body}>{plan.reason}</p>
    <div style={recommendation}>Twin recommends <strong>{plan.recommendedPace}</strong>. You chose <strong>{plan.chosenPace}</strong>.</div>
    <div style={paceRow}>{(['gentle','steady','fast'] as Pace[]).map(pace => <button key={pace} disabled={busy || locked} onClick={() => void choosePace(pace)} style={{ ...paceButton, ...(plan.chosenPace === pace ? activePace : {}), ...(busy || locked ? disabled : {}) }}><strong>{pace[0].toUpperCase()+pace.slice(1)}</strong><span>{COPY[pace]}</span></button>)}</div>
    <div style={flow}><Step n="1" label="Understand" /><Step n="2" label="Try" /><Step n="3" label="Reflect" /><Step n="4" label="Revisit" /></div>
    <div style={actions}>
      {plan.status === 'planned' && <button style={primary} disabled={busy} onClick={() => void startSession()}>{busy ? 'Starting…' : 'Start this session'}</button>}
      {plan.status === 'active' && <button style={primary} disabled={busy} onClick={() => void finishSession()}>{busy ? 'Finishing…' : 'Finish session'}</button>}
      {plan.status === 'completed' && <span style={done}>✓ Session recorded</span>}
    </div>
    {message && <div role="status" style={status}>{message}</div>}
  </section>
}

function Step({ n, label }: { n: string; label: string }) { return <div style={step}><span>{n}</span><strong>{label}</strong></div> }

const card: CSSProperties = { border:'1px solid var(--vs-border)', background:'var(--vs-card)', borderRadius:22, padding:18, boxShadow:'0 10px 28px rgba(15,15,26,.07)' }
const head: CSSProperties = { display:'flex', justifyContent:'space-between', gap:12, alignItems:'flex-start', flexWrap:'wrap' }
const eyebrow: CSSProperties = { fontSize:10, fontWeight:900, letterSpacing:1.15, textTransform:'uppercase', color:'var(--vs-muted)' }
const title: CSSProperties = { margin:'5px 0 8px', fontSize:19, letterSpacing:-.3 }
const badge: CSSProperties = { borderRadius:999, padding:'6px 9px', background:'var(--vs-accent-soft)', color:'var(--vs-accent)', fontSize:10, fontWeight:850 }
const body: CSSProperties = { color:'var(--vs-muted)', lineHeight:1.55, margin:'4px 0 10px' }
const muted: CSSProperties = { color:'var(--vs-muted)', lineHeight:1.5, fontSize:12 }
const recommendation: CSSProperties = { padding:'10px 12px', borderRadius:12, background:'var(--vs-surface)', fontSize:12, lineHeight:1.5 }
const paceRow: CSSProperties = { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginTop:12 }
const paceButton: CSSProperties = { display:'grid', gap:3, textAlign:'left', border:'1px solid var(--vs-border)', borderRadius:12, padding:10, background:'var(--vs-card)', color:'var(--vs-text)', cursor:'pointer' }
const activePace: CSSProperties = { borderColor:'var(--vs-accent)', background:'var(--vs-accent-soft)', color:'var(--vs-accent)' }
const disabled: CSSProperties = { cursor:'default', opacity:.72 }
const flow: CSSProperties = { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginTop:14 }
const step: CSSProperties = { display:'grid', gap:4, padding:'10px 8px', borderRadius:12, background:'var(--vs-surface)', textAlign:'center', fontSize:11 }
const actions: CSSProperties = { display:'flex', gap:9, alignItems:'center', flexWrap:'wrap', marginTop:14 }
const primary: CSSProperties = { border:0, borderRadius:14, padding:'11px 14px', background:'var(--vs-accent)', color:'white', fontWeight:900, cursor:'pointer' }
const done: CSSProperties = { color:'var(--vs-accent)', fontWeight:850, fontSize:12 }
const status: CSSProperties = { marginTop:10, borderRadius:12, padding:'10px 12px', background:'var(--vs-surface)', color:'var(--vs-muted)', fontSize:12, lineHeight:1.5 }
