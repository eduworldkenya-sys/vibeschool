'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getRevisionWorkspace, saveTopicNote, type TopicWorkspace } from '@/lib/student/vibelearn'

export default function TopicWorkspacePage() {
  const router = useRouter()
  const params = useSearchParams()
  const subject = params.get('subject') ?? ''
  const topic = params.get('topic') ?? ''
  const [workspace, setWorkspace] = useState<TopicWorkspace | null>(null)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!subject || !topic) { setError('Choose a subject and topic from your revision plan.'); setLoading(false); return }
    try {
      const result = await getRevisionWorkspace(subject, topic)
      setWorkspace(result.topicWorkspace)
      setNote(result.topicWorkspace?.note ?? '')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not open this topic workspace.')
    } finally {
      setLoading(false)
    }
  }, [subject, topic])

  useEffect(() => { void load() }, [load])

  async function saveNote() {
    if (!workspace || !note.trim()) return
    setSaving(true)
    setError('')
    try {
      await saveTopicNote(workspace.subject, workspace.topic, note.trim())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save your note.')
    } finally {
      setSaving(false)
    }
  }

  return <main style={shell}>
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <button style={backButton} onClick={() => router.push('/student/vibelearn/revision')}>← Revision plan</button>
      <section style={hero}>
        <div style={eyebrow}>Topic learning workspace</div>
        <h1 style={{ margin: '7px 0 4px' }}>{topic || 'Topic'}</h1>
        <p style={{ margin: 0, color: '#cbd5e1' }}>{subject || 'Subject'} · Learn, practise, review mistakes and make notes in one place.</p>
      </section>

      {error && <section style={{ ...card, color: '#b91c1c' }}>{error}</section>}
      {loading ? <section style={card}>Building your topic workspace…</section> : workspace && <>
        <section style={card}>
          <div style={eyebrowDark}>Topic evidence</div><h2 style={title}>Where you stand</h2>
          <div style={metrics}><Metric value={workspace.attempts} label="Questions attempted" /><Metric value={workspace.accuracy === null ? '—' : `${workspace.accuracy}%`} label="Practice accuracy" /><Metric value={workspace.mistakes.filter(item => item.status !== 'resolved').length} label="Open mistakes" /></div>
        </section>

        <section style={card}>
          <div style={eyebrowDark}>Learn</div><h2 style={title}>Books and teacher resources</h2>
          {workspace.resources.length === 0 ? <p style={muted}>No published resources are linked to this exact topic yet. You can still practise and keep notes here.</p> : <div style={grid}>
            {workspace.resources.map(item => <button key={item.id} style={actionCard} onClick={() => item.publicationId ? router.push(`/read/textbook/${item.publicationId}${item.chapterId ? `?chapter=${item.chapterId}` : ''}`) : undefined}>
              <span style={{ fontSize: 22 }}>📘</span><strong>{item.title}</strong>{item.description && <span style={muted}>{item.description}</span>}<span style={linkText}>Open resource →</span>
            </button>)}
          </div>}
        </section>

        <section style={card}>
          <div style={eyebrowDark}>My notebook</div><h2 style={title}>What I need to remember</h2>
          <textarea value={note} onChange={event => setNote(event.target.value)} placeholder="Write a formula, concept, mistake pattern or explanation in your own words…" style={textarea} maxLength={5000} />
          <button style={{ ...primaryButton, marginTop: 10, opacity: !note.trim() || saving ? 0.5 : 1 }} disabled={!note.trim() || saving} onClick={() => void saveNote()}>{saving ? 'Saving…' : 'Save note'}</button>
        </section>

        <section style={card}>
          <div style={eyebrowDark}>Practise</div><h2 style={title}>{workspace.questions.length} verified questions available</h2>
          <p style={muted}>Start a scored session using stored hints and explanations. VibeTwin remains off during scoring.</p>
          <button style={{ ...primaryButton, marginTop: 12 }} onClick={() => router.push(`/student/vibelearn/practice?subject=${encodeURIComponent(workspace.subject)}&topic=${encodeURIComponent(workspace.topic)}`)}>Start topic practice</button>
        </section>

        <section style={card}>
          <div style={eyebrowDark}>Recover</div><h2 style={title}>Mistakes from this topic</h2>
          {workspace.mistakes.length === 0 ? <p style={muted}>No recorded mistakes for this topic yet.</p> : <div style={{ display: 'grid', gap: 9 }}>
            {workspace.mistakes.map(item => <article key={item.id} style={mistakeCard}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><strong>{item.status.replaceAll('_', ' ')}</strong><span style={pill}>{item.repeatCount}× missed</span></div><p style={{ margin: '8px 0 0', lineHeight: 1.5 }}>{item.prompt}</p></article>)}
          </div>}
        </section>

        <section style={{ ...card, background: '#faf5ff', borderColor: '#ddd6fe' }}>
          <div style={eyebrowDark}>VibeTwin · explicit help only</div><h2 style={title}>Think first, ask second</h2>
          <p style={{ ...muted, lineHeight: 1.6 }}>Twin may simplify an explanation, translate, provide a similar example or explain a completed mistake. It must not answer an active scored question or replace the textbook, teacher or your own working.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}><span style={pill}>Explain simply</span><span style={pill}>Show similar example</span><span style={pill}>Explain my mistake</span><span style={pill}>Translate</span></div>
        </section>
      </>}
    </div>
  </main>
}

function Metric({ value, label }: { value: number | string; label: string }) { return <div style={metric}><strong style={{ fontSize: 24 }}>{value}</strong><span style={muted}>{label}</span></div> }

const shell: React.CSSProperties = { minHeight: '100vh', background: '#f8fafc', padding: '18px 14px 90px', color: '#0f172a', fontFamily: "'Plus Jakarta Sans', sans-serif" }
const hero: React.CSSProperties = { background: 'linear-gradient(135deg,#0f172a,#1e3a8a)', color: '#fff', borderRadius: 20, padding: 20, marginBottom: 12 }
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 16, marginBottom: 12 }
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.1, color: '#93c5fd' }
const eyebrowDark: React.CSSProperties = { fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.1, color: '#2563eb' }
const title: React.CSSProperties = { margin: '5px 0 12px', fontSize: 20 }
const muted: React.CSSProperties = { fontSize: 12, color: '#64748b', margin: 0 }
const backButton: React.CSSProperties = { border: 'none', background: 'transparent', color: '#2563eb', fontWeight: 800, marginBottom: 10, cursor: 'pointer', fontFamily: 'inherit' }
const metrics: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }
const metric: React.CSSProperties = { border: '1px solid #dbeafe', background: '#eff6ff', borderRadius: 13, padding: 13, display: 'grid', gap: 4 }
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 10 }
const actionCard: React.CSSProperties = { border: '1px solid #e2e8f0', background: '#fff', borderRadius: 14, padding: 14, textAlign: 'left', display: 'grid', gap: 7, cursor: 'pointer', fontFamily: 'inherit' }
const textarea: React.CSSProperties = { width: '100%', minHeight: 140, border: '1px solid #cbd5e1', borderRadius: 12, padding: 12, fontFamily: 'inherit', fontSize: 14, lineHeight: 1.55, resize: 'vertical', boxSizing: 'border-box' }
const primaryButton: React.CSSProperties = { border: 'none', background: '#2563eb', color: '#fff', borderRadius: 11, padding: '10px 14px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }
const linkText: React.CSSProperties = { color: '#2563eb', fontSize: 12, fontWeight: 800 }
const mistakeCard: React.CSSProperties = { border: '1px solid #fed7aa', background: '#fff7ed', borderRadius: 13, padding: 13 }
const pill: React.CSSProperties = { fontSize: 10, fontWeight: 800, background: '#ede9fe', color: '#6d28d9', padding: '5px 8px', borderRadius: 999 }
