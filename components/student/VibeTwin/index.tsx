'use client'

import { useState, useEffect } from 'react'
import type { VibeTwinProps, TwinMode } from './types'
import { useTwinSession } from './hooks/useTwinSession'
import { useTwinSpeech } from './hooks/useTwinSpeech'
import { useTwinRecognition } from './hooks/useTwinRecognition'
import TwinHeader from './ui/TwinHeader'
import TwinMessages from './ui/TwinMessages'
import TwinInput from './ui/TwinInput'
import { T } from './ui/TwinHeader'
import {
  answerAdaptivePracticeQuestion,
  askLearnerTwin,
  generateAdaptivePracticeQuestion,
  getLearnerTwinState,
  type AdaptivePracticeQuestion,
  type LearnerTwinChatMessage,
  type LearnerTwinState,
} from '@/lib/student/twin'

export default function VibeTwin({ isOpen, onClose, userName, learnerState }: VibeTwinProps) {
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<TwinMode>('text')
  const [resolvedState, setResolvedState] = useState<LearnerTwinState | null>(learnerState ?? null)
  const [practiceQuestion, setPracticeQuestion] = useState<AdaptivePracticeQuestion | null>(null)
  const [practiceLoading, setPracticeLoading] = useState(false)
  const [practiceFeedback, setPracticeFeedback] = useState<string | null>(null)
  const [hintIndex, setHintIndex] = useState(0)

  const {
    messages, twinState, setTwinState,
    greeted, setGreeted,
    addMessage, acquireProcessing, releaseProcessing,
  } = useTwinSession(isOpen)
  const { speak, cancel: cancelSpeech } = useTwinSpeech()

  useEffect(() => {
    if (!isOpen) {
      setMode('text')
      setInput('')
      setPracticeQuestion(null)
      setPracticeFeedback(null)
      setHintIndex(0)
      cancelSpeech()
    }
  }, [isOpen, cancelSpeech])

  useEffect(() => {
    if (learnerState) setResolvedState(learnerState)
  }, [learnerState])

  useEffect(() => {
    if (!isOpen || learnerState !== undefined || resolvedState) return
    let cancelled = false
    void getLearnerTwinState()
      .then(state => { if (!cancelled) setResolvedState(state) })
      .catch(() => { if (!cancelled) setResolvedState(null) })
    return () => { cancelled = true }
  }, [isOpen, learnerState, resolvedState])

  useEffect(() => {
    if (!isOpen || greeted) return
    if (learnerState === undefined && !resolvedState) return
    setGreeted(true)
    const now = resolvedState?.decision.now
    const weakest = resolvedState?.mastery.outcomes[0]
    const greeting = now
      ? `${userName}, ${now.title} is your best next step.${now.reason ? ` ${now.reason}` : ''}`
      : weakest
        ? `${userName}, you are caught up on assigned work. We can strengthen ${weakest.outcomeText} next.`
        : `${userName}, I am ready to help with your current schoolwork. As verified evidence builds, I will adapt what we do next.`

    addMessage('twin', greeting)
    const timer = setTimeout(() => speak(greeting), 300)
    return () => clearTimeout(timer)
  }, [isOpen, userName, greeted, setGreeted, addMessage, speak, learnerState, resolvedState])

  function finish(response: string, shouldSpeak = false) {
    addMessage('twin', response)
    releaseProcessing()
    if (shouldSpeak || mode === 'audio') {
      setTwinState('speaking')
      speak(response, () => setTwinState('idle'))
    } else {
      setTwinState('idle')
    }
  }

  async function startAdaptivePractice() {
    if (practiceLoading) return
    setPracticeLoading(true)
    setPracticeFeedback(null)
    setHintIndex(0)
    try {
      const weakest = resolvedState?.mastery.outcomes[0]
      const question = await generateAdaptivePracticeQuestion(weakest?.outcomeId ?? null)
      setPracticeQuestion(question)
    } catch (cause) {
      setPracticeFeedback(cause instanceof Error ? cause.message : 'Adaptive practice could not be prepared.')
    } finally {
      setPracticeLoading(false)
    }
  }

  async function submitAdaptiveAnswer(selectedIndex: number) {
    if (!practiceQuestion || practiceLoading) return
    setPracticeLoading(true)
    setPracticeFeedback(null)
    try {
      const result = await answerAdaptivePracticeQuestion({ questionId: practiceQuestion.id, selectedIndex })
      const nextState = await getLearnerTwinState({ force: true })
      setResolvedState(nextState)
      const masteryText = result.effectiveMasteryAfter == null ? '' : ` Effective mastery is now ${Math.round(result.effectiveMasteryAfter)}%.`
      if (result.correct) {
        setPracticeFeedback(`Correct. ${result.explanation}${masteryText}`)
      } else {
        const hint = practiceQuestion.hints[0] ? ` First hint: ${practiceQuestion.hints[0]}` : ''
        setPracticeFeedback(`Not yet. ${result.explanation}${hint}${masteryText}`)
      }
      setPracticeQuestion(result.nextQuestion)
      setHintIndex(0)
    } catch (cause) {
      setPracticeFeedback(cause instanceof Error ? cause.message : 'Your answer could not be recorded.')
    } finally {
      setPracticeLoading(false)
    }
  }

  async function handleQuery(query: string) {
    const q = query.trim()
    if (!q) return
    if (!acquireProcessing()) return

    const history: LearnerTwinChatMessage[] = messages.slice(-8).map(message => ({
      role: message.role === 'user' ? 'user' : 'assistant',
      content: message.text,
    }))

    addMessage('user', q)
    setInput('')
    setTwinState('processing')

    try {
      const response = await askLearnerTwin({
        firstName: userName,
        messages: [...history, { role: 'user', content: q }],
      })
      finish(response, true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Your Twin could not respond.'
      finish(`${message} Your learning state is still safe; try again when the connection is available.`)
    }
  }

  const recognition = useTwinRecognition({
    onTranscript: (text) => handleQuery(text),
    onStateChange: (state) => setTwinState(state),
    onError: (msg) => {
      addMessage('twin', msg)
      releaseProcessing()
      setTwinState('idle')
    },
  })

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Vibe Twin"
      style={{
        position: 'fixed', inset: 0, zIndex: 10000, background: T.bg,
        display: 'flex', flexDirection: 'column',
        animation: 'vl-slide-up 300ms cubic-bezier(0.34,1.56,0.64,1)',
        WebkitUserSelect: 'none', userSelect: 'none',
      }}
    >
      <TwinHeader
        mode={mode}
        onMode={(nextMode: TwinMode) => {
          cancelSpeech()
          recognition.abort()
          setTwinState('idle')
          setMode(nextMode)
        }}
        onClose={() => {
          cancelSpeech()
          recognition.abort()
          onClose()
        }}
      />

      <div style={{ padding: '10px 16px 0', display: 'grid', gap: 8 }}>
        {!practiceQuestion && (
          <button
            onClick={() => void startAdaptivePractice()}
            disabled={practiceLoading}
            style={{ border: `1px solid ${T.accentBdr}`, background: T.accentBg, color: T.text, borderRadius: 12, padding: '10px 12px', fontWeight: 800, cursor: 'pointer' }}
          >
            {practiceLoading ? 'Preparing adaptive practice…' : 'Practice my weakest skill'}
          </button>
        )}

        {practiceQuestion && (
          <section style={{ border: `1px solid ${T.border}`, background: T.card, borderRadius: 14, padding: 12 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: .8, color: T.muted, fontWeight: 800 }}>
              Adaptive practice · {practiceQuestion.difficulty}
            </div>
            <div style={{ marginTop: 5, fontSize: 11, color: T.muted }}>{practiceQuestion.outcomeCode ?? 'Curriculum outcome'} · {practiceQuestion.outcomeText}</div>
            <div style={{ marginTop: 9, fontSize: 13, lineHeight: 1.5, color: T.text, fontWeight: 700 }}>{practiceQuestion.prompt}</div>
            <div style={{ display: 'grid', gap: 7, marginTop: 10 }}>
              {practiceQuestion.options.map((option, index) => (
                <button
                  key={`${practiceQuestion.id}-${index}`}
                  onClick={() => void submitAdaptiveAnswer(index)}
                  disabled={practiceLoading}
                  style={{ textAlign: 'left', border: `1px solid ${T.border}`, background: T.bg, color: T.text, borderRadius: 10, padding: '9px 10px', cursor: 'pointer' }}
                >
                  {String.fromCharCode(65 + index)}. {option}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 9, flexWrap: 'wrap' }}>
              {practiceQuestion.hints.length > 0 && hintIndex < practiceQuestion.hints.length && (
                <button
                  onClick={() => setHintIndex(value => Math.min(practiceQuestion.hints.length, value + 1))}
                  style={{ border: `1px solid ${T.border}`, background: 'transparent', color: T.text, borderRadius: 9, padding: '7px 9px', cursor: 'pointer', fontSize: 11 }}
                >
                  Hint {hintIndex + 1}
                </button>
              )}
              <button
                onClick={() => { setPracticeQuestion(null); setPracticeFeedback(null); setHintIndex(0) }}
                style={{ border: 0, background: 'transparent', color: T.muted, padding: '7px 9px', cursor: 'pointer', fontSize: 11 }}
              >
                End practice
              </button>
            </div>
            {hintIndex > 0 && <div style={{ marginTop: 8, fontSize: 11, color: T.muted, lineHeight: 1.5 }}>{practiceQuestion.hints.slice(0, hintIndex).join(' ')}</div>}
          </section>
        )}

        {practiceFeedback && <div role="status" style={{ fontSize: 11, color: T.muted, lineHeight: 1.5 }}>{practiceFeedback}</div>}
      </div>

      <TwinMessages messages={messages} twinState={twinState} />

      <TwinInput
        mode={mode}
        twinState={twinState}
        input={input}
        onInput={setInput}
        onSubmit={handleQuery}
        onStartListen={recognition.start}
        onStopListen={recognition.stop}
        onCancelListen={recognition.cancel}
        onStopSpeak={() => {
          cancelSpeech()
          setTwinState('idle')
        }}
      />

      <style>{`
        @keyframes vl-slide-up {
          from { transform: translateY(100vh); }
          to   { transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
