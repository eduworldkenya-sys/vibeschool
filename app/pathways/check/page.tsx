'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type PathwayKey = 'stem' | 'social' | 'arts'
type Scores = Record<PathwayKey, number>

type Choice = {
  label: string
  hint?: string
  scores: Partial<Scores>
}

type Question = {
  id: string
  prompt: string
  choices: Choice[]
}

const PATHWAYS: Record<PathwayKey, { name: string; summary: string; href: string }> = {
  stem: {
    name: 'STEM',
    summary: 'Science, technology, engineering and mathematics.',
    href: '/pathways#stem',
  },
  social: {
    name: 'Social Sciences',
    summary: 'People, society, languages, humanities and business-related exploration.',
    href: '/pathways#social-sciences',
  },
  arts: {
    name: 'Arts & Sports Science',
    summary: 'Creative, performance, visual arts and sports-related exploration.',
    href: '/pathways#arts-and-sports-science',
  },
}

const QUESTIONS: Question[] = [
  {
    id: 'activity',
    prompt: 'Which activity sounds most interesting to you?',
    choices: [
      { label: 'Build, test or figure out how something works', scores: { stem: 3 } },
      { label: 'Understand people, communities or how decisions are made', scores: { social: 3 } },
      { label: 'Create, perform, design or compete physically', scores: { arts: 3 } },
      { label: 'I am not sure yet', scores: {} },
    ],
  },
  {
    id: 'problem',
    prompt: 'If you had a free afternoon, what would you rather try?',
    choices: [
      { label: 'An experiment, coding, building or technical challenge', scores: { stem: 3 } },
      { label: 'A debate, business idea, writing or community project', scores: { social: 3 } },
      { label: 'Music, film, drawing, performance or sport', scores: { arts: 3 } },
      { label: 'More than one of these', scores: { stem: 1, social: 1, arts: 1 } },
    ],
  },
  {
    id: 'strength',
    prompt: 'Which kind of school work usually feels most natural?',
    choices: [
      { label: 'Numbers, science, practical or technical work', scores: { stem: 2 } },
      { label: 'Languages, people, history, geography or business', scores: { social: 2 } },
      { label: 'Creative, performance, visual or physical activities', scores: { arts: 2 } },
      { label: 'I do not know yet', scores: {} },
    ],
  },
  {
    id: 'future',
    prompt: 'Which future sounds most exciting right now?',
    choices: [
      { label: 'Solving scientific, health, technology or engineering problems', scores: { stem: 3 } },
      { label: 'Working with people, organizations, society or enterprise', scores: { social: 3 } },
      { label: 'Creating, performing, designing or developing sport', scores: { arts: 3 } },
      { label: 'I have not decided', scores: {} },
    ],
  },
  {
    id: 'style',
    prompt: 'When learning something new, what do you enjoy most?',
    choices: [
      { label: 'Testing ideas and solving structured problems', scores: { stem: 2 } },
      { label: 'Discussing ideas, explaining and understanding viewpoints', scores: { social: 2 } },
      { label: 'Expressing ideas through making, movement or performance', scores: { arts: 2 } },
      { label: 'It depends on the topic', scores: { stem: 1, social: 1, arts: 1 } },
    ],
  },
  {
    id: 'choice',
    prompt: 'What would you like VibeSchool to help you do next?',
    choices: [
      { label: 'See subjects and schools connected to my direction', scores: {} },
      { label: 'Explore careers before I decide', scores: {} },
      { label: 'Understand the three pathways better', scores: {} },
      { label: 'I just want an early indication', scores: {} },
    ],
  },
]

const STORAGE_KEY = 'vs_pathways_quick_check_v1'

function calculate(answers: Record<string, number>): Scores {
  const scores: Scores = { stem: 0, social: 0, arts: 0 }
  for (const question of QUESTIONS) {
    const answer = answers[question.id]
    if (answer == null) continue
    const choice = question.choices[answer]
    if (!choice) continue
    for (const key of Object.keys(choice.scores) as PathwayKey[]) {
      scores[key] += choice.scores[key] ?? 0
    }
  }
  return scores
}

export default function PathwayQuickCheckPage() {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [complete, setComplete] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as { step?: number; answers?: Record<string, number>; complete?: boolean }
        if (parsed.answers && typeof parsed.answers === 'object') setAnswers(parsed.answers)
        if (typeof parsed.step === 'number') setStep(Math.max(0, Math.min(QUESTIONS.length - 1, parsed.step)))
        if (parsed.complete === true) setComplete(true)
      }
    } catch {
      // A damaged local draft should never block the free check.
    } finally {
      setHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, answers, complete }))
    } catch {
      // Storage can be unavailable in private/restricted browser modes.
    }
  }, [answers, complete, hydrated, step])

  const scores = useMemo(() => calculate(answers), [answers])
  const ranking = useMemo(
    () => (Object.keys(scores) as PathwayKey[]).sort((a, b) => scores[b] - scores[a]),
    [scores]
  )
  const leader = ranking[0]
  const runnerUp = ranking[1]
  const evidenceAnswers = Object.values(answers).filter(value => value != null).length
  const close = scores[leader] - scores[runnerUp] <= 2

  function select(index: number) {
    const question = QUESTIONS[step]
    const next = { ...answers, [question.id]: index }
    setAnswers(next)
    if (step === QUESTIONS.length - 1) {
      setComplete(true)
    } else {
      setStep(current => current + 1)
    }
  }

  function reset() {
    setAnswers({})
    setStep(0)
    setComplete(false)
    try { window.localStorage.removeItem(STORAGE_KEY) } catch {}
  }

  if (!hydrated) {
    return <main style={S.root}><div style={S.shell}><p style={S.muted}>Loading your free pathway check…</p></div></main>
  }

  if (complete) {
    const primary = PATHWAYS[leader]
    const secondary = PATHWAYS[runnerUp]
    return (
      <main style={S.root}>
        <div style={S.shell}>
          <Link href="/pathways" style={S.back}>← Pathways</Link>
          <div style={S.kicker}>EARLY GUIDANCE · FREE</div>
          <h1 style={S.h1}>{close ? 'Two directions are worth exploring' : `${primary.name} is your strongest signal so far`}</h1>
          <p style={S.lead}>
            This is an early indication from a short interest check, not an official placement decision or a judgment about what you can become.
          </p>

          <section style={S.resultCard}>
            <div style={S.resultLabel}>{close ? 'STRONGEST SIGNALS' : 'STRONGEST DIRECTION'}</div>
            <h2 style={S.resultTitle}>{primary.name}</h2>
            <p style={S.body}>{primary.summary}</p>
            {close && <div style={S.secondary}><strong>{secondary.name}</strong><span>{secondary.summary}</span></div>}
          </section>

          <section style={S.card}>
            <h2 style={S.cardTitle}>Why this result?</h2>
            <p style={S.body}>Your answers produced more interest signals for {primary.name}{close ? `, with ${secondary.name} close behind` : ''}. You answered {evidenceAnswers} short prompts. Adding real subject preferences, performance evidence and career goals later can strengthen or change the guidance.</p>
          </section>

          <section style={S.card}>
            <h2 style={S.cardTitle}>What should I do next?</h2>
            <div style={S.actions}>
              <Link href="/learn/careers" style={S.primaryAction}>Explore careers</Link>
              <Link href="/pathways" style={S.secondaryAction}>Understand pathways</Link>
              <button type="button" onClick={reset} style={S.textButton}>Retake the quick check</button>
            </div>
          </section>

          <section style={S.trustCard}>
            <strong>Trust note</strong>
            <p style={S.small}>Kenya's official Grade 10 selection system identifies STEM, Social Sciences, and Arts & Sports as the main pathway families. VibeSchool's result above is guidance based only on the answers you gave here. Detailed official subject-combination and school-offering data will only be shown after it is source-verified in the Pathways knowledge system.</p>
          </section>
        </div>
      </main>
    )
  }

  const question = QUESTIONS[step]
  const selected = answers[question.id]
  const pct = Math.round(((step + 1) / QUESTIONS.length) * 100)

  return (
    <main style={S.root}>
      <div style={S.shell}>
        <Link href="/pathways" style={S.back}>← Pathways</Link>
        <div style={S.kicker}>QUICK PATHWAY CHECK</div>
        <div style={S.progressTrack}><div style={{ ...S.progressFill, width: `${pct}%` }} /></div>
        <div style={S.stepText}>Question {step + 1} of {QUESTIONS.length}</div>
        <h1 style={S.question}>{question.prompt}</h1>
        <div style={S.choiceGrid}>
          {question.choices.map((choice, index) => (
            <button
              key={choice.label}
              type="button"
              onClick={() => select(index)}
              style={{ ...S.choice, ...(selected === index ? S.choiceSelected : {}) }}
            >
              <span style={S.choiceTitle}>{choice.label}</span>
              {choice.hint && <span style={S.small}>{choice.hint}</span>}
            </button>
          ))}
        </div>
        <div style={S.footerRow}>
          <button type="button" disabled={step === 0} onClick={() => setStep(current => Math.max(0, current - 1))} style={{ ...S.textButton, opacity: step === 0 ? .35 : 1 }}>Back</button>
          <span style={S.small}>No login required · answers stay on this device for now</span>
        </div>
      </div>
    </main>
  )
}

const S: Record<string, React.CSSProperties> = {
  root: { minHeight: '100dvh', background: '#f7f7fb', color: '#111827', padding: '24px 16px 56px' },
  shell: { width: '100%', maxWidth: 680, margin: '0 auto' },
  back: { display: 'inline-block', color: '#4f46e5', textDecoration: 'none', fontSize: 13, fontWeight: 800, marginBottom: 28 },
  kicker: { color: '#4f46e5', fontSize: 10, fontWeight: 900, letterSpacing: '0.18em', marginBottom: 10 },
  h1: { fontSize: 30, lineHeight: 1.08, margin: '0 0 12px', letterSpacing: '-0.03em' },
  lead: { fontSize: 15, lineHeight: 1.6, color: '#5b6475', margin: '0 0 20px' },
  progressTrack: { height: 7, background: '#e6e7ee', borderRadius: 999, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', background: '#4f46e5', borderRadius: 999, transition: 'width 180ms ease' },
  stepText: { fontSize: 11, color: '#7c8494', marginBottom: 24 },
  question: { fontSize: 27, lineHeight: 1.16, margin: '0 0 22px', letterSpacing: '-0.025em' },
  choiceGrid: { display: 'grid', gap: 10 },
  choice: { width: '100%', textAlign: 'left', border: '1px solid #e2e4ea', borderRadius: 16, padding: '17px 16px', background: '#fff', color: '#111827', cursor: 'pointer', boxShadow: '0 2px 8px rgba(15,23,42,.03)' },
  choiceSelected: { borderColor: '#4f46e5', background: '#eef2ff' },
  choiceTitle: { display: 'block', fontSize: 15, lineHeight: 1.4, fontWeight: 780 },
  footerRow: { marginTop: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
  textButton: { border: 'none', background: 'none', padding: 0, color: '#4f46e5', fontSize: 12, fontWeight: 850, cursor: 'pointer' },
  resultCard: { padding: 20, borderRadius: 20, background: '#171642', color: '#fff', marginBottom: 12 },
  resultLabel: { fontSize: 9, letterSpacing: '.16em', opacity: .65, fontWeight: 900 },
  resultTitle: { fontSize: 28, margin: '5px 0 6px', letterSpacing: '-0.025em' },
  secondary: { display: 'grid', gap: 3, borderTop: '1px solid rgba(255,255,255,.16)', marginTop: 16, paddingTop: 14, fontSize: 12, lineHeight: 1.5 },
  card: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 18, padding: 18, marginBottom: 12 },
  trustCard: { background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 18, padding: 16, fontSize: 12, lineHeight: 1.55 },
  cardTitle: { margin: '0 0 8px', fontSize: 16 },
  body: { margin: 0, color: '#5b6475', fontSize: 13, lineHeight: 1.6 },
  small: { color: '#7c8494', fontSize: 10, lineHeight: 1.45 },
  muted: { color: '#7c8494', fontSize: 13 },
  actions: { display: 'grid', gap: 9, marginTop: 12 },
  primaryAction: { display: 'block', textAlign: 'center', padding: '13px 14px', borderRadius: 13, background: '#4f46e5', color: '#fff', fontSize: 13, fontWeight: 850, textDecoration: 'none' },
  secondaryAction: { display: 'block', textAlign: 'center', padding: '12px 14px', borderRadius: 13, border: '1px solid #d8dae2', color: '#3730a3', fontSize: 13, fontWeight: 850, textDecoration: 'none' },
}
