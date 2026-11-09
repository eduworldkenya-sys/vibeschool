'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import VibeLearnSubnav from '@/components/student/VibeLearnSubnav'
import { useStudent } from '@/lib/student-context'
import { listMyAssessmentAssignments, type LearnerAssessmentAssignment } from '@/lib/assessment/discovery'
import { getLearnerAssessmentHub, type AssessmentResultSummary } from '@/lib/assessment/integration'

const isMath = (title: string) => /math(?:ematic)?s/i.test(title)
const isMock = (title: string) => /(?:kjsea|mock)/i.test(title)
const isGradeNine = (className: string) => /^(?:grade|class)\s*9$/i.test(className.trim())

function statusLabel(item: LearnerAssessmentAssignment): string {
  if (item.attemptStatus === 'in_progress') return 'Resume'
  if (item.percentage !== null) return 'View result'
  if (item.availability === 'upcoming') return 'Not open yet'
  if (item.availability === 'closed') return 'Closed'
  if (item.availability === 'attempts_exhausted') return 'Attempts used'
  return 'Start'
}

const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #dbe3eb', borderRadius: 18,
  padding: 20, color: '#16253d',
}
const secondary: React.CSSProperties = { color: '#64748b', fontSize: 13, lineHeight: 1.6 }
const action: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  minHeight: 46, border: 0, borderRadius: 11, padding: '10px 18px',
  background: '#244b87', color: '#fff', fontWeight: 700, cursor: 'pointer',
}

export default function GradeNineMathematicsPage() {
  const router = useRouter()
  const { identity, loading: identityLoading } = useStudent()
  const [assignments, setAssignments] = useState<LearnerAssessmentAssignment[]>([])
  const [results, setResults] = useState<AssessmentResultSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const allowed = !identityLoading && isGradeNine(identity?.className ?? '')
  useEffect(() => {
    if (identityLoading) return
    if (!allowed) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    Promise.all([listMyAssessmentAssignments(), getLearnerAssessmentHub()])
      .then(([items, hub]) => {
        if (cancelled) return
        // The canonical RPC already scopes assignments to the signed-in learner.
        setAssignments(items.filter(item => isMath(item.title)))
        setResults(hub.results.filter(item => isMath(item.assessmentTitle)))
      })
      .catch(reason => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Mathematics could not be loaded.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [allowed, identityLoading])

  const practice = useMemo(() => assignments.filter(item => !isMock(item.title)), [assignments])
  const mocks = useMemo(() => assignments.filter(item => isMock(item.title)), [assignments])

  function open(item: LearnerAssessmentAssignment) {
    if (item.percentage !== null) {
      router.push('/student/vibelearn/exams#exam-results')
      return
    }
    if (item.canStart) router.push(`/student/assessment/${item.assignmentId}`)
  }

  function assessmentCard(item: LearnerAssessmentAssignment) {
    const enabled = item.canStart || item.percentage !== null
    return <article key={item.assignmentId} style={card}>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'start' }}>
        <div>
          <strong style={{ fontSize: 17 }}>{item.title}</strong>
          <div style={{ ...secondary, marginTop: 6 }}>
            {item.assessmentType.replaceAll('_', ' ')}
            {item.timeLimitMinutes ? ` · ${item.timeLimitMinutes} min` : ''}
          </div>
        </div>
        {item.percentage !== null && <strong style={{ color: '#047857' }}>{item.percentage.toFixed(1)}%</strong>}
      </div>
      <div style={{ ...secondary, marginTop: 10 }}>{item.availability.replaceAll('_', ' ')}</div>
      <button type="button" disabled={!enabled} onClick={() => open(item)}
        style={{ ...action, marginTop: 14, opacity: enabled ? 1 : 0.55, cursor: enabled ? 'pointer' : 'not-allowed' }}>
        {statusLabel(item)}
      </button>
    </article>
  }

  return <main style={{ padding: '20px 16px 100px', background: '#f5f7fb', minHeight: '100vh' }}>
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <VibeLearnSubnav />
      <Link href="/student/vibelearn/exams" style={{ display: 'inline-block', padding: '12px 0', color: '#244b87', fontWeight: 700 }}>← Exams</Link>
      <header style={{ background: '#172b51', color: '#fff', borderRadius: 20, padding: 24, marginBottom: 20 }}>
        <div style={{ fontSize: 12, letterSpacing: 1, color: '#e4c676', fontWeight: 800 }}>GRADE 9 · KJSEA PRACTICE</div>
        <h1 style={{ fontSize: 30, margin: '9px 0' }}>Mathematics</h1>
        <p style={{ color: '#dbeafe', lineHeight: 1.6, margin: 0 }}>Choose an available practice assessment or mock examination. Your answers and results use your VibeSchool learner account.</p>
      </header>
      {identityLoading || loading ? <section style={card} role="status">Loading your Mathematics assessments…</section>
        : !allowed ? <section style={card} role="alert">
          <h2 style={{ marginTop: 0 }}>Grade 9 learners only</h2>
          <p style={secondary}>Sign in to an enrolled Grade 9 learner account to access this workspace.</p>
          <Link href="/student/vibelearn/exams">Back to Exams</Link>
        </section>
        : <>
          {error && <section style={{ ...card, borderColor: '#dc2626', marginBottom: 16 }} role="alert">{error}</section>}
          <section style={{ marginBottom: 22 }} aria-labelledby="grade9-topic-heading">
            <h2 id="grade9-topic-heading" style={{ fontSize: 22 }}>Topic practice</h2>
            <p style={secondary}>Approved practice assigned to your account appears below. Topics without approved questions are not shown as ready.</p>
            <div style={{ display: 'grid', gap: 12 }}>
              {practice.length ? practice.map(assessmentCard) : <div style={card}>
                <strong>Topic practice is being prepared</strong>
                <p style={secondary}>There is no approved Grade 9 Mathematics practice assigned to your account yet. The curriculum and questions must pass review before learners can start.</p>
              </div>}
            </div>
          </section>
          <section style={{ marginBottom: 22 }} aria-labelledby="grade9-mock-heading">
            <h2 id="grade9-mock-heading" style={{ fontSize: 22 }}>KJSEA-style mock</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              {mocks.length ? mocks.map(assessmentCard) : <div style={card}>
                <strong>No mock available yet</strong>
                <p style={secondary}>A full mock will appear when an authorised assessment has been approved and assigned. This is not an official KNEC examination.</p>
              </div>}
            </div>
          </section>
          <section aria-labelledby="grade9-results-heading">
            <h2 id="grade9-results-heading" style={{ fontSize: 22 }}>My Mathematics results</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              {results.length ? results.map(result => <article key={result.attemptId} style={card}>
                <strong>{result.assessmentTitle}</strong>
                <div style={{ ...secondary, marginTop: 6 }}>
                  Released {new Date(result.releasedAt).toLocaleDateString('en-KE')}
                </div>
                <p style={{ fontWeight: 800, fontSize: 20, marginBottom: 0 }}>
                  {result.score === null || result.maxScore === null ? 'Marking pending' : `${result.score} / ${result.maxScore}`}
                </p>
                {result.feedback && <p style={secondary}>{result.feedback}</p>}
              </article>) : <div style={card}><p style={secondary}>Your released Mathematics results will appear here after an assessment is completed and released.</p></div>}
            </div>
          </section>
        </>}
    </div>
  </main>
}
