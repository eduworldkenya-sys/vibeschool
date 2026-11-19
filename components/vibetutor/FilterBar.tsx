'use client'

import styles from './VibeTutor.module.css'
import Icon from './Icon'
import { type Mode } from './data'

export type FilterOption = { value: string; label: string; count: number }
type Sort = 'discover' | 'alphabetical' | 'recent'
type Props = {
  view: 'tutors' | 'students'; onView: (v: 'tutors' | 'students') => void
  q: string; onQ: (v: string) => void; placeholder: string
  subjects: FilterOption[]; subject: string; onSubject: (v: string) => void
  levels: FilterOption[]; level: string; onLevel: (v: string) => void
  areas: FilterOption[]; area: string; onArea: (v: string) => void
  modes: FilterOption[]; mode: Mode | ''; onMode: (v: Mode | '') => void
  priceRange: string; onPriceRange: (v: string) => void
  resultCount: number; noun: string; onClear: () => void; busy: boolean
  day?: string; days?: readonly string[]; onDay?: (v: string) => void
  sort?: Sort; onSort?: (v: Sort) => void; personalized?: boolean
}
const PRICE_OPTIONS = [
  { value: 'under500', label: 'Under KSh 500' },
  { value: '500to1000', label: 'KSh 500–1,000' },
  { value: '1000to2000', label: 'KSh 1,000–2,000' },
  { value: 'over2000', label: 'KSh 2,000+' },
]
type Choice = { value: string; label: string; count?: number }
function FilterChip({ label, value, options, onChange }: {label: string; value: string; options: readonly Choice[]; onChange: (v: string) => void}) {
  return <select aria-label={label} className={`${styles.discoveryChip} ${value ? styles.discoveryChipActive : ''}`} value={value} onChange={e => onChange(e.target.value)}>
    <option value="">{label}</option>
    {options.map(item => <option key={item.value} value={item.value}>{item.label}{item.count ? ' (' + item.count + ')' : ''}</option>)}
    {value && !options.some(item => item.value === value) && <option value={value}>{value}</option>}
  </select>
}
export default function FilterBar(p: Props) {
  const active = !!(p.q || p.subject || p.level || p.area || p.mode || p.priceRange || p.day)
  return <section className={styles.discoveryControls} aria-label="Search and filters">
    <div className={styles.segment} role="group" aria-label="I am looking for">
      <button type="button" className={`${styles.segmentBtn} ${p.view === 'tutors' ? styles.segmentOn : ''}`} aria-pressed={p.view === 'tutors'} onClick={() => p.onView('tutors')}>Find tutors</button>
      <button type="button" className={`${styles.segmentBtn} ${p.view === 'students' ? styles.segmentOn : ''}`} aria-pressed={p.view === 'students'} onClick={() => p.onView('students')}>Find learners</button>
    </div>
    <label className={styles.searchWrap}>
      <Icon name="search" size={18} className={styles.searchIcon} />
      <input className={styles.search} type="search" value={p.q} onChange={e => p.onQ(e.target.value)} placeholder={p.placeholder} aria-label={p.placeholder}/>
    </label>
    <div className={styles.discoveryRail} aria-label="Instant filters">
      <FilterChip label="Subject" value={p.subject} options={p.subjects} onChange={p.onSubject}/>
      <FilterChip label="Level" value={p.level} options={p.levels} onChange={p.onLevel}/>
      <FilterChip label="Location" value={p.area} options={p.areas} onChange={p.onArea}/>
      <FilterChip label="Mode" value={p.mode} options={p.modes} onChange={v => p.onMode(v as Mode | '')}/>
      <FilterChip label={p.view === 'tutors' ? 'Price' : 'Budget'} value={p.priceRange} options={PRICE_OPTIONS} onChange={p.onPriceRange}/>
      {p.onDay && <FilterChip label="Any day" value={p.day || ''} options={(p.days || []).map(value => ({value,label:value}))} onChange={p.onDay}/>}
    </div>
    <div className={styles.discoverySummary}>
      <div aria-live="polite">
        <strong>{p.personalized && (!p.sort || p.sort === 'discover') ? 'Recommended for you' : p.view === 'tutors' ? 'Tutors' : 'Learner requests'}</strong>
        <span className={styles.discoveryResultCount}> · {p.busy ? 'Loading…' : p.resultCount}</span>
      </div>
      <div className={styles.discoveryActions}>
        {active && <button type="button" className={styles.clear} onClick={p.onClear}>Clear</button>}
        {p.onSort && <select className={styles.discoverySort} aria-label="Sort results" value={p.sort || 'discover'} onChange={e => p.onSort?.(e.target.value as Sort)}>
          <option value="discover">{p.personalized ? 'Best match' : 'Discover'}</option>
          {p.view === 'tutors' ? <option value="alphabetical">Name A–Z</option> : <option value="recent">Recent</option>}
        </select>}
      </div>
    </div>
  </section>
}
