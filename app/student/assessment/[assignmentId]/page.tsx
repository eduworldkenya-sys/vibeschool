'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  claimAttemptClient,
  releaseAttemptClient,
  saveResponseWithRevision,
  startOrResumeAttempt,
  submitAttempt,
} from '@/lib/assessment'
import type {
  AttemptWorkspace,
  LearnerAssessmentItem,
  SubmitAttemptResult,
} from '@/lib/assessment'
import type { Json } from '@/lib/database.types'

type Answer = {
  text: string
  value: unknown
  revision: number
  saving: boolean
  saved: boolean
  dirty: boolean
  clientUpdatedAt: string
}

type AnswerState = Record<string, Answer>
type LocalDraft = {
  attemptId: string
  answers: Record<string, Pick<Answer, 'text' | 'value' | 'revision' | 'clientUpdatedAt'>>
  currentIndex: number
  savedAt: string
}
type ConflictState = {
  itemId: string
  serverRevision: number
  serverText: string
  serverValue: Json
  localAnswer: Answer
}

function remainingSeconds(expiresAt: string | null): number | null {
  if (!expiresAt) return null
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000))
}
function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}
function hasAnswer(answer: Answer | undefined): boolean {
  if (!answer) return false
  if (typeof answer.value === 'string') return answer.value.trim().length > 0
  if (answer.value !== null && answer.value !== undefined) return true
  return answer.text.trim().length > 0
}
function draftKey(attemptId: string): string {
  return `vibeschool:assessment-draft:${attemptId}`
}
function clientId(): string {
  const key = 'vibeschool:assessment-client-id'
  const existing = sessionStorage.getItem(key)
  if (existing) return existing
  const created = crypto.randomUUID()
  sessionStorage.setItem(key, created)
  return created
}

export default function LearnerAssessmentPage() {
  const params = useParams<{ assignmentId: string }>()
  const router = useRouter()
  const assignmentId = params.assignmentId

  const [workspace, setWorkspace] = useState<AttemptWorkspace | null>(null)
  const [answers, setAnswers] = useState<AnswerState>({})
  const answersRef = useRef<AnswerState>({})
  const clientIdRef = useRef('')
  const saveTimers = useRef<Record<string, number>>({})

  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<SubmitAttemptResult | null>(null)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [showReview, setShowReview] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [recoveredDraft, setRecoveredDraft] = useState(false)
  const [activeElsewhere, setActiveElsewhere] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [conflict, setConflict] = useState<ConflictState | null>(null)

  useEffect(() => {
    answersRef.current = answers
  }, [answers])

  const claim = useCallback(async (attemptId: string, force = false) => {
    if (!clientIdRef.current) clientIdRef.current = clientId()
    setClaiming(true)
    try {
      const claimed = await claimAttemptClient({
        attemptId,
        clientId: clientIdRef.current,
        force,
      })
      setActiveElsewhere(claimed.activeElsewhere)
      return claimed.ok
    } finally {
      setClaiming(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      try {
        const loaded = await startOrResumeAttempt(assignmentId)
        if (cancelled) return

        clientIdRef.current = clientId()
        const owned = await claim(loaded.attemptId)
        if (cancelled) return

        setWorkspace(loaded)
        setSecondsLeft(remainingSeconds(loaded.expiresAt))
        setActiveElsewhere(!owned)

        const serverMap = new Map(
          loaded.responses.map(response => [response.assessmentItemId, response]),
        )

        let localDraft: LocalDraft | null = null
        try {
          const raw = localStorage.getItem(draftKey(loaded.attemptId))
          if (raw) localDraft = JSON.parse(raw) as LocalDraft
        } catch {
          localStorage.removeItem(draftKey(loaded.attemptId))
        }

        const initial = Object.fromEntries(
          loaded.items.map(item => {
            const server = serverMap.get(item.id)
            const local = localDraft?.attemptId === loaded.attemptId
              ? localDraft.answers[item.id]
              : undefined
            const serverSavedAt = server ? Date.parse(server.lastSavedAt) : 0
            const localSavedAt = local ? Date.parse(local.clientUpdatedAt) : 0
            const useLocal = Boolean(local && localSavedAt > serverSavedAt)

            return [item.id, {
              text: useLocal ? local?.text ?? '' : server?.responseText ?? '',
              value: useLocal ? local?.value ?? null : server?.responseValue ?? null,
              revision: server?.revision ?? 0,
              saving: false,
              saved: Boolean(server) && !useLocal,
              dirty: useLocal,
              clientUpdatedAt: useLocal
                ? local?.clientUpdatedAt ?? new Date().toISOString()
                : server?.clientUpdatedAt ?? server?.lastSavedAt ?? new Date().toISOString(),
            } satisfies Answer]
          }),
        )

        setAnswers(initial)
        answersRef.current = initial

        if (localDraft?.attemptId === loaded.attemptId) {
          setCurrentIndex(
            Math.min(
              Math.max(localDraft.currentIndex, 0),
              Math.max(loaded.items.length - 1, 0),
            ),
          )
          setRecoveredDraft(Object.values(initial).some(answer => answer.dirty))
        }
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
      Object.values(saveTimers.current).forEach(window.clearTimeout)
    }
  }, [assignmentId, claim])

  useEffect(() => {
    if (!workspace || activeElsewhere || result) return

    const heartbeat = window.setInterval(() => {
      void claim(workspace.attemptId).catch(() => setActiveElsewhere(true))
    }, 30000)

    return () => window.clearInterval(heartbeat)
  }, [workspace, activeElsewhere, result, claim])

  useEffect(() => {
    if (!workspace || result) return

    const serializable = Object.fromEntries(
      Object.entries(answers).map(([id, answer]) => [id, {
        text: answer.text,
        value: answer.value,
        revision: answer.revision,
        clientUpdatedAt: answer.clientUpdatedAt,
      }]),
    )

    const draft: LocalDraft = {
      attemptId: workspace.attemptId,
      answers: serializable,
      currentIndex,
      savedAt: new Date().toISOString(),
    }

    localStorage.setItem(draftKey(workspace.attemptId), JSON.stringify(draft))
  }, [workspace, answers, currentIndex, result])

  useEffect(() => {
    if (!workspace || !clientIdRef.current) return

    const release = () => {
      void releaseAttemptClient(workspace.attemptId, clientIdRef.current)
    }

    window.addEventListener('pagehide', release)
    return () => {
      window.removeEventListener('pagehide', release)
      release()
    }
  }, [workspace])

  const dirtyCount = useMemo(
    () => Object.values(answers).filter(answer => answer.dirty || answer.saving).length,
    [answers],
  )

  useEffect(() => {
    if (dirtyCount === 0 || result) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirtyCount, result])

  const persistAnswer = useCallback(async (
    item: LearnerAssessmentItem,
    snapshot?: Answer,
  ) => {
    if (!workspace || secondsLeft === 0 || activeElsewhere) return
    const current = snapshot ?? answersRef.current[item.id]
    if (!current || current.saving) return

    setAnswers(state => ({
      ...state,
      [item.id]: { ...state[item.id], saving: true },
    }))

    try {
      const saved = await saveResponseWithRevision({
        attemptId: workspace.attemptId,
        assessmentItemId: item.id,
        clientId: clientIdRef.current,
        expectedRevision: current.revision,
        responseValue: current.value === undefined ? null : current.value,
        responseText: current.text || null,
        clientUpdatedAt: current.clientUpdatedAt,
      })

      if (saved.conflict) {
        setConflict({
          itemId: item.id,
          serverRevision: saved.revision,
          serverText: saved.responseText ?? '',
          serverValue: saved.responseValue,
          localAnswer: current,
        })
        setAnswers(state => ({
          ...state,
          [item.id]: { ...state[item.id], saving: false, dirty: true },
        }))
        return
      }

      setAnswers(state => ({
        ...state,
        [item.id]: {
          ...state[item.id],
          revision: saved.revision,
          saving: false,
          saved: true,
          dirty: false,
        },
      }))
    } catch (saveError) {
      console.error('[LearnerAssessment] save response', saveError)
      const message = saveError instanceof Error ? saveError.message : ''
      if (message.includes('attempt_client_lease_required')) {
        setActiveElsewhere(true)
      }
      setAnswers(state => ({
        ...state,
        [item.id]: {
          ...state[item.id],
          saving: false,
          saved: false,
          dirty: true,
        },
      }))
      setError(message || 'Answer could not be saved.')
    }
  }, [workspace, secondsLeft, activeElsewhere])

  function scheduleSave(
    item: LearnerAssessmentItem,
    next: Answer,
    immediate = false,
  ) {
    const existing = saveTimers.current[item.id]
    if (existing) window.clearTimeout(existing)

    if (immediate) {
      void persistAnswer(item, next)
      return
    }

    saveTimers.current[item.id] = window.setTimeout(
      () => void persistAnswer(item, answersRef.current[item.id]),
      700,
    )
  }

  function updateText(item: LearnerAssessmentItem, text: string) {
    if (activeElsewhere) return
    const next: Answer = {
      ...(answersRef.current[item.id] ?? {
        value: null,
        revision: 0,
        saving: false,
        saved: false,
        dirty: false,
      }),
      text,
      saved: false,
      dirty: true,
      clientUpdatedAt: new Date().toISOString(),
    }
    const state = { ...answersRef.current, [item.id]: next }
    answersRef.current = state
    setAnswers(state)
    scheduleSave(item, next)
  }

  function updateValue(
    item: LearnerAssessmentItem,
    value: unknown,
    text = '',
  ) {
    if (activeElsewhere) return
    const next: Answer = {
      ...(answersRef.current[item.id] ?? {
        revision: 0,
        saving: false,
        saved: false,
        dirty: false,
      }),
      value,
      text,
      saved: false,
      dirty: true,
      clientUpdatedAt: new Date().toISOString(),
    }
    const state = { ...answersRef.current, [item.id]: next }
    answersRef.current = state
    setAnswers(state)
    scheduleSave(item, next, true)
  }

  async function takeOver() {
    if (!workspace) return
    setError('')
    try {
      const owned = await claim(workspace.attemptId, true)
      setActiveElsewhere(!owned)
      if (owned) {
        for (const item of workspace.items) {
          const answer = answersRef.current[item.id]
          if (answer?.dirty) await persistAnswer(item, answer)
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Attempt takeover failed.')
    }
  }

  function keepServerConflict() {
    if (!conflict) return
    setAnswers(state => ({
      ...state,
      [conflict.itemId]: {
        text: conflict.serverText,
        value: conflict.serverValue,
        revision: conflict.serverRevision,
        saving: false,
        saved: true,
        dirty: false,
        clientUpdatedAt: new Date().toISOString(),
      },
    }))
    setConflict(null)
  }

  async function keepLocalConflict() {
    if (!conflict || !workspace) return
    const next: Answer = {
      ...conflict.localAnswer,
      revision: conflict.serverRevision,
      dirty: true,
      saving: false,
    }
    setAnswers(state => ({ ...state, [conflict.itemId]: next }))
    answersRef.current = { ...answersRef.current, [conflict.itemId]: next }
    setConflict(null)

    const item = workspace.items.find(candidate => candidate.id === conflict.itemId)
    if (item) await persistAnswer(item, next)
  }

  const submit = useCallback(async (expired = false) => {
    if (!workspace || submitting || result || activeElsewhere) return
    setSubmitting(true)
    setError('')

    try {
      if (!expired) {
        Object.values(saveTimers.current).forEach(window.clearTimeout)
        for (const item of workspace.items) {
          const answer = answersRef.current[item.id]
          if (answer && (answer.dirty || !answer.saved)) {
            await persistAnswer(item, answer)
          }
        }
      }

      const submitted = await submitAttempt(workspace.attemptId)
      await releaseAttemptClient(workspace.attemptId, clientIdRef.current)
      localStorage.removeItem(draftKey(workspace.attemptId))
      setShowConfirm(false)
      setShowReview(false)
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
  }, [workspace, submitting, result, activeElsewhere, persistAnswer])

  useEffect(() => {
    if (!workspace?.expiresAt || result || submitting) return
    const timer = window.setInterval(() => {
      const next = remainingSeconds(workspace.expiresAt)
      setSecondsLeft(next)
      if (next === 0) {
        window.clearInterval(timer)
        void submit(true)
      }
    }, 1000)
    return () => window.clearInterval(timer)
  }, [workspace?.expiresAt, result, submitting, submit])

  const answeredCount = useMemo(
    () => Object.values(answers).filter(hasAnswer).length,
    [answers],
  )
  const unansweredIndexes = useMemo(
    () => workspace
      ? workspace.items
          .map((item, index) => hasAnswer(answers[item.id]) ? -1 : index)
          .filter(index => index >= 0)
      : [],
    [workspace, answers],
  )

  if (loading) return <main style={shell}>Loading assessment…</main>
  if (error && !workspace) {
    return <main style={shell}><section style={card}>
      <h1 style={{ marginTop: 0 }}>Assessment unavailable</h1>
      <p style={{ color: '#b91c1c' }}>{error}</p>
      <button onClick={() => router.back()} style={secondaryButton}>Go back</button>
    </section></main>
  }
  if (!workspace) return null

  if (result) {
    return <main style={shell}><section style={{ ...card, maxWidth: 620, margin: '0 auto', borderColor: '#6ee7b7' }}>
      <h1 style={{ marginTop: 0, color: '#065f46' }}>Assessment submitted ✓</h1>
      {result.scoreReleased && result.score !== null && result.maxScore !== null && result.percentage !== null
        ? <><p style={{ fontSize: 30, fontWeight: 800, margin: '12px 0' }}>{result.score}/{result.maxScore}</p><p>{result.percentage.toFixed(1)}%</p></>
        : <p style={{ lineHeight: 1.6 }}>Your answers were submitted. Your score will appear when your teacher releases it.</p>}
      <p style={{ color: '#6b7280', lineHeight: 1.5 }}>
        {result.submittedDueToExpiry ? 'Time ended and the attempt was submitted automatically. ' : ''}
        {result.manualItems > 0
          ? `${result.manualItems} written response${result.manualItems === 1 ? '' : 's'} will be reviewed by your teacher.`
          : 'All questions were processed.'}
      </p>
      <button onClick={() => router.push('/student/assessment')} style={primaryButton}>Done</button>
    </section></main>
  }

  const locked = secondsLeft === 0 || submitting || activeElsewhere
  const item = workspace.items[currentIndex]
  const answer = item ? answers[item.id] : undefined

  return <main style={shell}>
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <section style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div style={eyebrow}>{workspace.assessmentType.replaceAll('_', ' ')}</div>
          {secondsLeft !== null && <div style={{ fontWeight: 900, color: secondsLeft <= 60 ? '#b91c1c' : '#4338ca' }}>⏱ {formatTime(secondsLeft)}</div>}
        </div>
        <h1 style={{ margin: '6px 0' }}>{workspace.title}</h1>
        {workspace.instructions && <p style={{ margin: 0, color: '#6b7280', lineHeight: 1.5 }}>{workspace.instructions}</p>}
        <div style={{ marginTop: 12, fontSize: 12, fontWeight: 700 }}>{answeredCount}/{workspace.items.length} answered · Attempt {workspace.attemptNumber}</div>
        {recoveredDraft && <div style={notice}>Recovered newer work saved on this device.</div>}
      </section>

      {activeElsewhere && <section style={{ ...card, borderColor: '#f59e0b', background: '#fffbeb' }}>
        <strong style={{ color: '#92400e' }}>This attempt is active on another tab or device.</strong>
        <p style={{ color: '#78350f', lineHeight: 1.5 }}>Editing is paused to prevent answers from being overwritten. Taking over will make this device authoritative.</p>
        <button type="button" disabled={claiming} onClick={() => void takeOver()} style={primaryButton}>
          {claiming ? 'Taking over…' : 'Take over this attempt'}
        </button>
      </section>}

      <section style={{ ...card, paddingBottom: 10 }}>
        <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 6 }}>
          {workspace.items.map((question, index) => {
            const complete = hasAnswer(answers[question.id])
            return <button
              key={question.id}
              type="button"
              onClick={() => setCurrentIndex(index)}
              style={{
                ...questionButton,
                borderColor: index === currentIndex ? '#4338ca' : complete ? '#6ee7b7' : '#d1d5db',
                background: index === currentIndex ? '#eef2ff' : complete ? '#ecfdf5' : '#fff',
              }}
            >{index + 1}</button>
          })}
        </div>
      </section>

      {item && <section style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <strong>Question {currentIndex + 1} of {workspace.items.length}</strong>
          <span style={{ color: '#6b7280', fontSize: 12 }}>{item.marks} mark{item.marks === 1 ? '' : 's'}</span>
        </div>
        <p style={{ lineHeight: 1.6 }}>{item.prompt}</p>
        {item.questionType === 'true_false'
          ? <div style={{ display: 'flex', gap: 10 }}>{['true', 'false'].map(option => <button key={option} type="button" disabled={locked} onClick={() => updateValue(item, null, option)} style={{ ...secondaryButton, flex: 1, background: answer?.text === option ? '#eef2ff' : '#fff', borderColor: answer?.text === option ? '#4338ca' : '#d1d5db' }}>{option === 'true' ? 'True' : 'False'}</button>)}</div>
          : item.questionType === 'multiple_choice' && Array.isArray(item.options)
            ? <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{item.options.map((option, optionIndex) => <button key={optionIndex} type="button" disabled={locked} onClick={() => updateValue(item, option)} style={{ ...secondaryButton, textAlign: 'left', background: JSON.stringify(answer?.value) === JSON.stringify(option) ? '#eef2ff' : '#fff', borderColor: JSON.stringify(answer?.value) === JSON.stringify(option) ? '#4338ca' : '#d1d5db' }}>{String(option)}</button>)}</div>
            : <textarea disabled={locked} value={answer?.text ?? ''} onChange={event => updateText(item, event.target.value)} onBlur={() => void persistAnswer(item)} rows={item.questionType === 'structured' ? 5 : 3} placeholder="Type your answer" style={input} />}
        <div style={{ marginTop: 8, fontSize: 11, color: answer?.dirty ? '#b45309' : '#6b7280' }}>
          {answer?.saving ? 'Saving…' : answer?.dirty ? 'Saved on this device — syncing…' : answer?.saved ? `Saved ✓ · revision ${answer.revision}` : 'Not answered'}
        </div>
      </section>}

      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <button type="button" disabled={currentIndex === 0} onClick={() => setCurrentIndex(index => Math.max(0, index - 1))} style={{ ...secondaryButton, flex: 1, opacity: currentIndex === 0 ? 0.5 : 1 }}>Previous</button>
        {currentIndex < workspace.items.length - 1
          ? <button type="button" onClick={() => setCurrentIndex(index => Math.min(workspace.items.length - 1, index + 1))} style={{ ...primaryButton, flex: 1 }}>Next</button>
          : <button type="button" disabled={activeElsewhere} onClick={() => setShowReview(true)} style={{ ...primaryButton, flex: 1, opacity: activeElsewhere ? 0.5 : 1 }}>Review answers</button>}
      </div>

      {error && <div style={{ ...card, color: '#b91c1c', borderColor: '#fecaca' }}>{error}</div>}
    </div>

    {showReview && <div style={overlay}><section style={modal}>
      <h2 style={{ marginTop: 0 }}>Review your answers</h2>
      <p>{answeredCount} of {workspace.items.length} questions answered.</p>
      {unansweredIndexes.length > 0
        ? <><p style={{ color: '#b45309', fontWeight: 700 }}>Unanswered: {unansweredIndexes.map(index => index + 1).join(', ')}</p><div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{unansweredIndexes.map(index => <button key={index} onClick={() => { setCurrentIndex(index); setShowReview(false) }} style={questionButton}>Go to {index + 1}</button>)}</div></>
        : <p style={{ color: '#065f46', fontWeight: 700 }}>Every question has an answer.</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}><button onClick={() => setShowReview(false)} style={{ ...secondaryButton, flex: 1 }}>Continue checking</button><button onClick={() => { setShowReview(false); setShowConfirm(true) }} style={{ ...primaryButton, flex: 1 }}>Submit</button></div>
    </section></div>}

    {showConfirm && <div style={overlay}><section style={modal}>
      <h2 style={{ marginTop: 0 }}>Submit assessment?</h2>
      <p style={{ lineHeight: 1.6 }}>After submission, this attempt will be locked and answers cannot be changed.</p>
      {unansweredIndexes.length > 0 && <p style={{ color: '#b45309', fontWeight: 700 }}>{unansweredIndexes.length} question{unansweredIndexes.length === 1 ? '' : 's'} still unanswered.</p>}
      <div style={{ display: 'flex', gap: 10 }}><button disabled={submitting} onClick={() => setShowConfirm(false)} style={{ ...secondaryButton, flex: 1 }}>Cancel</button><button disabled={submitting} onClick={() => void submit(false)} style={{ ...primaryButton, flex: 1, opacity: submitting ? 0.6 : 1 }}>{submitting ? 'Submitting…' : 'Submit now'}</button></div>
    </section></div>}

    {conflict && <div style={overlay}><section style={modal}>
      <h2 style={{ marginTop: 0 }}>Answer changed elsewhere</h2>
      <p style={{ lineHeight: 1.6 }}>A newer server revision exists for this question. Choose which answer to keep.</p>
      <div style={compareBox}><strong>Server answer</strong><p>{conflict.serverText || JSON.stringify(conflict.serverValue)}</p></div>
      <div style={compareBox}><strong>This device</strong><p>{conflict.localAnswer.text || JSON.stringify(conflict.localAnswer.value)}</p></div>
      <div style={{ display: 'flex', gap: 10 }}><button onClick={keepServerConflict} style={{ ...secondaryButton, flex: 1 }}>Keep server</button><button onClick={() => void keepLocalConflict()} style={{ ...primaryButton, flex: 1 }}>Keep this device</button></div>
    </section></div>}
  </main>
}

const shell: React.CSSProperties = { minHeight: '100vh', background: '#f8fafc', padding: '18px 14px 80px', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#111827' }
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: '#4338ca', textTransform: 'uppercase', letterSpacing: 1 }
const notice: React.CSSProperties = { marginTop: 12, padding: '9px 11px', borderRadius: 10, background: '#fffbeb', color: '#92400e', fontSize: 12, fontWeight: 700 }
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: 10, padding: '11px 12px', font: 'inherit', resize: 'vertical' }
const primaryButton: React.CSSProperties = { border: 'none', borderRadius: 12, padding: '13px 16px', background: '#4338ca', color: '#fff', fontWeight: 800, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }
const secondaryButton: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 10, padding: '10px 14px', background: '#fff', color: '#374151', fontWeight: 700, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' }
const questionButton: React.CSSProperties = { minWidth: 38, height: 38, border: '1px solid #d1d5db', borderRadius: 10, background: '#fff', fontWeight: 800, cursor: 'pointer' }
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'grid', placeItems: 'center', padding: 18, zIndex: 100 }
const modal: React.CSSProperties = { width: '100%', maxWidth: 520, maxHeight: '85vh', overflowY: 'auto', background: '#fff', borderRadius: 18, padding: 20, boxShadow: '0 20px 50px rgba(15,23,42,0.25)' }
const compareBox: React.CSSProperties = { border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, marginBottom: 10, background: '#f8fafc', overflowWrap: 'anywhere' }
