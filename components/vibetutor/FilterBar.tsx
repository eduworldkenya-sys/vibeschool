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

      <div className={styles.filterSearchRow}>
        <label className={styles.searchWrap}>
          <Icon name="search" size={18} className={styles.searchIcon} />
          <input className={styles.search} type="search" value={p.q} onChange={e => p.onQ(e.target.value)} placeholder={p.placeholder} aria-label={p.placeholder} />
        </label>
        <button type="button" className={styles.compactFilterButton} aria-expanded={expanded}
          aria-controls="vibetutor-more-filters" onClick={() => setExpanded(value => !value)}>
          <Icon name="search" size={16} /> Filters{selectedCount ? ' (' + selectedCount + ')' : ''}
        </button>
      </div>
      {searched && !expanded && suggestions.length > 0 && (
        <div className={styles.filterSuggestions} aria-label="Suggested filters">
          {suggestions.map(item => (
            <button key={item.kind + item.value} type="button" className={styles.filterSuggestion}
              onClick={() => selectSuggestion(item.kind, item.value)}>
              {item.label} <span className={styles.optionCount}>{item.count}</span>
            </button>
          ))}
        </div>
      )}
      {expanded && <div id="vibetutor-more-filters" className={styles.filterSelectGrid}>
        <label className={styles.filterSelectField}>
          <span>Level</span>
          <select className={styles.select} value={p.level} onChange={e => { p.onLevel(e.target.value); p.onSubject('') }}>
            <option value="">Any level</option>
            {p.levels.map(item => <option key={item.value} value={item.value}>{item.label} ({item.count})</option>)}
            {p.level && !p.levels.some(item => item.value === p.level) && <option value={p.level}>{p.level}</option>}
          </select>
        </label>
        {p.level && <label className={styles.filterSelectField}>
          <span>Subject</span>
          <select className={styles.select} value={p.subject} onChange={e => p.onSubject(e.target.value)}>
            <option value="">Any subject</option>
            {p.subjects.map(item => <option key={item.value} value={item.value}>{item.label} ({item.count})</option>)}
            {p.subject && !p.subjects.some(item => item.value === p.subject) && <option value={p.subject}>{p.subject}</option>}
          </select>
        </label>}
        <label className={styles.filterSelectField}>
          <span>Location</span>
          <select className={styles.select} value={p.area} onChange={e => p.onArea(e.target.value)}>
            <option value="">Any location</option>
            {p.areas.map(item => <option key={item.value} value={item.value}>{item.label} ({item.count})</option>)}
            {p.area && !p.areas.some(item => item.value === p.area) && <option value={p.area}>{p.area}</option>}
          </select>
        </label>
        <label className={styles.filterSelectField}>
          <span>Teaching mode</span>
          <select className={styles.select} value={p.mode} onChange={e => p.onMode(e.target.value as Mode | '')}>
            <option value="">Online or in person</option>
            {p.modes.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className={styles.filterSelectField}>
          <span>{p.view === 'tutors' ? 'Hourly rate' : 'Hourly budget'}</span>
          <select className={styles.select} value={p.priceRange} onChange={e => p.onPriceRange(e.target.value)}>
            <option value="">Any price</option>
            {PRICE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <div className={styles.filterPanelActions}>
          <button type="button" className={styles.compactFilterButton} onClick={() => setExpanded(false)}>
            Show {p.resultCount} {p.noun}{p.resultCount === 1 ? '' : 's'}
          </button>
          {active && <button type="button" className={styles.clear} onClick={p.onClear}>Reset filters</button>}
        </div>
      </div>}
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
