'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import VibeLearnSubnav from '@/components/student/VibeLearnSubnav'
import { getExamReadinessBrief, type ExamReadinessBrief } from '@/lib/student/vibelearn'
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

export default function VibeLearnExamsPage() {
  const router = useRouter()
  const [assignments, setAssignments] = useState<LearnerAssessmentAssignment[]>([])
  const [hub, setHub] = useState<LearnerAssessmentHub | null>(null)
  const [readiness, setReadiness] = useState<ExamReadinessBrief | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([listMyAssessmentAssignments(), getLearnerAssessmentHub(), getExamReadinessBrief()])
      .then(([items, assessmentHub, readinessBrief]) => {
        if (cancelled) return
        setAssignments(items)
        setHub(assessmentHub)
        setReadiness(readinessBrief)
      })
      .catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not load your exams.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return <main style={shell}>
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <VibeLearnSubnav />
      <section style={hero}>
        <div style={eyebrow}>Exams</div>
        <h1 style={{ margin: '7px 0 5px' }}>Tests, mocks and assessment history</h1>
        <p style={{ margin: 0, color: '#cbd5e1', lineHeight: 1.6 }}>Use practice for learning and this space for assigned tests, released results and exam-readiness evidence.</p>
      </section>

      {error && <section style={{ ...card, color: '#b91c1c' }}>{error}</section>}
      {loading ? <section style={card}>Loading exams…</section> : <>
        {readiness && <section style={{ ...card, borderColor: '#f59e0b', background: '#fffaf0' }}>
          <div style={eyebrowDark}>Exam readiness</div>
          <h2 style={title}>{readiness.examName} focus</h2>
          <div style={metrics}>
            <Metric label="Days remaining" value={readiness.daysRemaining ?? '—'} />
            <Metric label="Attempts" value={readiness.attemptCount} />
            <Metric label="Average" value={readiness.averagePercentage == null ? '—' : `${readiness.averagePercentage}%`} />
            <Metric label="Confidence" value={readiness.confidenceCheck == null ? '—' : `${readiness.confidenceCheck}/5`} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <button style={secondaryButton} onClick={() => router.push('/student/vibelearn/practice')}>Open practice</button>
            <button style={secondaryButton} onClick={() => router.push('/student/vibelearn/revision')}>Open revision</button>
          </div>
        </section>}

        <section style={card}>
          <div style={eyebrowDark}>Assigned exams and quizzes</div>
          <h2 style={title}>Your assessment queue</h2>
          {assignments.length === 0 ? <p style={muted}>Teacher-assigned quizzes, tests and exams will appear here.</p> : <div style={{ display: 'grid', gap: 10 }}>
            {assignments.map(item => {
              const enabled = item.canStart || item.percentage !== null
              const destination = item.percentage !== null && item.attemptId
                ? `/student/results/${item.attemptId}`
                : `/student/assessment/${item.assignmentId}`
              return <article key={item.assignmentId} style={itemCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div><div style={eyebrowDark}>{item.assessmentType.replaceAll('_', ' ')}</div><strong>{item.title}</strong></div>
                  {item.percentage !== null && <strong style={{ color: '#047857' }}>{item.percentage.toFixed(1)}%</strong>}
                </div>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 9 }}>
                  <span style={pill}>{item.availability.replaceAll('_', ' ')}</span>
                  {item.timeLimitMinutes && <span style={pill}>{item.timeLimitMinutes} min</span>}
                  {item.attemptNumber && <span style={pill}>Attempt {item.attemptNumber}/{item.maxAttempts}</span>}
                </div>
                <button style={{ ...primaryButton, marginTop: 12, opacity: enabled ? 1 : 0.55 }} disabled={!enabled} onClick={() => enabled && router.push(destination)}>{actionLabel(item)}</button>
              </article>
            })}
          </div>}
        </section>

        <section style={card}>
          <div style={eyebrowDark}>Released results</div>
          <h2 style={title}>Your exam history</h2>
          {!hub || hub.results.length === 0 ? <p style={muted}>Released marks and feedback will appear here.</p> : <div style={{ display: 'grid', gap: 9 }}>
            {hub.results.map(result => <button key={result.attemptId} type="button" style={resultRowButton} onClick={() => router.push(`/student/results/${result.attemptId}`)}>
              <div style={{ textAlign: 'left' }}><strong>{result.assessmentTitle}</strong><div style={muted}>{result.assessmentType.replaceAll('_', ' ')} · {new Date(result.releasedAt).toLocaleDateString('en-KE')}</div>{result.feedback && <div style={{ marginTop: 5, fontSize: 12 }}>{result.feedback}</div>}</div>
              <div style={{ display: 'grid', justifyItems: 'end', gap: 4 }}><strong>{result.percentage == null ? '—' : `${result.percentage.toFixed(1)}%`}</strong><span style={{ ...muted, color: '#4338ca', fontWeight: 800 }}>Review →</span></div>
            </button>)}
          </div>}
        </section>
      </>}
    </div>
  </main>
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div style={metric}><span style={muted}>{label}</span><strong style={{ fontSize: 22 }}>{value}</strong></div>
}

const shell: React.CSSProperties = { minHeight: '100vh', background: '#f8fafc', padding: '18px 14px 90px', color: '#0f172a', fontFamily: "'Plus Jakarta Sans', sans-serif" }
const hero: React.CSSProperties = { background: 'linear-gradient(135deg,#0f172a,#312e81)', color: '#fff', borderRadius: 20, padding: 20, marginBottom: 12 }
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 16, marginBottom: 12 }
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.1, color: '#a5b4fc' }
const eyebrowDark: React.CSSProperties = { fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.1, color: '#4f46e5' }
const title: React.CSSProperties = { margin: '5px 0 12px', fontSize: 20 }
const muted: React.CSSProperties = { fontSize: 12, color: '#64748b', margin: 0 }
const metrics: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }
const metric: React.CSSProperties = { border: '1px solid #fde68a', background: '#fff', borderRadius: 12, padding: 12, display: 'grid', gap: 4 }
const itemCard: React.CSSProperties = { border: '1px solid #e2e8f0', borderRadius: 13, padding: 13 }
const resultRowButton: React.CSSProperties = { width: '100%', border: '1px solid #e2e8f0', borderRadius: 12, padding: 12, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', background: '#fff', color: '#0f172a', cursor: 'pointer', fontFamily: 'inherit' }
const pill: React.CSSProperties = { fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 999, background: '#f1f5f9', color: '#475569' }
const primaryButton: React.CSSProperties = { border: 'none', background: '#4f46e5', color: '#fff', borderRadius: 11, padding: '10px 14px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }
const secondaryButton: React.CSSProperties = { border: '1px solid #c7d2fe', background: '#eef2ff', color: '#4338ca', borderRadius: 10, padding: '8px 11px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }
