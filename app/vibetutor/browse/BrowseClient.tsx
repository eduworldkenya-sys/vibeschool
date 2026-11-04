'use client'

import { useMemo, useState } from 'react'
import styles from '@/components/vibetutor/VibeTutor.module.css'
import FilterBar, { type FilterOption } from '@/components/vibetutor/FilterBar'
import BackToTop from '@/components/vibetutor/BackToTop'
import { TutorCard, RequestCard } from '@/components/vibetutor/Cards'
import { DEMO_REQUESTS, DEMO_TUTORS, LEVELS, SUBJECTS_BY_LEVEL, type Mode } from '@/components/vibetutor/data'

type View = 'tutors' | 'students'
type Filters = { q: string; subject: string; level: string; area: string; mode: Mode | ''; priceRange: string }

function matchesPrice(price: number, range: string) {
  if (range === 'under500') return price < 500
  if (range === '500to1000') return price >= 500 && price <= 1000
  if (range === '1000to2000') return price > 1000 && price <= 2000
  if (range === 'over2000') return price > 2000
  return true
}

function matchesText(values: string[], q: string) {
  const term = q.trim().toLowerCase()
  return !term || values.some(value => value.toLowerCase().includes(term))
}

export default function BrowseClient({ initialView }: { initialView: View }) {
  const [view, setView] = useState<View>(initialView)
  const [q, setQ] = useState('')
  const [subject, setSubject] = useState('')
  const [level, setLevel] = useState('')
  const [area, setArea] = useState('')
  const [mode, setMode] = useState<Mode | ''>('')
  const [priceRange, setPriceRange] = useState('')
  const filters: Filters = { q, subject, level, area, mode, priceRange }

  const tutorsFor = (f: Filters) => DEMO_TUTORS.filter(t =>
    (!f.level || t.levels.includes(f.level)) &&
    (!f.subject || t.subjects.includes(f.subject)) &&
    (!f.area || t.area === f.area) &&
    (!f.mode || t.mode === f.mode || t.mode === 'either') &&
    matchesPrice(t.rateKes, f.priceRange) &&
    matchesText([t.name, t.area, ...t.subjects, ...t.levels], f.q)
  )
  const requestsFor = (f: Filters) => DEMO_REQUESTS.filter(r =>
    (!f.level || r.level === f.level) &&
    (!f.subject || r.subjects.includes(f.subject)) &&
    (!f.area || r.area === f.area) &&
    (!f.mode || r.mode === f.mode || r.mode === 'either') &&
    matchesPrice(r.budgetKes, f.priceRange) &&
    matchesText([r.learnerLabel, r.area, r.level, ...r.subjects], f.q)
  )

  const tutors = useMemo(() => tutorsFor(filters), [q, subject, level, area, mode, priceRange])
  const requests = useMemo(() => requestsFor(filters), [q, subject, level, area, mode, priceRange])
  const currentCount = view === 'tutors' ? tutors.length : requests.length

  // Each facet is calculated without its own current selection. This keeps
  // alternative choices visible while removing choices that cannot match.
  const levelOptions: FilterOption[] = LEVELS.flatMap(value => {
    const f = { ...filters, level: '' }
    const count = view === 'tutors' ? tutorsFor(f).filter(t => t.levels.includes(value)).length : requestsFor(f).filter(r => r.level === value).length
    return count ? [{ value, label: value, count }] : []
  })
  const availableLevels = level ? SUBJECTS_BY_LEVEL[level] || [] : []
  const subjectOptions: FilterOption[] = availableLevels.flatMap(value => {
    const f = { ...filters, subject: '' }
    const count = view === 'tutors' ? tutorsFor(f).filter(t => t.subjects.includes(value)).length : requestsFor(f).filter(r => r.subjects.includes(value)).length
    return count ? [{ value, label: value, count }] : []
  })
  const areaOptions: FilterOption[] = [...new Set([
    ...DEMO_TUTORS.map(t => t.area), ...DEMO_REQUESTS.map(r => r.area),
  ])].flatMap(value => {
    const f = { ...filters, area: '' }
    const count = view === 'tutors' ? tutorsFor(f).filter(t => t.area === value).length : requestsFor(f).filter(r => r.area === value).length
    return count ? [{ value, label: value, count }] : []
  })
  const modeOptions: FilterOption[] = (['online', 'physical'] as const).flatMap(value => {
    const f: Filters = { ...filters, mode: '' }
    const count = view === 'tutors' ? tutorsFor(f).filter(t => t.mode === value || t.mode === 'either').length : requestsFor(f).filter(r => r.mode === value || r.mode === 'either').length
    return count ? [{ value, label: value === 'online' ? 'Online' : 'In person', count }] : []
  })

  const clear = () => { setQ(''); setSubject(''); setLevel(''); setArea(''); setMode(''); setPriceRange('') }
  const changeView = (next: View) => { setView(next); clear() }

  return (
    <>
      <h1 className={styles.pageTitle}>Find holiday tuition</h1>
      <FilterBar priceRange={priceRange} onPriceRange={setPriceRange} view={view} onView={changeView} q={q} onQ={setQ}
        placeholder={view === 'tutors' ? 'Search tutors by name, subject or area' : 'Search requests by subject, level or area'}
        subjects={subjectOptions} subject={subject} onSubject={setSubject}
        levels={levelOptions} level={level} onLevel={value => { setLevel(value); setSubject('') }}
        areas={areaOptions} area={area} onArea={setArea}
        modes={modeOptions} mode={mode} onMode={setMode}
        resultCount={currentCount} noun={view === 'tutors' ? 'tutor' : 'request'}
        onClear={clear} />
      <div className={styles.list}>
        {view === 'tutors' && tutors.length === 0 && <p className={styles.empty}>No example tutors match these filters. Remove a filter to broaden your search.</p>}
        {view === 'students' && requests.length === 0 && <p className={styles.empty}>No example requests match these filters. Remove a filter to broaden your search.</p>}
        {view === 'tutors' && tutors.map(tutor => <TutorCard key={tutor.id} t={tutor} />)}
        {view === 'students' && requests.map(request => <RequestCard key={request.id} r={request} />)}
      </div>
      <BackToTop />
    </>
  )
}
