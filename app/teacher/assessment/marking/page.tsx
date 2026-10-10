'use client'
export const dynamic = 'force-dynamic'
import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  finalizeAttempt,
  getMarkingAttempt,
  listMarkingQueue,
  markResponse,
  type MarkingAttempt,
  type MarkingQueueItem,
  type MarkingResponse,
} from '@/lib/assessment/marking'
import { getScoreAudit, requestModeration, type ScoreAuditEvent } from '@/lib/assessment/moderation'
import { MarkingGuide } from '@/components/teacher/assessment/MarkingGuide'
import {
  listTeacherAssessmentAnalytics,
  type AssessmentAnalyticsSummary,
} from '@/lib/assessment/analytics'
import { parseMark } from '@/lib/assessment/workspace'
import {
  AssessmentContextControls,
  AssessmentHeading,
  ContextState,
  useAssessmentContext,
  workspaceHref,
} from '@/components/teacher/assessment/AssessmentContext'
import styles from '@/components/teacher/assessment/AssessmentWorkspace.module.css'
type Draft = {
  score: string
  feedback: string
  overrideReason: string
  moderationReason: string
}
const blank: Draft = {
  score: '',
  feedback: '',
  overrideReason: '',
  moderationReason: '',
}
function draftFor(r: MarkingResponse): Draft {
  return {
    ...blank,
    score: r.finalScore === null ? '' : String(r.finalScore),
    feedback: r.teacherFeedback ?? '',
  }
}
function stage(item: MarkingQueueItem) {
  return item.attemptStatus === 'released'
    ? 'Shared'
    : item.attemptStatus === 'marked'
      ? 'Ready to share'
      : item.markedItems > 0
        ? 'In progress'
        : 'To mark'
}
function Workspace() {
  const scope = useAssessmentContext(),
    params = useSearchParams(),
    ticket = useRef(0),
    operation = useRef(false)
  const [summaries, setSummaries] = useState<AssessmentAnalyticsSummary[]>([])
  const [queue, setQueue] = useState<MarkingQueueItem[]>([]),
    [selectedState, setSelected] = useState<MarkingAttempt | null>(null),
    [drafts, setDrafts] = useState<Record<string, Draft>>({}),
    [feedback, setFeedback] = useState(''),
    [audit, setAudit] = useState<Record<string, ScoreAuditEvent[]>>({}),
    [tab, setTab] = useState('To mark'),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [revision, setRevision] = useState(0),
    [answerView, setAnswerView] = useState('one'),
    [questionIndex, setQuestionIndex] = useState(0)
  const scopeKey = JSON.stringify([scope.context?.schoolId, scope.selection]),
    scopeRef = useRef(scopeKey)
  scopeRef.current = scopeKey
  const allowed = new Set(
      scope.assignments
        .filter((a) => !scope.selection.assignmentId || a.id === scope.selection.assignmentId)
        .map((a) => a.id),
    ),
    visible = queue.filter((q) => allowed.has(q.assignmentId)),
    selected =
      selectedState && visible.some((q) => q.attemptId === selectedState.attemptId)
        ? selectedState
        : null,
    responses = selected?.responses.filter((r) => r.status !== 'void') ?? [],
    locked = selected?.attemptStatus === 'released'
  const dirty = Boolean(
    selected &&
    !locked &&
    (feedback !== (selected.feedback ?? '') ||
      responses.some((r) => {
        const d = drafts[r.responseId]
        return d && (d.score !== draftFor(r).score || d.feedback !== draftFor(r).feedback)
      })),
  )
  function canLeave() {
    return (
      !operation.current && (!dirty || window.confirm('Discard the unsaved marks and feedback?'))
    )
  }
  useEffect(() => {
    function warn(event: BeforeUnloadEvent) {
      if (dirty) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  useEffect(() => {
    const current = ++ticket.current
    setQueue([])
    setSelected(null)
    setError('')
    setLoading(Boolean(scope.context))
    if (scope.context)
      void Promise.all([listMarkingQueue(), listTeacherAssessmentAnalytics()])
        .then(([rows, summaries]) => {
          if (current === ticket.current) {
            setQueue(rows)
            setSummaries(summaries)
          }
        })
        .catch((cause) => {
          if (current === ticket.current)
            setError(cause instanceof Error ? cause.message : 'Submitted work could not be loaded.')
        })
        .finally(() => {
          if (current === ticket.current) setLoading(false)
        })
    return () => {
      ticket.current = current + 1
    }
  }, [scope.context, revision])
  useEffect(() => {
    setSelected(null)
    setDrafts({})
    setAudit({})
    setMessage('')
  }, [
    scope.selection.classId,
    scope.selection.subjectId,
    scope.selection.termId,
    scope.selection.assignmentId,
  ])
  function initialize(attempt: MarkingAttempt) {
    setSelected(attempt)
    setQuestionIndex(0)
    setFeedback(attempt.feedback ?? '')
    setDrafts(Object.fromEntries(attempt.responses.map((r) => [r.responseId, draftFor(r)])))
    setAudit({})
  }
  async function open(id: string) {
    if (!visible.some((q) => q.attemptId === id) || !canLeave()) return
    operation.current = true
    setBusy(true)
    setError('')
    setMessage('')
    const current = ticket.current
    try {
      const result = await getMarkingAttempt(id)
      if (current === ticket.current && scopeRef.current === scopeKey) initialize(result)
    } catch (cause) {
      if (current === ticket.current)
        setError(cause instanceof Error ? cause.message : 'This submission could not be opened.')
    } finally {
      operation.current = false
      setBusy(false)
    }
  }
  const deepLink = useRef('')
  const openRef = useRef(open)
  openRef.current = open
  const visibleAttemptIds = visible.map((q) => q.attemptId).join(',')
  useEffect(() => {
    const id = params.get('attemptId')
    if (
      id &&
      !loading &&
      scope.context &&
      visibleAttemptIds.split(',').includes(id) &&
      deepLink.current !== id
    ) {
      deepLink.current = id
      void openRef.current(id)
    }
  }, [loading, visibleAttemptIds, scope.context, params]) // permission-checked deep link; queue owns valid attempt IDs
  function validated(r: MarkingResponse) {
    const d = drafts[r.responseId] ?? blank,
      score = parseMark(d.score, r.maxScore)
    if (
      r.autoScore !== null &&
      score !== r.autoScore &&
      (score !== r.finalScore || d.feedback.trim() !== (r.teacherFeedback ?? '')) &&
      !d.overrideReason.trim()
    )
      throw new Error(`Question ${r.orderNum}: explain the automatic mark change.`)
    return {
      responseId: r.responseId,
      score,
      feedback: d.feedback.trim(),
      overrideReason: d.overrideReason,
    }
  }
  async function run(action: () => Promise<void>) {
    if (operation.current) return
    operation.current = true
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await action()
    } catch (cause) {
      if (scopeRef.current !== scopeKey) return
      setError(
        cause instanceof Error
          ? cause.message
          : 'The change could not be confirmed. Retry before continuing.',
      )
    } finally {
      operation.current = false
      setBusy(false)
    }
  }
  async function save(r: MarkingResponse) {
    if (!selected || locked) return
    const attemptId = selected.attemptId
    await run(async () => {
      const input = validated(r)
      await markResponse(input)
      const saved = await getMarkingAttempt(attemptId)
      if (scopeRef.current !== scopeKey) return
      setSelected(saved)
      const read = saved.responses.find((item) => item.responseId === r.responseId)
      if (!read || read.finalScore !== input.score)
        throw new Error('The saved mark could not be confirmed. Reload this submission.')
      setDrafts((current) => ({ ...current, [r.responseId]: draftFor(read) }))
      setAudit((current) => {
        const next = { ...current }
        delete next[r.responseId]
        return next
      })
      setMessage('Mark saved. Your other unsaved answers and overall feedback are still here.')
    })
  }
  async function finish(release: boolean) {
    if (!selected || locked) return
    if (release && !window.confirm('Share this result with the learner? Shared marks are locked.'))
      return
    await run(async () => {
      if (release && selected.pendingResponseIds.length)
        throw new Error('Resolve the pending mark review before sharing this result.')
      const inputs = responses.map(validated)
      if (!inputs.length) throw new Error('There are no answers to finalize.')
      for (const input of inputs) {
        if (scopeRef.current !== scopeKey)
          throw new Error(
            'Context changed. Reopen the submission to continue from its saved marks.',
          )
        const r = responses.find((r) => r.responseId === input.responseId)!
        if (r.finalScore !== input.score || (r.teacherFeedback ?? '') !== input.feedback) {
          await markResponse(input)
          setSelected((current) =>
            current
              ? {
                  ...current,
                  responses: current.responses.map((r) =>
                    r.responseId === input.responseId
                      ? {
                          ...r,
                          finalScore: input.score,
                          teacherFeedback: input.feedback,
                        }
                      : r,
                  ),
                }
              : null,
          )
        }
      }
      if (scopeRef.current !== scopeKey)
        throw new Error('Context changed. Reopen the submission before finishing.')
      try {
        await finalizeAttempt({
          attemptId: selected.attemptId,
          feedback,
          release,
        })
      } catch (cause) {
        const actual = await getMarkingAttempt(selected.attemptId)
        setSelected(actual)
        if (actual.attemptStatus === 'released')
          throw new Error(
            'The result was shared, but progress synchronization could not be confirmed. Do not release it again; contact school support.',
          )
        throw cause
      }
      initialize(await getMarkingAttempt(selected.attemptId))
      setQueue(await listMarkingQueue())
      setMessage(
        release
          ? 'Result shared and locked.'
          : 'Marking finished. The result stays private until you share it.',
      )
    })
  }
  function update(id: string, key: keyof Draft, value: string) {
    setDrafts((current) => ({
      ...current,
      [id]: { ...(current[id] ?? blank), [key]: value },
    }))
  }
  return (
    <section className={styles.page}>
      <AssessmentHeading
        title="Mark work"
        description="Mark submitted answers, save your progress and share results when ready."
      >
        {!dirty && <Link href={workspaceHref('analytics', scope.selection)}>Results</Link>}
      </AssessmentHeading>
      <ContextState scope={scope} />
      <AssessmentContextControls scope={scope} disabled={busy} canChange={canLeave} />
      {error && (
        <div role="alert" className={styles.error}>
          {error}
          {!selected && <button onClick={() => setRevision((n) => n + 1)}>Retry</button>}
        </div>
      )}
      {message && (
        <p role="status" className={styles.notice}>
          {message}
        </p>
      )}
      {loading && <p role="status">Loading submitted work…</p>}
      {!selected && !loading && scope.context && (
        <>
          <div className={styles.tabs} role="group" aria-label="Marking stages">
            {['To mark', 'In progress', 'Ready to share', 'Shared'].map((name) => (
              <button key={name} aria-pressed={tab === name} onClick={() => setTab(name)}>
                {name} ({visible.filter((q) => stage(q) === name).length})
              </button>
            ))}
          </div>
          <section className={styles.panel}>
            <h2>{tab}</h2>
            {!error && visible.filter((q) => stage(q) === tab).length === 0 && (
              <p>
                No submitted work in this stage matches your selections. Missing submissions are
                listed in Results.
              </p>
            )}
            {scope.assignments
              .filter((a) => visible.some((q) => q.assignmentId === a.id && stage(q) === tab))
              .map((a) => (
                <div key={a.id}>
                  <h3>{a.title}</h3>
                  <p className={styles.muted}>
                    {visible.filter((q) => q.assignmentId === a.id && stage(q) === tab).length}{' '}
                    submissions in this stage
                    {summaries.find((s) => s.assignmentId === a.id)
                      ? ' · ' +
                        summaries.find((s) => s.assignmentId === a.id)!.eligibleLearners +
                        ' expected learners'
                      : ''}
                  </p>
                  <p className={styles.muted}>
                    {scope.context?.classes.find((c) => c.id === a.classId)?.name} ·{' '}
                    {a.type.replaceAll('_', ' ')}
                  </p>
                  <ul className={styles.rows}>
                    {visible
                      .filter((q) => q.assignmentId === a.id && stage(q) === tab)
                      .map((q) => (
                        <li key={q.attemptId} className={styles.row}>
                          <div>
                            <strong>{q.studentName}</strong>
                            <p className={styles.muted}>
                              {q.markedItems} / {q.totalItems} answers scored
                              {q.submittedAt
                                ? ' · ' + new Date(q.submittedAt).toLocaleDateString('en-KE')
                                : ''}
                              {q.submittedAt &&
                              a.closesAt &&
                              Date.parse(q.submittedAt) > Date.parse(a.closesAt)
                                ? ' · Late submission'
                                : ''}
                            </p>
                          </div>
                          <button disabled={busy} onClick={() => void open(q.attemptId)}>
                            {tab === 'Shared' ? 'View work' : 'Open work'}
                          </button>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
          </section>
        </>
      )}
      {selected && (
        <>
          <section className={styles.panel}>
            <div className={styles.actions}>
              <button
                disabled={busy}
                onClick={() => {
                  if (canLeave()) {
                    setSelected(null)
                    setDrafts({})
                    setMessage('')
                  }
                }}
              >
                Back to queue
              </button>
              {visible.some(
                (q) => q.attemptId !== selected.attemptId && q.attemptStatus !== 'released',
              ) && (
                <button
                  disabled={busy}
                  onClick={() => {
                    const index = visible.findIndex((q) => q.attemptId === selected.attemptId),
                      next = [...visible.slice(index + 1), ...visible.slice(0, index)].find(
                        (q) => q.attemptStatus !== 'released',
                      )
                    if (next) void open(next.attemptId)
                  }}
                >
                  Next learner
                </button>
              )}
            </div>
            <h2>{selected.studentName}</h2>
            <p>{selected.assessmentTitle}</p>
            <p className={styles.muted}>
              {responses.filter((r) => r.finalScore !== null).length} / {responses.length} answers
              saved ·{' '}
              {locked
                ? 'Shared and locked'
                : selected.attemptStatus === 'marked'
                  ? 'Ready to share'
                  : 'Marking in progress'}
            </p>
            {dirty && <p role="status">Unsaved changes</p>}
          </section>
          <section className={styles.panel}>
            <div className={styles.fields}>
              <label>
                Answer view
                <select
                  value={answerView}
                  disabled={busy}
                  onChange={(e) => setAnswerView(e.target.value)}
                >
                  <option value="one">One question at a time</option>
                  <option value="all">All answers</option>
                </select>
              </label>
              {answerView === 'one' && (
                <label>
                  Question
                  <select
                    value={questionIndex}
                    disabled={busy}
                    onChange={(e) => setQuestionIndex(Number(e.target.value))}
                  >
                    {responses.map((r, index) => (
                      <option value={index} key={r.responseId}>
                        Question {r.orderNum} ·{' '}
                        {r.finalScore === null ? 'Not saved' : r.finalScore + ' / ' + r.maxScore}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </section>
          {(answerView === 'all'
            ? responses
            : responses.slice(questionIndex, questionIndex + 1)
          ).map((r) => {
            const d = drafts[r.responseId] ?? blank,
              reviewPending = selected.pendingResponseIds.includes(r.responseId),
              responseLocked = locked || reviewPending
            return (
              <section id={'question-' + r.orderNum} key={r.responseId} className={styles.panel}>
                <h2>
                  Question {r.orderNum} <span className={styles.muted}>/ {r.maxScore} marks</span>
                </h2>
                <p>{r.prompt}</p>
                {reviewPending && (
                  <p role="status" className={styles.notice}>
                    A school administrator is reviewing this mark. This answer is locked until the
                    review is resolved.
                  </p>
                )}
                <h3>Learner’s answer</h3>
                <div className={styles.answer}>
                  {r.responseText || <MarkingGuide value={r.responseValue} />}
                </div>
                <details>
                  <summary>Marking guide and expected answer</summary>
                  <MarkingGuide value={r.markingGuide} />
                  {r.correctAnswer !== null && <MarkingGuide value={r.correctAnswer} />}
                </details>
                {r.autoScore !== null && (
                  <p className={styles.muted}>
                    Automatic mark: {r.autoScore} / {r.maxScore}
                  </p>
                )}
                <div className={styles.fields}>
                  <label>
                    Mark for question {r.orderNum}
                    <input
                      disabled={busy || responseLocked}
                      type="number"
                      min="0"
                      max={r.maxScore}
                      step="any"
                      value={d.score}
                      onChange={(e) => update(r.responseId, 'score', e.target.value)}
                    />
                  </label>
                  <label>
                    Feedback for question {r.orderNum}
                    <textarea
                      disabled={busy || responseLocked}
                      value={d.feedback}
                      onChange={(e) => update(r.responseId, 'feedback', e.target.value)}
                    />
                  </label>
                </div>
                {r.autoScore !== null && d.score !== '' && Number(d.score) !== r.autoScore && (
                  <label className={styles.label}>
                    Reason for changing the automatic mark
                    <textarea
                      disabled={busy || responseLocked}
                      value={d.overrideReason}
                      onChange={(e) => update(r.responseId, 'overrideReason', e.target.value)}
                    />
                  </label>
                )}
                <div className={styles.actions}>
                  {!responseLocked && (
                    <button disabled={busy} onClick={() => void save(r)}>
                      Save question {r.orderNum}
                    </button>
                  )}
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const events = await getScoreAudit(r.responseId)
                        setAudit((current) => ({
                          ...current,
                          [r.responseId]: events,
                        }))
                      })
                    }
                  >
                    Score history for question {r.orderNum}
                  </button>
                  {responses.find((next) => next.orderNum > r.orderNum) &&
                    (answerView === 'one' ? (
                      <button
                        disabled={busy}
                        onClick={() =>
                          setQuestionIndex((index) => Math.min(index + 1, responses.length - 1))
                        }
                      >
                        Next question
                      </button>
                    ) : (
                      <a
                        href={
                          '#question-' +
                          responses.find((next) => next.orderNum > r.orderNum)!.orderNum
                        }
                      >
                        Next question
                      </a>
                    ))}
                </div>
                {audit[r.responseId] && (
                  <ul>
                    {audit[r.responseId].length === 0 ? (
                      <li>No score events yet.</li>
                    ) : (
                      audit[r.responseId].map((event) => (
                        <li key={event.eventId}>
                          {event.eventType.replaceAll('_', ' ')}: {event.previousScore ?? '—'} →{' '}
                          {event.newScore ?? '—'} ·{' '}
                          {new Date(event.createdAt).toLocaleString('en-KE')}
                          {event.reason ? ' · ' + event.reason : ''}
                        </li>
                      ))
                    )}
                  </ul>
                )}
                {!responseLocked && (
                  <details>
                    <summary>Request a mark review</summary>
                    <label className={styles.label}>
                      Review reason for question {r.orderNum}
                      <textarea
                        disabled={busy}
                        value={d.moderationReason}
                        onChange={(e) => update(r.responseId, 'moderationReason', e.target.value)}
                      />
                    </label>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          const score = parseMark(d.score, r.maxScore)
                          if (d.moderationReason.trim().length < 5)
                            throw new Error(
                              'Explain the review request in at least five characters.',
                            )
                          await requestModeration({
                            responseId: r.responseId,
                            requestedScore: score,
                            reason: d.moderationReason.trim(),
                          })
                          update(r.responseId, 'moderationReason', '')
                          setSelected(await getMarkingAttempt(selected.attemptId))
                          setMessage(
                            'Mark review requested. A school administrator must make the decision.',
                          )
                        })
                      }
                    >
                      Request review for question {r.orderNum}
                    </button>
                  </details>
                )}
              </section>
            )
          })}
          <section className={styles.panel}>
            <label className={styles.label}>
              Overall feedback
              <textarea
                disabled={busy || locked}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
              />
            </label>
            {locked ? (
              <p>This result is shared and locked.</p>
            ) : (
              <div className={styles.actions}>
                <button disabled={busy} onClick={() => void finish(false)}>
                  Finish marking
                </button>
                <button
                  className={styles.primary}
                  disabled={busy}
                  onClick={() => void finish(true)}
                >
                  Share result
                </button>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  )
}
export default function MarkingPage() {
  return (
    <Suspense fallback={<p role="status">Loading marking workspace…</p>}>
      <Workspace />
    </Suspense>
  )
}
