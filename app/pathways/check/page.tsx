'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  QUICK_CHECK_PATHWAYS,
  QUICK_CHECK_QUESTIONS,
  QUICK_CHECK_STORAGE_KEY,
  calculateQuickCheck,
  evaluateQuickCheck,
  rankQuickCheck,
} from '@/lib/pathways/quickCheck'

const ICONS: Record<string, string> = {
  stem: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-4 10h8M12 8v8',
  social: 'M7 18c0-2.2 2.2-4 5-4s5 1.8 5 4M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-7 6c0-1.6 1.2-3 3-3M19 18c0-1.6-1.2-3-3-3',
  arts: 'M4 16c3-1 4-4 4-7 3 1 6 4 8 7 2-2 3-5 4-8M5 19h14',
  compass: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm3 5-2 6-6 2 2-6 6-2Z',
  shield: 'M12 3 5 6v5c0 4.6 3 7.5 7 9 4-1.5 7-4.4 7-9V6l-7-3Zm-3 8 2 2 4-4',
}

function Icon({name}:{name:string}) {
  const path = ICONS[name] ?? ICONS.compass
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="icon"><path d={path} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

export default function PathwayQuickCheckPage() {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [complete, setComplete] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [started, setStarted] = useState(false)
  const [feedback, setFeedback] = useState<'yes'|'somewhat'|'no'|null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(QUICK_CHECK_STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as { step?: number; answers?: Record<string, number>; complete?: boolean }
        if (saved.answers && typeof saved.answers === 'object') setAnswers(saved.answers)
        if (typeof saved.step === 'number') setStep(Math.max(0, Math.min(QUICK_CHECK_QUESTIONS.length - 1, saved.step)))
        setComplete(saved.complete === true)
        if ((saved.answers && Object.keys(saved.answers).length > 0) || saved.complete) setStarted(true)
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
  const ranking = useMemo(() => rankQuickCheck(scores), [scores])
  const progress = Math.round(((step + (complete ? 1 : 0)) / QUICK_CHECK_QUESTIONS.length) * 100)
  const maxScore = Math.max(1, ...Object.values(scores))

  function choose(index: number) {
    const question = QUICK_CHECK_QUESTIONS[step]
    setAnswers(current => ({ ...current, [question.id]: index }))
    if (step === QUICK_CHECK_QUESTIONS.length - 1) setComplete(true)
    else setStep(current => current + 1)
  }

  function reset() {
    setAnswers({}); setStep(0); setComplete(false); setStarted(false); setFeedback(null)
    try { localStorage.removeItem(QUICK_CHECK_STORAGE_KEY); localStorage.removeItem('vs_pathways_save_id_v2') } catch {}
  }

  const signalRows = ranking.map(key => ({key, name: QUICK_CHECK_PATHWAYS[key].name, score: scores[key], width: Math.max(6, Math.round((scores[key] / maxScore) * 100))}))

  if (!hydrated) return <main className="page"><div className="wrap"><p>Loading your pathway check…</p></div><style jsx>{styles}</style></main>

  if (!started && !complete) return <main className="page"><div className="wrap intro">
    <header className="top"><Link href="/pathways">← Pathways</Link><span>Quick Check</span></header>
    <div className="trustIcon"><Icon name="compass" /></div>
    <p className="eyebrow">BEFORE YOU START</p>
    <h1>Six questions. One useful starting point.</h1>
    <p className="lead">This is not an exam and it does not decide your future. VibeSchool compares your answers across the three Senior School pathway families and only names a strongest direction when the signal is clear enough.</p>
    <section className="how"><div><span>1</span><strong>Answer honestly</strong><small>No right or wrong answers.</small></div><div><span>2</span><strong>We compare signals</strong><small>Your choices add evidence across pathways.</small></div><div><span>3</span><strong>We show uncertainty</strong><small>Ties and weak signals stay uncertain.</small></div><div><span>4</span><strong>You decide what to explore</strong><small>The result is guidance, not placement.</small></div></section>
    <button className="start" onClick={()=>setStarted(true)}>Start the check</button>
    <p className="privacy">About 2 minutes · No login required · Answers stay on this device unless you choose to save later.</p>
  </div><style jsx>{styles}</style></main>

  if (complete) {
    if (outcome.status === 'uncertain') {
      return <main className="page"><div className="wrap">
        <header className="top"><Link href="/pathways">← Pathways</Link><span>Quick Check</span></header>
        <div className="progressSteps" aria-label="Quick Check complete">{QUICK_CHECK_QUESTIONS.map((_,i)=><span key={i} className="done" />)}</div>
        <p className="eyebrow">EARLY GUIDANCE · COMPLETE</p>
        <h1>No single pathway is clear yet.</h1>
        <p className="lead">Your answers do not give VibeSchool enough separation to responsibly name one pathway first. That is a valid result.</p>
        <section className="signalCard"><strong>Your current signals</strong>{signalRows.map(r=><div key={r.key} className="signalRow"><div className="signalLabel"><span><Icon name={r.key}/>{r.name}</span><b>{r.score}</b></div><div className="signalTrack"><span style={{width:`${r.width}%`}} /></div></div>)}<small>These bars compare the check's internal evidence points. They are not percentages or probabilities.</small></section>
        <section className="card"><strong>Why we stopped here</strong><p>VibeSchool treats ties, low signal and narrow margins as uncertainty instead of forcing a label.</p></section>
        <div className="actions"><Link className="primary" href="/learn/careers">Explore careers</Link><Link href="/pathways">Compare pathways</Link><button onClick={reset}>Retake the check</button></div>
        <div className="verifiedNote"><Icon name="shield"/><span><strong>Trust rule:</strong> weak evidence stays weak. VibeSchool will not pretend certainty.</span></div>
      </div><style jsx>{styles}</style></main>
    }

    const primary = QUICK_CHECK_PATHWAYS[outcome.pathway]
    const secondary = QUICK_CHECK_PATHWAYS[outcome.runnerUp]
    const selectedLabels = QUICK_CHECK_QUESTIONS.flatMap(q => {
      const choiceIndex = answers[q.id]
      const choice = q.choices[choiceIndex]
      if (!choice || !choice.scores[outcome.pathway]) return []
      return [choice.label]
    }).slice(0,4)

    return <main className="page"><div className="wrap">
      <header className="top"><Link href="/pathways">← Pathways</Link><span>Quick Check</span></header>
      <div className="progressSteps" aria-label="Quick Check complete">{QUICK_CHECK_QUESTIONS.map((_,i)=><span key={i} className="done" />)}</div>
      <p className="eyebrow">YOUR EARLY DIRECTION</p>
      <h1>Your answers point most strongly toward {primary.name}.</h1>
      <p className="lead">This result comes from the actual answers you selected. It is guidance from this short check, not an official placement decision or a permanent label.</p>
      <section className="result"><span className="resultLabel">STRONGEST SIGNAL</span><div className="resultHead"><Icon name={outcome.pathway}/><strong>{primary.name}</strong></div><span>{primary.summary}</span><small>Also worth exploring: {secondary.name}</small></section>
      <section className="signalCard"><strong>How your signals compared</strong>{signalRows.map(r=><div key={r.key} className="signalRow"><div className="signalLabel"><span><Icon name={r.key}/>{r.name}</span><b>{r.score}</b></div><div className="signalTrack"><span style={{width:`${r.width}%`}} /></div></div>)}<small>Internal evidence points only—not probabilities. The recommendation requires both a minimum signal and a minimum lead over the runner-up.</small></section>
      <section className="card"><strong>Why {primary.name} appeared first</strong>{selectedLabels.length ? <ul>{selectedLabels.map(label=><li key={label}>{label}</li>)}</ul> : <p>Your total signal and lead over the next pathway passed VibeSchool's minimum threshold.</p>}</section>
      <section className="feedback"><strong>Does this feel like you?</strong><div><button onClick={()=>setFeedback('yes')} aria-pressed={feedback==='yes'}>Yes</button><button onClick={()=>setFeedback('somewhat')} aria-pressed={feedback==='somewhat'}>Somewhat</button><button onClick={()=>setFeedback('no')} aria-pressed={feedback==='no'}>Not really</button></div>{feedback==='no'&&<p>That matters. A six-question check cannot know everything about you. Compare another pathway or explore careers before deciding.</p>}{feedback==='somewhat'&&<p>Use this as one direction to explore, not a conclusion.</p>}{feedback==='yes'&&<p>Good—use the result to explore subjects, careers and verified school information next.</p>}</section>
      <div className="actions"><Link className="primary" href="/pathways/continue">Save or continue</Link><Link href="/learn/careers">Explore careers</Link><Link href="/pathways/schools">Explore verified schools</Link><button onClick={reset}>Retake the check</button></div>
      <div className="verifiedNote"><Icon name="shield"/><span><strong>Two kinds of information:</strong> this result is VibeSchool guidance. School-offering claims are only marked verified when source evidence exists.</span></div>
    </div><style jsx>{styles}</style></main>
  }

  const question = QUICK_CHECK_QUESTIONS[step]
  return <main className="page"><div className="wrap">
    <header className="top"><Link href="/pathways">← Pathways</Link><span>Quick Check</span></header>
    <div className="progressSteps" aria-label={`Question ${step + 1} of ${QUICK_CHECK_QUESTIONS.length}`}>{QUICK_CHECK_QUESTIONS.map((_,i)=><span key={i} className={i<step?'done':i===step?'current':''} />)}</div>
    <div className="questionMeta"><p className="eyebrow">QUESTION {step + 1} OF {QUICK_CHECK_QUESTIONS.length}</p><span>{progress}% complete</span></div>
    <h1>{question.prompt}</h1>
    <p className="instruction">Choose the answer that feels closest to you. There is no right or wrong answer.</p>
    <div className="choices">{question.choices.map((choice, index) => <button key={choice.label} onClick={() => choose(index)}><span>{choice.label}</span><span aria-hidden="true">→</span></button>)}</div>
    <div className="bottomRow">{step > 0 ? <button className="back" onClick={() => setStep(current => current - 1)}>← Back</button> : <span />}</div>
    <p className="privacy">No login required. Your answers stay on this device unless you choose to save the result later.</p>
  </div><style jsx>{styles}</style></main>
}

const styles = `
.page{min-height:100dvh;background:#f7f7fb;color:#111827;font-family:var(--font-jakarta),Arial,sans-serif}.wrap{max-width:720px;margin:0 auto;padding:22px 18px 64px}.intro{max-width:800px}.top{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:44px}.top a{color:#4f46e5;font-weight:850;text-decoration:none;font-size:13px}.top span{color:#6b7280;font-size:12px;font-weight:800}.icon{width:22px;height:22px;flex:0 0 auto}.trustIcon{width:58px;height:58px;border-radius:18px;display:grid;place-items:center;background:#eef2ff;color:#4338ca;margin:32px 0 18px}.trustIcon .icon{width:30px;height:30px}.progressSteps{display:grid;grid-template-columns:repeat(6,1fr);gap:7px;margin:18px 0 28px}.progressSteps span{height:7px;border-radius:999px;background:#e3e5ed}.progressSteps .done{background:#4f46e5}.progressSteps .current{background:#a5b4fc}.questionMeta{display:flex;align-items:center;justify-content:space-between;gap:12px}.questionMeta>span{font-size:11px;color:#6b7280;font-weight:800}.eyebrow{margin:0 0 10px;color:#4f46e5;font:900 11px var(--font-mono),monospace;letter-spacing:.15em}h1{font-size:clamp(31px,7vw,50px);line-height:1.06;letter-spacing:-.038em;margin:0 0 16px}.lead,.instruction,p{color:#5b6475;line-height:1.65}.lead{font-size:16px}.instruction{font-size:14px;margin:0 0 22px}.how{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:26px 0}.how div{display:grid;gap:6px;background:#fff;border:1px solid #e2e5ec;border-radius:16px;padding:16px}.how div>span{display:grid;place-items:center;width:28px;height:28px;border-radius:999px;background:#eef2ff;color:#4338ca;font-weight:900;font-size:12px}.how small{color:#737b8a;line-height:1.45}.start{min-height:52px;border:0;border-radius:14px;background:#4f46e5;color:#fff;font-weight:850;padding:0 18px;cursor:pointer}.choices,.actions{display:grid;gap:10px;margin-top:24px}.choices button,.actions a,.actions button,.back{min-height:52px;border:1px solid #dfe2ea;background:#fff;color:#161625;border-radius:15px;padding:15px 16px;text-align:left;font-weight:800;text-decoration:none;cursor:pointer;font:inherit}.choices button{display:flex;align-items:center;justify-content:space-between;gap:16px;transition:border-color .15s ease,background .15s ease,transform .15s ease}.choices button:hover,.choices button:focus-visible{border-color:#4f46e5;background:#eef2ff;outline:3px solid rgba(79,70,229,.15);outline-offset:2px}.choices button:active{transform:scale(.99)}.actions .primary{background:#4f46e5;border-color:#4f46e5;color:#fff}.result{display:grid;gap:9px;background:#171642;color:#fff;padding:24px;border-radius:20px;margin-top:26px}.resultLabel{font-size:10px;letter-spacing:.14em;font-weight:900;color:#b9b7ec}.resultHead{display:flex;align-items:center;gap:10px}.resultHead strong{font-size:30px}.result span:not(.resultLabel),.result small{color:#deddf2;line-height:1.5}.signalCard,.card,.feedback{background:#fff;border:1px solid #e2e5ec;border-radius:18px;padding:19px;margin-top:18px}.signalCard{display:grid;gap:14px}.signalRow{display:grid;gap:6px}.signalLabel{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:12px}.signalLabel span{display:flex;align-items:center;gap:8px}.signalLabel .icon{width:17px;height:17px;color:#4f46e5}.signalTrack{height:9px;border-radius:999px;background:#eceef3;overflow:hidden}.signalTrack span{display:block;height:100%;border-radius:999px;background:#4f46e5}.signalCard small{color:#737b8a;line-height:1.45}.card strong,.feedback strong,.signalCard>strong{font-size:18px}.card p{margin-bottom:0}.card ul{margin:12px 0 0;padding-left:20px;color:#5b6475;line-height:1.55}.feedback>div{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.feedback button{border:1px solid #dfe2ea;background:#fff;border-radius:999px;padding:9px 13px;font-weight:800;cursor:pointer}.feedback button[aria-pressed=true]{background:#eef2ff;border-color:#4f46e5;color:#3730a3}.feedback p{margin-bottom:0}.verifiedNote{display:flex;gap:10px;align-items:flex-start;margin-top:22px;padding:14px;border-radius:14px;background:#f0fdf4;color:#166534;font-size:12px;line-height:1.55}.verifiedNote .icon{width:19px;height:19px;margin-top:1px}.bottomRow{display:flex;justify-content:flex-start;margin-top:16px}.back{min-height:44px;padding:10px 13px}.privacy{font-size:12px;margin-top:22px;color:#737b8a}@media(max-width:520px){.wrap{padding:16px 16px 48px}h1{font-size:34px}.how{grid-template-columns:1fr}.choices button{min-height:58px;padding:16px}.actions a,.actions button{min-height:50px;display:flex;align-items:center}.top{position:sticky;top:0;background:rgba(247,247,251,.96);backdrop-filter:blur(10px);z-index:2}.feedback>div{display:grid;grid-template-columns:repeat(3,1fr)}.feedback button{padding:10px 6px}}
`
