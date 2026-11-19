'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import styles from '@/components/vibetutor/VibeTutor.module.css'
import FilterBar, { type FilterOption } from '@/components/vibetutor/FilterBar'
import BackToTop from '@/components/vibetutor/BackToTop'
import { TutorCard, RequestCard } from '@/components/vibetutor/Cards'
import { DAYS, LEVELS, SUBJECTS_BY_LEVEL, type DemoRequest, type DemoTutor, type Mode } from '@/components/vibetutor/data'
import { fetchLiveListings, type LiveListings } from '@/components/vibetutor/listings'
import { KENYA_DEMO_TUTORS } from '@/components/vibetutor/kenya-demo-tutors'

type View = 'tutors' | 'students'
type Sort = 'discover' | 'alphabetical' | 'recent'

// Stable ordering within a session; rotate the starting position daily.
// No popularity, reviews, payments or inferred availability in ranking.
function rotate<T extends { id: string }>(rows: readonly T[], seed: number): T[] {
  const ordered = [...rows].sort((a, b) => a.id.localeCompare(b.id))
  if (!ordered.length) return ordered
  const start = seed % ordered.length
  return [...ordered.slice(start), ...ordered.slice(0, start)]
}

function discoverySeed() {
  const day = Math.floor(Date.now() / 86400000)
  const fresh = Math.floor(Math.random() * 2147483647)
  try {
    const key = 'vibetutor-discovery-seed'
    const stored = sessionStorage.getItem(key)
    const seed = stored !== null && /^\d{1,10}$/.test(stored) ? Number(stored) : fresh
    sessionStorage.setItem(key, String(seed))
    return seed + day
  } catch {
    return fresh + day
  }
}
type Filters = { q: string; subject: string; level: string; area: string; mode: Mode | ''; priceRange: string; day: string }

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
  const [day, setDay] = useState('')
  const [sort, setSort] = useState<Sort>('discover')
  const [seed, setSeed] = useState(0)
  const [busy, setBusy] = useState(false)
  const [live, setLive] = useState<LiveListings | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const filters: Filters = { q, subject, level, area, mode, priceRange, day }
  useEffect(() => { setSeed(discoverySeed()) }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError('')
    fetchLiveListings()
      .then(result => { if (active) setLive(result) })
      .catch(() => { if (active) { setLive(null); setLoadError('We could not load live VibeTutor listings. Check your connection and try again.') } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reloadKey])

  const tutorSource = useMemo<DemoTutor[]>(() => live ? [...live.tutors, ...KENYA_DEMO_TUTORS] : [], [live])
  const requestSource = useMemo<DemoRequest[]>(() => live?.requests ?? [], [live])

  const tutorsFor = (f: Filters) => tutorSource.filter(t =>
    (!f.level || t.levels.includes(f.level)) &&
    (!f.subject || t.subjects.includes(f.subject)) &&
    (!f.area || t.area === f.area) &&
    (!f.mode || t.mode === f.mode || t.mode === 'either') &&
    (!f.day || t.days.includes(f.day)) &&
    matchesPrice(t.rateKes, f.priceRange) &&
    matchesText([t.name, t.area, ...t.subjects, ...t.levels], f.q)
  )
  const requestsFor = (f: Filters) => requestSource.filter(r =>
    (!f.level || r.level === f.level) &&
    (!f.subject || r.subjects.includes(f.subject)) &&
    (!f.area || r.area === f.area) &&
    (!f.mode || r.mode === f.mode || r.mode === 'either') &&
    (!f.day || r.days.includes(f.day)) &&
    matchesPrice(r.budgetKes, f.priceRange) &&
    matchesText([r.area, r.level, ...r.subjects], f.q)
  )

  const tutors = useMemo(() => {
    const matches = tutorsFor(filters)
    const order = (rows: DemoTutor[]) => sort === 'alphabetical'
      ? [...rows].sort((a, b) => a.name.localeCompare(b.name, 'en-KE') || a.id.localeCompare(b.id))
      : rotate(rows, seed)
    return [...order(matches.filter(t => t.real)), ...order(matches.filter(t => !t.real))]
  }, [q, subject, level, area, mode, priceRange, day, tutorSource, sort, seed])
  const requests = useMemo(() => {
    const rows = rotate(requestsFor(filters), seed)
    return sort === 'recent' ? rows.sort((a, b) => a.postedDaysAgo - b.postedDaysAgo) : rows
  }, [q, subject, level, area, mode, priceRange, day, requestSource, sort, seed])
  const currentCount = view === 'tutors' ? tutors.filter(t => t.real).length : requests.length

  // Each facet is calculated without its own current selection.
  const levelOptions: FilterOption[] = LEVELS.flatMap(value => {
    const f = { ...filters, level: '' }
    const count = view === 'tutors' ? tutorsFor(f).filter(t => t.real && t.levels.includes(value)).length : requestsFor(f).filter(r => r.level === value).length
    return count || (view === 'tutors' && tutorsFor(f).some(t => !t.real && t.levels.includes(value))) ? [{ value, label: value, count }] : []
  })
  const availableLevels = level ? SUBJECTS_BY_LEVEL[level] || [] : []
  const subjectOptions: FilterOption[] = availableLevels.flatMap(value => {
    const f = { ...filters, subject: '' }
    const count = view === 'tutors' ? tutorsFor(f).filter(t => t.real && t.subjects.includes(value)).length : requestsFor(f).filter(r => r.subjects.includes(value)).length
    return count || (view === 'tutors' && tutorsFor(f).some(t => !t.real && t.subjects.includes(value))) ? [{ value, label: value, count }] : []
  })
  const areaOptions: FilterOption[] = [...new Set([
    ...tutorSource.map(t => t.area), ...requestSource.map(r => r.area),
  ])].flatMap(value => {
    const f = { ...filters, area: '' }
    const count = view === 'tutors' ? tutorsFor(f).filter(t => t.real && t.area === value).length : requestsFor(f).filter(r => r.area === value).length
    return count || (view === 'tutors' && tutorsFor(f).some(t => !t.real && t.area === value)) ? [{ value, label: value, count }] : []
  })
  const modeOptions: FilterOption[] = [
    { value: 'online', label: 'Online', count: 0 },
    { value: 'physical', label: 'In person', count: 0 },
  ]

  useEffect(() => {
    setBusy(true)
    const timer = setTimeout(() => setBusy(false), 180)
    return () => clearTimeout(timer)
  }, [q, subject, level, area, mode, priceRange, day, sort, view])

  const clear = () => { setQ(''); setSubject(''); setLevel(''); setArea(''); setMode(''); setPriceRange(''); setDay('') }
  const changeView = (next: View) => { setView(next); setSort('discover'); clear() }

  return (
    <>
      <h1 className={styles.pageTitle}>Discover tuition</h1>
      <FilterBar priceRange={priceRange} onPriceRange={setPriceRange} view={view} onView={changeView} q={q} onQ={setQ}
        placeholder={view === 'tutors' ? 'Search tutors by name, subject or area' : 'Search requests by subject, level or area'}
        subjects={subjectOptions} subject={subject} onSubject={setSubject}
        levels={levelOptions} level={level} onLevel={value => { setLevel(value); setSubject('') }}
        areas={areaOptions} area={area} onArea={setArea}
        modes={modeOptions} mode={mode} onMode={setMode}
        resultCount={currentCount} noun={view === 'tutors' ? 'listing' : 'request'}
        onClear={clear} busy={busy || loading} />
      <div className={styles.filterSelectGrid} aria-label="Discovery preferences">
        <label className={styles.filterSelectField}>
          <span>Show</span>
          <select className={styles.select} value={sort} onChange={e => {
            const next = e.target.value
            setSort(next === 'alphabetical' || next === 'recent' ? next : 'discover')
          }}>
            <option value="discover">Discover</option>
            {view === 'tutors' ? <option value="alphabetical">Name A–Z</option> : <option value="recent">Recently posted</option>}
          </select>
        </label>
        {view === 'tutors' && <label className={styles.filterSelectField}>
          <span>Availability</span>
          <select className={styles.select} value={day} onChange={e => setDay(e.target.value)}>
            <option value="">Any day</option>
            {DAYS.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>}
        {view === 'students' && <label className={styles.filterSelectField}>
          <span>Preferred day</span>
          <select className={styles.select} value={day} onChange={e => setDay(e.target.value)}>
            <option value="">Any day</option>
            {DAYS.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>}
      </div>
      {day && <button type="button" className={styles.clear} onClick={() => setDay('')}>Clear day filter</button>}
      <div className={`${styles.list} ${busy || loading ? styles.dim : ''}`} aria-live="polite" aria-busy={loading}>
        {loading && <div className={styles.emptyState}><p className={styles.empty}>Loading live listings…</p></div>}
        {!loading && loadError && <div className={styles.emptyState} role="alert">
          <p className={styles.empty}>Listings are temporarily unavailable.</p>
          <p className={styles.emptyHint}>{loadError}</p>
          <button type="button" className={styles.emptyAction} onClick={() => setReloadKey(value => value + 1)}>Try again</button>
        </div>}
        {!loading && !loadError && view === 'students' && !live?.signedIn && <div className={styles.emptyState}>
          <p className={styles.empty}>Sign in to view learner requests.</p>
          <p className={styles.emptyHint}>Learner requests are available to signed-in VibeTutor members.</p>
          <a className={styles.emptyAction} href="/login?next=%2Fvibetutor%2Fbrowse%3Fview%3Dstudents">Sign in</a>
        </div>}
        {!loading && !loadError && view === 'tutors' && tutors.length === 0 && <div className={styles.emptyState}>
          <p className={styles.empty}>{tutorSource.length === 0 ? 'No tutor listings have been published yet.' : 'No tutors match these filters.'}</p>
          <p className={styles.emptyHint}>{tutorSource.length === 0 ? 'Be the first tutor to publish a listing.' : 'Try a broader search or clear some filters.'}</p>
          <div className={styles.emptyActions}>
            {subject && <button type="button" className={styles.emptyAction} onClick={() => setSubject('')}>Clear subject</button>}
            {priceRange && <button type="button" className={styles.emptyAction} onClick={() => setPriceRange('')}>Any price</button>}
            {mode && <button type="button" className={styles.emptyAction} onClick={() => setMode('')}>Any mode</button>}
            {area && <button type="button" className={styles.emptyAction} onClick={() => setArea('')}>Clear location</button>}
            {q && <button type="button" className={styles.emptyAction} onClick={() => setQ('')}>Clear search</button>}
            {(subject || priceRange || mode || area || q || level || day) && <button type="button" className={styles.emptyAction} onClick={clear}>Clear all</button>}
          </div>
        </div>}
        {!loading && !loadError && view === 'students' && live?.signedIn && requests.length === 0 && <div className={styles.emptyState}>
          <p className={styles.empty}>{requestSource.length === 0 ? 'No open learner requests yet.' : 'No requests match these filters.'}</p>
          <p className={styles.emptyHint}>{requestSource.length === 0 ? 'New learner requests will appear here.' : 'Try a broader search or clear some filters.'}</p>
          <div className={styles.emptyActions}>
            {subject && <button type="button" className={styles.emptyAction} onClick={() => setSubject('')}>Clear subject</button>}
            {priceRange && <button type="button" className={styles.emptyAction} onClick={() => setPriceRange('')}>Any budget</button>}
            {mode && <button type="button" className={styles.emptyAction} onClick={() => setMode('')}>Any mode</button>}
            {area && <button type="button" className={styles.emptyAction} onClick={() => setArea('')}>Clear location</button>}
            {q && <button type="button" className={styles.emptyAction} onClick={() => setQ('')}>Clear search</button>}
            {(subject || priceRange || mode || area || q || level || day) && <button type="button" className={styles.emptyAction} onClick={clear}>Clear all</button>}
          </div>
        </div>}
        {!loading && !loadError && view === 'tutors' && <>
          <p className={styles.meta}>{tutors.filter(t => t.real).length} registered tutor listings · {tutors.filter(t => !t.real).length} fictional examples</p>
          {tutors.filter(t => t.real).map(tutor => <TutorCard key={tutor.id} t={tutor} />)}
          <Link className={styles.cardAction} href="/vibetutor/post-request">Request online tuition</Link>
          {tutors.some(t => !t.real) && <>
            <h2 className={styles.cardTitle}>Example tutors</h2>
            
            {tutors.filter(t => !t.real).map(tutor => <TutorCard key={tutor.id} t={tutor} />)}
          </>}
        </>}
        {!loading && !loadError && view === 'students' && live?.signedIn && requests.map(request => <RequestCard key={request.id} r={request} />)}
      </div>
      <BackToTop />
    </>
  )
}
