'use client'

import { useState } from 'react'
import type { TeachingToolSpec } from '@/lib/learn/teachingToolCatalog'
import styles from './TeachingTools.module.css'

function Reorder({ values, instruction, separator = ' → ' }: { values: string[]; instruction: string; separator?: string }) {
  const [picked, setPicked] = useState<number[]>([])
  const [checked, setChecked] = useState(false)
  const options = values.map((_, index) => index).reverse()
  const complete = picked.length === values.length
  const correct = complete && picked.every((index, i) => values[index] === values[i])
  return <div className={styles.stack}>
    <p>{instruction}</p>
    <div className={styles.resultBox} role="status" aria-live="polite">
      {picked.length ? picked.map(index => values[index]).join(separator) : 'Choose an item to start.'}
    </div>
    <div className={styles.tokenRow}>
      {options.filter(index => !picked.includes(index)).map(index =>
        <button type="button" className={styles.token} key={index} onClick={() => { setPicked(previous => [...previous, index]); setChecked(false) }}>{values[index]}</button>)}
    </div>
    <div className={styles.actions}>
      <button type="button" onClick={() => setChecked(true)} disabled={!complete}>Check order</button>
      <button type="button" className={styles.secondary} onClick={() => { setPicked([]); setChecked(false) }}>Try again</button>
      {picked.length > 0 && !checked && <button type="button" className={styles.secondary} onClick={() => setPicked(previous => previous.slice(0, -1))}>Undo last</button>}
    </div>
    {checked && <p role="status" className={styles.explain}>{correct ? 'Correct order. Well done.' : 'Not quite. Change the order and try again.'}</p>}
  </div>
}

function WordBuilder({ spec }: { spec: TeachingToolSpec }) {
  const word = spec.word ?? ''
  const letters = Array.from(word)
  const [chosen, setChosen] = useState<number[]>([])
  const [checked, setChecked] = useState(false)
  const order = letters.map((_, i) => i).reverse()
  const answer = chosen.map(i => letters[i]).join('')
  return <div className={styles.stack}>
    <p>Use the letters to build the word. Read the clue above, then check your spelling.</p>
    <div className={styles.resultBox} aria-live="polite">{answer || 'Choose a letter to start.'}</div>
    <div className={styles.tokenRow}>{order.filter(index => !chosen.includes(index)).map(index =>
      <button type="button" className={styles.token} aria-label={'Add letter '+letters[index]} key={index}
        onClick={() => { setChosen(old => [...old, index]); setChecked(false) }}>{letters[index]}</button>)}</div>
    <div className={styles.actions}>
      <button type="button" disabled={chosen.length !== letters.length} onClick={() => setChecked(true)}>Check word</button>
      <button type="button" className={styles.secondary} onClick={() => { setChosen([]); setChecked(false) }}>Start again</button>
      {chosen.length > 0 && !checked && <button type="button" className={styles.secondary}
        onClick={() => setChosen(old => old.slice(0, -1))}>Undo</button>}
    </div>
    {checked && <p role="status" className={styles.explain}>
      {answer.toLocaleLowerCase() === word.toLocaleLowerCase() ? 'Correct spelling.' : 'Try another letter order.'}</p>}
  </div>
}

function SentenceOrder({ spec }: { spec: TeachingToolSpec }) {
  const sentence = spec.sentence ?? ''
  return <Reorder key={sentence} values={sentence.trim().split(/\s+/)}
    instruction="Put the words into a sentence." separator=" " />
}

function VocabularyMatch({ spec }: { spec: TeachingToolSpec }) {
  const pairs=spec.pairs ?? []
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [checked, setChecked] = useState(false)
  return <div className={styles.stack}>
    {pairs.map((item, i) => <label key={i} className={styles.promptLine}>
      <span>{item.definition}</span>
      <select aria-label={'Match meaning '+(i+1)} value={answers[i] ?? ''} onChange={e => {
        setAnswers(old => ({ ...old, [i]: e.target.value })); setChecked(false)
      }}>
        <option value="">Choose a word</option>
        {pairs.map((other, j) => <option key={j} value={String(j)}>{other.term}</option>)}
      </select>
    </label>)}
    <div className={styles.actions}>
      <button type="button" disabled={pairs.some((_, i) => !answers[i])} onClick={() => setChecked(true)}>Check matches</button>
      <button type="button" className={styles.secondary} onClick={() => { setAnswers({}); setChecked(false) }}>Reset</button>
    </div>
    {checked && <p role="status" className={styles.explain}>{pairs.filter((_, i) => answers[i] === String(i)).length} of {pairs.length} matches correct. {pairs.every((_, i) => answers[i] === String(i)) ? 'All matched.' : 'Change a match and check again.'}</p>}
  </div>
}

const variableGroups = ['Changed (independent)', 'Measured (dependent)', 'Kept the same (controlled)']

function Classification({ spec, variables = false }: { spec: TeachingToolSpec; variables?: boolean }) {
  const groups = variables ? variableGroups : spec.groups ?? []
  const items = spec.items ?? []
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [checked, setChecked] = useState(false)
  return <div className={styles.stack}>
    {variables && <p>In a fair test, change one factor, measure the outcome and keep other conditions constant.</p>}
    {items.map((item, i) => <label className={styles.promptLine} key={i}>
      <strong>{item.label}</strong>
      <select aria-label={'Classify '+item.label} value={answers[i] ?? ''} onChange={e => {
        setAnswers(old => ({ ...old, [i]: e.target.value })); setChecked(false)
      }}>
        <option value="">Choose a group</option>
        {groups.map(group => <option value={group} key={group}>{group}</option>)}
      </select>
    </label>)}
    <div className={styles.actions}>
      <button type="button" disabled={items.some((_, i) => !answers[i])} onClick={() => setChecked(true)}>Check groups</button>
      <button type="button" className={styles.secondary} onClick={() => { setAnswers({}); setChecked(false) }}>Reset</button>
    </div>
    {checked && <p role="status" className={styles.explain}>{items.filter((item, i) => answers[i] === item.group).length} of {items.length} correctly grouped. {items.every((item, i) => answers[i] === item.group) ? 'All correct.' : 'Review the groups and try again.'}</p>}
  </div>
}

function FoodChain({ spec }: { spec: TeachingToolSpec }) {
  const sequence = [...(spec.sequence ?? [])]
  return <Reorder key={sequence.join('|')} values={sequence}
    instruction="Build a food chain. Start with the producer and follow where the energy goes." />
}

function ReadingComprehension({ spec }: { spec: TeachingToolSpec }) {
  const [revealed, setRevealed] = useState(false)
  return <div className={styles.stack}>
    <div className={styles.reading} aria-label="Reading passage">{spec.passage}</div>
    <p><strong>Think:</strong> {spec.question}</p>
    <p>Write or say your response before reading the example answer.</p>
    <button type="button" aria-expanded={revealed} onClick={() => setRevealed(v => !v)}>
      {revealed ? 'Hide example response' : 'Compare with an example response'}
    </button>
    {revealed && <p role="status" className={styles.explain}><strong>Example response:</strong> {spec.sampleAnswer}</p>}
  </div>
}

function WritingPlanner({ spec }: { spec: TeachingToolSpec }) {
  const [start, setStart] = useState(''), [middle, setMiddle] = useState(''), [end, setEnd] = useState('')
  return <div className={styles.stack}>
    <p>Plan your writing: {spec.prompt}</p>
    <label>Beginning <textarea rows={3} value={start} onChange={e=>setStart(e.target.value)} placeholder="Introduce the idea." /></label>
    <label>Middle <textarea rows={3} value={middle} onChange={e=>setMiddle(e.target.value)} placeholder="Explain or describe it." /></label>
    <label>Ending <textarea rows={3} value={end} onChange={e=>setEnd(e.target.value)} placeholder="Conclude clearly." /></label>
    <p className={styles.explain}>Your writing stays on this page and is not submitted or marked.</p>
    <button type="button" className={styles.secondary} onClick={()=>{setStart('');setMiddle('');setEnd('')}}>Clear plan</button>
  </div>
}

export default function LanguageScienceTeachingTool({ spec }: { spec: TeachingToolSpec }) {
  switch (spec.id) {
    case 'word-builder': return <WordBuilder spec={spec} />
    case 'sentence-order': return <SentenceOrder spec={spec} />
    case 'vocabulary-match': return <VocabularyMatch spec={spec} />
    case 'reading-comprehension': return <ReadingComprehension spec={spec} />
    case 'writing-planner': return <WritingPlanner spec={spec} />
    case 'classification': return <Classification spec={spec} />
    case 'sorting-groups': return <Classification spec={spec} />
    case 'experiment-variables': return <Classification spec={spec} variables />
    case 'food-chain': return <FoodChain spec={spec} />
    default: return null
  }
}
