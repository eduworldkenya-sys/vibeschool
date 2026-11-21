'use client'

import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'

type Question = { id: string; prompt: string; choices: string[]; answer: string; explanation: string }
type Scene = { title: string; number: number; prefix?: string; question: string; answer: string; explanation: string }
type Slide = { title: string; body: string }
type StudioModule = {
  id: string
  title: string
  description?: string
  numbers?: number[]
  columns?: string[]
  initial?: number[]
  preset?: number[]
  maxBeadsPerRod?: number
  steps?: number[][]
  scenes?: Scene[]
  questions?: Array<Question | string>
  slides?: Slide[]
}
export type PlaceValueStudioPayload = {
  schema: 'vibeschool.interactive-resource-studio.candidate.v1'
  modules: StudioModule[]
}

export function isPlaceValueStudioPayload(value: unknown): value is PlaceValueStudioPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  return candidate.schema === 'vibeschool.interactive-resource-studio.candidate.v1'
    && Array.isArray(candidate.modules)
    && candidate.modules.length > 0
    && candidate.modules.every((m: unknown) =>
      !!m && typeof m === 'object' && !Array.isArray(m)
      && typeof (m as Record<string, unknown>).id === 'string'
      && typeof (m as Record<string, unknown>).title === 'string')
}

const POWERS = [10000, 1000, 100, 10, 1]
const PLACES = ['Ten-thousands', 'Thousands', 'Hundreds', 'Tens', 'Ones']
const SHORT = ['TTh', 'Th', 'H', 'T', 'O']
const panel: CSSProperties = { border: '1px solid var(--vs-border, #cddbd4)', borderRadius: 15, padding: 16, background: 'var(--vs-card, #fff)' }
const button: CSSProperties = { minHeight: 44, padding: '9px 12px', borderRadius: 10, border: '1px solid var(--vs-border, #cbd5d1)', background: 'var(--vs-card, #fff)', color: 'var(--vs-text, #173a2b)', cursor: 'pointer', fontWeight: 650 }
const activeButton: CSSProperties = { ...button, background: 'var(--vs-accent, #17694e)', color: '#fff' }
const subtle: CSSProperties = { color: 'var(--vs-muted, #64756b)', fontSize: 13 }
const format = (n: number) => n.toLocaleString('en-KE')

function numberForDigits(digits: number[]) {
  return digits.reduce((sum, digit, i) => sum + digit * POWERS[i], 0)
}

function PlaceValueChart({ module }: { module: StudioModule }) {
  const numbers = (module.numbers ?? [36482]).filter(n => Number.isInteger(n) && n >= 10000 && n <= 99999)
  const [number, setNumber] = useState(numbers[0] ?? 36482)
  const [selected, setSelected] = useState(0)
  const digits = String(number).split('').map(Number)
  const expanded = digits.map((digit, i) => digit * POWERS[i]).filter(Boolean).map(format).join(' + ')
  return <section style={panel} aria-label="Interactive place value chart">
    <p style={subtle}>Choose a number and select a digit to explore its position and value.</p>
    <label htmlFor="place-value-number">Number</label>
    <select id="place-value-number" value={number} onChange={e => { setNumber(Number(e.target.value)); setSelected(0) }} style={{ ...button, display: 'block', width: '100%', margin: '8px 0 16px' }}>
      {(numbers.length ? numbers : [36482]).map(n => <option value={n} key={n}>{format(n)}</option>)}
    </select>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 5 }}>
      {digits.map((digit, i) => <div key={i} style={{ textAlign: 'center', minWidth: 0 }}>
        <div style={{ ...subtle, fontSize: 11 }}>{SHORT[i]}</div>
        <button type="button" aria-label={`${digit} in ${PLACES[i]}`} aria-pressed={selected === i} style={{ ...(selected === i ? activeButton : button), width: '100%', fontSize: 19, padding: 7 }} onClick={() => setSelected(i)}>{digit}</button>
      </div>)}
    </div>
    <div aria-live="polite" style={{ background: 'var(--vs-accent-soft, #e9f6ef)', padding: 14, borderRadius: 12, marginTop: 16 }}>
      <div style={subtle}>Digit {digits[selected]} · {PLACES[selected]}</div>
      <strong style={{ display: 'block', fontSize: 26 }}>{format(digits[selected] * POWERS[selected])}</strong>
    </div>
    <p><strong>Expanded form:</strong> {expanded}</p>
  </section>
}

function DigitalAbacus({ module }: { module: StudioModule }) {
  const initial = module.initial?.length === 5 ? module.initial : [1, 2, 3, 4, 5]
  const [beads, setBeads] = useState(initial)
  const setColumn = (index: number, delta: number) => setBeads(previous => previous.map((count, i) => i === index ? Math.min(9, Math.max(0, count + delta)) : count))
  return <section style={panel} aria-label="Digital place value abacus">
    <p style={subtle}>Add or remove beads in each column. Every column can hold 0 to 9 beads.</p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 5 }}>
      {beads.map((count, i) => <div key={i} style={{ textAlign: 'center' }}>
        <strong style={{ fontSize: 12 }}>{SHORT[i]}</strong>
        <div style={{ height: 152, borderRadius: 8, background: 'var(--vs-canvas, #f1f5f2)', display: 'flex', flexDirection: 'column-reverse', justifyContent: 'flex-start', alignItems: 'center', gap: 3, padding: 5, margin: '8px 0' }} role="img" aria-label={`${count} beads in ${PLACES[i]}`}>
          {Array.from({ length: count }).map((_, j) => <div key={j} style={{ width: '85%', height: 11, borderRadius: 10, background: i % 2 ? '#b88743' : '#1d805b' }} />)}
        </div>
        <strong>{count}</strong>
        <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
          <button type="button" style={button} aria-label={`Remove one bead from ${PLACES[i]}`} disabled={count === 0} onClick={() => setColumn(i, -1)}>−</button>
          <button type="button" style={button} aria-label={`Add one bead to ${PLACES[i]}`} disabled={count === 9} onClick={() => setColumn(i, 1)}>+</button>
        </div>
      </div>)}
    </div>
    <p aria-live="polite" style={{ fontSize: 24, textAlign: 'center', fontWeight: 750 }}>Number: {format(numberForDigits(beads))}</p>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button type="button" style={button} onClick={() => setBeads([0, 0, 0, 0, 0])}>Clear</button>
      <button type="button" style={button} onClick={() => setBeads(module.preset?.length === 5 ? module.preset : [2, 4, 9, 0, 7])}>Build 24,907</button>
    </div>
  </section>
}

function TenExchange() {
  const stages = [{ from: 'ones', to: 'ten', amount: 10 }, { from: 'tens', to: 'hundred', amount: 100 }, { from: 'hundreds', to: 'thousand', amount: 1000 }, { from: 'thousands', to: 'ten-thousand', amount: 10000 }]
  const [step, setStep] = useState(0)
  const s = stages[step]
  return <section style={panel} aria-label="Groups of ten demonstration">
    <p style={subtle}>Step {step + 1} of {stages.length} · Ten-for-one exchange</p>
    <h3 style={{ textAlign: 'center' }}>10 {s.from} = 1 {s.to}</h3>
    <div aria-label={`Ten ${s.from}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', maxWidth: 290, gap: 8, margin: '16px auto' }}>
      {Array.from({ length: 10 }).map((_, i) => <div key={i} style={{ background: '#18734e', color: '#fff', borderRadius: 7, padding: 12, textAlign: 'center' }}>1</div>)}
    </div>
    <div style={{ textAlign: 'center', fontSize: 22 }} aria-hidden="true">↓</div>
    <div style={{ borderRadius: 12, padding: 16, background: 'var(--vs-accent-soft, #e9f6ef)', textAlign: 'center' }}>
      <strong>1 {s.to}</strong><div>{format(s.amount)}</div>
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 16 }}>
      <button type="button" style={button} disabled={step === 0} onClick={() => setStep(v => v - 1)}>Previous</button>
      <button type="button" style={button} onClick={() => setStep(v => (v + 1) % stages.length)}>{step === stages.length - 1 ? 'Start again' : 'Next exchange'}</button>
    </div>
  </section>
}

function RealLifeNumbers({ module }: { module: StudioModule }) {
  const scenes = module.scenes ?? []
  const [index, setIndex] = useState(0)
  const scene = scenes[index]
  if (!scene) return null
  return <section style={panel} aria-label="Numbers in daily life">
    <div role="group" aria-label="Choose scenario" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {scenes.map((item, i) => <button key={i} type="button" aria-pressed={index === i} style={index === i ? activeButton : button} onClick={() => setIndex(i)}>{item.title}</button>)}
    </div>
    <div style={{ background: 'var(--vs-accent-soft, #e9f6ef)', borderRadius: 13, padding: 20, textAlign: 'center', margin: '14px 0' }}>
      <div>{scene.title}</div><div style={{ fontSize: 32, fontWeight: 800 }}>{scene.prefix ?? ''}{format(scene.number)}</div>
    </div>
    <p><strong>Question:</strong> {scene.question}</p><p><strong>Answer:</strong> {scene.answer}. {scene.explanation}</p>
  </section>
}

function PracticeGame({ module }: { module: StudioModule }) {
  const questions = (module.questions ?? []).filter((q): q is Question => typeof q !== 'string')
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [score, setScore] = useState(0)
  const q = questions[index]
  if (!questions.length) return null
  if (!q) return <section style={panel} aria-live="polite">
    <h3>Practice completed</h3><p>You answered {score} of {questions.length} correctly.</p>
    <button type="button" style={button} onClick={() => { setIndex(0); setAnswer(''); setRevealed(false); setScore(0) }}>Try again</button>
  </section>
  return <section style={panel}>
    <p style={subtle}>Question {index + 1} of {questions.length}</p>
    <h3>{q.prompt}</h3>
    <fieldset style={{ border: 0, padding: 0 }}>
      <legend style={subtle}>Choose one answer</legend>
      {q.choices.map(choice => <label key={choice} style={{ display: 'flex', gap: 9, alignItems: 'center', padding: 10, marginTop: 6, border: '1px solid var(--vs-border, #cbd5d1)', borderRadius: 10 }}>
        <input type="radio" name="place-value-practice" value={choice} checked={answer === choice} onChange={() => { setAnswer(choice); setRevealed(false) }} /> {choice}
      </label>)}
    </fieldset>
    {revealed && <div role="status" style={{ marginTop: 14, padding: 12, borderRadius: 10, background: 'var(--vs-accent-soft, #e9f6ef)' }}>
      <strong>{answer === q.answer ? 'Correct' : 'Review this answer'}</strong><p>{q.explanation}</p>
    </div>}
    <button type="button" style={{ ...button, marginTop: 14 }} disabled={!answer} onClick={() => {
      if (!revealed) { setRevealed(true); return }
      if (answer === q.answer) setScore(v => v + 1)
      setIndex(v => v + 1); setAnswer(''); setRevealed(false)
    }}>{revealed ? 'Next question' : 'Check answer'}</button>
  </section>
}

function LearnerWorksheet({ module }: { module: StudioModule }) {
  const questions = (module.questions ?? []).filter((q): q is string => typeof q === 'string')
  const [copied, setCopied] = useState(false)
  const printable = `Grade 4 Mathematics — Place Value and Total Value\nName: __________________\n\n${questions.map((q,i) => `${i + 1}. ${q}`).join('\n\n')}`
  return <section style={panel} aria-label="Learner worksheet">
    <h3>Independent practice</h3><p style={subtle}>Grade 4 Mathematics · Lesson 1</p>
    <ol style={{ lineHeight: 1.9, paddingLeft: 22 }}>{questions.map((q,i) => <li key={i}>{q}</li>)}</ol>
    <button type="button" style={button} onClick={() => {
      void navigator.clipboard.writeText(printable).then(() => setCopied(true)).catch(() => setCopied(false))
    }}>{copied ? 'Copied questions' : 'Copy questions'}</button>
    <p style={subtle}>Answers are not included in the learner worksheet.</p>
  </section>
}

function TeacherSlides({ module }: { module: StudioModule }) {
  const slides = module.slides ?? []
  const [index, setIndex] = useState(0)
  if (!slides.length) return null
  return <section style={panel} aria-label="Teacher lesson presentation">
    <p style={subtle}>Slide {index + 1} of {slides.length}</p>
    <div style={{ minHeight: 200, padding: 22, borderRadius: 12, background: 'var(--vs-accent-soft, #e9f6ef)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <h3 style={{ fontSize: 24 }}>{slides[index].title}</h3><p>{slides[index].body}</p>
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 16 }}>
      <button type="button" style={button} disabled={index === 0} onClick={() => setIndex(v => v - 1)}>Previous</button>
      <button type="button" style={button} disabled={index === slides.length - 1} onClick={() => setIndex(v => v + 1)}>Next slide</button>
    </div>
  </section>
}

/**
 * Presentation-only renderer for a certified VibeSchool resource payload.
 * Does not fetch unpublished candidates, write grades, or certify resources.
 */
export default function PlaceValueResourceStudio({ payload }: { payload: PlaceValueStudioPayload }) {
  const modules = useMemo(() => payload.modules.filter(m =>
    ['place-value-chart', 'digital-abacus', 'grouping-and-exchange', 'real-life-numbers', 'practice-game', 'learner-worksheet', 'teacher-presentation'].includes(m.id)), [payload.modules])
  const [selected, setSelected] = useState(modules[0]?.id ?? '')
  const item = modules.find(m => m.id === selected) ?? modules[0]
  if (!item) return <p>No supported resources are available in this pack.</p>
  return <div style={{ display: 'grid', gap: 14, color: 'var(--vs-text, #173a2b)' }}>
    <label htmlFor="place-value-resource-select" style={{ fontWeight: 750 }}>Choose a learning resource</label>
    <select id="place-value-resource-select" value={item.id} onChange={e => setSelected(e.target.value)} style={{ ...button, width: '100%', fontSize: 15 }}>
      {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
    </select>
    <p style={subtle}>{item.description}</p>
    {item.id === 'place-value-chart' && <PlaceValueChart module={item}/>}
    {item.id === 'digital-abacus' && <DigitalAbacus module={item}/>}
    {item.id === 'grouping-and-exchange' && <TenExchange/>}
    {item.id === 'real-life-numbers' && <RealLifeNumbers module={item}/>}
    {item.id === 'practice-game' && <PracticeGame module={item}/>}
    {item.id === 'learner-worksheet' && <LearnerWorksheet module={item}/>}
    {item.id === 'teacher-presentation' && <TeacherSlides module={item}/>}
  </div>
}
