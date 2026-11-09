'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { listMyAssessmentAssignments, type LearnerAssessmentAssignment } from '@/lib/assessment/discovery'
import { getLearnerAssessmentHub, type LearnerAssessmentHub } from '@/lib/assessment/integration'
import './exams.css'

type View = 'for-you' | 'history' | 'progress'
type ExamState = 'in-progress' | 'new' | 'completed' | 'awaiting' | 'retake' | 'unavailable'

function examState(item: LearnerAssessmentAssignment): ExamState {
  const active = item.attemptStatus === 'in_progress'
    && (!item.attemptExpiresAt || Date.parse(item.attemptExpiresAt) > Date.now())
  if (active) return 'in-progress'
  if (item.attemptId) {
    if (item.resultStatus === 'released' || (item.assessmentType === 'practice'
      && item.showScorePolicy === 'immediate' && item.resultStatus === 'marked')) return 'completed'
    if (item.submittedAt || item.resultStatus === 'pending' && item.attemptStatus !== 'in_progress'
      || item.resultStatus === 'partially_marked' || item.resultStatus === 'marked') return 'awaiting'
    if (item.canStart) return 'retake'
    return 'unavailable'
  }
  return item.canStart ? 'new' : 'unavailable'
}

const statusText: Record<ExamState, string> = {
  'in-progress': 'In progress',
  new: 'New',
  completed: 'Completed',
  awaiting: 'Awaiting result',
  retake: 'Retake available',
  unavailable: 'Unavailable',
}

export default function VibeLearnExamsPage() {
  const router = useRouter()
  const [assignments, setAssignments] = useState<LearnerAssessmentAssignment[]>([])
  const [hub, setHub] = useState<LearnerAssessmentHub | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('for-you')
  const [assessmentError, setAssessmentError] = useState('')
  const [resultsError, setResultsError] = useState('')
  const [retake, setRetake] = useState<LearnerAssessmentAssignment | null>(null)

  const reload = useCallback(() => {
    let mounted = true
    setLoading(true)
    setAssessmentError('')
    setResultsError('')
    Promise.allSettled([listMyAssessmentAssignments(), getLearnerAssessmentHub()])
      .then(([assignmentResult, resultsResult]) => {
        if (!mounted) return
        if (assignmentResult.status === 'fulfilled') setAssignments(assignmentResult.value)
        else setAssessmentError('Exams could not be loaded. Try again.')
        if (resultsResult.status === 'fulfilled') setHub(resultsResult.value)
        else setResultsError('Results could not be loaded. Try again.')
      })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  useEffect(() => reload(), [reload])

  const groups = useMemo(() => {
    const ongoing: LearnerAssessmentAssignment[] = []
    const fresh: LearnerAssessmentAssignment[] = []
    const retakes: LearnerAssessmentAssignment[] = []
    const awaiting: LearnerAssessmentAssignment[] = []
    const completed: LearnerAssessmentAssignment[] = []
    for (const item of assignments) {
      const state = examState(item)
      if (state === 'in-progress') ongoing.push(item)
      else if (state === 'new') fresh.push(item)
      else if (state === 'retake') retakes.push(item)
      else if (state === 'awaiting') awaiting.push(item)
      else if (state === 'completed') {
        completed.push(item)
        if (item.canStart) retakes.push(item)
      }
    }
    return { ongoing, fresh, retakes, awaiting, completed }
  }, [assignments])
  const results = hub?.results ?? []
  const scored = results.filter(r => r.percentage !== null)
  const average = scored.length ? scored.reduce((sum, r) => sum + (r.percentage ?? 0), 0) / scored.length : null

  function start(item: LearnerAssessmentAssignment) {
    router.push(`/student/assessment/${encodeURIComponent(item.assignmentId)}`)
  }

  function examCard(item: LearnerAssessmentAssignment, kind: ExamState) {
    const action = kind === 'in-progress' ? 'Resume exam' : kind === 'new' ? 'Start exam'
      : kind === 'retake' ? 'Retake exam' : kind === 'completed' && item.attemptId ? 'View result' : 'View status'
    const resultAvailable = item.resultStatus === 'released' ||
      (item.assessmentType === 'practice' && item.showScorePolicy === 'immediate' && item.resultStatus === 'marked')
    return <article className="vs-exam-card" key={item.assignmentId + kind}>
      <div className="vs-exam-card-main">
        <span className={`vs-exam-status vs-exam-status--${kind}`}>{statusText[kind]}</span>
        <h3>{item.title}</h3>
        <p>{item.assessmentType.replaceAll('_', ' ')}{item.timeLimitMinutes ? ` · ${item.timeLimitMinutes} minutes` : ''}</p>
        {item.attemptNumber && <p>Attempt {item.attemptNumber} of {item.maxAttempts}</p>}
        {kind === 'awaiting' && <p>Your attempt was submitted. Results will appear when released.</p>}
        {kind === 'retake' && <p>This creates another attempt. Your previous result stays in History.</p>}
        {kind === 'completed' && resultAvailable && item.percentage !== null &&
          <p className="vs-exam-score">Latest score: {item.percentage.toFixed(1)}%</p>}
      </div>
      <div className="vs-exam-card-actions">
        <button type="button" className={kind === 'completed' ? 'vs-exam-button vs-exam-button--outline' : 'vs-exam-button'}
          onClick={() => {
            if (kind === 'retake') setRetake(item)
            else if (kind === 'completed' && resultAvailable && item.attemptId) router.push(`/student/results/${encodeURIComponent(item.attemptId)}`)
            else if (kind === 'new' || kind === 'in-progress') start(item)
            else setView('history')
          }}>{action}</button>
      </div>
    </article>
  }

  return <main className="vs-exams">
    <div className="vs-exams-container">
      <button type="button" className="vs-exams-back" onClick={() => router.push('/student/vibelearn')}>← Learn</button>
      <header className="vs-exams-heading">
        <div><p className="vs-exams-kicker">VibeSchool · Learn</p><h1>My Exams</h1>
          <p>Continue learning, explore new assessments and review your progress.</p></div>
        <button type="button" className="vs-exams-refresh" onClick={() => { setLoading(true); Promise.allSettled([listMyAssessmentAssignments(), getLearnerAssessmentHub()]).then(([a,h]) => { if (a.status === 'fulfilled') { setAssignments(a.value); setAssessmentError('') } else setAssessmentError('Could not refresh exams.'); if (h.status === 'fulfilled') { setHub(h.value); setResultsError('') } else setResultsError('Could not refresh results.') }).finally(() => setLoading(false)) }} disabled={loading}>Refresh</button>
      </header>

      <section className="vs-exams-overview" aria-label="Exam overview">
        <div><strong>{loading ? '—' : groups.fresh.length}</strong><span>New exams</span></div>
        <div><strong>{loading ? '—' : groups.ongoing.length}</strong><span>In progress</span></div>
        <div><strong>{loading ? '—' : results.length}</strong><span>Results</span></div>
      </section>

      <nav className="vs-exams-tabs" aria-label="Exam views">
        {([['for-you', 'For you'], ['history', 'History'], ['progress', 'Progress']] as const).map(([id, label]) =>
          <button key={id} type="button" aria-current={view === id ? 'page' : undefined}
            className={view === id ? 'vs-exams-tab is-active' : 'vs-exams-tab'} onClick={() => setView(id)}>{label}</button>)}
      </nav>

      {loading && <div className="vs-exams-message" role="status">Loading your exams…</div>}
      {!loading && assessmentError && <div className="vs-exams-message vs-exams-error" role="alert">{assessmentError}<button type="button" onClick={() => { setLoading(true); window.location.reload() }}>Retry</button></div>}
      {!loading && resultsError && <div className="vs-exams-message vs-exams-error" role="alert">{resultsError}</div>}

      {!loading && view === 'for-you' && <div className="vs-exams-sections">
        {groups.ongoing.length > 0 && <section aria-labelledby="vs-exams-continue">
          <h2 id="vs-exams-continue">Continue your exam</h2>
          <div className="vs-exams-card-list">{groups.ongoing.map(item => examCard(item, 'in-progress'))}</div>
        </section>}
        <section aria-labelledby="vs-exams-new">
          <div className="vs-exams-section-header"><h2 id="vs-exams-new">New exams</h2><span>{groups.fresh.length} available</span></div>
          {groups.fresh.length ? <div className="vs-exams-card-list">{groups.fresh.map(item => examCard(item, 'new'))}</div>
            : <div className="vs-exams-message">No new exam is available right now. Your previous attempts remain in History.</div>}
        </section>
        {groups.awaiting.length > 0 && <section aria-labelledby="vs-exams-awaiting">
          <h2 id="vs-exams-awaiting">Waiting for results</h2>
          <div className="vs-exams-card-list">{groups.awaiting.map(item => examCard(item, 'awaiting'))}</div>
        </section>}
        {groups.retakes.length > 0 && <section aria-labelledby="vs-exams-retakes">
          <h2 id="vs-exams-retakes">Practise again</h2>
          <p className="vs-exams-section-note">Retakes are optional and keep your previous attempts.</p>
          <div className="vs-exams-card-list">{groups.retakes.map(item => examCard(item, 'retake'))}</div>
        </section>}
      </div>}

      {!loading && view === 'history' && <section className="vs-exams-sections" aria-labelledby="vs-exams-history">
        <h2 id="vs-exams-history">Exam history</h2>
        <p className="vs-exams-section-note">Released results are saved with their original attempts.</p>
        {!resultsError && results.length === 0 && <div className="vs-exams-message">No released results yet. Completed exams awaiting review will appear after release.</div>}
        <div className="vs-exams-card-list">{results.map(result => <article className="vs-exam-card" key={result.attemptId}>
          <div className="vs-exam-card-main"><span className="vs-exam-status vs-exam-status--completed">Completed</span>
            <h3>{result.assessmentTitle}</h3><p>Released {new Date(result.releasedAt).toLocaleDateString('en-KE')}</p></div>
          <div className="vs-exam-card-actions"><strong className="vs-exam-result-value">{result.percentage === null ? '—' : `${result.percentage.toFixed(1)}%`}</strong>
            <button type="button" className="vs-exam-button vs-exam-button--outline" onClick={() => router.push(`/student/results/${encodeURIComponent(result.attemptId)}`)}>View result</button></div>
        </article>)}</div>
      </section>}

      {!loading && view === 'progress' && <section className="vs-exams-sections" aria-labelledby="vs-exams-progress">
        <h2 id="vs-exams-progress">Your progress</h2>
        <p className="vs-exams-section-note">Based on your released results, not an official exam prediction.</p>
        <div className="vs-exams-progress-grid">
          <div><span>Released assessments</span><strong>{results.length}</strong></div>
          <div><span>Average result</span><strong>{average === null ? '—' : `${average.toFixed(1)}%`}</strong></div>
        </div>
        {results.length === 0 ? <div className="vs-exams-message">Complete an assessment to start building your result history.</div>
          : <div className="vs-exams-message">Review previous results to see mistakes and explanations. Objective-level recommendations will appear when enough verified curriculum evidence is available.</div>}
        <button type="button" className="vs-exam-button vs-exam-button--outline" onClick={() => setView('history')}>View exam history</button>
      </section>}
    </div>

    {retake && <div className="vs-exam-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setRetake(null) }}>
      <section role="alertdialog" aria-modal="true" aria-labelledby="vs-retake-title" aria-describedby="vs-retake-copy" className="vs-exam-modal">
        <h2 id="vs-retake-title">Retake this exam?</h2>
        <p id="vs-retake-copy">A new attempt will start. Your previous results will stay in History. You have used {retake.attemptNumber ?? 0} of {retake.maxAttempts} attempts.</p>
        <div className="vs-exam-modal-actions"><button type="button" className="vs-exam-button vs-exam-button--outline" autoFocus onClick={() => setRetake(null)}>Cancel</button>
          <button type="button" className="vs-exam-button" onClick={() => { const item = retake; setRetake(null); start(item) }}>Start retake</button></div>
      </section>
    </div>}
  </main>
}
