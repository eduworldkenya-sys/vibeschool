'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import styles from '@/components/vibetutor/VibeTutor.module.css'
import Icon from '@/components/vibetutor/Icon'
import type { FilterOption } from '@/components/vibetutor/FilterBar'
import BackToTop from '@/components/vibetutor/BackToTop'
import { TutorCard, RequestCard } from '@/components/vibetutor/Cards'
import { DAYS, LEVELS, SUBJECTS_BY_LEVEL, type DemoRequest, type DemoTutor, type Mode } from '@/components/vibetutor/data'
import { fetchLiveListings, type LiveListings } from '@/components/vibetutor/listings'
import { PUBLIC_TUITION_SERVICES } from '@/components/vibetutor/tuitionServices'

type View = 'tutors' | 'students'
type Discovery = 'for-you' | 'nearby' | 'explore'
const DISCOVERY_TABS: { id: Discovery; label: string }[] = [
  { id: 'for-you', label: 'For You' }, { id: 'nearby', label: 'Nearby' }, { id: 'explore', label: 'Explore' },
]
const PRICE_OPTIONS = [['under500','Under KSh 500'], ['500to1000','KSh 500–1,000'], ['1000to2000','KSh 1,000–2,000'], ['over2000','KSh 2,000+']] as const

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

type Preferences = Omit<Filters, 'q'>
const INITIAL_PREFERENCES: Preferences = { subject: '', level: '', area: '', mode: '', priceRange: '', day: '' }

// Only score criteria that the viewer actually selected. Missing preferences never
// produce a percentage, and unverified prices or locations never count as a match.
function preferenceScore(row: DemoTutor | DemoRequest, p: Preferences): number | undefined {
  const tutor = 'levels' in row
  const levels = tutor ? row.levels : [row.level]
  const price = tutor ? row.rateKes : row.budgetKes
  const checks: [boolean, boolean, number][] = [
    [!!p.subject, row.subjects.includes(p.subject), 25],
    [!!p.level, levels.includes(p.level), 25],
    [!!p.day, row.days.includes(p.day), 20],
    [!!p.area, !!row.area && row.area === p.area, 10],
    [!!p.mode, row.mode === p.mode || row.mode === 'either', 5],
    [!!p.priceRange, price > 0 && matchesPrice(price, p.priceRange), 15],
  ]
  const known = checks.filter(([selected]) => selected)
  const total = known.reduce((sum, [, , weight]) => sum + weight, 0)
  return total ? Math.round(100 * known.reduce((sum, [, matched, weight]) => sum + (matched ? weight : 0), 0) / total) : undefined
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
  const [discovery, setDiscovery] = useState<Discovery>('for-you')
  const [searchOpen, setSearchOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [nearbyArea, setNearbyArea] = useState('')
  const [preferences, setPreferences] = useState<Record<View, Preferences>>({ tutors: INITIAL_PREFERENCES, students: INITIAL_PREFERENCES })
  const [seed, setSeed] = useState(0)
  const [live, setLive] = useState<LiveListings | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const filters: Filters = { q, subject, level, area: discovery === 'nearby' ? nearbyArea : area, mode, priceRange, day }
  const preferred = preferences[view]
  // Explicit choices inform the For You feed for this visit, separately for each role.
  useEffect(() => {
    const next = {subject, level, area: discovery === 'nearby' ? nearbyArea : area, mode, priceRange, day}
    if (!Object.values(next).some(Boolean)) return
    setPreferences(previous => ({
      ...previous,
      [view]: { ...previous[view], ...Object.fromEntries(Object.entries(next).filter(([, value]) => !!value)) },
    }))
  }, [view, subject, level, area, mode, priceRange, day, discovery, nearbyArea])
  useEffect(() => { setSeed(discoverySeed()); if (new URLSearchParams(window.location.search).get('view') === 'students') setView('students') }, [])

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

  const tutorSource = useMemo<DemoTutor[]>(() => live?.tutors ?? [], [live])
  const requestSource = useMemo<DemoRequest[]>(() => live?.requests ?? [], [live])

  const tutorsFor = (f: Filters) => tutorSource.filter(t =>
    (discovery !== 'nearby' || (!!nearbyArea && t.mode !== 'online')) &&
    (!f.level || t.levels.includes(f.level)) &&
    (!f.subject || t.subjects.includes(f.subject)) &&
    (!f.area || t.area === f.area) &&
    (!f.mode || t.mode === f.mode || t.mode === 'either') &&
    (!f.day || t.days.includes(f.day)) &&
    matchesPrice(t.rateKes, f.priceRange) &&
    matchesText([t.name, t.area, ...t.subjects, ...t.levels], f.q)
  )
  const requestsFor = (f: Filters) => requestSource.filter(r =>
    (discovery !== 'nearby' || (!!nearbyArea && r.mode !== 'online')) &&
    (!f.level || r.level === f.level) &&
    (!f.subject || r.subjects.includes(f.subject)) &&
    (!f.area || r.area === f.area) &&
    (!f.mode || r.mode === f.mode || r.mode === 'either') &&
    (!f.day || r.days.includes(f.day)) &&
    matchesPrice(r.budgetKes, f.priceRange) &&
    matchesText([r.learnerLabel, r.area, r.level, ...r.subjects], f.q)
  )

  const tutors = useMemo(() => {
    const matches = tutorsFor(filters)
    const order = (rows: DemoTutor[]) => {
      const rotated = rotate(rows, seed)
      return discovery === 'for-you' ? rotated.sort((a, b) => (preferenceScore(b, preferred) ?? 0) - (preferenceScore(a, preferred) ?? 0)) : rotated
    }
    return order(matches.filter(t => t.real))
  }, [q, subject, level, area, mode, priceRange, day, tutorSource, discovery, nearbyArea, preferred, seed])
  const requests = useMemo(() => {
    const rows = rotate(requestsFor(filters), seed)
    return discovery === 'for-you' ? rows.sort((a, b) => (preferenceScore(b, preferred) ?? 0) - (preferenceScore(a, preferred) ?? 0)) : rows
  }, [q, subject, level, area, mode, priceRange, day, requestSource, discovery, nearbyArea, preferred, seed])
  const currentCount = view === 'tutors' ? tutors.length : requests.length
  const services = useMemo(() => rotate(PUBLIC_TUITION_SERVICES.filter(service =>
    discovery !== 'nearby' && (!level || service.level === level) &&
    (!subject || service.subjects.includes(subject)) &&
    (!area || service.area === area) &&
    (!mode || mode === 'online') && !day && !priceRange &&
    matchesText([service.area, service.level, ...service.subjects], q)
  ), seed), [level, subject, area, mode, day, priceRange, q, seed, discovery])
  const [serviceLimit, setServiceLimit] = useState(12)
  useEffect(() => { setServiceLimit(12) }, [level, subject, area, mode, day, priceRange, q])

  // Each facet is calculated without its own current selection.
  const levelOptions: FilterOption[] = LEVELS.flatMap(value => {
    const f = { ...filters, level: '' }
    const count = view === 'tutors' ? tutorsFor(f).filter(t => t.real && t.levels.includes(value)).length : requestsFor(f).filter(r => r.level === value).length
    return count || (view === 'tutors' && PUBLIC_TUITION_SERVICES.some(t => t.level === value)) ? [{ value, label: value, count }] : []
  })
  const availableLevels = level ? SUBJECTS_BY_LEVEL[level] || [] : [...new Set(Object.values(SUBJECTS_BY_LEVEL).flat())]
  const subjectOptions: FilterOption[] = availableLevels.flatMap(value => {
    const f = { ...filters, subject: '' }
    const count = view === 'tutors' ? tutorsFor(f).filter(t => t.real && t.subjects.includes(value)).length : requestsFor(f).filter(r => r.subjects.includes(value)).length
    return count || (view === 'tutors' && PUBLIC_TUITION_SERVICES.some(t => (!level || t.level === level) && t.subjects.includes(value))) ? [{ value, label: value, count }] : []
  })
  const areaOptions: FilterOption[] = [...new Set([
    ...tutorSource.map(t => t.area), ...requestSource.map(r => r.area), ...PUBLIC_TUITION_SERVICES.map(t => t.area),
  ])].flatMap(value => {
    const f = { ...filters, area: '' }
    const count = view === 'tutors' ? tutorsFor(f).filter(t => t.real && t.area === value).length : requestsFor(f).filter(r => r.area === value).length
    return count || (view === 'tutors' && PUBLIC_TUITION_SERVICES.some(t => t.area === value)) ? [{ value, label: value, count }] : []
  })
  const modeOptions: FilterOption[] = [
    { value: 'online', label: 'Online', count: 0 },
    { value: 'physical', label: 'In person', count: 0 },
  ]

  const clear = () => { setQ(''); setSubject(''); setLevel(''); setArea(''); setMode(''); setPriceRange(''); setDay(''); setNearbyArea(''); setPreferences(p => ({ ...p, [view]: INITIAL_PREFERENCES })) }
  const changeView = (next: View) => { if (next === view) return; clear(); setView(next); setDiscovery('for-you') }
  const nearbyOptions = [...new Set((view === 'tutors' ? tutorSource : requestSource).filter(row => row.real && row.mode !== 'online' && row.area && !row.area.toLowerCase().includes('anywhere')).map(row => row.area))].sort((a, b) => a.localeCompare(b))
  const defaultSubjects = ['Mathematics', 'English', 'Science & Technology', 'Integrated Science']
  const subjectChips = [...new Set([...defaultSubjects.filter(s => !level || availableLevels.includes(s)), ...subjectOptions.map(s => s.value), ...(subject ? [subject] : [])])]
  const activeFilters = !!(q || subject || level || area || mode || priceRange || day || nearbyArea)
  const personalized = Object.values(preferred).some(Boolean)
  const score = (row: DemoTutor | DemoRequest) => discovery === 'for-you' && row.real ? preferenceScore(row, preferred) : undefined

  return (
    <>
      <section className={styles.discoveryPanel} aria-label="Discover tuition">
        <header className={styles.discoveryHeader}>
          <h1 className={styles.discoveryTitle}>Discover</h1>
          <div className={styles.discoveryActions}><Link className={styles.emptyAction} href="/vibetutor/inquiries">Inbox</Link>
            <button type="button" className={styles.discoveryIcon} aria-label="Search" aria-expanded={searchOpen} onClick={() => setSearchOpen(v => !v)}><Icon name="search" size={25} /></button>
            <button type="button" className={styles.discoveryIcon} aria-label="Filters" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(v => !v)}><svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M3 6h4m4 0h10M7 3v6M3 12h11m4 0h3m-3-3v6M3 18h4m4 0h10M7 15v6"/></svg></button>
          </div>
        </header>
        <div className={styles.discoveryRole} role="group" aria-label="Find people">
          <button type="button" aria-pressed={view === 'tutors'} onClick={() => changeView('tutors')}>Tutors</button>
          <button type="button" aria-pressed={view === 'students'} onClick={() => changeView('students')}>Learners</button>
        </div>
        <div className={styles.discoveryTabs} role="group" aria-label="Discovery mode">
          {DISCOVERY_TABS.map(tab => <button type="button" key={tab.id} aria-pressed={discovery === tab.id} onClick={() => { setDiscovery(tab.id); if (tab.id === 'nearby' && area) setNearbyArea(area) }}>{tab.label}</button>)}
        </div>
        {(searchOpen || q) && <label className={styles.searchWrap}>
          <Icon name="search" size={18} className={styles.searchIcon} />
          <input className={styles.search} type="search" autoFocus={searchOpen} value={q} onChange={e => setQ(e.target.value)} placeholder="Search subject, level or location" aria-label="Search listings" />
        </label>}
        <div className={styles.discoveryChips} role="group" aria-label="Subjects">
          <button type="button" aria-pressed={!subject} onClick={() => setSubject('')}>All</button>
          {subjectChips.map(value => <button type="button" key={value} aria-pressed={subject === value} onClick={() => setSubject(subject === value ? '' : value)}>{value === 'Science & Technology' ? 'Science' : value}</button>)}
        </div>
        {discovery === 'nearby' && <label className={styles.filterSelectField}>
          <span>Choose your area</span>
          <select className={styles.select} value={nearbyArea} onChange={e => setNearbyArea(e.target.value)}>
            <option value="">Select location</option>
            {nearbyOptions.map(value => <option key={value} value={value}>{value}</option>)}
            {nearbyArea && !nearbyOptions.includes(nearbyArea) && <option value={nearbyArea}>{nearbyArea}</option>}
          </select>
        </label>}
        {filtersOpen && <div className={styles.filterSelectGrid} aria-label="More filters">
          <label className={styles.filterSelectField}><span>Level</span><select className={styles.select} value={level} onChange={e => {setLevel(e.target.value);setSubject('')}}><option value="">Any level</option>{levelOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}{level && !levelOptions.some(o=>o.value===level) && <option value={level}>{level}</option>}</select></label>
          {discovery !== 'nearby' && <label className={styles.filterSelectField}><span>Location</span><select className={styles.select} value={area} onChange={e => setArea(e.target.value)}><option value="">Any location</option>{areaOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}{area && !areaOptions.some(o=>o.value===area) && <option value={area}>{area}</option>}</select></label>}
          <label className={styles.filterSelectField}><span>Teaching mode</span><select className={styles.select} value={mode} onChange={e=>setMode(e.target.value as Mode | '')}><option value="">Any mode</option>{modeOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
          <label className={styles.filterSelectField}><span>{view === 'tutors' ? 'Hourly rate' : 'Hourly budget'}</span><select className={styles.select} value={priceRange} onChange={e=>setPriceRange(e.target.value)}><option value="">Any price</option>{PRICE_OPTIONS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          <label className={styles.filterSelectField}><span>Availability</span><select className={styles.select} value={day} onChange={e=>setDay(e.target.value)}><option value="">Any day</option>{DAYS.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
          {(activeFilters || personalized) && <button type="button" className={styles.emptyAction} onClick={clear}>Reset filters and preferences</button>}
        </div>}
        <div className={styles.discoverySummary}>
          <p>{discovery === 'for-you' ? (personalized ? 'Recommended for you' : 'Discover your next match') : discovery === 'nearby' ? 'In your area' : 'Explore all listings'}</p>
          {!loading && !!currentCount && <span>{currentCount}</span>}
        </div>
      <div className={styles.discoveryList} aria-live="polite" aria-busy={loading}>
        {loading && <div className={styles.emptyState}><p className={styles.empty}>Loading live listings…</p></div>}
        {!loading && loadError && <div className={styles.emptyState} role="alert">
          <p className={styles.empty}>Listings are temporarily unavailable.</p>
          <p className={styles.emptyHint}>{loadError}</p>
          <button type="button" className={styles.emptyAction} onClick={() => setReloadKey(value => value + 1)}>Try again</button>
        </div>}
        {!loading && !loadError && view === 'tutors' && tutors.length === 0 && (discovery !== 'nearby' || !!nearbyArea) && <div className={styles.emptyState}>
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
        {!loading && !loadError && view === 'students' && requests.length === 0 && (discovery !== 'nearby' || !!nearbyArea) && <div className={styles.emptyState}>
          <p className={styles.empty}>{requestSource.length === 0 ? 'No public learner requests yet.' : 'No requests match these filters.'}</p>
          <p className={styles.emptyHint}>{requestSource.length === 0 ? 'Verified parents and teachers can post anonymously. Learner identities and phone numbers stay private.' : 'Try a broader search or clear some filters.'}</p>
          <div className={styles.emptyActions}>
            {subject && <button type="button" className={styles.emptyAction} onClick={() => setSubject('')}>Clear subject</button>}
            {priceRange && <button type="button" className={styles.emptyAction} onClick={() => setPriceRange('')}>Any budget</button>}
            {mode && <button type="button" className={styles.emptyAction} onClick={() => setMode('')}>Any mode</button>}
            {area && <button type="button" className={styles.emptyAction} onClick={() => setArea('')}>Clear location</button>}
            {q && <button type="button" className={styles.emptyAction} onClick={() => setQ('')}>Clear search</button>}
            {(subject || priceRange || mode || area || q || level || day) && <button type="button" className={styles.emptyAction} onClick={clear}>Clear all</button>}
          </div>
        </div>}
        {!loading && !loadError && discovery === 'nearby' && !nearbyArea && <p className={styles.emptyHint}>Choose an area to discover in-person tuition nearby.</p>}
        {!loading && !loadError && view === 'tutors' && (discovery !== 'nearby' || !!nearbyArea) && <>
          {tutors.map(tutor => <TutorCard key={tutor.id} t={tutor} compact score={score(tutor)} />)}
          <Link className={styles.cardAction} href="/vibetutor/post-request">Request online tuition</Link>
          {services.length > 0 && <>
            <h2 className={styles.cardTitle}>Tuition requests by subject</h2>
            <p className={styles.meta}>Choose a learning area. We will look for a tutor.</p>
            {services.slice(0, serviceLimit).map(service => <article key={service.id} className={styles.card}>
              <div className={styles.cardHead}><div className={styles.cardTitleWrap}>
                <h3 className={styles.cardTitle}>{service.subjects.join(' · ')}</h3>
                <p className={styles.muted}>{service.area} · Online</p>
              </div></div>
              <p className={styles.meta}>{service.level}</p>
              <Link className={styles.cardAction} href={'/vibetutor/post-request?service=' + encodeURIComponent(service.id)}>Request tutor</Link>
            </article>)}
            {serviceLimit < services.length && <button type="button" className={styles.cardAction} onClick={() => setServiceLimit(n => n + 12)}>Show more</button>}
          </>}
        </>}
        {!loading && !loadError && view === 'students' && requests.map(request => <RequestCard key={request.id} r={request} compact score={score(request)} signedIn={!!live?.signedIn} />)}
      </div>
      </section>
      <BackToTop />
    </>
  )
}
