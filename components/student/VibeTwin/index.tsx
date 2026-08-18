'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { VibeTwinProps, TwinMode } from './types'
import { useTwinSession } from './hooks/useTwinSession'
import { useTwinSpeech } from './hooks/useTwinSpeech'
import { useTwinRecognition } from './hooks/useTwinRecognition'
import TwinHeader from './ui/TwinHeader'
import TwinInput from './ui/TwinInput'
import TwinLearningCanvas from './ui/TwinLearningCanvas'
import { T } from './ui/TwinHeader'
import { routeTwinCore, type TwinCoreRouteResult } from '@/lib/student/twinCore'
import {
  answerAdaptivePracticeQuestion,
  generateAdaptivePracticeQuestion,
  getAdaptiveTeachingTurn,
  getLearnerTwinState,
  type AdaptivePracticeQuestion,
  type AdaptiveTeachingTurn,
  type LearnerTwinState,
} from '@/lib/student/twin'

const DETERMINISTIC_HELP = 'I work from your VibeSchool records and rules without generative AI. Try: “What should I do now?”, “What is my timetable?”, “Do I have homework?”, “What should I revise?”, “What is my weakest skill?”, “What do you remember about me?”, “Search …”, or “Save privately …”.'

export default function VibeTwin({ isOpen, onClose, userName, learnerState }: VibeTwinProps) {
  const router = useRouter()
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<TwinMode>('text')
  const [resolvedState, setResolvedState] = useState<LearnerTwinState | null>(learnerState ?? null)
  const [practiceQuestion, setPracticeQuestion] = useState<AdaptivePracticeQuestion | null>(null)
  const [practiceLoading, setPracticeLoading] = useState(false)
  const [practiceFeedback, setPracticeFeedback] = useState<string | null>(null)
  const [sessionSummary, setSessionSummary] = useState<string | null>(null)
  const [coreResult, setCoreResult] = useState<TwinCoreRouteResult | null>(null)
  const [hintIndex, setHintIndex] = useState(0)
  const [coachTurn, setCoachTurn] = useState<AdaptiveTeachingTurn | null>(null)
  const [coachStage, setCoachStage] = useState(0)

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
      setSessionSummary(null)
      setCoreResult(null)
      setHintIndex(0)
      setCoachTurn(null)
      setCoachStage(0)
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
      ? `${userName}, ${now.title} matters most right now.${now.reason ? ` ${now.reason}` : ''}`
      : weakest
        ? `${userName}, you are caught up on assigned work. We can strengthen ${weakest.outcomeText} next.`
        : `${userName}, I am ready to learn with you. You can start a guided practice session or ask, search, plan or save something.`

    addMessage('twin', greeting)
    const timer = setTimeout(() => speak(greeting), 250)
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
    setSessionSummary(null)
    setCoreResult(null)
    setHintIndex(0)
    setCoachTurn(null)
    setCoachStage(0)
    try {
      const weakest = resolvedState?.mastery.outcomes[0]
      const question = await generateAdaptivePracticeQuestion(weakest?.outcomeId ?? null)
      setPracticeQuestion(question)
      addMessage('twin', `Let’s work on ${question.outcomeText}. I’ll adapt the next step from how you respond.`)
    } catch (cause) {
      setPracticeFeedback(cause instanceof Error ? cause.message : 'Adaptive practice could not be prepared.')
    } finally {
      setPracticeLoading(false)
    }
  }

  async function requestCoaching() {
    if (!practiceQuestion || practiceLoading) return
    setPracticeLoading(true)
    try {
      const latestLearnerReply = [...messages].reverse().find(message => message.role === 'user')?.text ?? null
      const turn = await getAdaptiveTeachingTurn(practiceQuestion.outcomeId, coachStage, latestLearnerReply)
      setCoachTurn(turn)
      setCoachStage(turn.nextStage)
    } catch (cause) {
      setPracticeFeedback(cause instanceof Error ? cause.message : 'Adaptive coaching could not be prepared.')
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
      setPracticeFeedback(result.correct ? `Correct. ${result.explanation}${masteryText}` : `Not yet. ${result.explanation}${masteryText}`)
      setPracticeQuestion(result.nextQuestion)
      setHintIndex(0)
      setCoachTurn(null)
      setCoachStage(0)
      if (!result.nextQuestion) {
        const summary = result.correct
          ? 'You completed this practice set. Twin will use the recorded evidence to decide whether to revisit, advance, or leave the skill alone.'
          : 'This practice set is complete. Twin will keep the recorded difficulty signal and can revisit it with a different teaching approach.'
        setSessionSummary(summary)
        addMessage('twin', summary)
      }
    } catch (cause) {
      setPracticeFeedback(cause instanceof Error ? cause.message : 'Your answer could not be recorded.')
    } finally {
      setPracticeLoading(false)
    }
  }

  async function handleQuery(query: string) {
    const q = query.trim()
    if (!q || !acquireProcessing()) return

    addMessage('user', q)
    setInput('')
    setTwinState('processing')

    try {
      const core = await routeTwinCore(q)
      setCoreResult(core.handled ? core : null)
      if (core.handled) {
        finish(core.reply || 'Done.', false)
        return
      }

      if (practiceQuestion) {
        const turn = await getAdaptiveTeachingTurn(practiceQuestion.outcomeId, coachStage, q)
        setCoachTurn(turn)
        setCoachStage(turn.nextStage)
        finish(turn.prompt, false)
        return
      }

      finish(DETERMINISTIC_HELP, false)
    } catch {
      finish('Twin is still available without AI for your tasks, timetable, revision, memory, search, saved learning space and guided practice. Try one of those actions again.', false)
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

  return <div role="dialog" aria-modal="true" aria-label="Vibe Twin learning workspace" style={{ position: 'fixed', inset: 0, zIndex: 10000, background: T.bg, display: 'flex', flexDirection: 'column', animation: 'vl-slide-up 300ms cubic-bezier(0.34,1.56,0.64,1)', WebkitUserSelect: 'none', userSelect: 'none' }}>
    <TwinHeader mode={mode} onMode={(nextMode: TwinMode) => { cancelSpeech(); recognition.abort(); setTwinState('idle'); setMode(nextMode) }} onClose={() => { cancelSpeech(); recognition.abort(); onClose() }} />

    <TwinLearningCanvas
      userName={userName}
      learnerState={resolvedState}
      practiceQuestion={practiceQuestion}
      coachTurn={coachTurn}
      practiceFeedback={practiceFeedback}
      practiceLoading={practiceLoading}
      hintIndex={hintIndex}
      sessionSummary={sessionSummary}
      coreResult={coreResult}
      messages={messages}
      twinState={twinState}
      onStartPractice={() => void startAdaptivePractice()}
      onContinueTask={(url) => { onClose(); router.push(url) }}
      onAnswer={(index) => void submitAdaptiveAnswer(index)}
      onCoach={() => void requestCoaching()}
      onHint={() => setHintIndex(value => practiceQuestion ? Math.min(practiceQuestion.hints.length, value + 1) : value)}
      onExplainAnotherWay={() => void handleQuery(practiceQuestion ? `Help me understand ${practiceQuestion.outcomeText} another way without giving away the answer.` : 'What should I learn next?')}
      onEasier={() => void handleQuery(practiceQuestion ? `I need a smaller step for ${practiceQuestion.outcomeText}.` : 'What should I do now?')}
      onHarder={() => void handleQuery(practiceQuestion ? `Give me the next challenge for ${practiceQuestion.outcomeText}.` : 'What should I do now?')}
      onEndPractice={() => {
        const focus = practiceQuestion?.outcomeText ?? 'this learning focus'
        const summary = `We paused ${focus}. I’ll keep only the learning evidence already recorded. You can resume later without starting from zero.`
        setSessionSummary(summary)
        setPracticeQuestion(null)
        setPracticeFeedback(null)
        setHintIndex(0)
        setCoachTurn(null)
        setCoachStage(0)
        addMessage('twin', summary)
      }}
      onResumeCompanion={() => { onClose(); router.push('/student/twin/companion') }}
    />

    <TwinInput mode={mode} twinState={twinState} input={input} onInput={setInput} onSubmit={handleQuery} onStartListen={recognition.start} onStopListen={recognition.stop} onCancelListen={recognition.cancel} onStopSpeak={() => { cancelSpeech(); setTwinState('idle') }} />
    <style>{`@keyframes vl-slide-up { from { transform: translateY(100vh); } to { transform: translateY(0); } }`}</style>
  </div>
}