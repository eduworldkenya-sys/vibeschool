'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import VibeLearnSubnav from '@/components/student/VibeLearnSubnav'
import { generateKcseRevisionPlan, getKcseCandidateOS, getKcseGradeProjection, getKcseMasteryMap, updateKcseProfile, type KcseCandidateOS } from '@/lib/student/kcse'

export default function KcseCandidatePage() {
  const router = useRouter()
  const [os, setOs] = useState<KcseCandidateOS | null>(null)
  const [masteryCount, setMasteryCount] = useState(0)
  const [projection, setProjection] = useState<string>('—')
  const [examDate, setExamDate] = useState('')
  const [dailyMinutes, setDailyMinutes] = useState(90)
  const [confidence, setConfidence] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const [brief, mastery, grade] = await Promise.all([getKcseCandidateOS(), getKcseMasteryMap(), getKcseGradeProjection()])
      setOs(brief)
      setMasteryCount(Array.isArray(mastery.topics) ? mastery.topics.length : 0)
      setProjection(grade.projected_grade ?? grade.state.replaceAll('_', ' '))
      setExamDate(brief.onboarding.exam_date ?? '')
      setDailyMinutes(brief.onboarding.daily_revision_minutes || 90)
      setConfidence(brief.onboarding.confidence_check)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load KCSE Candidate OS.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  async function saveProfile() {
    setWorking(true); setError('')
    try {
      await updateKcseProfile({ examDate: examDate || null, dailyMinutes, confidence, optIn: true })
      await load()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save KCSE settings.') }
    finally { setWorking(false) }
  }

  async function buildPlan(days: number) {
    setWorking(true); setError('')
    try { await generateKcseRevisionPlan(days); await load() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not build revision plan.') }
    finally { setWorking(false) }
  }

  return <main style={shell}><div style={{ maxWidth: 960, margin: '0 auto' }}>
    <VibeLearnSubnav />
    <section style={hero}>
      <div style={eyebrow}>KCSE Candidate OS</div>
      <h1 style={{ margin: '8px 0 6px', fontSize: 30 }}>What should I do next to reach my KCSE target?</h1>
      <p style={{ margin: 0, color: '#cbd5e1', lineHeight: 1.6 }}>Vibeschool uses verified evidence, your remaining time and your mistakes. It abstains when authoritative KCSE content or grade thresholds are missing.</p>
    </section>

    {error && <section style={{ ...card, color: '#b91c1c' }}>{error}</section>}
    {loading ? <section style={card}>Preparing your candidate brief…</section> : os && <>
      {!os.onboarding.complete && <section style={{ ...card, borderColor: '#f59e0b', background: '#fffaf0' }}>
        <div style={eyebrowDark}>Candidate setup</div><h2 style={title}>Set your exam horizon</h2>
        <div style={formGrid}>
          <label style={label}>KCSE exam date<input style={input} type="date" value={examDate} onChange={e => setExamDate(e.target.value)} /></label>
          <label style={label}>Daily revision minutes<input style={input} type="number" min={15} max={240} value={dailyMinutes} onChange={e => setDailyMinutes(Math.max(15, Math.min(240, Number(e.target.value) || 15)))} /></label>
          <label style={label}>Confidence today<select style={input} value={confidence ?? ''} onChange={e => setConfidence(e.target.value ? Number(e.target.value) : null)}><option value="">Not set</option>{[1,2,3,4,5].map(v => <option key={v} value={v}>{v}/5</option>)}</select></label>
        </div>
        <button style={primaryButton} disabled={working} onClick={() => void saveProfile()}>{working ? 'Saving…' : 'Turn on KCSE Candidate Mode'}</button>
      </section>}

      <section style={card}>
        <div style={metrics}>
          <Metric label="Days remaining" value={os.countdown.days_remaining ?? '—'} />
          <Metric label="Target grade" value={os.onboarding.target_grade ?? 'Set on Student Home'} />
          <Metric label="Evidence average" value={os.projection.average_percentage == null ? '—' : `${os.projection.average_percentage}%`} />
          <Metric label="Verified grade projection" value={projection} />
          <Metric label="Mastery topics" value={masteryCount} />
          <Metric label="Due retests" value={os.due_retests.length} />
        </div>
        <p style={{ ...muted, marginTop: 12 }}>{os.countdown.message}</p>
      </section>

      <section style={card}>
        <div style={sectionHeader}><div><div style={eyebrowDark}>Next action</div><h2 style={title}>Recover evidence before chasing volume</h2></div><button style={primaryButton} onClick={() => router.push('/student/vibelearn/kcse/practice')}>Adaptive practice</button></div>
        {os.due_retests.length > 0 ? <div style={rows}>{os.due_retests.slice(0, 5).map(item => <button key={item.id} style={rowButton} onClick={() => router.push(`/student/vibelearn/kcse/practice?subject=${encodeURIComponent(item.subject)}&topic=${encodeURIComponent(item.topic)}`)}><div><strong>{item.subject} · {item.topic}</strong><div style={muted}>Spaced retest due · {item.mastery_state}</div></div><span style={linkText}>Retest →</span></button>)}</div> : <p style={muted}>No spaced retest is due. Use adaptive practice to build new evidence.</p>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}><button style={secondaryButton} disabled={working} onClick={() => void buildPlan(7)}>Build 7-day plan</button><button style={secondaryButton} disabled={working} onClick={() => void buildPlan(30)}>Build 30-day plan</button><button style={secondaryButton} onClick={() => router.push('/student/vibelearn/mistakes')}>Mistake notebook</button></div>
      </section>

      <section style={card}>
        <div style={eyebrowDark}>Verified coverage</div><h2 style={title}>Know the difference between weak and unavailable</h2>
        {os.coverage.length === 0 ? <div style={warning}><strong>No verified Form 4 syllabus coverage is loaded.</strong><p style={muted}>Vibeschool will not label you weak when it has no authoritative evidence.</p></div> : <div style={grid}>{os.coverage.map(item => <div key={item.subject} style={miniCard}><strong>{item.subject}</strong><span style={pill}>{item.evidence_state.replaceAll('_', ' ')}</span><span style={muted}>{item.syllabus_topics} syllabus topics · {item.verified_outcomes} verified outcomes · {item.published_form4_questions} exam questions</span></div>)}</div>}
      </section>

      <section style={card}>
        <div style={sectionHeader}><div><div style={eyebrowDark}>KCSE paper mode</div><h2 style={title}>Timed, resumable, no hints during the paper</h2></div></div>
        {os.paper_blueprints.length === 0 ? <div style={warning}><strong>No verified KCSE paper blueprint is available yet.</strong><p style={muted}>Vibeschool refuses to invent paper structure. A verified blueprint and verified Form 4 questions are required before mock generation is enabled.</p></div> : <div style={grid}>{os.paper_blueprints.map(paper => <button key={paper.id} style={miniButton} onClick={async () => {
          const clientId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
          const { createKcseMock } = await import('@/lib/student/kcse')
          const result = await createKcseMock(paper.subject, paper.paper_code, clientId)
          if (result.ok && result.session_id) router.push(`/student/vibelearn/kcse/mock/${result.session_id}?client=${encodeURIComponent(clientId)}`)
          else setError(result.reason?.replaceAll('_',' ') ?? 'Could not create mock.')
        }}><strong>{paper.subject} · {paper.paper_code}</strong><span>{paper.title}</span><span style={muted}>{paper.duration_minutes} min · {paper.total_marks} marks</span><span style={linkText}>Start timed mock →</span></button>)}</div>}
      </section>

      <section style={card}><div style={eyebrowDark}>Guardrails</div><h2 style={title}>What Vibeschool will not fake</h2><div style={grid}>{Object.entries(os.guardrails).map(([key,value]) => value && <div key={key} style={miniCard}><strong>✓ {key.replaceAll('_',' ')}</strong></div>)}</div></section>
    </>}
  </div></main>
}

function Metric({ label, value }: { label: string; value: string | number }) { return <div style={metric}><strong style={{ fontSize: 23 }}>{value}</strong><span style={muted}>{label}</span></div> }
const shell: React.CSSProperties = { minHeight: '100vh', background: '#f8fafc', padding: '18px 14px 90px', color: '#0f172a', fontFamily: "'Plus Jakarta Sans', sans-serif" }
const hero: React.CSSProperties = { background: 'linear-gradient(135deg,#020617,#312e81)', color: '#fff', borderRadius: 20, padding: 22, marginBottom: 12 }
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 16, marginBottom: 12 }
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1.2, color: '#c7d2fe' }
const eyebrowDark: React.CSSProperties = { fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1.1, color: '#4338ca' }
const title: React.CSSProperties = { margin: '5px 0 12px', fontSize: 20 }
const muted: React.CSSProperties = { fontSize: 12, color: '#64748b', margin: 0, lineHeight: 1.55 }
const metrics: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(135px,1fr))', gap: 10 }
const metric: React.CSSProperties = { border: '1px solid #e0e7ff', background: '#eef2ff', borderRadius: 13, padding: 13, display: 'grid', gap: 4 }
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 }
const formGrid: React.CSSProperties = { ...grid, marginBottom: 12 }
const label: React.CSSProperties = { fontSize: 12, fontWeight: 800, display: 'grid', gap: 6 }
const input: React.CSSProperties = { border: '1px solid #cbd5e1', borderRadius: 10, padding: 10, fontFamily: 'inherit', background: '#fff' }
const sectionHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }
const primaryButton: React.CSSProperties = { border: 'none', background: '#4f46e5', color: '#fff', borderRadius: 10, padding: '9px 12px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }
const secondaryButton: React.CSSProperties = { border: '1px solid #c7d2fe', background: '#eef2ff', color: '#4338ca', borderRadius: 10, padding: '9px 12px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }
const rows: React.CSSProperties = { display: 'grid', gap: 8 }
const rowButton: React.CSSProperties = { border: '1px solid #e2e8f0', background: '#fff', borderRadius: 12, padding: 12, display: 'flex', justifyContent: 'space-between', gap: 10, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }
const linkText: React.CSSProperties = { color: '#4338ca', fontSize: 12, fontWeight: 900 }
const miniCard: React.CSSProperties = { border: '1px solid #e2e8f0', borderRadius: 12, padding: 12, display: 'grid', gap: 7 }
const miniButton: React.CSSProperties = { ...miniCard, background: '#fff', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }
const warning: React.CSSProperties = { border: '1px solid #fcd34d', background: '#fffbeb', borderRadius: 13, padding: 14 }
const pill: React.CSSProperties = { width: 'fit-content', fontSize: 10, fontWeight: 800, borderRadius: 999, padding: '4px 8px', background: '#eef2ff', color: '#4338ca' }
