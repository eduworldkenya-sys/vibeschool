'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import VibeLearnSubnav from '@/components/student/VibeLearnSubnav'
import { useStudent } from '@/lib/student-context'
import { getKcseCandidateOS, createKcseMock, type KcseCandidateOS } from '@/lib/student/kcse'
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
  const { identity, loading: identityLoading } = useStudent()
  const isGrade4 = !identityLoading && /^(grade|class)\s*4$/i.test(identity?.className?.trim() ?? '')
  const isForm4 = !identityLoading && /^form\s*4$/i.test(identity?.className?.trim() ?? '')
  const [assignments, setAssignments] = useState<LearnerAssessmentAssignment[]>([])
  const [hub, setHub] = useState<LearnerAssessmentHub | null>(null)
  const [readiness, setReadiness] = useState<ExamReadinessBrief | null>(null)
  const [kcse, setKcse] = useState<KcseCandidateOS | null>(null)
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedPaper, setSelectedPaper] = useState('')
  const [starting, setStarting] = useState(false)
  const [catalogueError, setCatalogueError] = useState('')
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

  useEffect(() => {
    let cancelled = false
    if (!isForm4) return
    getKcseCandidateOS().then(value => { if (!cancelled) setKcse(value) }).catch(() => { if (!cancelled) setCatalogueError('KCSE paper catalogue is unavailable.') })
    return () => { cancelled = true }
  }, [isForm4])

  const papers = kcse?.paper_blueprints ?? []
  const subjects = Array.from(new Set(papers.map(paper => paper.subject))).sort()
  const subjectPapers = papers.filter(paper => paper.subject === selectedSubject)
  const chosenPaper = subjectPapers.find(paper => paper.id === selectedPaper)

  async function startSelectedPaper() {
    if (!chosenPaper || starting) return
    setStarting(true)
    setCatalogueError('')
    try {
      const clientId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
      const result = await createKcseMock(chosenPaper.subject, chosenPaper.paper_code, clientId)
      if (result.ok && result.session_id) router.push(`/student/vibelearn/kcse/mock/${result.session_id}?client=${encodeURIComponent(clientId)}`)
      else setCatalogueError(result.reason?.replaceAll('_', ' ') ?? 'This paper cannot be started yet.')
    } catch (reason) { setCatalogueError(reason instanceof Error ? reason.message : 'Could not start paper.') }
    finally { setStarting(false) }
  }

  return <main style={shell}>
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <VibeLearnSubnav />
      <section style={{ ...hero, background: '#172b51', padding: 24 }}>
        <button type="button" onClick={() => router.push('/student/vibelearn')} style={{ background: 'transparent', border: 0, color: '#fff', padding: '0 0 18px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>← Learn</button>
        <h1 style={{ margin: '0 0 8px', fontSize: 30 }}>Exams</h1>
        <p style={{ margin: 0, color: '#dbeafe', lineHeight: 1.6 }}>Practise, take exams and track your progress.</p>
      </section>

      <nav aria-label="Exam tools" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12, marginBottom: 16 }}>
        {([
          { icon: '▤', title: 'Practice Exams', description: 'Choose a subject', href: '/student/vibelearn/practice' },
          { icon: '◷', title: 'Mock Exams', description: 'Timed papers', href: isForm4 ? '/student/vibelearn/kcse' : '#school-exams' },
          { icon: '▣', title: 'Past Papers', description: isForm4 ? 'Verified papers' : 'Available school papers', href: isForm4 ? '#choose-exam' : '#school-exams' },
          { icon: '▥', title: 'My Results', description: 'Scores & progress', href: '#exam-results' },
        ] as const).map(item => <button key={item.title} type="button" onClick={() => item.href.startsWith('#') ? document.getElementById(item.href.slice(1))?.scrollIntoView({ behavior: 'smooth' }) : router.push(item.href)} style={{ border: 0, background: '#101827', color: '#fff', borderRadius: 18, padding: 20, minHeight: 154, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
          <span aria-hidden="true" style={{ fontSize: 26, lineHeight: 1 }}>{item.icon}</span>
          <strong style={{ fontSize: 17 }}>{item.title}</strong>
          <span style={{ fontSize: 12, color: '#cbd5e1', marginTop: 'auto' }}>{item.description}</span>
        </button>)}
      </nav>

      {isGrade4 && assignments.filter(item => /^Grade 4 English — Pilot 01$/i.test(item.title)).map(item =>
        <section key={item.assignmentId} style={{ ...card, padding: 20, borderColor: '#a7d7c4' }} aria-label="Grade 4 English exam">
          <div style={eyebrowDark}>Grade 4 · English</div>
          <h2 style={title}>English practice exam</h2>
          <p style={muted}>10 questions · 20 minutes · Your answers are saved securely as you go.</p>
          <button type="button" style={{ ...primaryButton, marginTop: 12, opacity: item.canStart || item.percentage !== null ? 1 : 0.55 }} disabled={!item.canStart && item.percentage === null} onClick={() => router.push(`/student/assessment/${item.assignmentId}`)}>{actionLabel(item)}</button>
        </section>
      )}

      {isGrade4 && <section style={{ ...card, padding: 20, borderColor: '#a7d7c4' }} aria-label="Grade 4 Mathematics exams">
        <div style={eyebrowDark}>Grade 4 · Mathematics</div>
        <h2 style={title}>Mathematics exam</h2>
        <p style={muted}>Answer one question at a time. Your answers are saved as you go, and your results appear when released.</p>
        {assignments.filter(item => /math(?:ematic)?s/i.test(item.title)).length === 0
          ? <p style={{ ...muted, marginTop: 12 }}>No approved Mathematics exam has been assigned yet. Your teacher can publish one through the existing assessment system.</p>
          : assignments.filter(item => /math(?:ematic)?s/i.test(item.title)).map(item => <div key={item.assignmentId} style={{ ...itemCard, marginTop: 12 }}>
              <strong>{item.title}</strong>
              <p style={{ ...muted, marginTop: 6 }}>{item.timeLimitMinutes ? `${item.timeLimitMinutes} minutes · ` : ''}{item.availability.replaceAll('_', ' ')}</p>
              <button type="button" style={{ ...primaryButton, marginTop: 12 }} disabled={!item.canStart} onClick={() => router.push(`/student/assessment/${item.assignmentId}`)}>{item.attemptStatus === 'in_progress' ? 'Resume exam' : 'Start exam'}</button>
            </div>)}
      </section>}

      {isForm4 ? <section id="choose-exam" style={{ ...card, scrollMarginTop: 20, padding: 20 }}>
        <h2 style={{ ...title, marginBottom: 18 }}>Choose your exam</h2>
        <div style={{ display: 'grid', gap: 0 }}>
          <div style={examPickerRow}><span>Level</span><strong>KCSE · Form 4</strong></div>
          <label style={examPickerRow}><span>Subject</span><select aria-label="Subject" value={selectedSubject} onChange={event => { setSelectedSubject(event.target.value); setSelectedPaper('') }} style={examPickerSelect}>
            <option value="">Select subject</option>
            {subjects.map(subject => <option key={subject} value={subject}>{subject}</option>)}
          </select></label>
          <label style={examPickerRow}><span>Paper</span><select aria-label="Paper" value={selectedPaper} disabled={!selectedSubject} onChange={event => setSelectedPaper(event.target.value)} style={examPickerSelect}>
            <option value="">Select paper</option>
            {subjectPapers.map(paper => <option key={paper.id} value={paper.id}>{paper.paper_code} · {paper.title}</option>)}
          </select></label>
        </div>
        {chosenPaper && <p style={{ ...muted, marginTop: 12 }}>{chosenPaper.duration_minutes} minutes · {chosenPaper.total_marks} marks</p>}
        {catalogueError && <p role="alert" style={{ color: '#b91c1c', fontSize: 13 }}>{catalogueError}</p>}
        {kcse && papers.length === 0 && <p style={{ ...muted, marginTop: 12 }}>No verified papers available yet. You can still practise by subject.</p>}
        <button style={{ ...primaryButton, width: '100%', minHeight: 52, marginTop: 18, background: '#294889', opacity: chosenPaper && !starting ? 1 : 0.55 }} disabled={!chosenPaper || starting} onClick={() => void startSelectedPaper()}>{starting ? 'Starting…' : 'Start Exam'}</button>
      </section> : <section style={{ ...card, padding: 20 }}><h2 style={title}>{identity?.className || "Your class"} exams</h2><p style={muted}>Choose an available teacher-assigned exam below. KCSE papers are for Form 4 learners only.</p><button type="button" style={{ ...primaryButton, marginTop: 12 }} onClick={() => document.getElementById("school-exams")?.scrollIntoView({ behavior: "smooth" })}>View available exams</button></section>}

      <button type="button" onClick={() => document.getElementById('school-exams')?.scrollIntoView({ behavior: 'smooth' })} style={{ ...card, display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: '#0f172a' }}>
        <span><strong style={{ fontSize: 18 }}>School Exams</strong><span style={{ ...muted, display: 'block', marginTop: 8 }}>Teacher-assigned tests and examinations</span></span>
        <span aria-hidden="true" style={{ fontSize: 24 }}>›</span>
      </button>

      {error && <section role="alert" style={{ ...card, color: '#b91c1c' }}>{error}</section>}
      {loading && <section style={card}>Loading your school exams and results…</section>}
      {!loading && <>
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

        <section id="school-exams" style={{ ...card, scrollMarginTop: 20 }}>
          <div style={eyebrowDark}>Assigned exams and quizzes</div>
          <h2 style={title}>Your assessment queue</h2>
          {assignments.length === 0 ? <p style={muted}>Teacher-assigned quizzes, tests and exams will appear here.</p> : <div style={{ display: 'grid', gap: 10 }}>
            {assignments.map(item => {
              const enabled = item.canStart || item.percentage !== null
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
                <button style={{ ...primaryButton, marginTop: 12, opacity: enabled ? 1 : 0.55 }} disabled={!enabled} onClick={() => enabled && router.push(`/student/assessment/${item.assignmentId}`)}>{actionLabel(item)}</button>
              </article>
            })}
          </div>}
        </section>

        <section id="exam-results" style={{ ...card, scrollMarginTop: 20 }}>
          <div style={eyebrowDark}>Released results</div>
          <h2 style={title}>Your exam history</h2>
          {!hub || hub.results.length === 0 ? <p style={muted}>Released marks and feedback will appear here.</p> : <div style={{ display: 'grid', gap: 9 }}>
            {hub.results.map(result => <div key={result.attemptId} style={row}>
              <div><strong>{result.assessmentTitle}</strong><div style={muted}>{result.assessmentType.replaceAll('_', ' ')} · {new Date(result.releasedAt).toLocaleDateString('en-KE')}</div>{result.feedback && <div style={{ marginTop: 5, fontSize: 12 }}>{result.feedback}</div>}</div>
              <strong>{result.percentage == null ? '—' : `${result.percentage.toFixed(1)}%`}</strong>
            </div>)}
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
const row: React.CSSProperties = { border: '1px solid #e2e8f0', borderRadius: 12, padding: 12, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }
const pill: React.CSSProperties = { fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 999, background: '#f1f5f9', color: '#475569' }
const primaryButton: React.CSSProperties = { border: 'none', background: '#4f46e5', color: '#fff', borderRadius: 11, padding: '10px 14px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }
const secondaryButton: React.CSSProperties = { border: '1px solid #c7d2fe', background: '#eef2ff', color: '#4338ca', borderRadius: 10, padding: '8px 11px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }

const independentAction: React.CSSProperties = { border: '1px solid #c7d2fe', borderRadius: 12, background: '#fff', padding: 14, textAlign: 'left', cursor: 'pointer', display: 'grid', gap: 8, fontFamily: 'inherit', color: '#0f172a' }

const examSelect: React.CSSProperties = { border: '1px solid #cbd5e1', borderRadius: 10, padding: 11, background: '#fff', color: '#0f172a', width: '100%', fontFamily: 'inherit' }

const examPickerRow: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 76, borderBottom: '1px solid #e2e8f0', fontSize: 14 }
const examPickerSelect: React.CSSProperties = { minWidth: 0, maxWidth: '66%', padding: '12px 4px', border: 0, background: 'transparent', color: '#0f172a', fontWeight: 700, fontSize: 14, textAlign: 'right', fontFamily: 'inherit' }
