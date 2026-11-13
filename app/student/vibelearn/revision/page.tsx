'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import VibeLearnSubnav from '@/components/student/VibeLearnSubnav'
import LearningNotebookPrompt from '@/components/learn/LearningNotebookPrompt'
import { generateRevisionPlan, getRevisionWorkspace, isCurrentGradeMistake, type RevisionWorkspace } from '@/lib/student/vibelearn'
import { useStudent } from '@/lib/student-context'

function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export default function RevisionWorkspacePage() {
  const router = useRouter()
  const { identity } = useStudent()
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

  const allMistakes = workspace?.mistakes ?? []
  const currentMistakes = allMistakes.filter(item => isCurrentGradeMistake(item,identity?.className))
  const historicalMistakes = allMistakes.filter(item => !isCurrentGradeMistake(item,identity?.className))
  // Do not promote older cross-grade or unverified bank topics as today's work.
  // Preserve the learner's original scores and history unchanged.
  const topicKey = (subject:string,topic:string) => (subject+'::'+topic).toLowerCase()
  const currentKeys = new Set(currentMistakes.map(item => topicKey(item.subject,item.topic)))
  const historicalOnlyKeys = new Set(historicalMistakes
    .filter(item => !currentKeys.has(topicKey(item.subject,item.topic)))
    .map(item => topicKey(item.subject,item.topic)))
  const currentTopic = (subject:string,topic:string) => !historicalOnlyKeys.has(topicKey(subject,topic))
  const todayPlan = (workspace?.todayPlan ?? []).filter(item => currentTopic(item.subject,item.topic))
  const weekPlan = (workspace?.weekPlan ?? []).filter(item => currentTopic(item.subject,item.topic))
  const weakTopics = (workspace?.weakTopics ?? []).filter(item => currentTopic(item.subject,item.topic))

  return <main style={shell}>
    <div style={{ maxWidth: 920, margin: '0 auto' }}>
      <VibeLearnSubnav />
      <button style={backButton} onClick={() => router.push('/student/vibelearn')}>← VibeLearn</button>
      <section style={hero}>
        <div style={eyebrow}>My revision</div>
        <h1 style={{ margin: '7px 0 5px' }}>What should I revise?</h1>
        <p style={{ margin: 0, color: 'var(--vs-muted)', lineHeight: 1.6 }}>Use your own learning progress to plan your next steps.</p>
      </section>
      <LearningNotebookPrompt stage="revision" />

      {error && <section style={{ ...card, color: '#b91c1c' }}>{error}</section>}
      {loading ? <section style={card}>Preparing your revision workspace…</section> : workspace && <>
        <section style={{ ...card, borderColor: workspace.revisionMode.mode === 'final_sprint' ? '#fca5a5' : 'var(--vs-border)' }}>
          <div style={eyebrowDark}>Your study plan</div>
          <h2 style={title}>{workspace.revisionMode.daysRemaining > 0 ? `${workspace.revisionMode.daysRemaining} days until your exam` : 'Plan your next 7 days'}</h2>
          {workspace.revisionMode.daysRemaining > 0 && <p style={muted}>{workspace.revisionMode.message}</p>}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:14 }}>
            <button style={primaryButton} disabled={working} onClick={() => void buildPlan()}>{working ? 'Building…' : workspace.weekPlan.length ? 'Refresh 7-day plan' : 'Build my 7-day plan'}</button>
            <button style={secondaryButton} onClick={() => router.push('/student/vibelearn/mistakes')}>Open mistake notebook</button>
            <button style={secondaryButton} onClick={() => router.push('/student/vibelearn/exams')}>Open exams</button>
          </div>
        </section>

        {historicalMistakes.length>0 && <p style={{...muted,margin:'12px 0'}}>Historical or unverified practice is excluded from current-grade suggestions. <button style={secondaryButton} onClick={()=>router.push('/student/vibelearn/mistakes')}>Review past practice ({historicalMistakes.length})</button></p>}
        <section style={card}><div style={eyebrowDark}>Today</div><h2 style={title}>What to study now</h2>{todayPlan.length === 0 ? <p style={muted}>Build your plan to turn exam-bank evidence into three focused actions.</p> : <div style={grid}>{todayPlan.map(item => <button key={item.id} style={actionCard} onClick={() => router.push(item.actionUrl)}><span style={priorityPill}>Priority {item.priority}</span><strong>{item.subject}: {item.topic}</strong><span style={muted}>{item.targetMinutes} min · {item.activityType.replaceAll('_', ' ')}</span><span style={reason}>{item.reason}</span><span style={linkText}>Open workspace →</span></button>)}</div>}</section>

        <section style={card}><div style={eyebrowDark}>This week</div><h2 style={title}>Revision timetable</h2>{weekPlan.length === 0 ? <p style={muted}>No plan generated yet.</p> : <div style={{ display: 'grid', gap: 8 }}>{weekPlan.map(item => <button key={item.id} style={rowButton} onClick={() => router.push(item.actionUrl)}><div><strong>{item.date} · {item.subject}</strong><div style={muted}>{item.topic} · {item.targetMinutes} min</div></div><span style={linkText}>Start →</span></button>)}</div>}</section>

        <section style={card}><div style={eyebrowDark}>Weak-topic recovery</div><h2 style={title}>Patterns worth fixing</h2>{weakTopics.length === 0 ? <p style={muted}>Complete practice sessions and your evidence-backed weak topics will appear here.</p> : <div style={grid}>{weakTopics.map(item => <button key={`${item.subject}-${item.topic}`} style={actionCard} onClick={() => router.push(`/student/vibelearn/topic?subject=${encodeURIComponent(item.subject)}&topic=${encodeURIComponent(item.topic)}`)}><strong>{item.subject}</strong><span>{item.topic}</span><span style={muted}>{item.misses} misses · {item.accuracy}% accuracy</span><span style={linkText}>Recover topic →</span></button>)}</div>}</section>

        <section style={card}><div style={eyebrowDark}>Mistake notebook</div><h2 style={title}>Revise your own mistakes</h2>{currentMistakes.length === 0 ? <p style={muted}>Wrong practice answers will be captured here automatically.</p> : <div style={{ display: 'grid', gap: 10 }}>{currentMistakes.slice(0, 8).map(item => <article key={item.id} style={mistakeCard}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><strong>{item.subject} · {item.topic}</strong><span style={priorityPill}>{item.repeatCount}× missed</span></div><p style={{ margin: '8px 0', lineHeight: 1.5 }}>{item.prompt}</p>{item.explanation && <details><summary style={{fontSize:13,fontWeight:700,cursor:'pointer',color:'var(--vs-accent)'}}>Read explanation</summary><p style={{...muted,fontSize:13,marginTop:7}}>{item.explanation}</p></details>}<div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>{item.reviewUrl && <button style={secondaryButton} onClick={() => router.push(item.reviewUrl as string)}>Review source</button>}<button style={secondaryButton} onClick={() => router.push(`/student/vibelearn/practice?subject=${encodeURIComponent(item.subject)}&topic=${encodeURIComponent(item.topic)}`)}>Practise topic</button></div></article>)}</div>}<button style={{ ...secondaryButton, marginTop:12 }} onClick={() => router.push('/student/vibelearn/mistakes')}>View full mistake notebook</button></section>

        <section style={card}><div style={eyebrowDark}>Learning journey</div><h2 style={title}>Your evidence, not comparison</h2><div style={metrics}><Metric value={workspace.journey.practiceAttempts} label="Questions attempted" /><Metric value={workspace.journey.correctAnswers} label="Correct answers" /><Metric value={workspace.journey.resolvedMistakes} label="Mistakes resolved" /><Metric value={workspace.journey.booksStarted} label="Books started" /><Metric value={workspace.journey.chaptersCompleted} label="Chapters completed" /><Metric value={workspace.journey.learningEvents30d} label="Learning actions · 30d" /></div></section>
      </>}
    </div>
  </main>
}

function Metric({ value, label }: { value: number; label: string }) { return <div style={metric}><strong style={{ fontSize: 24 }}>{value}</strong><span style={muted}>{label}</span></div> }

const shell: React.CSSProperties = { minHeight: '100vh', background: 'var(--vs-soft)', padding: '18px 14px 90px', color: 'var(--vs-text)', fontFamily: "'Plus Jakarta Sans', sans-serif" }
const hero: React.CSSProperties = { background: '#fff', border: '1px solid var(--vs-border)', color: 'var(--vs-text)', borderRadius: 20, padding: 20, marginBottom: 12 }
const card: React.CSSProperties = { background: '#fff', border: '1px solid var(--vs-border)', borderRadius: 16, padding: 16, marginBottom: 12 }
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.1, color: 'var(--vs-accent)' }
const eyebrowDark: React.CSSProperties = { fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.1, color: 'var(--vs-accent)' }
const title: React.CSSProperties = { margin: '5px 0 12px', fontSize: 20 }
const muted: React.CSSProperties = { fontSize: 12, color: 'var(--vs-muted)', margin: 0 }
const backButton: React.CSSProperties = { border: 'none', background: 'transparent', color: 'var(--vs-accent)', fontWeight: 800, marginBottom: 10, cursor: 'pointer', fontFamily: 'inherit' }
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 10 }
const actionCard: React.CSSProperties = { border: '1px solid var(--vs-border)', background: '#fff', borderRadius: 14, padding: 14, textAlign: 'left', display: 'grid', gap: 7, cursor: 'pointer', fontFamily: 'inherit' }
const rowButton: React.CSSProperties = { width: '100%', border: '1px solid var(--vs-border)', borderRadius: 12, padding: 13, background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }
const mistakeCard: React.CSSProperties = { border: '1px solid #fed7aa', background: '#fff7ed', borderRadius: 13, padding: 13 }
const priorityPill: React.CSSProperties = { width: 'fit-content', fontSize: 10, fontWeight: 800, color: '#7c2d12', background: '#ffedd5', borderRadius: 999, padding: '4px 8px' }
const reason: React.CSSProperties = { color: 'var(--vs-muted)', fontSize: 12, lineHeight: 1.45 }
const linkText: React.CSSProperties = { color: 'var(--vs-accent)', fontSize: 12, fontWeight: 800 }
const primaryButton: React.CSSProperties = { border: 'none', background: 'var(--vs-accent)', color: '#fff', borderRadius: 11, padding: '10px 14px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }
const secondaryButton: React.CSSProperties = { border: '1px solid var(--vs-border)', background: 'var(--vs-accent-soft)', color: 'var(--vs-accent)', borderRadius: 10, padding: '8px 11px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }
const metrics: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }
const metric: React.CSSProperties = { border: '1px solid var(--vs-border)', borderRadius: 13, padding: 13, display: 'grid', gap: 4 }
