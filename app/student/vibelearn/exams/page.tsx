'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import VibeLearnSubnav from '@/components/student/VibeLearnSubnav'
import { listMyAssessmentAssignments, type LearnerAssessmentAssignment } from '@/lib/assessment/discovery'
import { getLearnerAssessmentHub, type LearnerAssessmentHub } from '@/lib/assessment/integration'

/**
 * Learner exams are discovery-first: never advertise an unverified mock,
 * paper catalogue, topic bank or a disabled assessment as available.
 * History is driven exclusively by the canonical released-results hub.
 */
export default function VibeLearnExamsPage() {
  const router = useRouter()
  const [assignments, setAssignments] = useState<LearnerAssessmentAssignment[]>([])
  const [hub, setHub] = useState<LearnerAssessmentHub | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'available' | 'results'>('available')
  const [assessmentError, setAssessmentError] = useState('')
  const [resultsError, setResultsError] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([listMyAssessmentAssignments(), getLearnerAssessmentHub()])
      .then(([assignmentResult, resultsResult]) => {
        if (cancelled) return
        if (assignmentResult.status === 'fulfilled') setAssignments(assignmentResult.value)
        else setAssessmentError('Could not load available exams. Please try again.')
        if (resultsResult.status === 'fulfilled') setHub(resultsResult.value)
        else setResultsError('Could not load released results. Please try again.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const available = assignments.filter(item => {
    const active = item.attemptStatus === 'in_progress'
      && (!item.attemptExpiresAt || Date.parse(item.attemptExpiresAt) > Date.now())
    return active || item.canStart
  })
  const results = hub?.results ?? []

  return <main style={shell}>
    <div className="vs-learn-page" style={workspace}>
      <VibeLearnSubnav />
      <button type="button" onClick={() => router.push('/student/vibelearn')} style={back}>← Learn</button>
      <header style={header}>
        <h1 style={{ margin: 0, fontSize: 26, letterSpacing: '-0.03em' }}>Exams</h1>
        <p style={{ margin: '6px 0 0', color: '#657087', fontSize: 14 }}>Your available exams and results.</p>
      </header>
      <div role="tablist" aria-label="Exams views" style={tabs}>
        <button type="button" role="tab" id="available-tab" aria-controls="available-panel" aria-selected={activeTab === 'available'} onClick={() => setActiveTab('available')} style={activeTab === 'available' ? selectedTab : inactiveTab}>Available{loading ? '' : ` (${available.length})`}</button>
        <button type="button" role="tab" id="results-tab" aria-controls="results-panel" aria-selected={activeTab === 'results'} onClick={() => setActiveTab('results')} style={activeTab === 'results' ? selectedTab : inactiveTab}>My Results{loading ? '' : ` (${results.length})`}</button>
      </div>
      {loading && <section style={panel} role="status">Loading your exams…</section>}
      {!loading && activeTab === 'available' && <section id="available-panel" role="tabpanel" aria-labelledby="available-tab" style={list}>
        {assessmentError && <p role="alert" style={errorStyle}>{assessmentError}</p>}
        {!assessmentError && available.length === 0 && <p style={empty}>No exam is available for you right now.</p>}
        {available.map(item => {
          const active = item.attemptStatus === 'in_progress'
            && (!item.attemptExpiresAt || Date.parse(item.attemptExpiresAt) > Date.now())
          return <article key={item.assignmentId} style={row}>
            <div style={rowInfo}>
              <strong style={rowTitle}>{item.title}</strong>
              <span style={muted}>{item.timeLimitMinutes ? `${item.timeLimitMinutes} minutes · ` : ''}{item.assessmentType.replaceAll('_', ' ')}</span>
            </div>
            <button type="button" style={primaryButton} onClick={() => router.push(`/student/assessment/${item.assignmentId}`)}>
              {active ? 'Resume exam' : 'Start exam'}
            </button>
          </article>
        })}
      </section>}
      {!loading && activeTab === 'results' && <section id="results-panel" role="tabpanel" aria-labelledby="results-tab" style={list}>
        {resultsError && <p role="alert" style={errorStyle}>{resultsError}</p>}
        {!resultsError && results.length === 0 && <p style={empty}>No released results yet.</p>}
        {results.map(result => <article key={result.attemptId} style={row}>
          <div style={rowInfo}>
            <strong style={rowTitle}>{result.assessmentTitle}</strong>
            <span style={muted}>{new Date(result.releasedAt).toLocaleDateString('en-KE')}</span>
          </div>
          <div style={resultActions}>
            <strong style={{fontSize: 16}}>{result.percentage == null ? '—' : `${result.percentage.toFixed(1)}%`}</strong>
            <button type="button" style={secondaryButton} onClick={() => router.push(`/student/results/${encodeURIComponent(result.attemptId)}`)}>View result</button>
          </div>
        </article>)}
      </section>}
    </div>
  </main>
}

const shell: React.CSSProperties = { minHeight: '100vh', background: '#f6f7fb', padding: '18px clamp(12px,3vw,36px) 90px', color: '#17213b', fontFamily: "'Plus Jakarta Sans', sans-serif" }
const workspace: React.CSSProperties = { maxWidth: 1000, width: '100%', margin: '0 auto' }
const back: React.CSSProperties = { background: 'transparent', border: 0, color: '#5145e8', padding: '6px 0 12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }
const header: React.CSSProperties = { padding: '4px 0 18px' }
const tabs: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8, marginBottom: 12 }
const tabBase: React.CSSProperties = { minWidth: 0, minHeight: 48, borderRadius: 12, padding: '10px 12px', fontFamily: 'inherit', fontWeight: 750, fontSize: 14, cursor: 'pointer' }
const selectedTab: React.CSSProperties = { ...tabBase, background: '#5145e8', color: '#fff', border: '1px solid #5145e8' }
const inactiveTab: React.CSSProperties = { ...tabBase, background: '#fff', color: '#303a53', border: '1px solid #dfe3ed' }
const panel: React.CSSProperties = { background: '#fff', border: '1px solid #dfe3ed', borderRadius: 12, padding: 16 }
const list: React.CSSProperties = { display: 'grid', gap: 10 }
const row: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: '#fff', border: '1px solid #dfe3ed', borderRadius: 12, padding: '13px 15px', minWidth: 0 }
const rowInfo: React.CSSProperties = { display: 'grid', gap: 5, minWidth: 0, flex: '1 1 180px' }
const rowTitle: React.CSSProperties = { fontSize: 14, lineHeight: 1.4, overflowWrap: 'anywhere' }
const muted: React.CSSProperties = { color: '#667186', fontSize: 13 }
const empty: React.CSSProperties = { ...panel, margin: 0, color: '#667186' }
const errorStyle: React.CSSProperties = { ...panel, color: '#b91c1c', fontSize: 13, margin: 0 }
const resultActions: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }
const primaryButton: React.CSSProperties = { border: 0, background: '#5145e8', color: '#fff', borderRadius: 9, padding: '10px 14px', fontWeight: 750, cursor: 'pointer', fontFamily: 'inherit', minHeight: 44, whiteSpace: 'nowrap' }
const secondaryButton: React.CSSProperties = { border: '1px solid #d5d1ff', background: '#f5f3ff', color: '#5145e8', borderRadius: 9, padding: '10px 12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', minHeight: 44, whiteSpace: 'nowrap' }
