'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import VibeLearnSubnav from '@/components/student/VibeLearnSubnav'
import { generateRevisionPlan, getRevisionWorkspace, resolveMistake, type RevisionWorkspace } from '@/lib/student/vibelearn'

function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export default function RevisionWorkspacePage() {
  const router = useRouter()
  const [workspace, setWorkspace] = useState<RevisionWorkspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try { setWorkspace(await getRevisionWorkspace()) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load your revision workspace.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  async function buildPlan() {
    setWorking(true); setError('')
    try { await generateRevisionPlan(todayIso(), 7); await load() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not build your revision plan.') }
    finally { setWorking(false) }
  }

  async function markResolved(id: string) {
    setWorking(true)
    try { await resolveMistake(id); await load() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update the mistake.') }
    finally { setWorking(false) }
  }

  return <main style={shell}>
    <div style={{ maxWidth: 920, margin: '0 auto' }}>
      <VibeLearnSubnav />
      <button style={backButton} onClick={() => router.push('/student/vibelearn')}>← VibeLearn</button>
      <section style={hero}>
        <div style={eyebrow}>Personal revision OS</div>
        <h1 style={{ margin: '7px 0 5px' }}>Your plan, mistakes and progress</h1>
        <p style={{ margin: 0, color: '#cbd5e1', lineHeight: 1.6 }}>Built from your own practice, assessment and reading evidence—not from public rankings.</p>
      </section>

      {error && <section style={{ ...card, color: '#b91c1c' }}>{error}</section>}
      {loading ? <section style={card}>Preparing your revision workspace…</section> : workspace && <>
        <section style={{ ...card, borderColor: workspace.revisionMode.mode === 'final_sprint' ? '#fca5a5' : '#c7d2fe' }}>
          <div style={eyebrowDark}>{workspace.revisionMode.mode.replaceAll('_', ' ')}</div>
          <h2 style={title}>{workspace.revisionMode.daysRemaining} days remaining</h2>
          <p style={muted}>{workspace.revisionMode.message}</p>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:14 }}>
            <button style={primaryButton} disabled={working} onClick={() => void buildPlan()}>{working ? 'Building…' : workspace.weekPlan.length ? 'Refresh 7-day plan' : 'Build my 7-day plan'}</button>
            <button style={secondaryButton} onClick={() => router.push('/student/vibelearn/mistakes')}>Open mistake notebook</button>
            <button style={secondaryButton} onClick={() => router.push('/student/vibelearn/exams')}>Open exams</button>
          </div>
        </section>

        <section style={card}><div style={eyebrowDark}>Today</div><h2 style={title}>What to study now</h2>{workspace.todayPlan.length === 0 ? <p style={muted}>Build your plan to turn exam-bank evidence into three focused actions.</p> : <div style={grid}>{workspace.todayPlan.map(item => <button key={item.id} style={actionCard} onClick={() => router.push(item.actionUrl)}><span style={priorityPill}>Priority {item.priority}</span><strong>{item.subject}: {item.topic}</strong><span style={muted}>{item.targetMinutes} min · {item.activityType.replaceAll('_', ' ')}</span><span style={reason}>{item.reason}</span><span style={linkText}>Open workspace →</span></button>)}</div>}</section>

        <section style={card}><div style={eyebrowDark}>This week</div><h2 style={title}>Revision timetable</h2>{workspace.weekPlan.length === 0 ? <p style={muted}>No plan generated yet.</p> : <div style={{ display: 'grid', gap: 8 }}>{workspace.weekPlan.map(item => <button key={item.id} style={rowButton} onClick={() => router.push(item.actionUrl)}><div><strong>{item.date} · {item.subject}</strong><div style={muted}>{item.topic} · {item.targetMinutes} min</div></div><span style={linkText}>Start →</span></button>)}</div>}</section>

        <section style={card}><div style={eyebrowDark}>Weak-topic recovery</div><h2 style={title}>Patterns worth fixing</h2>{workspace.weakTopics.length === 0 ? <p style={muted}>Complete practice sessions and your evidence-backed weak topics will appear here.</p> : <div style={grid}>{workspace.weakTopics.map(item => <button key={`${item.subject}-${item.topic}`} style={actionCard} onClick={() => router.push(`/student/vibelearn/topic?subject=${encodeURIComponent(item.subject)}&topic=${encodeURIComponent(item.topic)}`)}><strong>{item.subject}</strong><span>{item.topic}</span><span style={muted}>{item.misses} misses · {item.accuracy}% accuracy</span><span style={linkText}>Recover topic →</span></button>)}</div>}</section>

        <section style={card}><div style={eyebrowDark}>Mistake notebook</div><h2 style={title}>Revise your own mistakes</h2>{workspace.mistakes.length === 0 ? <p style={muted}>Wrong practice answers will be captured here automatically.</p> : <div style={{ display: 'grid', gap: 10 }}>{workspace.mistakes.slice(0, 8).map(item => <article key={item.id} style={mistakeCard}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><strong>{item.subject} · {item.topic}</strong><span style={priorityPill}>{item.repeatCount}× missed</span></div><p style={{ margin: '8px 0', lineHeight: 1.5 }}>{item.prompt}</p>{item.explanation && <p style={muted}>{item.explanation}</p>}<div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>{item.reviewUrl && <button style={secondaryButton} onClick={() => router.push(item.reviewUrl as string)}>Review source</button>}<button style={secondaryButton} onClick={() => router.push(`/student/vibelearn/practice?subject=${encodeURIComponent(item.subject)}&topic=${encodeURIComponent(item.topic)}`)}>Practise topic</button>{item.status !== 'resolved' && <button style={secondaryButton} disabled={working} onClick={() => void markResolved(item.id)}>Mark understood</button>}</div></article>)}</div>}<button style={{ ...secondaryButton, marginTop:12 }} onClick={() => router.push('/student/vibelearn/mistakes')}>View full mistake notebook</button></section>

        <section style={card}><div style={eyebrowDark}>Learning journey</div><h2 style={title}>Your evidence, not comparison</h2><div style={metrics}><Metric value={workspace.journey.practiceAttempts} label="Questions attempted" /><Metric value={workspace.journey.correctAnswers} label="Correct answers" /><Metric value={workspace.journey.resolvedMistakes} label="Mistakes resolved" /><Metric value={workspace.journey.booksStarted} label="Books started" /><Metric value={workspace.journey.chaptersCompleted} label="Chapters completed" /><Metric value={workspace.journey.learningEvents30d} label="Learning actions · 30d" /></div></section>
      </>}
    </div>
  </main>
}

function Metric({ value, label }: { value: number; label: string }) { return <div style={metric}><strong style={{ fontSize: 24 }}>{value}</strong><span style={muted}>{label}</span></div> }

const shell: React.CSSProperties = { minHeight: '100vh', background: '#f8fafc', padding: '18px 14px 90px', color: '#0f172a', fontFamily: "'Plus Jakarta Sans', sans-serif" }
const hero: React.CSSProperties = { background: 'linear-gradient(135deg,#0f172a,#312e81)', color: '#fff', borderRadius: 20, padding: 20, marginBottom: 12 }
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 16, marginBottom: 12 }
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.1, color: '#a5b4fc' }
const eyebrowDark: React.CSSProperties = { fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.1, color: '#4f46e5' }
const title: React.CSSProperties = { margin: '5px 0 12px', fontSize: 20 }
const muted: React.CSSProperties = { fontSize: 12, color: '#64748b', margin: 0 }
const backButton: React.CSSProperties = { border: 'none', background: 'transparent', color: '#4338ca', fontWeight: 800, marginBottom: 10, cursor: 'pointer', fontFamily: 'inherit' }
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 10 }
const actionCard: React.CSSProperties = { border: '1px solid #e2e8f0', background: '#fff', borderRadius: 14, padding: 14, textAlign: 'left', display: 'grid', gap: 7, cursor: 'pointer', fontFamily: 'inherit' }
const rowButton: React.CSSProperties = { width: '100%', border: '1px solid #e2e8f0', borderRadius: 12, padding: 13, background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }
const mistakeCard: React.CSSProperties = { border: '1px solid #fed7aa', background: '#fff7ed', borderRadius: 13, padding: 13 }
const priorityPill: React.CSSProperties = { width: 'fit-content', fontSize: 10, fontWeight: 800, color: '#7c2d12', background: '#ffedd5', borderRadius: 999, padding: '4px 8px' }
const reason: React.CSSProperties = { color: '#475569', fontSize: 12, lineHeight: 1.45 }
const linkText: React.CSSProperties = { color: '#4338ca', fontSize: 12, fontWeight: 800 }
const primaryButton: React.CSSProperties = { border: 'none', background: '#4f46e5', color: '#fff', borderRadius: 11, padding: '10px 14px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }
const secondaryButton: React.CSSProperties = { border: '1px solid #c7d2fe', background: '#eef2ff', color: '#4338ca', borderRadius: 10, padding: '8px 11px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }
const metrics: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }
const metric: React.CSSProperties = { border: '1px solid #e2e8f0', borderRadius: 13, padding: 13, display: 'grid', gap: 4 }
