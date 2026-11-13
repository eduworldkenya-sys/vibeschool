'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, CircleAlert, SkipForward, Volume2, VolumeX } from 'lucide-react'
import './learning-feedback.css'

/** One sound preference and one audio engine for all VibeSchool Learn and student feedback. */
export type LearningFeedbackStatus = 'correct' | 'incorrect' | 'skipped'
export type LearningFeedbackKind = 'select' | 'correct' | 'retry' | 'skip' | 'saved' | 'submitted' | 'complete' | 'error'
type Context = { play: (kind: LearningFeedbackKind, message?: string) => void; soundEnabled: boolean; toggleSound: () => void }
const SOUND_KEY = 'vibeschool:learning-feedback:sound:v1'
const FeedbackContext = createContext<Context>({ play: () => undefined, soundEnabled: false, toggleSound: () => undefined })
let audioContext: AudioContext | null = null

function readPreference(): boolean {
  try { return typeof window !== 'undefined' && window.localStorage.getItem(SOUND_KEY) === 'on' }
  catch { return false }
}

const tones: Record<LearningFeedbackKind, readonly [number, number, number][]> = {
  select: [[480, 0, .06]],
  correct: [[620, 0, .085], [790, .1, .095]],
  retry: [[345, 0, .1]],
  skip: [[430, 0, .07]],
  saved: [[560, 0, .08]],
  submitted: [[520, 0, .09], [690, .12, .12]],
  complete: [[520, 0, .08], [690, .1, .09], [880, .22, .16]],
  error: [[345, 0, .13]],
}

/** Original gentle non-musical tones; never autoplay or interrupt speech. */
function renderTone(context: AudioContext, kind: LearningFeedbackKind) {
  const start = context.currentTime
  for (const [frequency, delay, duration] of tones[kind]) {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(frequency, start + delay)
    gain.gain.setValueAtTime(.0001, start + delay)
    gain.gain.exponentialRampToValueAtTime(kind === 'select' ? .012 : .026, start + delay + .015)
    gain.gain.exponentialRampToValueAtTime(.0001, start + delay + duration)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(start + delay)
    oscillator.stop(start + delay + duration + .015)
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
  }
}

/** A blocked/suspended first sound is retried only after the user-gesture audio unlock. */
function playTone(kind: LearningFeedbackKind) {
  if (!readPreference() || typeof window === 'undefined') return
  if ('speechSynthesis' in window && window.speechSynthesis.speaking) return
  try {
    const context = audioContext ?? new window.AudioContext()
    audioContext = context
    if (context.state !== 'running') {
      void context.resume().then(() => {
        if (context.state === 'running' && readPreference() &&
          !('speechSynthesis' in window && window.speechSynthesis.speaking)) {
          renderTone(context, kind)
        }
      }).catch(() => undefined)
      return
    }
    renderTone(context, kind)
  } catch { /* Sounds must never prevent learning or grading. */ }
}

/** Legacy topic practice API: keep the single common audio engine. */
export function playLearningSound(status: LearningFeedbackStatus): void {
  playTone(status === 'correct' ? 'correct' : status === 'incorrect' ? 'retry' : 'skip')
}

export function LearningFeedbackProvider({ children }: { children: ReactNode }) {
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [notice, setNotice] = useState<{ id: number; kind: LearningFeedbackKind; message: string } | null>(null)
  const serial = useRef(0)

  useEffect(() => {
    setSoundEnabled(readPreference())
    const handleStorage = (event: StorageEvent) => {
      if (event.key === SOUND_KEY) setSoundEnabled(readPreference())
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  // Audio is unlocked only after a genuine user interaction.
  useEffect(() => {
    if (!soundEnabled) return
    const unlock = () => {
      try {
        const context = audioContext ?? new window.AudioContext()
        audioContext = context
        if (context.state === 'suspended') void context.resume().catch(() => undefined)
      } catch { /* Browser denied audio. */ }
    }
    document.addEventListener('pointerdown', unlock, { capture: true, once: true })
    document.addEventListener('keydown', unlock, { capture: true, once: true })
    return () => {
      document.removeEventListener('pointerdown', unlock, true)
      document.removeEventListener('keydown', unlock, true)
    }
  }, [soundEnabled])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(value => value?.id === notice.id ? null : value), 2500)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const play = useCallback((kind: LearningFeedbackKind, message?: string) => {
    playTone(kind)
    if (message) setNotice({ id: ++serial.current, kind, message })
  }, [])

  const toggleSound = useCallback(() => {
    const next = !readPreference()
    setSoundEnabled(next)
    try { window.localStorage.setItem(SOUND_KEY, next ? 'on' : 'off') } catch { /* no storage */ }
  }, [])

  return <FeedbackContext.Provider value={{ play, soundEnabled, toggleSound }}>
    {children}
    {notice && <div key={notice.id} className="learning-feedback__notice" data-kind={notice.kind}
      role={notice.kind === 'error' ? 'alert' : 'status'}
      aria-live={notice.kind === 'error' ? 'assertive' : 'polite'}>{notice.message}</div>}
  </FeedbackContext.Provider>
}

export function useLearningFeedback(): Context {
  return useContext(FeedbackContext)
}

export function FeedbackSoundToggle() {
  const { soundEnabled, toggleSound } = useLearningFeedback()
  return <button type="button" className="learning-feedback__sound learning-feedback__global-sound"
    aria-label={soundEnabled ? 'Mute learning sounds' : 'Enable learning sounds'}
    aria-pressed={soundEnabled} onClick={toggleSound} title={soundEnabled ? 'Learning sounds on' : 'Learning sounds off'}>
    {soundEnabled ? <Volume2 size={19} aria-hidden="true" /> : <VolumeX size={19} aria-hidden="true" />}
  </button>
}

export default function LearningFeedback({
  status, answer, explanation, children,
}: { status: LearningFeedbackStatus; answer?: string | null; explanation?: string | null; children?: ReactNode }) {
  const { soundEnabled, toggleSound } = useLearningFeedback()
  const soundOn = soundEnabled
  const Icon = status === 'correct' ? CheckCircle2 : status === 'incorrect' ? CircleAlert : SkipForward
  return <div className={'learning-feedback learning-feedback--' + status} role="status" aria-live="polite">
    <div className="learning-feedback__top">
      <div className="learning-feedback__title"><Icon size={20} aria-hidden="true" /><strong>{status === 'correct' ? 'Correct answer' : status === 'incorrect' ? 'Not quite — keep learning' : 'Question skipped'}</strong></div>
      <button type="button" className="learning-feedback__sound" aria-pressed={soundOn} onClick={toggleSound}>
        {soundOn ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}
        Sound {soundOn ? 'on' : 'off'}
      </button>
    </div>
    {answer && <p><strong>Correct answer:</strong> {answer}</p>}
    {explanation && <p className="learning-feedback__explanation"><strong>Why:</strong> {explanation}</p>}
    {status !== 'correct' && <p className="learning-feedback__guidance">
      {status === 'incorrect'
        ? explanation
          ? 'Read why the answer works. After finishing, practise this skill again using a fresh question.'
          : 'Review the lesson explanation in Learn, then try a fresh question. This result does not mean you cannot improve.'
        : 'Return to this skill during your review. Skipped questions do not count as correct answers.'}
    </p>}
    <div className="learning-feedback__actions">{children}</div>
  </div>
}
