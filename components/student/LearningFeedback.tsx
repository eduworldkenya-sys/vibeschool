'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { CheckCircle2, CircleAlert, SkipForward, Volume2, VolumeX } from 'lucide-react'
import './learning-feedback.css'

export type LearningFeedbackStatus = 'correct' | 'incorrect' | 'skipped'
const SOUND_KEY = 'vibeschool:learning-feedback:sound:v1'
let audioContext: AudioContext | null = null

function readPreference(): boolean {
  try { return typeof window !== 'undefined' && window.localStorage.getItem(SOUND_KEY) === 'on' }
  catch { return false }
}

/** Soft, original non-musical confirmation tones. No external audio, tracking or autoplay. */
export function playLearningSound(status: LearningFeedbackStatus): void {
  if (!readPreference() || typeof window === 'undefined') return
  try {
    const context = audioContext ?? new window.AudioContext()
    audioContext = context
    void context.resume().catch(() => undefined)
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const start = context.currentTime
    const pitch = status === 'correct' ? 620 : status === 'incorrect' ? 320 : 440
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(pitch, start)
    oscillator.frequency.linearRampToValueAtTime(status === 'correct' ? 790 : pitch - 45, start + 0.13)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.035, start + 0.018)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.17)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(start)
    oscillator.stop(start + 0.18)
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
  } catch { /* Sound is optional: unsupported or blocked audio never blocks learning. */ }
}

export default function LearningFeedback({
  status, answer, explanation, children,
}: { status: LearningFeedbackStatus; answer?: string | null; explanation?: string | null; children?: ReactNode }) {
  const [soundOn, setSoundOn] = useState(false)
  useEffect(() => { setSoundOn(readPreference()) }, [])
  function toggleSound() {
    const next = !soundOn
    setSoundOn(next)
    try { window.localStorage.setItem(SOUND_KEY, next ? 'on' : 'off') } catch { /* no storage */ }
    if (next) playLearningSound('correct')
  }
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
    {explanation && <p className="learning-feedback__explanation">{explanation}</p>}
    <div className="learning-feedback__actions">{children}</div>
  </div>
}
