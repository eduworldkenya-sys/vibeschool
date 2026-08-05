'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  saveResponse,
  startOrResumeAttempt,
  submitAttempt,
} from '@/lib/assessment'
import type {
  AttemptWorkspace,
  LearnerAssessmentItem,
  SubmitAttemptResult,
} from '@/lib/assessment'

type AnswerState = Record<
  string,
  {
    text: string
    value: unknown
    saving: boolean
    saved: boolean
  }
>

export default function LearnerAssessmentPage() {
  const params = useParams<{ assignmentId: string }>()
  const router = useRouter()
  const assignmentId = params.assignmentId

  const [workspace, setWorkspace] =
    useState<AttemptWorkspace | null>(null)
  const [answers, setAnswers] = useState<AnswerState>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] =
    useState<SubmitAttemptResult | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')

      try {
        const loaded = await startOrResumeAttempt(assignmentId)
        if (cancelled) return

        setWorkspace(loaded)

        const savedMap = new Map(
          loaded.responses.map(response => [
            response.assessmentItemId,
            response,
          ]),
        )

        setAnswers(
          Object.fromEntries(
            loaded.items.map(item => {
              const saved = savedMap.get(item.id)
              return [
                item.id,
                {
                  text: saved?.responseText ?? '',
                  value: saved?.responseValue ?? null,
                  saving: false,
                  saved: Boolean(saved),
                },
              ]
            }),
          ),
        )
      } catch (loadError) {
        console.error('[LearnerAssessment] start attempt', loadError)
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Assessment could not be opened.',
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [assignmentId])

  const answeredCount = useMemo(
    () => Object.values(answers).filter(answer => {
      if (typeof answer.value === 'string') {
        return answer.value.trim().length > 0
      }
      if (answer.value !== null && answer.value !== undefined) {
        return true
      }
      return answer.text.trim().length > 0
    }).length,
    [answers],
  )

  function updateText(itemId: string, text: string) {
    setAnswers(current => ({
      ...current,
      [itemId]: {
        ...(current[itemId] ?? {
          value: null,
          saving: false,
          saved: false,
        }),
        text,
        saved: false,
      },
    }))
  }

  function updateValue(itemId: string, value: unknown) {
    setAnswers(current => ({
      ...current,
      [itemId]: {
        ...(current[itemId] ?? {
          text: '',
          saving: false,
          saved: false,
        }),
        value,
        saved: false,
      },
    }))
  }

  async function persist(item: LearnerAssessmentItem) {
    if (!workspace) return

    const current = answers[item.id]
    if (!current || current.saving) return

    setAnswers(state => ({
      ...state,
      [item.id]: { ...state[item.id], saving: true },
    }))

    try {
      await saveResponse({
        attemptId: workspace.attemptId,
        assessmentItemId: item.id,
        responseValue:
          current.value === undefined ? null : current.value,
        responseText: current.text || null,
      })

      setAnswers(state => ({
        ...state,
        [item.id]: {
          ...state[item.id],
          saving: false,
          saved: true,
        },
      }))
    } catch (saveError) {
      console.error('[LearnerAssessment] save response', saveError)
      setAnswers(state => ({
        ...state,
        [item.id]: {
          ...state[item.id],
          saving: false,
          saved: false,
        },
      }))
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Answer could not be saved.',
      )
    }
  }

  async function submit() {
    if (!workspace || submitting) return

    setSubmitting(true)
    setError('')

    try {
      for (const item of workspace.items) {
        const answer = answers[item.id]
        if (answer && !answer.saved) {
          await saveResponse({
            attemptId: workspace.attemptId,
            assessmentItemId: item.id,
            responseValue:
              answer.value === undefined ? null : answer.value,
            responseText: answer.text || null,
          })
        }
      }

      const submitted = await submitAttempt(workspace.attemptId)
      setResult(submitted)
    } catch (submitError) {
      console.error('[LearnerAssessment] submit attempt', submitError)
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Assessment could not be submitted.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <main style={shell}>Loading assessment…</main>
  }

  if (error && !workspace) {
    return (
      <main style={shell}>
        <section style={card}>
          <h1 style={{ marginTop: 0 }}>Assessment unavailable</h1>
          <p style={{ color: '#b91c1c' }}>{error}</p>
          <button onClick={() => router.back()} style={secondaryButton}>
            Go back
          </button>
        </section>
      </main>
    )
  }

  if (!workspace) return null

  if (result) {
    return (
      <main style={shell}>
        <section style={{ ...card, borderColor: '#6ee7b7' }}>
          <h1 style={{ marginTop: 0, color: '#065f46' }}>
            Assessment submitted ✓
          </h1>
          <p style={{ fontSize: 30, fontWeight: 800, margin: '12px 0' }}>
            {result.score}/{result.maxScore}
          </p>
          <p style={{ color: '#374151' }}>
            {result.percentage.toFixed(1)}%
          </p>
          <p style={{ color: '#6b7280', lineHeight: 1.5 }}>
            {result.manualItems > 0
              ? `${result.manualItems} written response${result.manualItems === 1 ? '' : 's'} will be reviewed by your teacher.`
              : 'All questions were marked automatically.'}
          </p>
          <button onClick={() => router.back()} style={primaryButton}>
            Done
          </button>
        </section>
      </main>
    )
  }

  return (
    <main style={shell}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <section style={card}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#4338ca' }}>
            QUIZ
          </div>
          <h1 style={{ margin: '6px 0' }}>{workspace.title}</h1>
          {workspace.instructions && (
            <p style={{ margin: 0, color: '#6b7280', lineHeight: 1.5 }}>
              {workspace.instructions}
            </p>
          )}
          <div style={{ marginTop: 12, fontSize: 12, fontWeight: 700 }}>
            {answeredCount}/{workspace.items.length} answered
          </div>
        </section>

        {workspace.items.map((item, index) => {
          const answer = answers[item.id]

          return (
            <section key={item.id} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <strong>Question {index + 1}</strong>
                <span style={{ color: '#6b7280', fontSize: 12 }}>
                  {item.marks} mark{item.marks === 1 ? '' : 's'}
                </span>
              </div>
              <p style={{ lineHeight: 1.6 }}>{item.prompt}</p>

              {item.questionType === 'true_false' ? (
                <div style={{ display: 'flex', gap: 10 }}>
                  {['true', 'false'].map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => updateText(item.id, option)}
                      onBlur={() => void persist(item)}
                      style={{
                        ...secondaryButton,
                        flex: 1,
                        background:
                          answer?.text === option ? '#eef2ff' : '#fff',
                        borderColor:
                          answer?.text === option ? '#4338ca' : '#d1d5db',
                      }}
                    >
                      {option === 'true' ? 'True' : 'False'}
                    </button>
                  ))}
                </div>
              ) : item.questionType === 'multiple_choice' && Array.isArray(item.options) ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {item.options.map((option, optionIndex) => (
                    <button
                      key={optionIndex}
                      type="button"
                      onClick={() => updateValue(item.id, option)}
                      onBlur={() => void persist(item)}
                      style={{
                        ...secondaryButton,
                        textAlign: 'left',
                        background:
                          JSON.stringify(answer?.value) === JSON.stringify(option)
                            ? '#eef2ff'
                            : '#fff',
                      }}
                    >
                      {String(option)}
                    </button>
                  ))}
                </div>
              ) : (
                <textarea
                  value={answer?.text ?? ''}
                  onChange={event => updateText(item.id, event.target.value)}
                  onBlur={() => void persist(item)}
                  rows={item.questionType === 'structured' ? 5 : 3}
                  placeholder="Type your answer"
                  style={input}
                />
              )}

              <div style={{ marginTop: 8, fontSize: 11, color: '#6b7280' }}>
                {answer?.saving
                  ? 'Saving…'
                  : answer?.saved
                    ? 'Saved ✓'
                    : 'Not saved yet'}
              </div>
            </section>
          )
        })}

        {error && (
          <div style={{ ...card, color: '#b91c1c', borderColor: '#fecaca' }}>
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          style={{
            ...primaryButton,
            width: '100%',
            opacity: submitting ? 0.6 : 1,
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Submitting…' : 'Submit Assessment'}
        </button>
      </div>
    </main>
  )
}

const shell: React.CSSProperties = {
  minHeight: '100vh',
  background: '#f8fafc',
  padding: '18px 14px 80px',
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  color: '#111827',
}

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 16,
  padding: 16,
  marginBottom: 12,
  boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
}

const input: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid #d1d5db',
  borderRadius: 10,
  padding: '11px 12px',
  font: 'inherit',
  resize: 'vertical',
}

const primaryButton: React.CSSProperties = {
  border: 'none',
  borderRadius: 12,
  padding: '13px 16px',
  background: '#4338ca',
  color: '#fff',
  fontWeight: 800,
  fontSize: 13,
  fontFamily: 'inherit',
}

const secondaryButton: React.CSSProperties = {
  border: '1px solid #d1d5db',
  borderRadius: 10,
  padding: '10px 14px',
  background: '#fff',
  color: '#374151',
  fontWeight: 700,
  fontSize: 12,
  fontFamily: 'inherit',
  cursor: 'pointer',
}
