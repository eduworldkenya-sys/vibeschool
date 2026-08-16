'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  QUICK_CHECK_PATHWAYS,
  QUICK_CHECK_QUESTIONS,
  QUICK_CHECK_STORAGE_KEY,
  calculateQuickCheck,
  evaluateQuickCheck,
} from '@/lib/pathways/quickCheck'

export default function PathwayQuickCheckPage() {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [complete, setComplete] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(QUICK_CHECK_STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as { step?: number; answers?: Record<string, number>; complete?: boolean }
        if (saved.answers && typeof saved.answers === 'object') setAnswers(saved.answers)
        if (typeof saved.step === 'number') setStep(Math.max(0, Math.min(QUICK_CHECK_QUESTIONS.length - 1, saved.step)))
        setComplete(saved.complete === true)
      }
    } catch {}
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try { localStorage.setItem(QUICK_CHECK_STORAGE_KEY, JSON.stringify({ step, answers, complete })) } catch {}
  }, [step, answers, complete, hydrated])

  const scores = useMemo(() => calculateQuickCheck(answers), [answers])
  const outcome = useMemo(() => evaluateQuickCheck(scores), [scores])

  function choose(index: number) {
    const question = QUICK_CHECK_QUESTIONS[step]
    setAnswers(current => ({ ...current, [question.id]: index }))
    if (step === QUICK_CHECK_QUESTIONS.length - 1) setComplete(true)
    else setStep(current => current + 1)
  }

  function reset() {
    setAnswers({})
    setStep(0)
    setComplete(false)
    try {
      localStorage.removeItem(QUICK_CHECK_STORAGE_KEY)
      localStorage.removeItem('vs_pathways_save_id_v2')
    } catch {}
  }

  if (!hydrated) return <main className="wrap"><p>Loading your pathway check…</p><style jsx>{styles}</style></main>

  if (complete) {
    if (outcome.status === 'uncertain') {
      return <main className="wrap">
        <Link href="/pathways">← Pathways</Link>
        <p className="eyebrow">EARLY GUIDANCE · FREE</p>
        <h1>No single pathway is clear yet.</h1>
        <p>Your answers do not provide enough separation to name one pathway responsibly. VibeSchool will not turn missing, tied, or weak evidence into a STEM recommendation.</p>
        <section className="card">
          <strong>What this means</strong>
          <p>Explore more than one direction, compare subjects and careers, and return when you have more evidence about your interests and strengths.</p>
        </section>
        <div className="actions"><Link href="/pathways">Explore all pathways</Link><Link href="/learn/careers">Explore careers</Link><button onClick={reset}>Retake the check</button></div>
        <style jsx>{styles}</style>
      </main>
    }

    const primary = QUICK_CHECK_PATHWAYS[outcome.pathway]
    const secondary = QUICK_CHECK_PATHWAYS[outcome.runnerUp]
    return <main className="wrap">
      <Link href="/pathways">← Pathways</Link>
      <p className="eyebrow">EARLY GUIDANCE · FREE</p>
      <h1>{primary.name} is your strongest signal so far.</h1>
      <p>This is guidance from a short interest check, not an official placement decision.</p>
      <section className="result"><strong>{primary.name}</strong><span>{primary.summary}</span><small>Next strongest signal: {secondary.name}</small></section>
      <div className="actions"><Link href="/pathways/continue">Save or continue safely</Link><Link href="/pathways/schools">Explore verified schools</Link><button onClick={reset}>Retake the check</button></div>
      <style jsx>{styles}</style>
    </main>
  }

  const question = QUICK_CHECK_QUESTIONS[step]
  return <main className="wrap">
    <Link href="/pathways">← Pathways</Link>
    <p className="eyebrow">QUESTION {step + 1} OF {QUICK_CHECK_QUESTIONS.length}</p>
    <h1>{question.prompt}</h1>
    <div className="choices">{question.choices.map((choice, index) => <button key={choice.label} onClick={() => choose(index)}>{choice.label}</button>)}</div>
    {step > 0 && <button className="back" onClick={() => setStep(current => current - 1)}>Back</button>}
    <p className="privacy">No login required. Answers stay on this device until you explicitly save them.</p>
    <style jsx>{styles}</style>
  </main>
}

const styles = `
.wrap{min-height:100dvh;background:#f7f7fb;color:#111827;padding:32px 18px 64px;max-width:720px;margin:0 auto;font-family:var(--font-jakarta),Arial,sans-serif}.wrap>a{color:#4f46e5;font-weight:800;text-decoration:none}.eyebrow{margin:32px 0 10px;color:#4f46e5;font:900 11px var(--font-mono),monospace;letter-spacing:.15em}h1{font-size:clamp(30px,6vw,48px);line-height:1.08;letter-spacing:-.035em;margin:0 0 16px}p{color:#5b6475;line-height:1.65}.choices,.actions{display:grid;gap:10px;margin-top:24px}.choices button,.actions a,.actions button,.back{border:1px solid #dfe2ea;background:#fff;color:#161625;border-radius:14px;padding:15px;text-align:left;font-weight:800;text-decoration:none;cursor:pointer}.choices button:hover,.choices button:focus-visible{border-color:#4f46e5;background:#eef2ff}.result{display:grid;gap:7px;background:#171642;color:#fff;padding:22px;border-radius:18px;margin-top:24px}.result strong{font-size:26px}.result span,.result small{color:#d9d8ec;line-height:1.5}.card{background:#fff;border:1px solid #e2e5ec;border-radius:16px;padding:18px;margin-top:22px}.back{margin-top:16px;padding:10px 13px}.privacy{font-size:12px;margin-top:20px}
`
