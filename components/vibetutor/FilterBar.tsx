'use client'

import { useEffect, useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
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
export default function FilterBar(p: Props) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [counties, setCounties] = useState<string[]>([])
  const [subCounties, setSubCounties] = useState<string[]>([])
  const [wards, setWards] = useState<string[]>([])
  const [county, setCounty] = useState(p.area)
  const [subCounty, setSubCounty] = useState('')
  const [ward, setWard] = useState('')
  const [locationLoading, setLocationLoading] = useState(false)

  useEffect(() => {
    let active = true
    getSupabaseClient().rpc('schools_location_options_public_v1', { p_county: null, p_sub_county: null }).then(({ data, error }) => {
      if (!active || error) return
      const options = (data ?? []) as { option_type: string; value: string }[]
      setCounties(Array.from(new Set(options.filter(item => item.option_type === 'county').map(item => item.value))).sort())
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    if (!county) { setSubCounties([]); return }
    setLocationLoading(true)
    getSupabaseClient().rpc('schools_location_options_public_v1', { p_county: county, p_sub_county: null }).then(({ data, error }) => {
      if (!active) return
      const options = (data ?? []) as { option_type: string; value: string }[]
      setSubCounties(error ? [] : Array.from(new Set(options.filter(item => item.option_type === 'sub_county').map(item => item.value))).sort())
      setLocationLoading(false)
    })
    return () => { active = false }
  }, [county])

  useEffect(() => {
    let active = true
    if (!county || !subCounty) { setWards([]); return }
    setLocationLoading(true)
    getSupabaseClient().rpc('schools_location_options_public_v1', { p_county: county, p_sub_county: subCounty }).then(({ data, error }) => {
      if (!active) return
      const options = (data ?? []) as { option_type: string; value: string }[]
      setWards(error ? [] : Array.from(new Set(options.filter(item => item.option_type === 'ward').map(item => item.value))).sort())
      setLocationLoading(false)
    })
    return () => { active = false }
  }, [county, subCounty])

  const chooseCounty = (value: string) => {
    setCounty(value); setSubCounty(''); setWard(''); p.onArea(value)
  }
  useEffect(() => {
    setCounty(p.area)
    if (!p.area) { setSubCounty(''); setWard('') }
  }, [p.area])

  const active = !!(p.q || p.subject || p.level || p.area || p.mode || p.priceRange)
  const secondaryCount = Number(!!p.area) + Number(!!p.priceRange)
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
      <label className={styles.filterField}>
        <span className={styles.subLabel}>Class / level</span>
        <select className={styles.select} value={p.level} onChange={e => p.onLevel(e.target.value)} aria-label="Choose class or level">
          <option value="">All levels</option>
          {p.levels.map(item => <option key={item.value} value={item.value}>{item.label} ({item.count})</option>)}
        </select>
      </label>
      {p.level && <div>
        <div className={styles.subjectHeading}>
          <p className={styles.subLabel}>Subject · {p.level}</p>
          <span className={styles.hint}>{p.subjects.reduce((sum, item) => sum + item.count, 0)} matching subject options</span>
        </div>
        <div className={styles.chipRow} role="group" aria-label="Available subjects">
          <button type="button" className={`${styles.chip} ${p.subject === '' ? styles.chipOn : ''}`} aria-pressed={p.subject === ''} onClick={() => p.onSubject('')}>All subjects</button>
          {p.subjects.map(item => <button key={item.value} type="button" className={`${styles.chip} ${p.subject === item.value ? styles.chipOn : ''}`} aria-pressed={p.subject === item.value} onClick={() => p.onSubject(item.value)}>{item.label} <span className={styles.optionCount}>{item.count}</span></button>)}
        </div>
      </div>}
      <div className={styles.filterField}>
        <span className={styles.subLabel}>Teaching mode</span>
        <div className={styles.modeChoices} role="group" aria-label="Teaching mode">
          <button type="button" className={`${styles.segmentBtn} ${p.mode === '' ? styles.segmentOn : ''}`} aria-pressed={p.mode === ''} onClick={() => p.onMode('')}>Any mode</button>
          <button type="button" className={`${styles.segmentBtn} ${p.mode === 'online' ? styles.segmentOn : ''}`} aria-pressed={p.mode === 'online'} onClick={() => p.onMode('online')}>Online</button>
          <button type="button" className={`${styles.segmentBtn} ${p.mode === 'physical' ? styles.segmentOn : ''}`} aria-pressed={p.mode === 'physical'} onClick={() => p.onMode('physical')}>In person</button>
        </div>
      </div>
      {p.level && <div className={styles.compactFilterRow}>
        <button type="button" className={styles.compactFilterButton} aria-expanded={filtersOpen} aria-controls="vibetutor-secondary-filters" onClick={() => setFiltersOpen(open => !open)}>
          <span>More filters</span>
          {secondaryCount > 0 && <span className={styles.compactFilterCount}>{secondaryCount}</span>}
          <span aria-hidden="true">{filtersOpen ? "−" : "+"}</span>
        </button>
        {secondaryCount > 0 && <span className={styles.hint}>{secondaryCount} applied</span>}
      </div>}
      {p.level && filtersOpen && <div id="vibetutor-secondary-filters" className={styles.secondaryFilters}>
        <div className={styles.filterField}>
          <span className={styles.subLabel}>Location · verified VibeSchool areas</span>
          <select className={styles.select} value={county} onChange={e => chooseCounty(e.target.value)} aria-label="County">
            <option value="">All counties</option>
            {counties.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
          <select className={styles.select} value={subCounty} onChange={e => { setSubCounty(e.target.value); setWard('') }} aria-label="Sub-county" disabled={!county || locationLoading}>
            <option value="">All sub-counties</option>
            {subCounties.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
          <select className={styles.select} value={ward} onChange={e => setWard(e.target.value)} aria-label="Ward" disabled={!subCounty || locationLoading}>
            <option value="">All wards</option>
            {wards.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
          <span className={styles.hint}>Sub-county and ward choices use the verified location directory. Example listings only contain broad areas, so those two levels cannot narrow the sample results yet.</span>
        </div>
        <div className={styles.filterField}>
          <span className={styles.subLabel}>Price per hour</span>
          <div className={styles.chipRow} role="group" aria-label="Price range">
            {[
              { value: '', label: 'Any price' },
              { value: 'under500', label: 'Under KSh 500' },
              { value: '500to1000', label: 'KSh 500–1,000' },
              { value: '1000to2000', label: 'KSh 1,000–2,000' },
              { value: 'over2000', label: 'KSh 2,000+' },
            ].map(option => <button key={option.value} type="button" className={`${styles.chip} ${p.priceRange === option.value ? styles.chipOn : ''}`} aria-pressed={p.priceRange === option.value} onClick={() => p.onPriceRange(option.value)}>{option.label}</button>)}
          </div>
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
        {p.priceRange && <button type="button" className={styles.filterTag} onClick={() => p.onPriceRange('')}>{({under500:'Under KSh 500','500to1000':'KSh 500–1,000','1000to2000':'KSh 1,000–2,000',over2000:'KSh 2,000+'} as Record<string,string>)[p.priceRange]} ×</button>}
      </div>}
      <div className={styles.progressTrack} aria-hidden="true">{p.busy && <div className={styles.progressBar} />}</div>
    </section>
  )
}
