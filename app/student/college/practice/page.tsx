'use client'

import Link from 'next/link'
import { useState } from 'react'
import compact from '@/components/student/LearnerCompact.module.css'

const TOPICS = [
  ['source-documents-and-books', 'Source documents and books of original entry'],
  ['double-entry-and-ledgers', 'Double entry and ledgers'],
  ['trial-balance-and-statements', 'Trial balance and statements'],
] as const

const QUESTIONS = [
  {
    prompt: 'A shop that sells stationery buys exercise books on credit for resale. Where should this be recorded first?',
    options: ['Sales journal', 'Purchases journal', 'Cashbook'],
    correct: 1,
    feedback: 'Use the purchases journal for credit purchases of goods for resale.',
  },
  {
    prompt: 'A customer pays KSh 4,800 into the bank to settle an invoice. Which entry records the receipt?',
    options: ['Debit Bank, credit Sales', 'Debit Receivables, credit Bank', 'Debit Bank, credit Receivables'],
    correct: 2,
    feedback: 'Bank increases and the customer’s outstanding balance falls. The sale was recorded when invoiced.',
  },
  {
    prompt: 'A cash purchase was completely omitted. What happens to the trial balance totals?',
    options: ['They can still agree', 'Debit total must exceed credit total', 'Credit total must exceed debit total'],
    correct: 0,
    feedback: 'Both sides of the entry are missing by the same amount. Agreement alone cannot detect a complete omission.',
  },
] as const

const MARKING_POINTS = [
  'Debit Bank KSh 30,000 and credit Capital KSh 30,000.',
  'Debit Equipment KSh 9,000 and credit Bank KSh 9,000.',
  'Debit Receivables KSh 6,000 and credit Service Revenue KSh 6,000.',
  'Debit Bank KSh 2,000 and credit Receivables KSh 2,000.',
  'Trial balance debits are Bank KSh 23,000, Equipment KSh 9,000 and Receivables KSh 4,000.',
  'Trial balance credits are Capital KSh 30,000 and Service Revenue KSh 6,000. Each column totals KSh 36,000.',
]

const button = { minHeight: 44, borderRadius: 10, padding: '8px 14px', border: '1px solid var(--vs-border)', background: 'var(--vs-card)', color: 'var(--vs-text)', fontWeight: 700 }

function UnitTest() {
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitted, setSubmitted] = useState(false)
  const score = QUESTIONS.filter((question, index) => answers[index] === question.correct).length
  return <form onSubmit={event => { event.preventDefault(); setSubmitted(true) }}>
    <p>Accounting Process and Systems · {QUESTIONS.length} marks</p>
    {QUESTIONS.map((question, index) => <fieldset key={question.prompt} disabled={submitted} style={{ border: 0, padding: '12px 0' }}>
      <legend>{index + 1}. {question.prompt}</legend>
      {question.options.map((option, optionIndex) => <label key={option} style={{ display: 'flex', gap: 8, alignItems: 'center', minHeight: 44 }}>
        <input type="radio" name={`question-${index}`} required checked={answers[index] === optionIndex}
          onChange={() => setAnswers(current => ({ ...current, [index]: optionIndex }))} />
        {option}
      </label>)}
      {submitted && <p>{answers[index] === question.correct ? 'Correct. ' : 'Review. '}{question.feedback}</p>}
    </fieldset>)}
    {submitted ? <>
      <p role="status"><strong>{score}/{QUESTIONS.length} · Auto-marked</strong></p>
      <button style={button} type="button" onClick={() => { setAnswers({}); setSubmitted(false) }}>Try again</button>
    </> : <button style={button} type="submit">Submit test</button>}
  </form>
}

function PracticalChallenge() {
  const [work, setWork] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [marks, setMarks] = useState<boolean[]>(() => MARKING_POINTS.map(() => false))
  return <form onSubmit={event => { event.preventDefault(); if (work.trim()) setSubmitted(true) }}>
    <p>Record each transaction and prepare a closing trial balance for Taji Repairs. All receipts and payments use the bank.</p>
    <ol>
      <li>The owner deposited KSh 30,000 into the business bank account.</li>
      <li>The business bought equipment for KSh 9,000 and paid immediately.</li>
      <li>The business billed a customer KSh 6,000 for completed repairs.</li>
      <li>The customer paid KSh 2,000 towards the bill.</li>
    </ol>
    <label style={{ display: 'grid', gap: 8 }}>Your journal entries and trial balance
      <textarea rows={7} required readOnly={submitted} value={work} onChange={event => setWork(event.target.value)}
        style={{ width: '100%', padding: 10, border: '1px solid var(--vs-border)', background: 'var(--vs-bg)', color: 'var(--vs-text)' }} />
    </label>
    {submitted ? <>
      <p>Tick each marking point you met. Award one mark per tick.</p>
      {MARKING_POINTS.map((point, index) => <label key={point} style={{ display: 'flex', gap: 8, alignItems: 'center', minHeight: 44 }}>
        <input type="checkbox" checked={marks[index]} onChange={event => {
          const checked = event.target.checked
          setMarks(current => current.map((mark, markIndex) => markIndex === index ? checked : mark))
        }} />
        {point}
      </label>)}
      <p role="status"><strong>{marks.filter(Boolean).length}/{MARKING_POINTS.length} · Self-marked</strong></p>
      <button style={button} type="button" onClick={() => { setWork(''); setMarks(MARKING_POINTS.map(() => false)); setSubmitted(false) }}>Try again</button>
    </> : <button style={button} type="submit" disabled={!work.trim()}>Submit and self-mark</button>}
  </form>
}

export default function CpaPracticePage() {
  return <div className={compact.screen}>
    <h1>Self-evaluation</h1>
    <section className={compact.panel}>
      <h2>CA11 · Financial Accounting</h2>
      <Link className={compact.primary} href="/learn/kasneb-cpa?view=practice">Browse Topic Checks <span aria-hidden="true">→</span></Link>
    </section>
    <details className={compact.panel}>
      <summary>Unit 02 Topic Checks</summary>
      <div style={{display:'grid',gap:6}}>{TOPICS.map(([slug, title]) =>
        <Link key={slug} className={compact.action} href={`/learn/kasneb-cpa/ca11/${slug}#practice`}>{title}</Link>)}</div>
    </details>
    <details className={compact.panel}>
      <summary>Unit Test</summary>
      <UnitTest />
    </details>
    <details className={compact.panel}>
      <summary>Practical Challenge</summary>
      <PracticalChallenge />
    </details>
    <section className={compact.panel}>
      <h2>Mock Exam</h2>
      <p className={compact.muted}>Full practice paper coming soon</p>
    </section>
  </div>
}
