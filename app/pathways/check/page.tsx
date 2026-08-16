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
  const progress = Math.round(((step + (complete ? 1 : 0)) / QUICK_CHECK_QUESTIONS.length) * 100)

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

  if (!hydrated) return <main className="page"><div className="wrap"><p>Loading your pathway check…</p></div><style jsx>{styles}</style></main>

  if (complete) {
    if (outcome.status === 'uncertain') {
      return <main className="page"><div className="wrap">
        <header className="top"><Link href="/pathways">← Pathways</Link><span>Quick Check</span></header>
        <div className="progress" aria-label="Quick Check complete"><span style={{width:'100%'}} /></div>
        <p className="eyebrow">EARLY GUIDANCE · COMPLETE</p>
        <h1>No single pathway is clear yet.</h1>
        <p className="lead">Your answers are too close to name one direction responsibly. That is a valid result, not a failure.</p>
        <section className="card">
          <strong>What to do next</strong>
          <p>Explore more than one direction, compare subjects and careers, and return when you have more evidence about what interests you and what you enjoy doing.</p>
        </section>
        <div className="actions"><Link className="primary" href="/learn/careers">Explore careers</Link><Link href="/pathways">Explore all pathways</Link><button onClick={reset}>Retake the check</button></div>
        <p className="privacy">VibeSchool will not turn missing, tied or weak evidence into a confident recommendation.</p>
      </div><style jsx>{styles}</style></main>
    }

    const primary = QUICK_CHECK_PATHWAYS[outcome.pathway]
    const secondary = QUICK_CHECK_PATHWAYS[outcome.runnerUp]
    return <main className="page"><div className="wrap">
      <header className="top"><Link href="/pathways">← Pathways</Link><span>Quick Check</span></header>
      <div className="progress" aria-label="Quick Check complete"><span style={{width:'100%'}} /></div>
      <p className="eyebrow">YOUR EARLY DIRECTION</p>
      <h1>Your answers point most strongly toward {primary.name}.</h1>
      <p className="lead">This is an early signal from six interest questions, not a permanent label or an official placement decision.</p>
      <section className="result"><span className="resultLabel">STRONGEST SIGNAL</span><strong>{primary.name}</strong><span>{primary.summary}</span><small>Also worth exploring: {secondary.name}</small></section>
      <section className="card"><strong>Why this matters</strong><p>Use this result to decide what to explore next. Your direction can change as you learn more about subjects, careers and your own strengths.</p></section>
      <div className="actions"><Link className="primary" href="/pathways/continue">Save or continue</Link><Link href="/learn/careers">Explore careers</Link><Link href="/pathways/schools">Explore verified schools</Link><button onClick={reset}>Retake the check</button></div>
    </div><style jsx>{styles}</style></main>
  }

  const question = QUICK_CHECK_QUESTIONS[step]
  return <main className="page"><div className="wrap">
    <header className="top"><Link href="/pathways">← Pathways</Link><span>Quick Check</span></header>
    <div className="progress" aria-label={`Question ${step + 1} of ${QUICK_CHECK_QUESTIONS.length}`}><span style={{width:`${progress}%`}} /></div>
    <div className="questionMeta"><p className="eyebrow">QUESTION {step + 1} OF {QUICK_CHECK_QUESTIONS.length}</p><span>{progress}%</span></div>
    <h1>{question.prompt}</h1>
    <p className="instruction">Choose the answer that feels closest to you. There is no right or wrong answer.</p>
    <div className="choices">{question.choices.map((choice, index) => <button key={choice.label} onClick={() => choose(index)}><span>{choice.label}</span><span aria-hidden="true">→</span></button>)}</div>
    <div className="bottomRow">{step > 0 ? <button className="back" onClick={() => setStep(current => current - 1)}>← Back</button> : <span />}</div>
    <p className="privacy">No login required. Your answers stay on this device unless you choose to save the result later.</p>
  </div><style jsx>{styles}</style></main>
}

const styles = `
.page{min-height:100dvh;background:#f7f7fb;color:#111827;font-family:var(--font-jakarta),Arial,sans-serif}.wrap{max-width:720px;margin:0 auto;padding:22px 18px 64px}.top{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:44px}.top a{color:#4f46e5;font-weight:850;text-decoration:none;font-size:13px}.top span{color:#6b7280;font-size:12px;font-weight:800}.progress{height:6px;background:#e7e7ef;border-radius:999px;overflow:hidden;margin:16px 0 28px}.progress span{display:block;height:100%;background:#4f46e5;border-radius:999px;transition:width .2s ease}.questionMeta{display:flex;align-items:center;justify-content:space-between;gap:12px}.questionMeta>span{font-size:11px;color:#6b7280;font-weight:800}.eyebrow{margin:0 0 10px;color:#4f46e5;font:900 11px var(--font-mono),monospace;letter-spacing:.15em}h1{font-size:clamp(31px,7vw,50px);line-height:1.06;letter-spacing:-.038em;margin:0 0 16px}.lead,.instruction,p{color:#5b6475;line-height:1.65}.instruction{font-size:14px;margin:0 0 22px}.choices,.actions{display:grid;gap:10px;margin-top:24px}.choices button,.actions a,.actions button,.back{min-height:52px;border:1px solid #dfe2ea;background:#fff;color:#161625;border-radius:15px;padding:15px 16px;text-align:left;font-weight:800;text-decoration:none;cursor:pointer;font:inherit}.choices button{display:flex;align-items:center;justify-content:space-between;gap:16px;transition:border-color .15s ease,background .15s ease,transform .15s ease}.choices button:hover,.choices button:focus-visible{border-color:#4f46e5;background:#eef2ff;outline:3px solid rgba(79,70,229,.15);outline-offset:2px}.choices button:active{transform:scale(.99)}.actions .primary{background:#4f46e5;border-color:#4f46e5;color:#fff}.result{display:grid;gap:8px;background:#171642;color:#fff;padding:24px;border-radius:20px;margin-top:26px}.resultLabel{font-size:10px;letter-spacing:.14em;font-weight:900;color:#b9b7ec}.result strong{font-size:30px}.result span:not(.resultLabel),.result small{color:#deddf2;line-height:1.5}.card{background:#fff;border:1px solid #e2e5ec;border-radius:18px;padding:19px;margin-top:18px}.card strong{font-size:18px}.card p{margin-bottom:0}.bottomRow{display:flex;justify-content:flex-start;margin-top:16px}.back{min-height:44px;padding:10px 13px}.privacy{font-size:12px;margin-top:22px;color:#737b8a}@media(max-width:520px){.wrap{padding:16px 16px 48px}.progress{margin:12px 0 24px}h1{font-size:34px}.choices button{min-height:58px;padding:16px}.actions a,.actions button{min-height:50px;display:flex;align-items:center}.top{position:sticky;top:0;background:rgba(247,247,251,.96);backdrop-filter:blur(10px);z-index:2}}
`
