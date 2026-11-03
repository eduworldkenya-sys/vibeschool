'use client'

import styles from './VibeTutor.module.css'
import Icon from './Icon'
import { modeLabel, type Mode } from './data'

export type FilterOption = { value: string; label: string; count: number }
type Props = {
  view: 'tutors' | 'students'; onView: (v: 'tutors' | 'students') => void
  q: string; onQ: (v: string) => void; placeholder: string
  subjects: FilterOption[]; subject: string; onSubject: (v: string) => void
  levels: FilterOption[]; level: string; onLevel: (v: string) => void
  areas: FilterOption[]; area: string; onArea: (v: string) => void
  modes: FilterOption[]; mode: Mode | ''; onMode: (v: Mode | '') => void
  resultCount: number; noun: string; onClear: () => void; busy: boolean
}
export default function FilterBar(p: Props) {
  const active = !!(p.q || p.subject || p.level || p.area || p.mode)
  return (
    <section className={styles.filterBar} aria-label="Search and filters">
      <div className={styles.segment} role="group" aria-label="I am looking for" style={{ justifySelf: 'start' }}>
        <button type="button" className={`${styles.segmentBtn} ${p.view === 'tutors' ? styles.segmentOn : ''}`} aria-pressed={p.view === 'tutors'} onClick={() => p.onView('tutors')}>Find a tutor</button>
        <button type="button" className={`${styles.segmentBtn} ${p.view === 'students' ? styles.segmentOn : ''}`} aria-pressed={p.view === 'students'} onClick={() => p.onView('students')}>Find learners</button>
      </div>
      <label className={styles.searchWrap}>
        <Icon name="search" size={18} className={styles.searchIcon} />
        <input className={styles.search} type="search" value={p.q} onChange={e => p.onQ(e.target.value)} placeholder={p.placeholder} aria-label={p.placeholder} />
      </label>

      <div className={styles.controls}>
        <label className={styles.filterField}>
          <span className={styles.subLabel}>Level</span>
          <select className={styles.select} value={p.level} onChange={e => p.onLevel(e.target.value)} aria-label="Choose level first">
            <option value="">All levels</option>
            {p.levels.map(item => <option key={item.value} value={item.value}>{item.label} ({item.count})</option>)}
          </select>
        </label>
        <label className={styles.filterField}>
          <span className={styles.subLabel}>Location</span>
          <select className={styles.select} value={p.area} onChange={e => p.onArea(e.target.value)} aria-label="Location">
            <option value="">All locations</option>
            {p.areas.map(item => <option key={item.value} value={item.value}>{item.label} ({item.count})</option>)}
          </select>
        </label>
        <div className={styles.filterField}>
          <span className={styles.subLabel}>Teaching mode</span>
          <div className={styles.segment} role="group" aria-label="Teaching format">
            <button type="button" className={`${styles.segmentBtn} ${p.mode === '' ? styles.segmentOn : ''}`} aria-pressed={p.mode === ''} onClick={() => p.onMode('')}>Any</button>
            {p.modes.map(item => <button key={item.value} type="button" className={`${styles.segmentBtn} ${p.mode === item.value ? styles.segmentOn : ''}`} aria-pressed={p.mode === item.value} onClick={() => p.onMode(item.value as Mode)}>{item.label} <span className={styles.optionCount}>{item.count}</span></button>)}
          </div>
        </div>
      </div>

      <div>
        <div className={styles.subjectHeading}>
          <p className={styles.subLabel}>Subject {p.level ? `· ${p.level}` : '· Choose a level to see relevant subjects'}</p>
          {p.level && <span className={styles.hint}>{p.subjects.reduce((sum, item) => sum + item.count, 0)} matching subject options</span>}
        </div>
        {p.level
          ? <div className={styles.chipRow} role="group" aria-label="Available subjects">
              <button type="button" className={`${styles.chip} ${p.subject === '' ? styles.chipOn : ''}`} aria-pressed={p.subject === ''} onClick={() => p.onSubject('')}>All subjects</button>
              {p.subjects.map(item => <button key={item.value} type="button" className={`${styles.chip} ${p.subject === item.value ? styles.chipOn : ''}`} aria-pressed={p.subject === item.value} onClick={() => p.onSubject(item.value)}>{item.label} <span className={styles.optionCount}>{item.count}</span></button>)}
            </div>
          : <p className={styles.hint}>Select a level first. Only matching subjects will then appear.</p>}
      </div>

      <div className={styles.summary} aria-live="polite">
        <span className={styles.count}>{p.busy ? 'Updating…' : `${p.resultCount} ${p.noun}${p.resultCount === 1 ? '' : 's'} found`}</span>
        {active && <button type="button" className={styles.clear} onClick={p.onClear}>Clear all filters</button>}
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
