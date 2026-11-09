'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
    <div style={{ maxWidth: 900, width: '100%', margin: '0 auto' }}>
      <button type="button" onClick={() => router.push('/student/vibelearn')} style={back}>← Learn</button>
      <header style={hero}>
        <h1 style={{ margin: 0, fontSize: 28 }}>Exams</h1>
        <p style={{ margin: '8px 0 0', color: '#dbeafe' }}>Your available exams and results.</p>
      </header>

      {loading && <section style={card} role="status">Loading your exams…</section>}
      {!loading && <>
        <section style={card} aria-label="Available exams">
          <h2 style={heading}>Available exams</h2>
          {assessmentError && <p role="alert" style={errorStyle}>{assessmentError}</p>}
          {!assessmentError && available.length === 0 && <p style={muted}>No exam is available for you right now.</p>}
          <div style={{ display: 'grid', gap: 12 }}>
            {available.map(item => {
              const active = item.attemptStatus === 'in_progress'
                && (!item.attemptExpiresAt || Date.parse(item.attemptExpiresAt) > Date.now())
              return <article key={item.assignmentId} style={examCard}>
                <strong style={{ fontSize: 17 }}>{item.title}</strong>
                <div style={muted}>{item.timeLimitMinutes ? `${item.timeLimitMinutes} minutes · ` : ''}{item.assessmentType.replaceAll('_', ' ')}</div>
                <button type="button" style={primaryButton} onClick={() => router.push(`/student/assessment/${item.assignmentId}`)}>
                  {active ? 'Resume exam' : 'Start exam'}
                </button>
              </article>
            })}
          </div>
        </section>
        {(results.length > 0 || resultsError) && <section style={card} aria-label="My results">
          <h2 style={heading}>My results</h2>
          {resultsError && <p role="alert" style={errorStyle}>{resultsError}</p>}
          <div style={{ display: 'grid', gap: 10 }}>
            {results.map(result => <article key={result.attemptId} style={resultRow}>
              <div style={{ display: 'grid', gap: 6 }}>
                <strong>{result.assessmentTitle}</strong>
                <span style={muted}>{new Date(result.releasedAt).toLocaleDateString('en-KE')}</span>
              </div>
              <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
                <strong>{result.percentage == null ? '—' : `${result.percentage.toFixed(1)}%`}</strong>
                <button type="button" style={secondaryButton} onClick={() => router.push(`/student/results/${encodeURIComponent(result.attemptId)}`)}>View result</button>
              </div>
            </article>)}
          </div>
        </section>}
      </>}
    </div>
  </main>
}

const shell: React.CSSProperties = { minHeight: '100vh', background: '#f8fafc', padding: '18px clamp(12px,3vw,36px) 90px', color: '#0f172a', fontFamily: "'Plus Jakarta Sans', sans-serif" }
const back: React.CSSProperties = { background: 'transparent', border: 0, color: '#334155', padding: '8px 0 16px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }
const hero: React.CSSProperties = { background: '#172b51', color: '#fff', borderRadius: 18, padding: 24, marginBottom: 14 }
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 18, marginBottom: 14 }
const heading: React.CSSProperties = { margin: '0 0 16px', fontSize: 20 }
const muted: React.CSSProperties = { color: '#64748b', fontSize: 13 }
const errorStyle: React.CSSProperties = { color: '#b91c1c', fontSize: 13 }
const examCard: React.CSSProperties = { border: '1px solid #e2e8f0', borderRadius: 12, padding: 15, display: 'grid', justifyItems: 'start', gap: 10 }
const resultRow: React.CSSProperties = { border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }
const primaryButton: React.CSSProperties = { border: 0, background: '#294889', color: '#fff', borderRadius: 10, padding: '11px 16px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', minHeight: 44 }
const secondaryButton: React.CSSProperties = { border: '1px solid #c7d2fe', background: '#eef2ff', color: '#4338ca', borderRadius: 10, padding: '9px 12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }
