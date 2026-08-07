'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import VibeLearnSubnav from '@/components/student/VibeLearnSubnav'
import { getRevisionWorkspace, resolveMistake, type RevisionWorkspace } from '@/lib/student/vibelearn'

export default function VibeLearnMistakesPage() {
  const router = useRouter()
  const [workspace, setWorkspace] = useState<RevisionWorkspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      setWorkspace(await getRevisionWorkspace())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load your mistake notebook.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function markResolved(id: string) {
    setWorking(id)
    setError('')
    try {
      await resolveMistake(id)
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update this mistake.')
    } finally {
      setWorking(null)
    }
  }

  const mistakes = workspace?.mistakes ?? []
  const openCount = mistakes.filter(item => item.status !== 'resolved').length
  const resolvedCount = mistakes.filter(item => item.status === 'resolved').length

  return <main style={shell}>
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <VibeLearnSubnav />
      <section style={hero}>
        <div style={eyebrow}>Mistake notebook</div>
        <h1 style={{ margin: '7px 0 5px' }}>Learn from what went wrong</h1>
        <p style={{ margin: 0, color: '#cbd5e1', lineHeight: 1.6 }}>Wrong practice answers are captured here so you can review the exact source, retry the topic and mark understanding when it is genuinely resolved.</p>
      </section>

      {error && <section style={{ ...card, color: '#b91c1c' }}>{error}</section>}
      {loading ? <section style={card}>Loading your mistakes…</section> : <>
        <section style={card}>
          <div style={metrics}>
            <Metric label="Needs work" value={openCount} />
            <Metric label="Resolved" value={resolvedCount} />
            <Metric label="Weak topics" value={workspace?.weakTopics.length ?? 0} />
          </div>
        </section>

        <section style={card}>
          <div style={eyebrowDark}>Your mistakes</div>
          <h2 style={title}>Review, practise, resolve</h2>
          {mistakes.length === 0 ? <div style={emptyBox}><strong>No mistakes recorded yet</strong><p style={muted}>When you miss a practice question, it will appear here automatically with a path back to the source when available.</p><button style={primaryButton} onClick={() => router.push('/student/vibelearn/practice')}>Start practice</button></div> : <div style={{ display: 'grid', gap: 10 }}>
            {mistakes.map(item => <article key={item.id} style={{ ...mistakeCard, opacity: item.status === 'resolved' ? 0.72 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                <div><strong>{item.subject} · {item.topic}</strong><div style={muted}>{item.status.replaceAll('_', ' ')}</div></div>
                <span style={priorityPill}>{item.repeatCount}× missed</span>
              </div>
              <p style={{ margin: '8px 0', lineHeight: 1.5 }}>{item.prompt}</p>
              {item.explanation && <p style={muted}>{item.explanation}</p>}
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                {item.reviewUrl && <button style={secondaryButton} onClick={() => router.push(item.reviewUrl as string)}>Review source</button>}
                <button style={secondaryButton} onClick={() => router.push(`/student/vibelearn/practice?subject=${encodeURIComponent(item.subject)}&topic=${encodeURIComponent(item.topic)}`)}>Practise topic</button>
                {item.status !== 'resolved' && <button style={primaryButton} disabled={working === item.id} onClick={() => void markResolved(item.id)}>{working === item.id ? 'Updating…' : 'Mark understood'}</button>}
              </div>
            </article>)}
          </div>}
        </section>

        <section style={card}>
          <div style={eyebrowDark}>Weak-topic recovery</div>
          <h2 style={title}>Patterns worth fixing</h2>
          {!workspace || workspace.weakTopics.length === 0 ? <p style={muted}>Weak-topic patterns appear after enough practice evidence exists.</p> : <div style={grid}>
            {workspace.weakTopics.map(item => <button key={`${item.subject}-${item.topic}`} style={actionCard} onClick={() => router.push(`/student/vibelearn/topic?subject=${encodeURIComponent(item.subject)}&topic=${encodeURIComponent(item.topic)}`)}>
              <strong>{item.subject}</strong><span>{item.topic}</span><span style={muted}>{item.misses} misses · {item.accuracy}% accuracy</span><span style={linkText}>Recover topic →</span>
            </button>)}
          </div>}
        </section>
      </>}
    </div>
  </main>
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div style={metric}><strong style={{ fontSize: 24 }}>{value}</strong><span style={muted}>{label}</span></div>
}

const shell: React.CSSProperties = { minHeight: '100vh', background: '#f8fafc', padding: '18px 14px 90px', color: '#0f172a', fontFamily: "'Plus Jakarta Sans', sans-serif" }
const hero: React.CSSProperties = { background: 'linear-gradient(135deg,#0f172a,#7c2d12)', color: '#fff', borderRadius: 20, padding: 20, marginBottom: 12 }
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 16, marginBottom: 12 }
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.1, color: '#fed7aa' }
const eyebrowDark: React.CSSProperties = { fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.1, color: '#c2410c' }
const title: React.CSSProperties = { margin: '5px 0 12px', fontSize: 20 }
const muted: React.CSSProperties = { fontSize: 12, color: '#64748b', margin: 0 }
const metrics: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }
const metric: React.CSSProperties = { border: '1px solid #fed7aa', background: '#fff7ed', borderRadius: 13, padding: 13, display: 'grid', gap: 4 }
const mistakeCard: React.CSSProperties = { border: '1px solid #fed7aa', background: '#fff7ed', borderRadius: 13, padding: 13 }
const priorityPill: React.CSSProperties = { width: 'fit-content', fontSize: 10, fontWeight: 800, color: '#7c2d12', background: '#ffedd5', borderRadius: 999, padding: '4px 8px' }
const emptyBox: React.CSSProperties = { border: '1px dashed #fdba74', borderRadius: 14, padding: 16 }
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 10 }
const actionCard: React.CSSProperties = { border: '1px solid #e2e8f0', background: '#fff', borderRadius: 14, padding: 14, textAlign: 'left', display: 'grid', gap: 7, cursor: 'pointer', fontFamily: 'inherit' }
const linkText: React.CSSProperties = { color: '#4338ca', fontSize: 12, fontWeight: 800 }
const primaryButton: React.CSSProperties = { border: 'none', background: '#4f46e5', color: '#fff', borderRadius: 10, padding: '8px 11px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }
const secondaryButton: React.CSSProperties = { border: '1px solid #c7d2fe', background: '#eef2ff', color: '#4338ca', borderRadius: 10, padding: '8px 11px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }
