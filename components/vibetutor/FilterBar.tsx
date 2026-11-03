'use client'

import styles from './VibeTutor.module.css'
import Icon from './Icon'
import { modeLabel, type Mode } from './data'

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
  busy: boolean
}

const MODE_OPTIONS: { value: Mode | ''; label: string }[] = [
  { value: '', label: 'Any' },
  { value: 'online', label: 'Online' },
  { value: 'physical', label: 'In person' },
]

export default function FilterBar(p: Props) {
  const active = !!(p.q || p.subject || p.level || p.area || p.mode)

  return (
    <section className={styles.filterBar} aria-label="Filters">
      <label className={styles.searchWrap}>
        <Icon name="search" size={18} className={styles.searchIcon} />
        <input
          className={styles.search}
          type="search"
          value={p.q}
          onChange={e => p.onQ(e.target.value)}
          placeholder={p.placeholder}
          aria-label={p.placeholder}
        />
      </label>

      <div className={styles.chipRow} role="group" aria-label="Subject">
        <button type="button" className={`${styles.chip} ${p.subject === '' ? styles.chipOn : ''}`} aria-pressed={p.subject === ''} onClick={() => p.onSubject('')}>All subjects</button>
        {p.subjects.map(s => (
          <button key={s} type="button" className={`${styles.chip} ${p.subject === s ? styles.chipOn : ''}`} aria-pressed={p.subject === s} onClick={() => p.onSubject(s)}>{s}</button>
        ))}
      </div>

      <div className={styles.controls}>
        <div className={styles.segment} role="group" aria-label="Mode">
          {MODE_OPTIONS.map(m => (
            <button key={m.label} type="button" className={`${styles.segmentBtn} ${p.mode === m.value ? styles.segmentOn : ''}`} aria-pressed={p.mode === m.value} onClick={() => p.onMode(m.value)}>{m.label}</button>
          ))}
        </div>
        <select className={styles.select} value={p.level} onChange={e => p.onLevel(e.target.value)} aria-label="Level">
          <option value="">All levels</option>
          {p.levels.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className={styles.select} value={p.area} onChange={e => p.onArea(e.target.value)} aria-label="Area">
          <option value="">All areas</option>
          {p.areas.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div className={styles.summary} aria-live="polite">
        <span className={styles.count}>{p.busy ? 'Updating…' : `${p.resultCount} ${p.noun}${p.resultCount === 1 ? '' : 's'}`}</span>
        {active && <button type="button" className={styles.clear} onClick={p.onClear}>Clear all</button>}
      </div>

      {active && (
        <div className={styles.tagRow} aria-label="Active filters">
          {p.q && <button type="button" className={styles.filterTag} onClick={() => p.onQ('')}>“{p.q}” <span aria-hidden="true">×</span><span className={styles.sr}>Remove search</span></button>}
          {p.subject && <button type="button" className={styles.filterTag} onClick={() => p.onSubject('')}>{p.subject} <span aria-hidden="true">×</span><span className={styles.sr}>Remove subject</span></button>}
          {p.level && <button type="button" className={styles.filterTag} onClick={() => p.onLevel('')}>{p.level} <span aria-hidden="true">×</span><span className={styles.sr}>Remove level</span></button>}
          {p.area && <button type="button" className={styles.filterTag} onClick={() => p.onArea('')}>{p.area} <span aria-hidden="true">×</span><span className={styles.sr}>Remove area</span></button>}
          {p.mode && <button type="button" className={styles.filterTag} onClick={() => p.onMode('')}>{modeLabel(p.mode)} <span aria-hidden="true">×</span><span className={styles.sr}>Remove mode</span></button>}
        </div>
      )}

      <div className={styles.progressTrack} aria-hidden="true">
        {p.busy && <div className={styles.progressBar} />}
      </div>
    </section>
  )
}
