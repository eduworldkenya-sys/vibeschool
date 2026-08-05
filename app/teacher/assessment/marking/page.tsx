'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import {
  finalizeAttempt,
  getMarkingAttempt,
  listMarkingQueue,
  markResponse,
  type MarkingAttempt,
  type MarkingQueueItem,
} from '@/lib/assessment/marking'

type DraftMarks = Record<string, { score: string; feedback: string }>

export default function AssessmentMarkingPage() {
  const [queue, setQueue] = useState<MarkingQueueItem[]>([])
  const [selected, setSelected] = useState<MarkingAttempt | null>(null)
  const [drafts, setDrafts] = useState<DraftMarks>({})
  const [attemptFeedback, setAttemptFeedback] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function loadQueue() {
    setLoading(true)
    setError('')
    try {
      setQueue(await listMarkingQueue())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load marking queue.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadQueue()
  }, [])

  async function openAttempt(attemptId: string) {
    setBusy(true)
    setError('')
    try {
      const attempt = await getMarkingAttempt(attemptId)
      setSelected(attempt)
      setAttemptFeedback(attempt.feedback ?? '')
      setDrafts(Object.fromEntries(attempt.responses.map(response => [
        response.responseId,
        {
          score: response.finalScore === null ? '' : String(response.finalScore),
          feedback: response.teacherFeedback ?? '',
        },
      ])))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open submission.')
    } finally {
      setBusy(false)
    }
  }

  async function saveResponseMark(responseId: string, maxScore: number) {
    const draft = drafts[responseId]
    const score = Number(draft?.score)
    if (!Number.isFinite(score) || score < 0 || score > maxScore) {
      setError(`Enter a score from 0 to ${maxScore}.`)
      return
    }

    setBusy(true)
    setError('')
    try {
      await markResponse({
        responseId,
        score,
        feedback: draft.feedback,
      })
      if (selected) await openAttempt(selected.attemptId)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Response could not be marked.')
      setBusy(false)
    }
  }

  async function finishAttempt(release: boolean) {
    if (!selected) return
    setBusy(true)
    setError('')

    try {
      for (const response of selected.responses) {
        if (response.finalScore !== null) continue
        const draft = drafts[response.responseId]
        const score = Number(draft?.score)
        if (!Number.isFinite(score) || score < 0 || score > response.maxScore) {
          throw new Error(`Question ${response.orderNum} needs a score from 0 to ${response.maxScore}.`)
        }
        await markResponse({
          responseId: response.responseId,
          score,
          feedback: draft.feedback,
        })
      }

      await finalizeAttempt({
        attemptId: selected.attemptId,
        feedback: attemptFeedback,
        release,
      })
      setSelected(null)
      setDrafts({})
      await loadQueue()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Attempt could not be finalized.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main style={shell}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <section style={card}>
          <div style={eyebrow}>Assessment Engine</div>
          <h1 style={{ margin: '6px 0' }}>Marking Workspace</h1>
          <p style={{ margin: 0, color: '#6b7280' }}>Review written answers, finalize scores, and release results.</p>
        </section>

        {error && <section style={{ ...card, color: '#b91c1c', borderColor: '#fecaca' }}>{error}</section>}

        {!selected ? (
          <section style={card}>
            {loading ? 'Loading submissions…' : queue.length === 0 ? (
              <div>
                <strong>No submissions waiting for review</strong>
                <p style={{ color: '#6b7280', marginBottom: 0 }}>Written responses will appear here after learners submit.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {queue.map(item => (
                  <button key={item.attemptId} type="button" disabled={busy} onClick={() => void openAttempt(item.attemptId)} style={queueButton}>
                    <div style={{ textAlign: 'left' }}>
                      <strong>{item.studentName}</strong>
                      <div style={muted}>{item.assessmentTitle} · {item.className}{item.classStream ? ` ${item.classStream}` : ''}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <strong style={{ color: item.manualItems > 0 ? '#b45309' : '#065f46' }}>
                        {item.manualItems > 0 ? `${item.manualItems} to mark` : item.attemptStatus.replaceAll('_', ' ')}
                      </strong>
                      {item.percentage !== null && <div style={muted}>{item.percentage.toFixed(1)}%</div>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : (
          <>
            <section style={card}>
              <button type="button" onClick={() => setSelected(null)} style={secondaryButton}>← Back to queue</button>
              <h2 style={{ margin: '14px 0 4px' }}>{selected.studentName}</h2>
              <p style={{ margin: 0, color: '#6b7280' }}>{selected.assessmentTitle}</p>
            </section>

            {selected.responses.map(response => {
              const draft = drafts[response.responseId] ?? { score: '', feedback: '' }
              return (
                <section key={response.responseId} style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <strong>Question {response.orderNum}</strong>
                    <span style={{ color: '#6b7280' }}>/{response.maxScore}</span>
                  </div>
                  <p style={{ lineHeight: 1.6 }}>{response.prompt}</p>
                  <div style={answerBox}>{response.responseText || JSON.stringify(response.responseValue)}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 10, marginTop: 12 }}>
                    <input type="number" min={0} max={response.maxScore} step="0.5" value={draft.score} onChange={event => setDrafts(current => ({ ...current, [response.responseId]: { ...draft, score: event.target.value } }))} placeholder="Score" style={input} />
                    <input value={draft.feedback} onChange={event => setDrafts(current => ({ ...current, [response.responseId]: { ...draft, feedback: event.target.value } }))} placeholder="Feedback for learner" style={input} />
                  </div>
                  <button type="button" disabled={busy} onClick={() => void saveResponseMark(response.responseId, response.maxScore)} style={{ ...secondaryButton, marginTop: 10 }}>Save mark</button>
                </section>
              )
            })}

            <section style={card}>
              <label style={label}>Overall feedback</label>
              <textarea value={attemptFeedback} onChange={event => setAttemptFeedback(event.target.value)} rows={4} style={{ ...input, resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button type="button" disabled={busy} onClick={() => void finishAttempt(false)} style={{ ...secondaryButton, flex: 1 }}>Finalize</button>
                <button type="button" disabled={busy} onClick={() => void finishAttempt(true)} style={{ ...primaryButton, flex: 1 }}>{busy ? 'Saving…' : 'Finalize and Release'}</button>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}

const shell: React.CSSProperties = { minHeight: '100vh', background: '#f8fafc', padding: '18px 14px 80px', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#111827' }
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, marginBottom: 12 }
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: '#4338ca', textTransform: 'uppercase', letterSpacing: 1 }
const muted: React.CSSProperties = { fontSize: 12, color: '#6b7280', marginTop: 3 }
const queueButton: React.CSSProperties = { width: '100%', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }
const answerBox: React.CSSProperties = { background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, whiteSpace: 'pre-wrap', lineHeight: 1.5 }
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: 10, padding: '10px 12px', font: 'inherit' }
const label: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }
const primaryButton: React.CSSProperties = { border: 'none', borderRadius: 12, padding: '12px 16px', background: '#4338ca', color: '#fff', fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }
const secondaryButton: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 10, padding: '10px 14px', background: '#fff', color: '#374151', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }
