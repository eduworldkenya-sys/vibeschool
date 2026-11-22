'use client'

import { useState } from 'react'
import styles from './PlaceValuePreview.module.css'

const presets = [
  { label: '24,907', value: '24907' },
  { label: '36,482', value: '36482' },
  { label: '40,506', value: '40506' },
  { label: '50,505', value: '50505' },
  { label: '30,742', value: '30742' },
  { label: '20,305', value: '20305' },
]
const placeNames = ['Ten-thousands', 'Thousands', 'Hundreds', 'Tens', 'Ones']
const weights = [10000, 1000, 100, 10, 1]
const shortNames = ['TTh', 'Th', 'H', 'T', 'O']

/** An original, read-only exploration. No account, persistence or assessment scores. */
export default function PlaceValuePreviewChart() {
  const [number, setNumber] = useState('24907')
  const [selected, setSelected] = useState(1)
  const digits = number.split('').map(Number)
  const expanded = digits.map((digit, i) => digit * weights[i]).filter(value => value !== 0)
  const totalValue = digits[selected] * weights[selected]

  return <section aria-labelledby="place-value-explore-title" className={styles.chart}>
    <div className={styles.chartHeader}>
      <h3 id="place-value-explore-title">Try the place-value chart</h3>
      <label htmlFor="place-value-preview-number">Choose a number</label>
      <select id="place-value-preview-number" value={number} onChange={event => { setNumber(event.target.value); setSelected(0) }}>
        {presets.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
    </div>
    <p>Tap a digit to discover its position and total value.</p>
    <div role="group" aria-label={Number(number).toLocaleString('en-KE') + ' place-value digits'} className={styles.digits}>
      {digits.map((digit, i) => <button type="button" key={i} aria-pressed={selected === i}
        aria-label={`Digit ${digit}, ${placeNames[i]}`} className={selected === i ? styles.digitSelected : styles.digit}
        onClick={() => setSelected(i)}>
        <span>{shortNames[i]}</span><strong>{digit}</strong>
      </button>)}
    </div>
    <div className={styles.answer} aria-live="polite" aria-atomic="true">
      <div><span>Selected digit</span><strong>{digits[selected]}</strong></div>
      <div><span>Place value</span><strong>{placeNames[selected]}</strong></div>
      <div><span>Total value</span><strong>{totalValue.toLocaleString('en-KE')}</strong></div>
    </div>
    <p className={styles.expanded}><strong>Expanded form:</strong> {expanded.map(v => v.toLocaleString('en-KE')).join(' + ')}</p>
  </section>
}
