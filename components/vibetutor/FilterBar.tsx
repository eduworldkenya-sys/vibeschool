'use client'

import styles from './VibeTutor.module.css'
import Icon from './Icon'
import { modeLabel, type Mode } from './data'

type Props = {
  view: 'tutors' | 'students'; onView: (v: 'tutors' | 'students') => void
  q: string; onQ: (v: string) => void; placeholder: string
  subjects: string[]; subject: string; onSubject: (v: string) => void
  levels: string[]; level: string; onLevel: (v: string) => void
  areas: string[]; area: string; onArea: (v: string) => void
  mode: Mode | ''; onMode: (v: Mode | '') => void
  resultCount: number; noun: string; onClear: () => void; busy: boolean
}
const MODE_OPTIONS: { value: Mode | ''; label: string }[] = [
  { value: '', label: 'Any' }, { value: 'online', label: 'Online' }, { value: 'physical', label: 'In person' },
]
export default function FilterBar(p: Props) {
  const active = !!(p.q || p.subject || p.level || p.area || p.mode)
  return (
    <section className={styles.filterBar} aria-label="Filters">
      <div className={styles.segment} role="group" aria-label="I am looking for" style={{ justifySelf: 'start' }}>
        <button type="button" className={`${styles.segmentBtn} ${p.view === 'tutors' ? styles.segmentOn : ''}`} aria-pressed={p.view === 'tutors'} onClick={() => p.onView('tutors')}>Find a tutor</button>
        <button type="button" className={`${styles.segmentBtn} ${p.view === 'students' ? styles.segmentOn : ''}`} aria-pressed={p.view === 'students'} onClick={() => p.onView('students')}>Find learners</button>
      </div>
      <label className={styles.searchWrap}>
        <Icon name="search" size={18} className={styles.searchIcon} />
        <input className={styles.search} type="search" value={p.q} onChange={e => p.onQ(e.target.value)} placeholder={p.placeholder} aria-label={p.placeholder} />
      </label>
      <div className={styles.controls}>
        <select className={styles.select} value={p.level} onChange={e => { p.onLevel(e.target.value); p.onSubject('') }} aria-label="Choose level first">
          <option value="">Choose level</option>
          {p.levels.map(item => <option key={item}>{item}</option>)}
        </select>
        <select className={styles.select} value={p.area} onChange={e => p.onArea(e.target.value)} aria-label="Area">
          <option value="">All areas</option>
          {p.areas.map(item => <option key={item}>{item}</option>)}
        </select>
        <div className={styles.segment} role="group" aria-label="Teaching format">
          {MODE_OPTIONS.map(item => <button key={item.label} type="button" className={`${styles.segmentBtn} ${p.mode === item.value ? styles.segmentOn : ''}`} aria-pressed={p.mode === item.value} onClick={() => p.onMode(item.value)}>{item.label}</button>)}
        </div>
      </div>
      <div>
        <p className={styles.subLabel}>Subjects {p.level ? `for ${p.level}` : ''}</p>
        {p.level
          ? <div className={styles.chipRow} role="group" aria-label="Subjects">
              <button type="button" className={`${styles.chip} ${p.subject === '' ? styles.chipOn : ''}`} aria-pressed={p.subject === ''} onClick={() => p.onSubject('')}>All</button>
              {p.subjects.map(item => <button key={item} type="button" className={`${styles.chip} ${p.subject === item ? styles.chipOn : ''}`} aria-pressed={p.subject === item} onClick={() => p.onSubject(item)}>{item}</button>)}
            </div>
          : <p className={styles.hint}>Choose a level to see its subjects.</p>}
      </div>
      <div className={styles.summary} aria-live="polite">
        <span className={styles.count}>{p.busy ? 'Updating…' : `${p.resultCount} ${p.noun}${p.resultCount === 1 ? '' : 's'}`}</span>
        {active && <button type="button" className={styles.clear} onClick={p.onClear}>Clear all</button>}
      </div>
      {active && <div className={styles.tagRow} aria-label="Active filters">
        {p.q && <button type="button" className={styles.filterTag} onClick={() => p.onQ('')}>“{p.q}” ×</button>}
        {p.level && <button type="button" className={styles.filterTag} onClick={() => { p.onLevel(''); p.onSubject('') }}>{p.level} ×</button>}
        {p.subject && <button type="button" className={styles.filterTag} onClick={() => p.onSubject('')}>{p.subject} ×</button>}
        {p.area && <button type="button" className={styles.filterTag} onClick={() => p.onArea('')}>{p.area} ×</button>}
        {p.mode && <button type="button" className={styles.filterTag} onClick={() => p.onMode('')}>{modeLabel(p.mode)} ×</button>}
      </div>}
      <div className={styles.progressTrack} aria-hidden="true">{p.busy && <div className={styles.progressBar} />}</div>
    </section>
  )
}
