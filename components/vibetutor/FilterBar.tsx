'use client'

import { useState } from 'react'
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
  priceRange: string; onPriceRange: (v: string) => void
  resultCount: number; noun: string; onClear: () => void; busy: boolean
}

const PRICE_OPTIONS = [
  { value: 'under500', label: 'Under KSh 500' },
  { value: '500to1000', label: 'KSh 500–1,000' },
  { value: '1000to2000', label: 'KSh 1,000–2,000' },
  { value: 'over2000', label: 'KSh 2,000+' },
]

export default function FilterBar(p: Props) {
  const [expanded, setExpanded] = useState(false)
  const active = !!(p.q || p.subject || p.level || p.area || p.mode || p.priceRange)
  const selectedCount = [p.subject, p.level, p.area, p.mode, p.priceRange].filter(Boolean).length
  const searched = p.q.trim().toLocaleLowerCase()
  const suggestions = searched
    ? [
        ...p.levels.map(item => ({ ...item, kind: 'level' as const })),
        ...p.subjects.map(item => ({ ...item, kind: 'subject' as const })),
        ...p.areas.map(item => ({ ...item, kind: 'area' as const })),
        ...p.modes.filter(item => item.count > 0).map(item => ({ ...item, kind: 'mode' as const })),
      ].filter(item => item.label.toLocaleLowerCase().includes(searched) ||
        searched.includes(item.label.toLocaleLowerCase())).slice(0, 5)
    : []
  const selectSuggestion = (kind: 'level' | 'subject' | 'area' | 'mode', value: string) => {
    if (kind === 'level') { p.onLevel(value); p.onSubject('') }
    else if (kind === 'subject') p.onSubject(value)
    else if (kind === 'area') p.onArea(value)
    else p.onMode(value as Mode)
    p.onQ('')
  }
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

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" className={styles.chip} aria-expanded={expanded} aria-controls="vibetutor-more-filters"
          onClick={() => setExpanded(value => !value)}>
          Filters{selectedCount ? ` (${selectedCount})` : ''}
        </button>
        {searched && !expanded && suggestions.map(item => (
          <button key={item.kind + item.value} type="button" className={styles.chip}
            onClick={() => selectSuggestion(item.kind, item.value)}>
            {item.label} <span className={styles.optionCount}>{item.count}</span>
          </button>
        ))}
      </div>
      <div id="vibetutor-more-filters" hidden={!expanded} style={{ display: expanded ? 'grid' : 'none', gap: 14 }}>
      <div className={styles.filterField}>
        <span className={styles.subLabel}>Level</span>
        <div className={styles.chipRow} role="group" aria-label="Level">
          <button type="button" className={`${styles.chip} ${p.level === '' ? styles.chipOn : ''}`} aria-pressed={p.level === ''} onClick={() => { p.onLevel(''); p.onSubject('') }}>All levels</button>
          {p.levels.map(item => <button key={item.value} type="button" className={`${styles.chip} ${p.level === item.value ? styles.chipOn : ''}`} aria-pressed={p.level === item.value} onClick={() => { p.onLevel(item.value); p.onSubject('') }}>{item.label} <span className={styles.optionCount}>{item.count}</span></button>)}
        </div>
      </div>

      <div className={styles.filterField}>
        <span className={styles.subLabel}>Location</span>
        <div className={styles.chipRow} role="group" aria-label="Location">
          <button type="button" className={`${styles.chip} ${p.area === '' ? styles.chipOn : ''}`} aria-pressed={p.area === ''} onClick={() => p.onArea('')}>All locations</button>
          {p.areas.map(item => <button key={item.value} type="button" className={`${styles.chip} ${p.area === item.value ? styles.chipOn : ''}`} aria-pressed={p.area === item.value} onClick={() => p.onArea(item.value)}>{item.label} <span className={styles.optionCount}>{item.count}</span></button>)}
        </div>
      </div>

      <div className={styles.filterField}>
        <span className={styles.subLabel}>Teaching mode</span>
        <div className={styles.chipRow} role="group" aria-label="Teaching mode">
          <button type="button" className={`${styles.chip} ${p.mode === '' ? styles.chipOn : ''}`} aria-pressed={p.mode === ''} onClick={() => p.onMode('')}>Any mode</button>
          {p.modes.map(item => <button key={item.value} type="button" className={`${styles.chip} ${p.mode === item.value ? styles.chipOn : ''}`} aria-pressed={p.mode === item.value} onClick={() => p.onMode(item.value as Mode)}>{item.label} <span className={styles.optionCount}>{item.count}</span></button>)}
        </div>
      </div>

      <div className={styles.filterField}>
        <span className={styles.subLabel}>Price per hour</span>
        <div className={styles.chipRow} role="group" aria-label="Price range">
          <button type="button" className={`${styles.chip} ${p.priceRange === '' ? styles.chipOn : ''}`} aria-pressed={p.priceRange === ''} onClick={() => p.onPriceRange('')}>Any price</button>
          {PRICE_OPTIONS.map(option => <button key={option.value} type="button" className={`${styles.chip} ${p.priceRange === option.value ? styles.chipOn : ''}`} aria-pressed={p.priceRange === option.value} onClick={() => p.onPriceRange(option.value)}>{option.label}</button>)}
        </div>
      </div>

      {p.level && <div className={styles.filterField}>
        <span className={styles.subLabel}>Subject</span>
        <div className={styles.chipRow} role="group" aria-label="Subject">
          <button type="button" className={`${styles.chip} ${p.subject === '' ? styles.chipOn : ''}`} aria-pressed={p.subject === ''} onClick={() => p.onSubject('')}>All subjects</button>
          {p.subjects.map(item => <button key={item.value} type="button" className={`${styles.chip} ${p.subject === item.value ? styles.chipOn : ''}`} aria-pressed={p.subject === item.value} onClick={() => p.onSubject(item.value)}>{item.label} <span className={styles.optionCount}>{item.count}</span></button>)}
        </div>
      </div>}

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
        {p.priceRange && <button type="button" className={styles.filterTag} onClick={() => p.onPriceRange('')}>{PRICE_OPTIONS.find(o => o.value === p.priceRange)?.label ?? p.priceRange} ×</button>}
      </div>}
      <div className={styles.progressTrack} aria-hidden="true">{p.busy && <div className={styles.progressBar} />}</div>
    </section>
  )
}
