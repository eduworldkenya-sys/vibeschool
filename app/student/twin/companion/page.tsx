'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { companionText, getLearningCompanionSnapshot, type LearningCompanionSnapshot } from '@/lib/student/learningCompanion'

function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {} }
function number(value: unknown): number { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0 }

export default function LearningCompanionPage() {
  const router = useRouter()
  const [snapshot, setSnapshot] = useState<LearningCompanionSnapshot | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void getLearningCompanionSnapshot().then(value => { if (!cancelled) setSnapshot(value) }).catch(() => { if (!cancelled) setError('Your companion snapshot could not be loaded right now.') })
    return () => { cancelled = true }
  }, [])

  if (!snapshot && !error) return <main style={shell}><section style={card}>Loading what Twin remembers…</section></main>
  if (!snapshot) return <main style={shell}><section style={card}><strong>{error}</strong><button style={button} onClick={() => router.push('/student/twin')}>Back to Twin</button></section></main>

  const now = record(snapshot.whatMattersNow)
  const session = record(snapshot.resumeSession)
  const revision = snapshot.todayRevision[0] ?? null
  const actionUrl = companionText(now.action_url)

  return <main style={shell}>
    <header style={header}><button style={back} onClick={() => router.push('/student/twin')}>← Twin</button><div><div style={brand}>✦ Learning Companion</div><div style={muted}>What matters now, what Twin remembers, and where to continue.</div></div></header>

    <section style={hero}><div style={eyebrow}>CONTINUE, DON'T RESTART</div><h1 style={title}>I remember where we are.</h1><p style={body}>This view combines teacher priorities, safe learner memory, resumable sessions and recent learning changes. Low-authority interactions never become verified mastery by themselves.</p></section>

    <div style={grid}>
      <section style={card}><div style={eyebrowDark}>WHAT MATTERS NOW</div><h2 style={sectionTitle}>{companionText(now.title) || companionText(now.subject) || 'Build the next verified signal'}</h2><p style={body}>{companionText(now.reason) || 'Twin is waiting for enough verified evidence to choose a stronger next step.'}</p>{actionUrl && <button style={button} onClick={() => router.push(actionUrl)}>Continue this task</button>}</section>

      <section style={card}><div style={eyebrowDark}>RESUME</div>{snapshot.resumeSession ? <><h2 style={sectionTitle}>{number(session.planned_minutes) ? `${number(session.planned_minutes)} minute ${companionText(session.mode) || 'learning'} session` : 'Your Twin session'}</h2><p style={body}>{companionText(session.reason) || 'Continue the session already prepared from your current evidence.'}</p><button style={button} onClick={() => router.push('/student/twin')}>Resume with Twin</button></> : <p style={body}>No unfinished Twin session right now.</p>}</section>

      <section style={card}><div style={eyebrowDark}>TODAY'S REVISION</div>{revision ? <><h2 style={sectionTitle}>{companionText(revision.topic) || 'Revision'}</h2><p style={body}>{companionText(revision.subject)} · {number(revision.target_minutes)} min</p><p style={muted}>{companionText(revision.reason)}</p></> : <p style={body}>No revision item is scheduled for today.</p>}</section>

      <section style={card}><div style={eyebrowDark}>WHAT TWIN SAFELY REMEMBERS</div>{snapshot.memories.length ? snapshot.memories.slice(0,6).map((item,index)=><div key={index} style={row}><strong>{companionText(item.claim)}</strong><span style={muted}>{companionText(item.type).replaceAll('_',' ')}</span></div>) : <p style={body}>Twin is still building safe long-term memory from real evidence.</p>}</section>
    </div>

    <section style={card}><div style={eyebrowDark}>WHAT CHANGED RECENTLY</div>{snapshot.recentChanges.length ? snapshot.recentChanges.slice(0,8).map((item,index)=><div key={index} style={row}><strong>{companionText(item.summary)}</strong><span style={muted}>Does not change verified mastery by itself.</span></div>) : <p style={body}>No new safe companion changes are available yet.</p>}</section>

    <section style={footer}>{Math.round(snapshot.confidence*100)}% state confidence · {snapshot.verifiedEvidenceCount} verified evidence records · {snapshot.verifiedCalibrationCount} verified calibrations{snapshot.examContextValid ? ' · exam context verified' : ''}</section>
  </main>
}

const shell:CSSProperties={maxWidth:980,margin:'0 auto',padding:'20px 16px 110px',display:'grid',gap:14}
const header:CSSProperties={display:'flex',gap:12,alignItems:'center'}
const back:CSSProperties={border:'1px solid var(--vs-border)',background:'var(--vs-surface)',borderRadius:12,padding:'9px 11px',cursor:'pointer',color:'inherit'}
const brand:CSSProperties={fontSize:21,fontWeight:950}
const muted:CSSProperties={fontSize:12,opacity:.66,lineHeight:1.45}
const hero:CSSProperties={padding:24,borderRadius:22,background:'linear-gradient(135deg,var(--vs-accent),#312a8c)',color:'#fff',display:'grid',gap:10}
const eyebrow:CSSProperties={fontSize:11,fontWeight:900,letterSpacing:'.08em',opacity:.8}
const eyebrowDark:CSSProperties={fontSize:11,fontWeight:900,letterSpacing:'.08em',opacity:.62}
const title:CSSProperties={margin:0,fontSize:'clamp(28px,5vw,42px)'}
const body:CSSProperties={margin:0,lineHeight:1.55}
const grid:CSSProperties={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:12}
const card:CSSProperties={padding:18,border:'1px solid var(--vs-border)',borderRadius:18,background:'var(--vs-surface)',display:'grid',gap:10}
const sectionTitle:CSSProperties={margin:0,fontSize:20}
const button:CSSProperties={justifySelf:'start',border:0,borderRadius:11,padding:'9px 12px',background:'var(--vs-accent)',color:'#fff',fontWeight:850,cursor:'pointer'}
const row:CSSProperties={display:'grid',gap:3,padding:'9px 0',borderBottom:'1px solid var(--vs-border)'}
const footer:CSSProperties={fontSize:12,opacity:.66,textAlign:'center',padding:8}
