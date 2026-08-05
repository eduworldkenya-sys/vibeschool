'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import {
  getAssignmentAnalytics,
  listTeacherAssessmentAnalytics,
  type AssessmentAnalyticsDetail,
  type AssessmentAnalyticsSummary,
} from '@/lib/assessment/analytics'

export default function AssessmentAnalyticsPage() {
  const [summaries, setSummaries] = useState<AssessmentAnalyticsSummary[]>([])
  const [detail, setDetail] = useState<AssessmentAnalyticsDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await listTeacherAssessmentAnalytics()
        if (!cancelled) setSummaries(data)
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load analytics.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  async function openDetail(assignmentId: string) {
    setLoading(true)
    setError('')
    try {
      setDetail(await getAssignmentAnalytics(assignmentId))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load assignment analytics.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={shell}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <section style={card}>
          <div style={eyebrow}>Assessment Engine</div>
          <h1 style={{ margin: '6px 0' }}>Teacher Analytics</h1>
          <p style={{ margin: 0, color: '#6b7280' }}>Submission, performance, question difficulty, and learners needing support.</p>
        </section>

        {error && <section style={{ ...card, color: '#b91c1c' }}>{error}</section>}

        {!detail ? (
          <section style={card}>
            {loading ? 'Loading analytics…' : summaries.length === 0 ? (
              <div><strong>No assessment analytics yet</strong><p style={{ color: '#6b7280', marginBottom: 0 }}>Assigned assessments will appear here.</p></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {summaries.map(item => {
                  const submissionRate = item.eligibleLearners > 0
                    ? Math.round((item.submittedCount / item.eligibleLearners) * 100)
                    : 0
                  return (
                    <button key={item.assignmentId} type="button" onClick={() => void openDetail(item.assignmentId)} style={rowButton}>
                      <div style={{ textAlign: 'left' }}>
                        <div style={eyebrow}>{item.assessmentType.replaceAll('_', ' ')}</div>
                        <strong>{item.title}</strong>
                        <div style={muted}>{item.className}{item.classStream ? ` ${item.classStream}` : ''}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <strong>{item.averagePercentage === null ? '—' : `${item.averagePercentage.toFixed(1)}%`}</strong>
                        <div style={muted}>{submissionRate}% submitted</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        ) : (
          <>
            <section style={card}>
              <button type="button" onClick={() => setDetail(null)} style={secondaryButton}>← Back to assessments</button>
              <h2 style={{ margin: '14px 0 4px' }}>{detail.title}</h2>
              <p style={{ margin: 0, color: '#6b7280' }}>{detail.className}{detail.classStream ? ` ${detail.classStream}` : ''}</p>
              <div style={metricGrid}>
                <Metric label="Submission" value={`${detail.submissionRate.toFixed(1)}%`} />
                <Metric label="Average" value={detail.averagePercentage === null ? '—' : `${detail.averagePercentage.toFixed(1)}%`} />
                <Metric label="Highest" value={detail.highestPercentage === null ? '—' : `${detail.highestPercentage.toFixed(1)}%`} />
                <Metric label="Lowest" value={detail.lowestPercentage === null ? '—' : `${detail.lowestPercentage.toFixed(1)}%`} />
              </div>
            </section>

            <section style={card}>
              <h3 style={{ marginTop: 0 }}>Learner performance</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {detail.learners.map(learner => (
                  <div key={learner.studentId} style={dataRow}>
                    <div>
                      <strong>{learner.studentName}</strong>
                      <div style={muted}>{learner.attemptStatus ? learner.attemptStatus.replaceAll('_', ' ') : 'Not submitted'}</div>
                    </div>
                    <strong style={{ color: learner.percentage !== null && learner.percentage < 50 ? '#b91c1c' : '#065f46' }}>
                      {learner.percentage === null ? '—' : `${learner.percentage.toFixed(1)}%`}
                    </strong>
                  </div>
                ))}
              </div>
            </section>

            <section style={card}>
              <h3 style={{ marginTop: 0 }}>Question performance</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {detail.questions.map(question => (
                  <div key={question.assessmentItemId} style={questionBox}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <strong>Question {question.orderNum}</strong>
                      <strong style={{ color: question.averagePercentage !== null && question.averagePercentage < 50 ? '#b91c1c' : '#065f46' }}>
                        {question.averagePercentage === null ? 'No data' : `${question.averagePercentage.toFixed(1)}% avg`}
                      </strong>
                    </div>
                    <p style={{ margin: '8px 0', lineHeight: 1.5 }}>{question.prompt}</p>
                    <div style={muted}>{question.responseCount} responses · {question.zeroScoreCount} scored zero</div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div style={metric}><div style={muted}>{label}</div><strong style={{ fontSize: 20 }}>{value}</strong></div>
}

const shell: React.CSSProperties = { minHeight: '100vh', background: '#f8fafc', padding: '18px 14px 80px', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#111827' }
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, marginBottom: 12 }
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: '#4338ca', textTransform: 'uppercase', letterSpacing: 1 }
const muted: React.CSSProperties = { fontSize: 12, color: '#6b7280', marginTop: 3 }
const rowButton: React.CSSProperties = { width: '100%', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }
const metricGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginTop: 16 }
const metric: React.CSSProperties = { background: '#f8fafc', borderRadius: 12, padding: 12 }
const dataRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: 12, border: '1px solid #e5e7eb', borderRadius: 10 }
const questionBox: React.CSSProperties = { padding: 12, border: '1px solid #e5e7eb', borderRadius: 10, background: '#f8fafc' }
const secondaryButton: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 10, padding: '10px 14px', background: '#fff', color: '#374151', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }
