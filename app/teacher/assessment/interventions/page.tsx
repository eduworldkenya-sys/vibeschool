'use client'
export const dynamic = 'force-dynamic'
import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { nairobiDateStr } from '@/lib/time'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  createInterventionAssessment,
  refreshInterventionEvidence,
  evaluateIntervention,
  listInterventionQueue,
  updateIntervention,
  type InterventionQueueItem,
  type InterventionStatus,
} from '@/lib/assessment/interventions'
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
    params = useSearchParams(),
    router = useRouter(),
    ticket = useRef(0),
    operation = useRef(false),
    studentId = params.get('studentId') ?? ''
  const [items, setItems] = useState<InterventionQueueItem[]>([]),
    [includeClosed, setIncludeClosed] = useState(false),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [revision, setRevision] = useState(0),
    [selectedId, setSelectedId] = useState(''),
    [search, setSearch] = useState(''),
    [status, setStatus] = useState('all'),
    [note, setNote] = useState(''),
    [due, setDue] = useState('')
  const assignment = scope.context?.assignments.find((a) => a.id === scope.selection.assignmentId),
    classId = assignment?.classId || scope.selection.classId,
    subjectId = assignment?.subjectId || scope.selection.subjectId
  useEffect(() => {
    const current = ++ticket.current
    setItems([])
    setSelectedId('')
    setNote('')
    setDue('')
    setMessage('')
    setError('')
    setLoading(Boolean(scope.context))
    if (scope.context)
      void listInterventionQueue(classId || undefined, includeClosed)
        .then((rows) => {
          if (current === ticket.current)
            setItems(
              rows.filter(
                (r) =>
                  (!subjectId || r.subjectId === subjectId) &&
                  (!studentId || r.studentId === studentId),
              ),
            )
        })
        .catch((cause) => {
          if (current === ticket.current)
            setError(
              cause instanceof Error ? cause.message : 'Learner support could not be loaded.',
            )
        })
        .finally(() => {
          if (current === ticket.current) setLoading(false)
        })
    return () => {
      ticket.current = current + 1
    }
  }, [scope.context, classId, subjectId, studentId, includeClosed, revision])
  const selected = items.find((i) => i.interventionId === selectedId),
    visible = items.filter(
      (i) =>
        (status === 'all' || i.status === status) &&
        [i.studentName, i.admissionNumber, i.outcomeText]
          .join(' ')
          .toLowerCase()
          .includes(search.toLowerCase()),
    ),
    active = items.filter((i) => !['completed', 'dismissed'].includes(i.status))
  function choose(item: InterventionQueueItem) {
    setSelectedId(item.interventionId)
    setNote('')
    setDue(item.dueAt ? nairobiDateStr(new Date(item.dueAt)) : '')
    setError('')
    setMessage('')
  }
  async function run(action: () => Promise<string>) {
    if (operation.current) return
    operation.current = true
    setBusy(true)
    setError('')
    setMessage('')
    const current = ticket.current
    try {
      const result = await action()
      if (current !== ticket.current) return
      const rows = await listInterventionQueue(classId || undefined, includeClosed)
      if (current === ticket.current) {
        setItems(
          rows.filter(
            (r) =>
              (!subjectId || r.subjectId === subjectId) &&
              (!studentId || r.studentId === studentId),
          ),
        )
        setNote('')
        const currentRecord = rows.find((row) => row.interventionId === selectedId)
        setDue(currentRecord?.dueAt ? nairobiDateStr(new Date(currentRecord.dueAt)) : '')
        setMessage(result)
      }
    } catch (cause) {
      if (current === ticket.current)
        setError(
          cause instanceof Error ? cause.message : 'The support change could not be confirmed.',
        )
    } finally {
      operation.current = false
      setBusy(false)
    }
  }
  function change(item: InterventionQueueItem, next: InterventionStatus) {
    void run(async () => {
      if (
        (next === 'dismissed' || ['completed', 'dismissed'].includes(item.status)) &&
        note.trim().length < 5
      )
        throw new Error(
          'Give a reason of at least five characters before dismissing or reopening support.',
        )
      await updateIntervention({
        interventionId: item.interventionId,
        status: next,
        completionNote: note.trim() || null,
        dueAt: due ? due + 'T09:00:00+03:00' : null,
      })
      const read = (await listInterventionQueue(classId || undefined, true)).find(
        (r) => r.interventionId === item.interventionId,
      )
      if (!read || read.status !== next || (note.trim() && read.completionNote !== note.trim()))
        throw new Error(
          'The status or reason was not saved as requested. Your support record needs a server correction; do not repeat the action.',
        )
      return 'Support updated and verified.'
    })
  }
  return (
    <section className={styles.page}>
      <AssessmentHeading
        title="Learner support"
        description="Turn learning evidence into a plan, then review what changed."
      >
        <Link href={workspaceHref('analytics', scope.selection)}>Results</Link>
        {classId && (
          <Link
            href={`/teacher/classhub/${classId}/progress${subjectId ? '?subjectId=' + subjectId : ''}`}
          >
            Progress record
          </Link>
        )}
      </AssessmentHeading>
      <ContextState scope={scope} />
      <AssessmentContextControls scope={scope} disabled={busy} />
      {assignment && (
        <p className={styles.muted}>
          Support is shown for this assessment’s class and subject. Support records can draw on
          several assessments; they are not attributed to this paper alone.
        </p>
      )}
      {error && (
        <div className={styles.error} role="alert">
          {error}{' '}
          <button disabled={busy} onClick={() => setRevision((n) => n + 1)}>
            Retry
          </button>
        </div>
      )}
      {message && (
        <p role="status" className={styles.notice}>
          {message}
        </p>
      )}
      {loading && <p role="status">Loading saved support records…</p>}
      {scope.context && !loading && (
        <>
          <div className={styles.actions}>
            <button disabled={busy||!classId} onClick={()=>void run(async()=>{const count=await refreshInterventionEvidence(classId);return `${count} support records refreshed from recorded evidence. Existing review dates are kept.`})}>Refresh from evidence</button>
            <button
              disabled={busy}
              aria-pressed={includeClosed}
              onClick={() => setIncludeClosed((v) => !v)}
            >
              {includeClosed ? 'Show open support' : 'Include completed support'}
            </button>
          </div>
          {!error && (
            <div className={styles.stats}>
              <div>
                <strong>{active.length}</strong>Active plans
              </div>
              <div>
                <strong>
                  {active.filter((i) => i.priority === 'urgent' || i.priority === 'high').length}
                </strong>
                High priority
              </div>
              <div>
                <strong>
                  {active.filter((i) => i.dueAt && Date.parse(i.dueAt) < Date.now()).length}
                </strong>
                Overdue reviews
              </div>
            </div>
          )}
          {!selected ? (
            <section className={styles.panel}>
              <h2>Support queue</h2>
              <div className={styles.fields}>
                <label>
                  Plan status
                  <select value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="all">All statuses</option>
                    {[
                      'open',
                      'in_progress',
                      'escalated',
                      ...(includeClosed ? ['completed', 'dismissed'] : []),
                    ].map((s) => (
                      <option key={s} value={s}>
                        {s.replaceAll('_', ' ')}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Find learner or outcome
                  <input value={search} onChange={(e) => setSearch(e.target.value)} />
                </label>
              </div>
              {visible.length === 0 && !error ? (
                <>
                  <strong>No support records match</strong>
                  <p>
                    No evidence-backed intervention matches this context. This does not mean every
                    learner has mastered the curriculum.
                  </p>
                </>
              ) : (
                <ul className={styles.rows}>
                  {visible.map((item) => (
                    <li key={item.interventionId} className={styles.row}>
                      <div>
                        <strong>{item.studentName}</strong>
                        <p className={styles.muted}>
                          {item.className} · {item.subjectName} ·{' '}
                          {item.recommendationType === 'extension_challenge'
                            ? 'Extension'
                            : item.priority + ' priority'}{' '}
                          · {item.status.replaceAll('_', ' ')}
                        </p>
                        <p>{item.outcomeText}</p>
                        <p className={styles.muted}>
                          {item.evidenceCount} evidence records
                          {item.dueAt
                            ? ' · Review ' +
                              new Date(item.dueAt).toLocaleDateString('en-KE', {
                                timeZone: 'Africa/Nairobi',
                              })
                            : ''}
                        </p>
                      </div>
                      <button disabled={busy} onClick={() => choose(item)}>
                        Review {item.studentName}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : (
            <section className={styles.panel}>
              <button disabled={busy} onClick={() => setSelectedId('')}>
                Back to support queue
              </button>
              <h2>{selected.studentName}</h2>
              <p className={styles.muted}>
                {selected.className} · {selected.subjectName} ·{' '}
                {selected.status.replaceAll('_', ' ')}
              </p>
              <h3>
                {selected.outcomeCode ? selected.outcomeCode + ' · ' : ''}
                {selected.outcomeText}
              </h3>
              <p>{selected.recommendation}</p>
              <div className={styles.stats}>
                <div>
                  <strong>{selected.masteryScore.toFixed(1)}%</strong>Recorded mastery
                </div>
                <div>
                  <strong>{selected.evidenceCount}</strong>Evidence records
                </div>
              </div>
              <details>
                <summary>Evidence and progress</summary>
                <p>{selected.repeatedWeaknessCount} recent results below 50%.</p>
                <p>
                  Baseline:{' '}
                  {selected.baselineMasteryScore === null
                    ? 'Not recorded'
                    : selected.baselineMasteryScore.toFixed(1) + '%'}{' '}
                  · Follow-up:{' '}
                  {selected.followupMasteryScore === null
                    ? 'Not evaluated'
                    : selected.followupMasteryScore.toFixed(1) + '%'}{' '}
                  · Change:{' '}
                  {selected.masteryChange === null
                    ? 'Not evaluated'
                    : selected.masteryChange.toFixed(1) + ' percentage points'}
                </p>
                <SupportHistory item={selected} />
              </details>
              {selected.completionNote && <p>Recorded note: {selected.completionNote}</p>}
              <label className={styles.label}>
                Plan note or reason
                <textarea
                  disabled={busy}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Record your plan, dismissal reason or reason to reopen"
                />
              </label>
              <label className={styles.label}>
                Review date
                <input
                  type="date"
                  disabled={busy}
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                />
              </label>
              <div className={styles.actions}>
                {selected.status === 'open' && (
                  <button
                    className={styles.primary}
                    disabled={busy}
                    onClick={() => change(selected, 'in_progress')}
                  >
                    Start support
                  </button>
                )}
                {!['completed', 'dismissed'].includes(selected.status) && (
                  <>
                    <button disabled={busy} onClick={() => change(selected, selected.status)}>
                      Save plan
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          const id =
                            selected.remedialAssessmentId ??
                            (await createInterventionAssessment(selected.interventionId))
                          router.push('/teacher/assessment/builder/' + id)
                          return 'Practice assessment opened.'
                        })
                      }
                    >
                      {selected.remedialAssessmentId
                        ? 'Open practice'
                        : selected.recommendationType === 'extension_challenge'
                          ? 'Create extension practice'
                          : 'Create focused practice'}
                    </button>
                    {selected.remedialAssignmentId && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            const result = await evaluateIntervention(selected.interventionId)
                            return `Follow-up evaluated: ${result.baselineMasteryScore.toFixed(1)}% → ${result.followupMasteryScore.toFixed(1)}%. ${result.recommendation}`
                          })
                        }
                      >
                        Evaluate follow-up
                      </button>
                    )}
                    {selected.status !== 'escalated' && (
                      <button disabled={busy} onClick={() => change(selected, 'escalated')}>
                        Escalate support
                      </button>
                    )}
                    <button disabled={busy} onClick={() => change(selected, 'dismissed')}>
                      Dismiss with reason
                    </button>
                  </>
                )}
                {['completed', 'dismissed'].includes(selected.status) && (
                  <button disabled={busy} onClick={() => change(selected, 'open')}>
                    Reopen with reason
                  </button>
                )}
              </div>
              <p className={styles.muted}>
                Completion is decided by released follow-up evidence. Opening this page does not
                refresh evidence or change plans.
              </p>
            </section>
          )}
        </>
      )}
    </section>
  )
}
function SupportHistory({ item }: { item: InterventionQueueItem }) {
  const snapshot =
    item.evidenceSnapshot &&
    typeof item.evidenceSnapshot === 'object' &&
    !Array.isArray(item.evidenceSnapshot)
      ? item.evidenceSnapshot
      : {}
  const sources = Array.isArray(snapshot.evidence_sources) ? snapshot.evidence_sources : []
  const history = Array.isArray(snapshot.lifecycle_history) ? snapshot.lifecycle_history : []
  return (
    <>
      <p>
        Evidence sources:{' '}
        {sources.length
          ? sources
              .filter((s) => typeof s === 'string')
              .map((s) => String(s).replaceAll('_', ' '))
              .join(', ')
          : 'Not listed in this record'}
      </p>
      <h3>Plan history</h3>
      {history.length ? (
        <ol>
          {history.map((entry, index) => {
            const row = entry && typeof entry === 'object' && !Array.isArray(entry) ? entry : {}
            return (
              <li key={index}>
                {typeof row.at === 'string' ? new Date(row.at).toLocaleString('en-KE') : ''} ·{' '}
                {String(row.from_status ?? '').replaceAll('_', ' ')} →{' '}
                {String(row.to_status ?? '').replaceAll('_', ' ')}
                {typeof row.note === 'string' ? ' · ' + row.note : ''}
              </li>
            )
          })}
        </ol>
      ) : (
        <p>
          No lifecycle history is recorded yet. Existing notes and evaluated results remain above.
        </p>
      )}
    </>
  )
}
export default function SupportPage() {
  return (
    <Suspense fallback={<p role="status">Loading learner support…</p>}>
      <Workspace />
    </Suspense>
  )
}
