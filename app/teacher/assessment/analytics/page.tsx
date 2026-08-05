'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import {
  getAssignmentAnalytics,
  listTeacherAssessmentAnalytics,
  type AssessmentAnalyticsDetail,
  type AssessmentAnalyticsSummary,
} from '@/lib/assessment/analytics'
import {
  getAssignmentIntelligence,
  type AssignmentIntelligence,
} from '@/lib/assessment/intelligence'

export default function AssessmentAnalyticsPage() {
  const [summaries, setSummaries] = useState<AssessmentAnalyticsSummary[]>([])
  const [detail, setDetail] = useState<AssessmentAnalyticsDetail | null>(null)
  const [intelligence, setIntelligence] = useState<AssignmentIntelligence | null>(null)
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
      const [analytics, insight] = await Promise.all([
        getAssignmentAnalytics(assignmentId),
        getAssignmentIntelligence(assignmentId),
      ])
      setDetail(analytics)
      setIntelligence(insight)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load assignment analytics.')
    } finally {
      setLoading(false)
    }
  }

  function back() {
    setDetail(null)
    setIntelligence(null)
  }

  return (
    <main style={shell}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <section style={card}>
          <div style={eyebrow}>Assessment Intelligence</div>
          <h1 style={{ margin: '6px 0' }}>Teacher Analytics</h1>
          <p style={{ margin: 0, color: '#6b7280' }}>Released-result evidence for learner performance, outcomes, difficulty, Bloom levels, and misconceptions.</p>
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
              <button type="button" onClick={back} style={secondaryButton}>← Back to assessments</button>
              <h2 style={{ margin: '14px 0 4px' }}>{detail.title}</h2>
              <p style={{ margin: 0, color: '#6b7280' }}>{detail.className}{detail.classStream ? ` ${detail.classStream}` : ''}</p>
              <div style={metricGrid}>
                <Metric label="Submission" value={`${detail.submissionRate.toFixed(1)}%`} />
                <Metric label="Average" value={detail.averagePercentage === null ? '—' : `${detail.averagePercentage.toFixed(1)}%`} />
                <Metric label="Highest" value={detail.highestPercentage === null ? '—' : `${detail.highestPercentage.toFixed(1)}%`} />
                <Metric label="Lowest" value={detail.lowestPercentage === null ? '—' : `${detail.lowestPercentage.toFixed(1)}%`} />
              </div>
            </section>

            {intelligence && intelligence.misconceptions.length > 0 && (
              <section style={{ ...card, borderColor: '#fecaca' }}>
                <h3 style={{ marginTop: 0, color: '#991b1b' }}>Misconception signals</h3>
                <div style={{ display: 'grid', gap: 10 }}>
                  {intelligence.misconceptions.map(item => (
                    <div key={item.assessmentItemId} style={{ ...questionBox, background: '#fef2f2', borderColor: '#fecaca' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <strong>Question {item.orderNum}</strong>
                        <strong style={{ color: '#b91c1c' }}>{item.averagePercentage?.toFixed(1) ?? '—'}%</strong>
                      </div>
                      <p style={{ margin: '8px 0', lineHeight: 1.5 }}>{item.prompt}</p>
                      <div style={muted}>{item.affectedLearners} learners below 50% · {item.zeroScoreCount} scored zero</div>
                      <div style={{ marginTop: 8, fontWeight: 700, color: '#7f1d1d' }}>{item.recommendedAction.replaceAll('_', ' ')}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {intelligence && intelligence.outcomes.length > 0 && (
              <section style={card}>
                <h3 style={{ marginTop: 0 }}>Outcome mastery</h3>
                <div style={{ display: 'grid', gap: 10 }}>
                  {intelligence.outcomes.map(outcome => (
                    <div key={outcome.outcomeId} style={dataRow}>
                      <div>
                        <strong>{outcome.outcomeCode ? `${outcome.outcomeCode} · ` : ''}{outcome.outcomeText}</strong>
                        <div style={muted}>{outcome.learnersBelow50} learners below 50% · {outcome.responseCount} responses</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <strong style={{ color: outcome.averagePercentage !== null && outcome.averagePercentage < 50 ? '#b91c1c' : '#065f46' }}>
                          {outcome.averagePercentage === null ? '—' : `${outcome.averagePercentage.toFixed(1)}%`}
                        </strong>
                        <div style={muted}>{outcome.masteryBand}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {intelligence && (
              <section style={card}>
                <h3 style={{ marginTop: 0 }}>Cognitive and difficulty profile</h3>
                <h4>Bloom levels</h4>
                <div style={bandGrid}>{intelligence.bloom.map(item => <Band key={item.label} item={item} />)}</div>
                <h4 style={{ marginTop: 18 }}>Difficulty levels</h4>
                <div style={bandGrid}>{intelligence.difficulty.map(item => <Band key={item.label} item={item} />)}</div>
              </section>
            )}

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
                {(intelligence?.questions ?? detail.questions).map(question => (
                  <div key={question.assessmentItemId} style={questionBox}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <strong>Question {question.orderNum}</strong>
                      <strong style={{ color: question.averagePercentage !== null && question.averagePercentage < 50 ? '#b91c1c' : '#065f46' }}>
                        {question.averagePercentage === null ? 'No released data' : `${question.averagePercentage.toFixed(1)}% avg`}
                      </strong>
                    </div>
                    <p style={{ margin: '8px 0', lineHeight: 1.5 }}>{question.prompt}</p>
                    {'difficulty' in question && <div style={muted}>{question.difficulty} · {question.bloomLevel} · {question.performanceBand.replaceAll('_', ' ')}</div>}
                    <div style={muted}>{question.responseCount} released responses · {question.zeroScoreCount} scored zero</div>
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

function Band({ item }: { item: { label: string; responseCount: number; averagePercentage: number | null; learnersBelow50: number } }) {
  return <div style={metric}>
    <strong style={{ textTransform: 'capitalize' }}>{item.label.replaceAll('_', ' ')}</strong>
    <div style={{ fontSize: 20, fontWeight: 800, marginTop: 5 }}>{item.averagePercentage === null ? '—' : `${item.averagePercentage.toFixed(1)}%`}</div>
    <div style={muted}>{item.responseCount} responses · {item.learnersBelow50} learners below 50%</div>
  </div>
}

const shell: React.CSSProperties = { minHeight: '100vh', background: '#f8fafc', padding: '18px 14px 80px', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#111827' }
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, marginBottom: 12 }
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: '#4338ca', textTransform: 'uppercase', letterSpacing: 1 }
const muted: React.CSSProperties = { fontSize: 12, color: '#6b7280', marginTop: 3 }
const rowButton: React.CSSProperties = { width: '100%', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }
const metricGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginTop: 16 }
const bandGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }
const metric: React.CSSProperties = { background: '#f8fafc', borderRadius: 12, padding: 12 }
const dataRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: 12, border: '1px solid #e5e7eb', borderRadius: 10 }
const questionBox: React.CSSProperties = { padding: 12, border: '1px solid #e5e7eb', borderRadius: 10, background: '#f8fafc' }
const secondaryButton: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 10, padding: '10px 14px', background: '#fff', color: '#374151', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }
