'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { listMyAssessmentAssignments, type LearnerAssessmentAssignment } from '@/lib/assessment/discovery'
import { getLearnerAssessmentHub, type LearnerAssessmentHub } from '@/lib/assessment/integration'

function actionLabel(item: LearnerAssessmentAssignment): string {
  if (item.attemptStatus === 'in_progress') return 'Resume'
  if (item.percentage !== null) return 'View result'
  if (item.availability === 'upcoming') return 'Not open yet'
  if (item.availability === 'closed') return 'Closed'
  if (item.availability === 'attempts_exhausted') return 'Attempts used'
  return 'Start'
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export default function StudentAssessmentsPage() {
  const router = useRouter()
  const [items, setItems] = useState<LearnerAssessmentAssignment[]>([])
  const [hub, setHub] = useState<LearnerAssessmentHub | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [assignments, assessmentHub] = await Promise.all([
          listMyAssessmentAssignments(),
          getLearnerAssessmentHub(),
        ])
        if (!cancelled) {
          setItems(assignments)
          setHub(assessmentHub)
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Could not load assessments.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  return (
    <main style={shell}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <section style={card}>
          <div style={eyebrow}>Assessment Hub</div>
          <h1 style={{ margin: '6px 0' }}>Quizzes, Results and Revision</h1>
          <p style={{ margin: 0, color: '#6b7280' }}>Open assigned work, resume active attempts, review released feedback, and follow your next revision priorities.</p>
        </section>

        {loading ? <section style={card}>Loading assessments…</section>
          : error ? <section style={{ ...card, color: '#b91c1c' }}>{error}</section>
          : <>
            <section style={card}>
              <h2 style={sectionTitle}>Assigned work</h2>
              {items.length === 0 ? <div><strong>No assessments assigned yet</strong><p style={{ color: '#6b7280', marginBottom: 0 }}>New quizzes and practice activities will appear here.</p></div>
                : items.map(item => {
                  const enabled = item.canStart || item.percentage !== null
                  return (
                    <div key={item.assignmentId} style={itemBox}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <div><div style={eyebrow}>{item.assessmentType.replaceAll('_', ' ')}</div><h3 style={{ fontSize: 17, margin: '5px 0' }}>{item.title}</h3></div>
                        {item.percentage !== null && <strong style={{ color: '#065f46' }}>{item.percentage.toFixed(1)}%</strong>}
                      </div>
                      {item.instructions && <p style={{ color: '#6b7280', lineHeight: 1.5 }}>{item.instructions}</p>}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                        {item.timeLimitMinutes && <span style={pill}>{item.timeLimitMinutes} minutes</span>}
                        {item.closesAt && <span style={pill}>Due {new Date(item.closesAt).toLocaleString('en-KE')}</span>}
                        <span style={pill}>{item.availability.replaceAll('_', ' ')}</span>
                        {item.attemptNumber && <span style={pill}>Attempt {item.attemptNumber}/{item.maxAttempts}</span>}
                      </div>
                      <button type="button" disabled={!enabled} onClick={() => enabled && router.push(`/student/assessment/${item.assignmentId}`)} style={{ ...primaryButton, opacity: enabled ? 1 : 0.55, cursor: enabled ? 'pointer' : 'not-allowed' }}>
                        {actionLabel(item)}
                      </button>
                    </div>
                  )
                })}
            </section>

            <section style={card}>
              <h2 style={sectionTitle}>Released results</h2>
              {!hub || hub.results.length === 0 ? <p style={muted}>Released marks and teacher feedback will appear here.</p>
                : <div style={{ display: 'grid', gap: 10 }}>
                  {hub.results.map(result => <div key={result.attemptId} style={dataRow}>
                    <div>
                      <strong>{result.assessmentTitle}</strong>
                      <div style={muted}>{result.assessmentType.replaceAll('_', ' ')} · {new Date(result.releasedAt).toLocaleDateString('en-KE')}</div>
                      {result.feedback && <div style={{ marginTop: 6, fontSize: 13, color: '#374151' }}>{result.feedback}</div>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <strong style={{ color: result.percentage !== null && result.percentage < 50 ? '#b91c1c' : '#065f46' }}>{result.percentage === null ? '—' : `${result.percentage.toFixed(1)}%`}</strong>
                      <div style={muted}>{result.score ?? '—'}/{result.maxScore ?? '—'}</div>
                    </div>
                  </div>)}
                </div>}
            </section>

            <section style={card}>
              <h2 style={sectionTitle}>Revision priorities</h2>
              {!hub || hub.recommendations.length === 0 ? <p style={muted}>Revision guidance will appear after enough released assessment evidence is available.</p>
                : <div style={{ display: 'grid', gap: 10 }}>
                  {hub.recommendations.slice(0, 6).map((value, index) => {
                    const item = asRecord(value)
                    const title = typeof item.title === 'string' ? item.title : 'Revision priority'
                    const reason = typeof item.reason === 'string' ? item.reason : 'Based on your recent assessment evidence.'
                    const status = typeof item.status === 'string' ? item.status.replaceAll('_', ' ') : 'active'
                    return <div key={`${title}-${index}`} style={recommendationBox}><strong>{title}</strong><div style={{ marginTop: 5, fontSize: 13 }}>{reason}</div><div style={muted}>{status}</div></div>
                  })}
                </div>}
            </section>

            <section style={card}>
              <h2 style={sectionTitle}>Learning timeline</h2>
              {!hub || hub.timeline.length === 0 ? <p style={muted}>Your released assessment milestones will appear here.</p>
                : <div style={{ display: 'grid', gap: 8 }}>
                  {hub.timeline.slice(0, 8).map((value, index) => {
                    const item = asRecord(value)
                    const title = typeof item.title === 'string' ? item.title : 'Assessment update'
                    const summary = typeof item.summary === 'string' ? item.summary : ''
                    const occurredAt = typeof item.occurred_at === 'string' ? item.occurred_at : null
                    return <div key={`${title}-${index}`} style={timelineRow}><strong>{title}</strong>{summary && <div style={{ marginTop: 4, fontSize: 13 }}>{summary}</div>}{occurredAt && <div style={muted}>{new Date(occurredAt).toLocaleString('en-KE')}</div>}</div>
                  })}
                </div>}
            </section>
          </>}
      </div>
    </main>
  )
}

const shell: React.CSSProperties = { minHeight: '100vh', background: '#f8fafc', padding: '18px 14px 80px', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#111827' }
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, marginBottom: 12 }
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: '#4338ca', textTransform: 'uppercase', letterSpacing: 1 }
const sectionTitle: React.CSSProperties = { margin: '0 0 12px', fontSize: 18 }
const muted: React.CSSProperties = { fontSize: 12, color: '#6b7280', margin: 0 }
const pill: React.CSSProperties = { fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 20, background: '#f3f4f6', color: '#4b5563' }
const primaryButton: React.CSSProperties = { width: '100%', border: 'none', borderRadius: 12, padding: '12px 16px', background: '#4338ca', color: '#fff', fontWeight: 800, fontSize: 13, fontFamily: 'inherit' }
const itemBox: React.CSSProperties = { border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, marginBottom: 10 }
const dataRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }
const recommendationBox: React.CSSProperties = { border: '1px solid #ddd6fe', background: '#f5f3ff', borderRadius: 12, padding: 12 }
const timelineRow: React.CSSProperties = { borderLeft: '3px solid #4338ca', padding: '8px 12px', background: '#f8fafc', borderRadius: 8 }
