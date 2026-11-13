'use client'

import { useState } from 'react'
import type { TeachingToolSpec } from '@/lib/learn/teachingToolCatalog'
import styles from './TeachingTools.module.css'

function safeText(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim().length > 0 && value.length < 200 ? value.trim() : fallback
}
function safeSequence(values: readonly string[] | undefined, fallback: string[]) {
  if (!Array.isArray(values) || values.length < 2 || values.length > 12 || !values.every(x => typeof x === 'string' && x.trim() && x.length < 80)) {
    return fallback
  }
  return [...values]
}

function Reorder({ values, instruction }: { values: string[]; instruction: string }) {
  const [picked, setPicked] = useState<number[]>([])
  const [checked, setChecked] = useState(false)
  const options = values.map((_, index) => index).reverse()
  const complete = picked.length === values.length
  const correct = complete && picked.every((index, i) => index === i)
  return <div className={styles.stack}>
    <p>{instruction}</p>
    <div className={styles.resultBox} role="status" aria-live="polite">
      {picked.length ? picked.map(index => values[index]).join(' → ') : 'Choose an item to start.'}
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
  const word = safeText(spec.word, 'planet').replace(/[^\p{L}]/gu, '').slice(0, 12)
  const letters = Array.from(word || 'planet')
  const [chosen, setChosen] = useState<number[]>([])
  const [checked, setChecked] = useState(false)
  const order = letters.map((_, i) => i).reverse()
  const answer = chosen.map(i => letters[i]).join('')
  return <div className={styles.stack}>
    <p>Build this word: <strong>{word || 'planet'}</strong></p>
    <div className={styles.resultBox} aria-live="polite">{answer || 'Choose a letter to start.'}</div>
    <div className={styles.tokenRow}>{order.filter(index => !chosen.includes(index)).map(index =>
      <button type="button" className={styles.token} key={index} onClick={() => { setChosen(old => [...old, index]); setChecked(false) }}>{letters[index]}</button>)}</div>
    <div className={styles.actions}>
      <button type="button" disabled={chosen.length !== letters.length} onClick={() => setChecked(true)}>Check word</button>
      <button type="button" className={styles.secondary} onClick={() => { setChosen([]); setChecked(false) }}>Start again</button>
      {chosen.length > 0 && !checked && <button type="button" className={styles.secondary} onClick={() => setChosen(old => old.slice(0, -1))}>Undo</button>}
    </div>
    {checked && <p role="status" className={styles.explain}>{answer.toLocaleLowerCase() === word.toLocaleLowerCase() ? 'Correct spelling.' : 'Try another letter order.'}</p>}
  </div>
}

function SentenceOrder({ spec }: { spec: TeachingToolSpec }) {
  const sentence = safeText(spec.sentence, 'Plants need sunlight to grow.')
  return <Reorder key={sentence} values={safeSequence(sentence.split(/\s+/), ['Plants', 'need', 'sunlight', 'to', 'grow.'])} instruction="Put the words into a sentence." />
}

const defaultPairs = [
  { term: 'Observe', definition: 'To look carefully and notice details' },
  { term: 'Predict', definition: 'To say what you think may happen' },
  { term: 'Compare', definition: 'To notice what is alike or different' },
]

function VocabularyMatch({ spec }: { spec: TeachingToolSpec }) {
  const pairs = Array.isArray(spec.pairs) && spec.pairs.length >= 2 && spec.pairs.length <= 8
    && spec.pairs.every(p => p && safeText(p.term, '') && safeText(p.definition, ''))
      ? spec.pairs : defaultPairs
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [checked, setChecked] = useState(false)
  return <div className={styles.stack}>
    {pairs.map((item, i) => <label key={i} className={styles.promptLine}>
      <span>{item.definition}</span>
      <select aria-label={`Match meaning ${i + 1}`} value={answers[i] ?? ''} onChange={e => { setAnswers(old => ({ ...old, [i]: e.target.value })); setChecked(false) }}>
        <option value="">Choose a word</option>
        {pairs.map((other, j) => <option key={j} value={String(j)}>{other.term}</option>)}
      </select>
    </label>)}
    <div className={styles.actions}>
      <button type="button" disabled={pairs.some((_, i) => answers[i] === undefined || answers[i] === '')} onClick={() => setChecked(true)}>Check matches</button>
      <button type="button" className={styles.secondary} onClick={() => { setAnswers({}); setChecked(false) }}>Reset</button>
    </div>
    {checked && <p role="status" className={styles.explain}>{pairs.filter((_, i) => answers[i] === String(i)).length} of {pairs.length} matches correct. {pairs.every((_, i) => answers[i] === String(i)) ? 'All matched.' : 'Change a match and check again.'}</p>}
  </div>
}

const defaultGroups = ['Living things', 'Non-living things']
const defaultItems = [
  { label: 'Butterfly', group: 'Living things' },
  { label: 'Stone', group: 'Non-living things' },
  { label: 'Grass', group: 'Living things' },
  { label: 'Glass cup', group: 'Non-living things' },
]
const variableGroups = ['Changed (independent)', 'Measured (dependent)', 'Kept the same (controlled)']
const variableItems = [
  { label: 'Hours of sunlight', group: 'Changed (independent)' },
  { label: 'Height of the plant', group: 'Measured (dependent)' },
  { label: 'Type of soil', group: 'Kept the same (controlled)' },
  { label: 'Amount of water', group: 'Kept the same (controlled)' },
]

function Classification({ spec, variables = false }: { spec: TeachingToolSpec; variables?: boolean }) {
  const candidateGroups = variables ? variableGroups : spec.groups
  const groups = safeSequence(candidateGroups, variables ? variableGroups : defaultGroups)
  const items = !variables && Array.isArray(spec.items) && spec.items.length >= 2 && spec.items.length <= 12
    && spec.items.every(item => item && typeof item.label === 'string' && item.label.length < 80 && groups.includes(item.group))
      ? spec.items : variables ? variableItems : defaultItems
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [checked, setChecked] = useState(false)
  return <div className={styles.stack}>
    {variables && <p>Plan a fair plant-growth test. Change one factor, measure the outcome and keep the other conditions the same.</p>}
    {items.map((item, i) => <label className={styles.promptLine} key={i}>
      <strong>{item.label}</strong>
      <select aria-label={`Classify ${item.label}`} value={answers[i] ?? ''} onChange={e => { setAnswers(old => ({ ...old, [i]: e.target.value })); setChecked(false) }}>
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
  const sequence = safeSequence(spec.sequence, ['Grass', 'Grasshopper', 'Frog', 'Snake'])
  return <Reorder key={sequence.join('|')} values={sequence} instruction="Build a food chain. Start with the producer and follow where the energy goes." />
}

export default function LanguageScienceTeachingTool({ spec }: { spec: TeachingToolSpec }) {
  switch (spec.id) {
    case 'word-builder': return <WordBuilder spec={spec} />
    case 'sentence-order': return <SentenceOrder spec={spec} />
    case 'vocabulary-match': return <VocabularyMatch spec={spec} />
    case 'classification': return <Classification spec={spec} />
    case 'experiment-variables': return <Classification spec={spec} variables />
    case 'food-chain': return <FoodChain spec={spec} />
    default: return null
  }
}
