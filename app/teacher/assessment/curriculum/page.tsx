'use client'
export const dynamic = 'force-dynamic'
import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { getAssignmentIntelligence } from '@/lib/assessment/intelligence'
import { loadAssessmentOutcomeQuestions, type OutcomeQuestion } from '@/lib/assessment/workspace'
import {
  getCurriculumIntelligence,
  type CurriculumIntelligence,
} from '@/lib/assessment/curriculumIntelligence'
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
  const [questions, setQuestions] = useState<OutcomeQuestion[]>([])
  const [data, setData] = useState<CurriculumIntelligence | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    setData(null)
    setQuestions([])
    setError('')
    setLoading(Boolean(id && scope.context))
    if (id && scope.context)
      void Promise.all([
        getCurriculumIntelligence(id),
        getAssignmentIntelligence(id),
        loadAssessmentOutcomeQuestions(
          scope.context.assignments.find((a) => a.id === id)!.assessmentId,
        ),
      ])
        .then(([result, released, questions]) => {
          if (result.assignmentId !== id || released.assignmentId !== id)
            throw new Error('The requested outcome evidence could not be confirmed.')
          if (active) {
            setQuestions(questions)
            setData({
              ...result,
              outcomes: result.outcomes.map((outcome) => {
                const evidence = released.outcomes.find((o) => o.outcomeId === outcome.outcomeId)
                return {
                  ...outcome,
                  responseCount: evidence?.responseCount ?? 0,
                  averagePercentage: evidence?.averagePercentage ?? null,
                  learnersBelow50: evidence?.learnersBelow50 ?? 0,
                  masteryBand: evidence?.masteryBand ?? 'not_assessed',
                }
              }),
            })
          }
        })
        .catch((cause) => {
          if (active)
            setError(
              cause instanceof Error ? cause.message : 'Learning outcomes could not be loaded.',
            )
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    return () => {
      active = false
    }
  }, [id, scope.context, revision])
  const assessed = data?.outcomes.filter((o) => o.responseCount > 0).length ?? 0
  return (
    <section className={styles.page}>
      <AssessmentHeading
        title="Learning outcomes"
        description="See the evidence behind each outcome and decide what to teach next."
      >
        <Link href={workspaceHref('analytics', scope.selection)}>Results</Link>
        <Link href={workspaceHref('interventions', scope.selection)}>Learner support</Link>
      </AssessmentHeading>
      <ContextState scope={scope} />
      <AssessmentContextControls scope={scope} />
      {scope.context && !id && (
        <section className={styles.panel}>
          <h2>Choose an assessment</h2>
          <p>Choose a class, subject and assessment above to review its linked outcomes.</p>
          {scope.assignments.length === 0 && (
            <p>No assessments match these selections. Try another class or term.</p>
          )}
        </section>
      )}
      {loading && <p role="status">Loading learning evidence…</p>}
      {error && (
        <div role="alert" className={styles.error}>
          {error} <button onClick={() => setRevision((n) => n + 1)}>Retry</button>
        </div>
      )}
      {data && data.assignmentId === id && !loading && (
        <>
          <div className={styles.stats}>
            <div>
              <strong>{data.outcomes.length}</strong>Linked outcomes
            </div>
            <div>
              <strong>{assessed}</strong>With response evidence
            </div>
            <div>
              <strong>{data.outcomes.length - assessed}</strong>Without response evidence
            </div>
          </div>
          <section className={styles.panel}>
            <h2>Outcome evidence</h2>
            <p className={styles.muted}>
              Only shared response evidence describes this assessment. It does not establish which
              outcomes have been taught or complete curriculum coverage.
            </p>
            {data.outcomes.length === 0 ? (
              <p>
                No outcomes are linked to this assessment. Link questions to outcomes in the
                assessment builder.
              </p>
            ) : (
              data.outcomes.map((outcome) => (
                <details key={outcome.outcomeId}>
                  <summary>
                    {outcome.outcomeCode ? outcome.outcomeCode + ' · ' : ''}
                    {outcome.outcomeText}
                  </summary>
                  <div className={styles.row}>
                    <div>
                      <strong>
                        {outcome.responseCount === 0
                          ? 'Not assessed'
                          : outcome.masteryBand.replaceAll('_', ' ')}
                      </strong>
                      <p className={styles.muted}>
                        {outcome.responseCount} scored responses ·{' '}
                        {outcome.responseCount
                          ? `${outcome.learnersBelow50} learners below 50%`
                          : 'No demonstrated mastery yet'}
                      </p>
                      <p className={styles.muted}>
                        Teaching coverage: not available from assessment evidence.
                      </p>
                    </div>
                    <strong>
                      {outcome.averagePercentage === null
                        ? 'No score evidence'
                        : outcome.averagePercentage.toFixed(1) + '%'}
                    </strong>
                  </div>
                  <h3>Questions assessing this outcome</h3>
                  {questions.some((q) => q.outcomeIds.includes(outcome.outcomeId)) ? (
                    <ul>
                      {questions
                        .filter((q) => q.outcomeIds.includes(outcome.outcomeId))
                        .map((q) => (
                          <li key={q.id}>
                            Question {q.order}: {q.prompt}
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <p>
                      Question links are not available in this record. Open the assessment to check
                      its outcome links.
                    </p>
                  )}
                  {outcome.competencyTags.length > 0 && (
                    <p className={styles.muted}>
                      Competencies: {outcome.competencyTags.join(', ')}
                    </p>
                  )}
                  <div className={styles.actions}>
                    <Link href={workspaceHref('analytics', scope.selection)}>
                      Review questions and learner results
                    </Link>
                    <Link href={workspaceHref('interventions', scope.selection)}>
                      Plan learner support
                    </Link>
                  </div>
                </details>
              ))
            )}
            <div className={styles.actions}>
              <Link
                href={
                  '/teacher/lessonplan?classId=' +
                  scope.assignments.find((a) => a.id === id)?.classId +
                  '&subjectId=' +
                  scope.assignments.find((a) => a.id === id)?.subjectId
                }
              >
                Plan reteaching
              </Link>
              <Link href="/teacher/assessment/bank">Find reusable questions</Link>
            </div>
            {scope.assignments.find((a) => a.id === id) && (
              <p>
                <Link
                  href={
                    '/teacher/assessment/builder/' +
                    scope.assignments.find((a) => a.id === id)!.assessmentId
                  }
                >
                  Open assessment and outcome links
                </Link>
              </p>
            )}
          </section>
          <section className={styles.panel}>
            <h2>Learners to follow up</h2>
            <p className={styles.muted}>
              These signals use cumulative recorded mastery for outcomes linked to this assessment,
              not only this paper’s scores.
            </p>
            {data.interventions.length === 0 ? (
              <p>
                {assessed === 0
                  ? 'No scored outcome evidence is available yet. Mark and share results before drawing conclusions.'
                  : 'No follow-up signals were returned for this assessment. Review the evidence before deciding whether support is needed.'}
              </p>
            ) : (
              <ul className={styles.rows}>
                {data.interventions.map((signal, index) => (
                  <li key={signal.studentId + signal.outcomeId + index} className={styles.row}>
                    <div>
                      <strong>{signal.studentName}</strong>
                      <p className={styles.muted}>{signal.outcomeText}</p>
                      <p>{signal.recommendedAction.replaceAll('_', ' ')}</p>
                    </div>
                    <Link
                      href={
                        workspaceHref('interventions', scope.selection) +
                        (workspaceHref('interventions', scope.selection).includes('?')
                          ? '&'
                          : '?') +
                        'studentId=' +
                        signal.studentId
                      }
                    >
                      Review support
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </section>
  )
}
export default function CurriculumPage() {
  return (
    <Suspense fallback={<p role="status">Loading learning outcomes…</p>}>
      <Workspace />
    </Suspense>
  )
}
