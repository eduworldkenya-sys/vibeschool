'use client'
export const dynamic = 'force-dynamic'
import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { getAssignmentAnalytics, type AssessmentAnalyticsDetail } from '@/lib/assessment/analytics'
import {
  getAssignmentIntelligence,
  type AssignmentIntelligence,
} from '@/lib/assessment/intelligence'
import { safeCsvCell, compareReleasedResults } from '@/lib/assessment/workspace'
import {
  AssessmentContextControls,
  AssessmentHeading,
  ContextState,
  useAssessmentContext,
  workspaceHref,
} from '@/components/teacher/assessment/AssessmentContext'
import styles from '@/components/teacher/assessment/AssessmentWorkspace.module.css'
function Workspace() {
  const scope = useAssessmentContext(),
    id = scope.selection.assignmentId
  const [comparisonId, setComparisonId] = useState(''),
    [comparison, setComparison] = useState<ReturnType<typeof compareReleasedResults>>(null),
    [comparisonLoading, setComparisonLoading] = useState(false),
    [comparisonError, setComparisonError] = useState('')
  const current = scope.context?.assignments.find((a) => a.id === id),
    comparable = scope.assignments.filter(
      (a) =>
        a.id !== id &&
        a.assessmentId === current?.assessmentId &&
        a.classId === current.classId &&
        a.subjectId === current.subjectId &&
        a.assignedAt &&
        current.assignedAt &&
        Date.parse(a.assignedAt) < Date.parse(current.assignedAt),
    )
  const [detail, setDetail] = useState<AssessmentAnalyticsDetail | null>(null),
    [insight, setInsight] = useState<AssignmentIntelligence | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0),
    [search, setSearch] = useState(''),
    [status, setStatus] = useState('all'),
    [resultScope, setResultScope] = useState('released')
  const comparableIds = comparable.map((a) => a.id).join(',')
  useEffect(() => {
    setComparisonId('')
  }, [id])
  useEffect(() => {
    let active = true
    setComparison(null)
    setComparisonError('')
    setComparisonLoading(Boolean(comparisonId && detail))
    if (comparisonId && detail && comparableIds.split(',').includes(comparisonId))
      void getAssignmentAnalytics(comparisonId)
        .then((previous) => {
          if (active) setComparison(compareReleasedResults(previous.learners, detail.learners))
        })
        .catch((cause) => {
          if (active)
            setComparisonError(
              cause instanceof Error ? cause.message : 'Comparison could not be loaded.',
            )
        })
        .finally(() => {
          if (active) setComparisonLoading(false)
        })
    return () => {
      active = false
    }
  }, [comparisonId, detail, comparableIds])
  useEffect(() => {
    let active = true
    setDetail(null)
    setInsight(null)
    setError('')
    setLoading(Boolean(id && scope.context))
    setSearch('')
    setStatus('all')
    if (id && scope.context)
      void Promise.all([getAssignmentAnalytics(id), getAssignmentIntelligence(id)])
        .then(([data, intelligence]) => {
          if (intelligence.assignmentId !== id)
            throw new Error('The requested question evidence could not be confirmed.')
          if (active) {
            setDetail(data)
            setInsight(intelligence)
          }
        })
        .catch((cause) => {
          if (active)
            setError(cause instanceof Error ? cause.message : 'Results could not be loaded.')
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    return () => {
      active = false
    }
  }, [id, scope.context, revision])
  const scored = useMemo(
    () =>
      detail?.learners.filter(
        (l) =>
          ((l.attemptStatus === 'released' && l.resultStatus === 'released') ||
            (resultScope === 'teacher' &&
              l.attemptStatus === 'marked' &&
              l.resultStatus === 'marked')) &&
          l.score !== null &&
          l.maxScore !== null &&
          l.maxScore > 0,
      ) ?? [],
    [detail, resultScope],
  )
  const percentages = scored.map((l) => (100 * l.score!) / l.maxScore!),
    average = percentages.length
      ? percentages.reduce((a, b) => a + b, 0) / percentages.length
      : null
  const learners =
    detail?.learners.filter(
      (l) =>
        (status === 'all' ||
          (status === 'missing' ? !l.submittedAt : l.attemptStatus === status && (status!=='released'||l.resultStatus==='released'))) &&
        [l.studentName, l.admissionNumber].join(' ').toLowerCase().includes(search.toLowerCase()),
    ) ?? []
  function exportResults() {
    if (!detail) return
    const rows = [
      ['Learner', 'Admission number', 'Status', 'Score', 'Maximum', 'Percentage'],
      ...detail.learners.map((l) => {
        const allowed =
          (l.attemptStatus === 'released' && l.resultStatus === 'released') ||
          (resultScope === 'teacher' && l.attemptStatus === 'marked' && l.resultStatus === 'marked')
        return [
          l.studentName,
          l.admissionNumber,
          l.attemptStatus ?? 'Not submitted',
          allowed ? l.score : null,
          allowed ? l.maxScore : null,
          allowed && l.score !== null && l.maxScore !== null && l.maxScore > 0
            ? ((100 * l.score) / l.maxScore).toFixed(1)
            : null,
        ]
      }),
    ]
    const url = URL.createObjectURL(
      new Blob([rows.map((row) => row.map(safeCsvCell).join(',')).join('\r\n')], {
        type: 'text/csv;charset=utf-8',
      }),
    )
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'assessment-results.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }
  return (
    <section className={styles.page}>
      <AssessmentHeading
        title="Results"
        description="Review one assessment at a time, then follow the evidence to your next lesson."
      >
        <Link href={workspaceHref('marking', scope.selection)}>Mark work</Link>
        <Link href={workspaceHref('curriculum', scope.selection)}>Learning outcomes</Link>
        <Link href={workspaceHref('interventions', scope.selection)}>Learner support</Link>
      </AssessmentHeading>
      <ContextState scope={scope} />
      <AssessmentContextControls scope={scope} />
      {scope.context && !id && (
        <section className={styles.panel}>
          <h2>Assessment results</h2>
          {scope.assignments.length === 0 ? (
            <p>No assessments match your selections. Try another class or term.</p>
          ) : (
            <ul className={styles.rows}>
              {scope.assignments.map((a) => (
                <li className={styles.row} key={a.id}>
                  <div>
                    <strong>{a.title}</strong>
                    <p className={styles.muted}>
                      {scope.context?.classes.find((c) => c.id === a.classId)?.name} ·{' '}
                      {scope.context?.subjects.find((s) => s.id === a.subjectId)?.name} ·{' '}
                      {a.type.replaceAll('_', ' ')}
                    </p>
                  </div>
                  <button onClick={() => scope.choose({ assignmentId: a.id })}>
                    Review results
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {loading && <p role="status">Loading assessment results…</p>}
      {error && (
        <div role="alert" className={styles.error}>
          {error} <button onClick={() => setRevision((n) => n + 1)}>Retry</button>
        </div>
      )}
      {detail && detail.assignmentId === id && !loading && (
        <>
          <h2>{detail.title}</h2>
          <label className={styles.label} htmlFor="result-scope">
            Results included
          </label>
          <select
            id="result-scope"
            value={resultScope}
            onChange={(e) => setResultScope(e.target.value)}
          >
            <option value="released">Shared results only</option>
            <option value="teacher">Shared and marked results — teacher view</option>
          </select>
          <p className={styles.muted}>
            {resultScope === 'teacher'
              ? 'Unshared marks are private to this teacher view. Exported records can contain private marks.'
              : 'Only shared, scored results contribute to performance figures.'}{' '}
            Latest attempt per eligible learner; pending and missing work stay outside the score
            denominator.
          </p>
          <div className={styles.stats}>
            <div>
              <strong>{detail.eligibleLearners}</strong>Eligible learners
            </div>
            <div>
              <strong>{detail.learners.filter((l) => l.submittedAt).length}</strong>
              Submitted in the current roster
            </div>
            <div>
              <strong>{scored.length}</strong>Scored learners included
            </div>
            <div>
              <strong>{average === null ? '—' : average.toFixed(1) + '%'}</strong>
              Average of learner percentages
            </div>
          </div>
          <section className={styles.panel}>
            <h2>Score distribution</h2>
            {scored.length === 0 ? (
              <p>
                No scored results are available in this scope. Missing marks have not been counted
                as zero.
              </p>
            ) : (
              <ul className={styles.rows}>
                {[
                  [0, 25],
                  [25, 50],
                  [50, 75],
                  [75, 101],
                ].map(([low, high]) => (
                  <li className={styles.row} key={low}>
                    <span>
                      {low}–{high === 101 ? '100' : '<' + high}%
                    </span>
                    <span>
                      {percentages.filter((p) => p >= low && p < high).length} of {scored.length}{' '}
                      learners
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className={styles.muted}>
              These score ranges are descriptive, not curriculum performance levels. Trends require
              comparable assessments and are not inferred across different papers.
            </p>
          </section>
          {comparable.length > 0 && (
            <section className={styles.panel}>
              <h2>Compare the same paper</h2>
              <label className={styles.label}>
                Earlier assignment
                <select value={comparisonId} onChange={(e) => setComparisonId(e.target.value)}>
                  <option value="">Choose an assignment</option>
                  {comparable.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                      {a.assignedAt
                        ? ' · ' +
                          new Date(a.assignedAt).toLocaleDateString('en-KE', {
                            timeZone: 'Africa/Nairobi',
                          })
                        : ''}
                    </option>
                  ))}
                </select>
              </label>
              <p className={styles.muted}>
                Same paper, class and subject. Only learners with shared results and matching
                maximum marks in both assignments are compared.
              </p>
              {comparisonLoading && <p role="status">Loading comparison…</p>}
              {comparisonError && (
                <p role="alert" className={styles.error}>
                  {comparisonError}
                </p>
              )}
              {comparison && (
                <p>
                  {comparison.learnerCount} matched learners: {comparison.averageBefore.toFixed(1)}%
                  → {comparison.averageAfter.toFixed(1)}% ({comparison.change >= 0 ? '+' : ''}
                  {comparison.change.toFixed(1)} percentage points). This does not establish the
                  cause of a change.
                </p>
              )}
              {comparisonId && !comparisonLoading && !comparison && !comparisonError && (
                <p>No comparable shared learner results are available.</p>
              )}
            </section>
          )}
          <section className={styles.panel}>
            <h2>Learner results</h2>
            <div className={styles.fields}>
              <label>
                Work status
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="all">All learners</option>
                  <option value="missing">Not submitted</option>
                  <option value="teacher_review">Needs marking</option>
                  <option value="marked">Ready to share</option>
                  <option value="released">Shared</option>
                </select>
              </label>
              <label>
                Find a learner
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name or admission number"
                />
              </label>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <caption>{learners.length} matching learners</caption>
                <thead>
                  <tr>
                    <th scope="col">Learner</th>
                    <th scope="col">Work status</th>
                    <th scope="col">Result</th>
                    <th scope="col">Next action</th>
                  </tr>
                </thead>
                <tbody>
                  {learners.map((l) => {
                    const allowed =
                      (l.attemptStatus === 'released' && l.resultStatus === 'released') ||
                      (resultScope === 'teacher' &&
                        l.attemptStatus === 'marked' &&
                        l.resultStatus === 'marked')
                    return (
                      <tr key={l.studentId}>
                        <th scope="row">
                          {l.studentName}
                          <div className={styles.muted}>{l.admissionNumber}</div>
                        </th>
                        <td>
                          {!l.submittedAt
                            ? 'Not submitted'
                            : l.attemptStatus === 'released' && l.resultStatus === 'released'
                              ? 'Shared'
                              : l.attemptStatus==='released'?'Release not confirmed': l.attemptStatus === 'marked'
                                ? 'Ready to share'
                                : 'Needs marking'}
                        </td>
                        <td>
                          {allowed && l.score !== null && l.maxScore !== null
                            ? `${l.score} / ${l.maxScore}`
                            : '—'}
                        </td>
                        <td>
                          <Link
                            href={
                              workspaceHref(
                                l.attemptStatus === 'released' && l.resultStatus === 'released'
                                  ? 'interventions'
                                  : 'marking',
                                scope.selection,
                              ) +
                              (workspaceHref('marking', scope.selection).includes('?')
                                ? '&'
                                : '?') +
                              (l.attemptStatus === 'released' && l.resultStatus === 'released'
                                ? 'studentId=' + l.studentId
                                : 'attemptId=' + (l.attemptId ?? ''))
                            }
                          >
                            {l.attemptStatus === 'released' && l.resultStatus === 'released'
                              ? 'Review support'
                              : l.attemptId
                                ? 'Review work'
                                : 'Open marking queue'}
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {learners.length === 0 && <p>No learners match these filters.</p>}
            <div className={styles.actions}>
              <button onClick={exportResults}>Export CSV</button>
              <button onClick={() => window.print()}>Print results</button>
            </div>
          </section>
          <section className={styles.panel}>
            <h2>Question evidence</h2>
            <p className={styles.muted}>
              Question analysis uses shared responses only, including when the teacher view is
              selected.
            </p>
            {!insight?.questions.length ? (
              <p>No question evidence was returned.</p>
            ) : (
              insight.questions.map((q) => (
                <details key={q.assessmentItemId}>
                  <summary>
                    Question {q.orderNum} ·{' '}
                    {q.averagePercentage === null
                      ? 'Not assessed'
                      : q.averagePercentage.toFixed(1) + '% average'}
                  </summary>
                  <p>{q.prompt}</p>
                  <p className={styles.muted}>
                    {q.responseCount} scored responses · {q.zeroScoreCount} zero marks ·{' '}
                    {q.fullScoreCount} full marks
                  </p>
                  <p>
                    {insight.misconceptions
                      .find((m) => m.assessmentItemId === q.assessmentItemId)
                      ?.recommendedAction.replaceAll('_', ' ') ??
                      'Review responses before deciding on follow-up.'}
                  </p>
                  <Link href={workspaceHref('curriculum', scope.selection)}>
                    Review linked outcomes
                  </Link>
                </details>
              ))
            )}
          </section>
        </>
      )}
    </section>
  )
}
export default function ResultsPage() {
  return (
    <Suspense fallback={<p role="status">Loading results…</p>}>
      <Workspace />
    </Suspense>
  )
}
