'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { listMyAssessmentAssignments, type LearnerAssessmentAssignment } from '@/lib/assessment/discovery'
import { getLearnerAssessmentHub, type LearnerAssessmentHub } from '@/lib/assessment/integration'
import './exams.css'

type View = 'for-you' | 'history' | 'progress'
type ExamState = 'in-progress' | 'new' | 'completed' | 'awaiting' | 'expired' | 'retake' | 'unavailable'

function mayRetake(item: LearnerAssessmentAssignment): boolean {
  // Discovery may have processed a timed-out attempt but not yet reflected
  // the quota. Do not advertise an extra attempt on the exhausted paper.
  return item.canStart && (item.attemptNumber ?? 0) < item.maxAttempts
}

function examState(item: LearnerAssessmentAssignment): ExamState {
  const active = item.attemptStatus === 'in_progress'
    && (!item.attemptExpiresAt || Date.parse(item.attemptExpiresAt) > Date.now())
  if (active) return 'in-progress'
  if (item.attemptStatus === 'in_progress' && item.attemptExpiresAt && Date.parse(item.attemptExpiresAt) <= Date.now()) return 'expired'
  if (item.attemptId) {
    if (item.resultStatus === 'released' || (item.assessmentType === 'practice'
      && item.showScorePolicy === 'immediate' && item.resultStatus === 'marked')) return 'completed'
    if (item.submittedAt || item.resultStatus === 'pending' && item.attemptStatus !== 'in_progress'
      || item.resultStatus === 'partially_marked' || item.resultStatus === 'marked') return 'awaiting'
    if (mayRetake(item)) return 'retake'
    return 'unavailable'
  }
  return item.canStart ? 'new' : 'unavailable'
}

function subjectFromTitle(title: string): string {
  const match = title.match(/(?:grade|form)\s*\d+\s+(.+?)\s*[—–-]\s*/i)
  return match?.[1]?.trim() || 'Assessment'
}

const statusText: Record<ExamState, string> = {
  'in-progress': 'In progress',
  new: 'New',
  completed: 'Completed',
  awaiting: 'Awaiting result',
  expired: 'Time ended',
  retake: 'Retake available',
  unavailable: 'Unavailable',
}

export default function VibeLearnExamsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedView = searchParams.get('view')
  const initialView: View = selectedView === 'history' || selectedView === 'progress' ? selectedView : 'for-you'
  const retakeTrigger = useRef<HTMLButtonElement | null>(null)
  const [assignments, setAssignments] = useState<LearnerAssessmentAssignment[]>([])
  const [hub, setHub] = useState<LearnerAssessmentHub | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>(initialView)
  const [assessmentError, setAssessmentError] = useState('')
  const [resultsError, setResultsError] = useState('')
  const [retake, setRetake] = useState<LearnerAssessmentAssignment | null>(null)
  const [query, setQuery] = useState('')
  const [subject, setSubject] = useState('All subjects')
  const [examType, setExamType] = useState('All types')
  const [layout, setLayout] = useState<'grid' | 'list'>('grid')


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
  useEffect(() => {
    if (selectedView === 'history' || selectedView === 'progress' || selectedView === 'for-you') {
      setView(selectedView)
    }
  }, [selectedView])
  useEffect(() => {
    if (!retake) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRetake()
      if (event.key !== 'Tab') return
      const modal = document.getElementById('vs-retake-title')?.closest('[role="alertdialog"]')
      const controls = modal?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
      if (!controls?.length) return
      if (event.shiftKey && document.activeElement === controls[0]) {
        event.preventDefault()
        controls[controls.length - 1].focus()
      } else if (!event.shiftKey && document.activeElement === controls[controls.length - 1]) {
        event.preventDefault()
        controls[0].focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [retake])
  function closeRetake() {
    setRetake(null)
    requestAnimationFrame(() => retakeTrigger.current?.focus())
  }
  function openRetake(item: LearnerAssessmentAssignment, trigger: HTMLButtonElement) {
    retakeTrigger.current = trigger
    setRetake(item)
  }
  function changeView(next: View) {
    setView(next)
    router.replace(`/student/vibelearn/exams?view=${next}`, { scroll: false })
  }
  function viewResult(attemptId: string) {
    router.push(`/student/results/${encodeURIComponent(attemptId)}?from=${view}`)
  }

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
      else if (state === 'awaiting' || state === 'expired') awaiting.push(item)
      else if (state === 'completed') {
        completed.push(item)
        if (mayRetake(item)) retakes.push(item)
      }
    }
    return { ongoing, fresh, retakes, awaiting, completed }
  }, [assignments])
  const subjects = useMemo(() => ['All subjects', ...Array.from(new Set(assignments.map(item => subjectFromTitle(item.title)).filter(name => name !== 'Assessment'))).sort()], [assignments])
  const types = useMemo(() => ['All types', ...Array.from(new Set(assignments.map(item => item.assessmentType.replaceAll('_', ' ')))).sort()], [assignments])
  const filterExam = (item: LearnerAssessmentAssignment) => (subject === 'All subjects' || subjectFromTitle(item.title) === subject)
    && (examType === 'All types' || item.assessmentType.replaceAll('_', ' ') === examType)
    && (item.title + ' ' + item.assessmentType).toLowerCase().includes(query.trim().toLowerCase())
  const filteredFresh = groups.fresh.filter(filterExam)
  const filteredRetakes = groups.retakes.filter(filterExam)
  const featured = groups.ongoing[0] ?? groups.fresh[0] ?? null
  const results = hub?.results ?? []
  const scored = results.filter(r => r.percentage !== null)
  // Raw attempts may include repeat practice and timeouts: never present this as mastery.
  const average = scored.length ? scored.reduce((sum, r) => sum + (r.percentage ?? 0), 0) / scored.length : null
  const chronological = [...scored].sort((a, b) => Date.parse(a.releasedAt) - Date.parse(b.releasedAt))
  const trend = chronological.slice(-6)
  const distinctPapers = new Set(results.map(r => r.assessmentTitle)).size
  const reviewFirst = [...chronological].reverse().find(result => result.percentage !== null && result.percentage < 60)
  const revisionCandidate = [...groups.retakes].filter(mayRetake).sort((a, b) => {
    const score = (title: string) => chronological.filter(r => r.assessmentTitle === title).at(-1)?.percentage ?? 101
    return score(a.title) - score(b.title)
  })[0]
  const previousAttempt = (title: string, releasedAt: string) => chronological
    .filter(entry => entry.assessmentTitle === title && Date.parse(entry.releasedAt) < Date.parse(releasedAt)).at(-1)


  function start(item: LearnerAssessmentAssignment) {
    router.push(`/student/assessment/${encodeURIComponent(item.assignmentId)}`)
  }

  function examCard(item: LearnerAssessmentAssignment, kind: ExamState) {
    const action = kind === 'expired' ? 'Refresh status' : kind === 'in-progress' ? 'Resume exam' : kind === 'new' ? 'Start exam'
      : kind === 'retake' ? 'Retake exam' : kind === 'completed' && item.attemptId ? 'View result' : 'View status'
    const resultAvailable = item.resultStatus === 'released' ||
      (item.assessmentType === 'practice' && item.showScorePolicy === 'immediate' && item.resultStatus === 'marked')
    return <article className="vs-exam-card" key={item.assignmentId + kind}><div className="vs-command-glyph" aria-hidden="true">{subjectFromTitle(item.title).slice(0, 1).toUpperCase()}</div>
      <div className="vs-exam-card-main">
        <span className={`vs-exam-status vs-exam-status--${kind}`}>{statusText[kind]}</span>
        <h3>{item.title}</h3>
        <p>{item.assessmentType.replaceAll('_', ' ')}{item.timeLimitMinutes ? ` · ${item.timeLimitMinutes} minutes` : ''}</p>
        {item.attemptNumber && <p>Attempt {item.attemptNumber} of {item.maxAttempts}</p>}
        {kind === 'awaiting' && <p>Your attempt was submitted. Results will appear when released.</p>}
        {kind === 'expired' && <p>Your time has ended. The server must finalize this attempt before any further action.</p>}
        {kind === 'retake' && <p>This creates another attempt. Your previous result stays in History.</p>}
        {kind === 'completed' && resultAvailable && item.percentage !== null &&
          <p className="vs-exam-score">Latest score: {item.percentage.toFixed(1)}%</p>}
      </div>
      <div className="vs-exam-card-actions">
        <button type="button" className={kind === 'completed' ? 'vs-exam-button vs-exam-button--outline' : 'vs-exam-button'}
          onClick={event => {
            if (kind === 'retake' && mayRetake(item)) openRetake(item, event.currentTarget)
            else if (kind === 'completed' && resultAvailable && item.attemptId) viewResult(item.attemptId)
            else if (kind === 'new' || kind === 'in-progress') start(item)
            else if (kind === 'expired') reload()
            else changeView('history')
          }}>{action}</button>
      </div>
    </article>
  }

  return <main className="vs-exams vs-exams-command">
    <div className="vs-exams-container">
      <div className="vs-command-topbar">
        <button type="button" className="vs-command-brand" onClick={() => router.push('/student')}><span className="vs-command-brand-icon" aria-hidden="true">V</span><span><strong>VibeSchool</strong><small>EXAM COMMAND CENTRE</small></span></button>
        <div className="vs-command-actions">
          <button type="button" className="vs-exams-refresh" onClick={() => reload()} disabled={loading}>Refresh</button>
        </div>
      </div>
      <header className="vs-exams-heading">
        <div><p className="vs-exams-kicker">● YOUR EXAMINATION SPACE</p><h1>My Exams <span aria-hidden="true">✦</span></h1>
          <p>Choose your next assessment, resume your work or explore your results.</p></div>
      </header>

      <section className="vs-exams-overview" aria-label="Exam overview">
        <div><strong>{loading ? '—' : groups.fresh.length}</strong><span>New exams</span></div>
        <div><strong>{loading ? '—' : groups.ongoing.length}</strong><span>In progress</span></div>
        <div><strong>{loading ? '—' : results.length}</strong><span>Results</span></div>
      </section>

      {!loading && featured && view === 'for-you' && <section className="vs-command-featured" aria-label="Featured examination">
        <div className="vs-command-feature-copy">
          <span className="vs-command-feature-kicker">{examState(featured) === 'in-progress' ? '↻ CONTINUE YOUR EXAM' : '✦ NEXT UP · READY FOR YOU'}</span>
          <h2>{featured.title}</h2>
          <p>{featured.assessmentType.replaceAll('_', ' ')}{featured.timeLimitMinutes ? ' · ' + featured.timeLimitMinutes + ' minutes' : ''}</p>
          <button type="button" className="vs-exam-button" onClick={() => start(featured)}>{examState(featured) === 'in-progress' ? 'Resume examination ↗' : 'Open examination ↗'}</button>
        </div>
        <div className="vs-command-orbit" aria-hidden="true"><div className="vs-command-cube">✓</div><small>ASSESSMENT READY</small></div>
      </section>}
      <nav className="vs-exams-tabs" aria-label="Exam views">
        {([['for-you', 'Explore'], ['history', 'Results'], ['progress', 'Insights']] as const).map(([id, label]) =>
          <button key={id} type="button" aria-current={view === id ? 'page' : undefined}
            className={view === id ? 'vs-exams-tab is-active' : 'vs-exams-tab'} onClick={() => changeView(id)}>{label}</button>)}
      </nav>

      {loading && <div className="vs-exams-message" role="status">Loading your exams…</div>}
      {!loading && assessmentError && <div className="vs-exams-message vs-exams-error" role="alert">{assessmentError}<button type="button" onClick={() => { setLoading(true); window.location.reload() }}>Retry</button></div>}
      {!loading && resultsError && <div className="vs-exams-message vs-exams-error" role="alert">{resultsError}</div>}

      {!loading && view === 'for-you' && <div className="vs-exams-sections">
        <section className="vs-command-explore" aria-label="Search and filter exams">
          <div className="vs-exams-section-header"><div><h2>Exam library</h2><p className="vs-exams-section-note">Find the right assessment for you.</p></div><div className="vs-command-layout"><button type="button" aria-pressed={layout === 'grid'} onClick={() => setLayout('grid')}>▦ Cards</button><button type="button" aria-pressed={layout === 'list'} onClick={() => setLayout('list')}>☷ List</button></div></div>
          <div className="vs-command-filters">
            <label className="vs-command-search"><span>Search exams</span><input type="search" placeholder="Search exam title or type" value={query} onChange={event => setQuery(event.target.value)} /></label>
            <label><span>Subject</span><select value={subject} onChange={event => setSubject(event.target.value)}>{subjects.map(option => <option key={option}>{option}</option>)}</select></label>
            <label><span>Exam type</span><select value={examType} onChange={event => setExamType(event.target.value)}>{types.map(option => <option key={option}>{option}</option>)}</select></label>
          </div>
          <div className="vs-command-filter-summary"><span>{filteredFresh.length} available matching exams</span><button type="button" onClick={() => {setQuery('');setSubject('All subjects');setExamType('All types')}}>Clear filters</button></div>
        </section>
        {groups.ongoing.length > 0 && <section aria-labelledby="vs-exams-continue">
          <h2 id="vs-exams-continue">Continue your exam</h2>
          <div className="vs-exams-card-list">{groups.ongoing.map(item => examCard(item, 'in-progress'))}</div>
        </section>}
        <section aria-labelledby="vs-exams-new">
          <div className="vs-exams-section-header"><h2 id="vs-exams-new">Available examinations</h2><span>{filteredFresh.length} shown</span></div>
          {filteredFresh.length ? <div className={`vs-exams-card-list vs-command-card-${layout}`}>{filteredFresh.map(item => examCard(item, 'new'))}</div>
            : <div className="vs-exams-next" role="status">
                <strong>{groups.fresh.length ? 'No exams match your filters' : "You're up to date with new exams"}</strong>
                <p>{groups.fresh.length ? 'Change your filters to find an available assessment.' : 'Use your previous results to choose what to improve next.'}</p>
                <div className="vs-exams-next-actions">
                  {reviewFirst && <button type="button" className="vs-exam-button" onClick={() => viewResult(reviewFirst.attemptId)}>Review previous mistakes</button>}
                  {revisionCandidate && <button type="button" className="vs-exam-button vs-exam-button--outline" onClick={event => openRetake(revisionCandidate, event.currentTarget)}>Practise again</button>}
                  {!reviewFirst && !revisionCandidate && <button type="button" className="vs-exam-button vs-exam-button--outline" onClick={() => results.length ? changeView('history') : router.push('/student/vibelearn')}>{results.length ? 'View exam history' : 'Explore Learn'}</button>}
                </div>
                {reviewFirst && <p className="vs-exams-section-note">Review suggested from your released score in {reviewFirst.assessmentTitle} ({reviewFirst.percentage?.toFixed(1)}%). This does not identify a specific weak curriculum objective.</p>}
              </div>}
        </section>
        {groups.awaiting.length > 0 && <section aria-labelledby="vs-exams-awaiting">
          <h2 id="vs-exams-awaiting">Waiting for results</h2>
          <div className="vs-exams-card-list">{groups.awaiting.map(item => examCard(item, examState(item)))}</div>
        </section>}
        {filteredRetakes.length > 0 && <section aria-labelledby="vs-exams-retakes">
          <h2 id="vs-exams-retakes">Practise again</h2>
          <p className="vs-exams-section-note">Retakes are optional and keep your previous attempts.</p>
          <div className="vs-exams-card-list">{filteredRetakes.map(item => examCard(item, 'retake'))}</div>
        </section>}
      </div>}

      {!loading && view === 'history' && <section className="vs-exams-sections" aria-labelledby="vs-exams-history">
        <h2 id="vs-exams-history">Exam history</h2>
        <p className="vs-exams-section-note">Released results are saved with their original attempts.</p>
        {!resultsError && results.length === 0 && <div className="vs-exams-message">No released results yet. Completed exams awaiting review will appear after release.</div>}
        <div className="vs-exams-card-list">{results.map(result => <article className="vs-exam-card" key={result.attemptId}>
          <div className="vs-exam-card-main"><span className="vs-exam-status vs-exam-status--completed">Released result</span>
            <h3>{result.assessmentTitle}</h3>
              <p>{subjectFromTitle(result.assessmentTitle)} · {result.assessmentType.replaceAll('_', ' ')} · Released {new Date(result.releasedAt).toLocaleDateString('en-KE')}</p>
              {(() => { const earlier = previousAttempt(result.assessmentTitle, result.releasedAt); return earlier?.percentage != null && result.percentage != null
                ? <p className="vs-exam-comparison">Versus previous attempt: {result.percentage - earlier.percentage >= 0 ? '+' : ''}{(result.percentage - earlier.percentage).toFixed(1)} points</p>
                : null })()}</div>
          <div className="vs-exam-card-actions"><strong className="vs-exam-result-value">{result.percentage === null ? '—' : `${result.percentage.toFixed(1)}%`}</strong>
            <button type="button" className="vs-exam-button vs-exam-button--outline" onClick={() => viewResult(result.attemptId)}>View result</button></div>
        </article>)}</div>
      </section>}

      {!loading && view === 'progress' && <section className="vs-exams-sections" aria-labelledby="vs-exams-progress">
        <h2 id="vs-exams-progress">Your progress</h2>
        <p className="vs-exams-section-note">Released attempts include repeat practice and timed-out attempts. The raw average is not a mastery score or an official exam prediction.</p>
        <div className="vs-exams-progress-grid">
          <div><span>Released attempts</span><strong>{results.length} across {distinctPapers} paper{distinctPapers === 1 ? '' : 's'}</strong></div>
          <div><span>Raw average across attempts</span><strong>{average === null ? '—' : `${average.toFixed(1)}%`}</strong></div>
        </div>
        {trend.length >= 2 && <section className="vs-exams-trend" aria-label="Recent released assessment scores">
          <div className="vs-exams-section-header"><h3>Recent results</h3><span>Last {trend.length} attempts</span></div>
          <div className="vs-exams-trend-bars" role="list">
            {trend.map((result, index) => <div key={result.attemptId} role="listitem" className="vs-exams-trend-item" title={result.assessmentTitle}>
              <span>{result.percentage?.toFixed(0)}%</span>
              <div className="vs-exams-trend-track"><div className="vs-exams-trend-fill" style={{height: `${Math.max(2, Math.min(100, result.percentage ?? 0))}%`}} /></div>
              <small>#{index + 1}</small>
            </div>)}
          </div>
          <p className="vs-exams-section-note">Scores shown in release order, not as a single improvement trend. Different papers and repeat attempts cannot be compared directly.</p>
        </section>}
        {results.length === 0 ? <div className="vs-exams-message">Complete an assessment to start building your result history.</div>
          : <div className="vs-exams-next">
              <strong>What to do next</strong>
              <p>{reviewFirst ? `Review ${reviewFirst.assessmentTitle} and check the answers you missed.` : 'Review previous answers and explanations to decide what to revise.'}</p>
              <button type="button" className="vs-exam-button" onClick={() => reviewFirst ? viewResult(reviewFirst.attemptId) : changeView('history')}>{reviewFirst ? 'Review this result' : 'View exam history'}</button>
              <p className="vs-exams-section-note">Objective-level recommendations will follow verified question-to-curriculum mappings.</p>
            </div>}
        <button type="button" className="vs-exam-button vs-exam-button--outline" onClick={() => changeView('history')}>View exam history</button>
      </section>}
    </div>

    {retake && mayRetake(retake) && <div className="vs-exam-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closeRetake() }}>
      <section role="alertdialog" aria-modal="true" aria-labelledby="vs-retake-title" aria-describedby="vs-retake-copy" className="vs-exam-modal">
        <h2 id="vs-retake-title">Retake this exam?</h2>
        <p id="vs-retake-copy">A new attempt will start. Your previous results will stay in History. You have used {retake.attemptNumber ?? 0} of {retake.maxAttempts} attempts.</p>
        <div className="vs-exam-modal-actions"><button type="button" className="vs-exam-button vs-exam-button--outline" autoFocus onClick={closeRetake}>Cancel</button>
          <button type="button" className="vs-exam-button" onClick={() => { const item = retake; closeRetake(); start(item) }}>Start retake</button></div>
      </section>
    </div>}
  </main>
}
