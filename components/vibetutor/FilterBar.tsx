'use client'

import styles from './VibeTutor.module.css'
import type { Mode } from './data'

type Props = {
  q: string
  onQ: (v: string) => void
  placeholder: string
  subjects: string[]
  subject: string
  onSubject: (v: string) => void
  levels: string[]
  level: string
  onLevel: (v: string) => void
  areas: string[]
  area: string
  onArea: (v: string) => void
  mode: Mode | ''
  onMode: (v: Mode | '') => void
  resultCount: number
  noun: string
  onClear: () => void
}

const MODES: { value: Mode | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'online', label: 'Online' },
  { value: 'physical', label: 'In person' },
]

export default function FilterBar(p: Props) {
  const active = !!(p.q || p.subject || p.level || p.area || p.mode)

  return (
    <section className={styles.bar} aria-label="Filters">
      <input
        className={styles.search}
        type="search"
        value={p.q}
        onChange={e => p.onQ(e.target.value)}
        placeholder={p.placeholder}
        aria-label={p.placeholder}
      />

      <div className={styles.chipRow} role="group" aria-label="Subject">
        <button type="button" className={`${styles.chip} ${p.subject === '' ? styles.chipOn : ''}`} aria-pressed={p.subject === ''} onClick={() => p.onSubject('')}>All subjects</button>
        {p.subjects.map(s => (
          <button key={s} type="button" className={`${styles.chip} ${p.subject === s ? styles.chipOn : ''}`} aria-pressed={p.subject === s} onClick={() => p.onSubject(s)}>{s}</button>
        ))}
      </div>

      <div className={styles.controls}>
        <div className={styles.segment} role="group" aria-label="Mode">
          {MODES.map(m => (
            <button key={m.label} type="button" className={`${styles.segmentBtn} ${p.mode === m.value ? styles.segmentOn : ''}`} aria-pressed={p.mode === m.value} onClick={() => p.onMode(m.value)}>{m.label}</button>
          ))}
        </div>
        <select className={styles.dropdown} value={p.level} onChange={e => p.onLevel(e.target.value)} aria-label="Level">
          <option value="">All levels</option>
          {p.levels.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className={styles.dropdown} value={p.area} onChange={e => p.onArea(e.target.value)} aria-label="Area">
          <option value="">All areas</option>
          {p.areas.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div className={styles.summary} aria-live="polite">
        <span>{p.resultCount} {p.noun}{p.resultCount === 1 ? '' : 's'}</span>
        {active && <button type="button" className={styles.clear} onClick={p.onClear}>Clear filters</button>}
      </div>
    </section>
  )
}
