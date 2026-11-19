'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import styles from '@/components/vibetutor/VibeTutor.module.css'
import FilterBar, { type FilterOption } from '@/components/vibetutor/FilterBar'
import BackToTop from '@/components/vibetutor/BackToTop'
import { TutorCard, RequestCard } from '@/components/vibetutor/Cards'
import { DAYS, LEVELS, SUBJECTS_BY_LEVEL, type DemoRequest, type DemoTutor, type Mode } from '@/components/vibetutor/data'
import { fetchLiveListings, type LiveListings } from '@/components/vibetutor/listings'
import { PUBLIC_TUITION_SERVICES } from '@/components/vibetutor/tuitionServices'
import { compatibility, rankDiscovery, matchesDiscoveryText } from '@/components/vibetutor/discovery'

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

const matchesText = matchesDiscoveryText

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

  const tutorSource = useMemo<DemoTutor[]>(() => live?.tutors ?? [], [live])
  const requestSource = useMemo<DemoRequest[]>(() => (live?.requests ?? []).filter(r => !live?.ownRequestIds?.includes(r.id)), [live])

  const tutorsFor = (f: Filters) => tutorSource.filter(t =>
    (!f.level || t.levels.includes(f.level)) &&
    (!f.subject || t.subjects.includes(f.subject)) &&
    (!f.area || t.area === f.area) &&
    (!f.mode || t.mode === f.mode || t.mode === 'either') &&
    (!f.day || t.days.includes(f.day)) &&
    matchesPrice(t.rateKes, f.priceRange) &&
    matchesText([t.name, t.area, t.bio, ...t.subjects, ...t.levels], f.q)
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
    if (sort === 'alphabetical') return [...matches].sort((a, b) => a.name.localeCompare(b.name, 'en-KE') || a.id.localeCompare(b.id))
    return rankDiscovery(matches, seed, t => live?.learnerPreference ? compatibility(live.learnerPreference, {
      subjects: t.subjects, levels: t.levels, days: t.days, area: t.area, mode: t.mode, amount: t.rateKes,
    }) : 0)
  }, [q, subject, level, area, mode, priceRange, day, tutorSource, sort, seed, live])
  const requests = useMemo(() => {
    const rows = rankDiscovery(requestsFor(filters), seed, r => live?.tutorPreference ? compatibility({
      subjects: r.subjects, levels: [r.level], days: r.days, area: r.area, mode: r.mode, amount: r.budgetKes,
    }, live.tutorPreference) : 0)
    return sort === 'recent' ? rows.sort((a, b) => a.postedDaysAgo - b.postedDaysAgo) : rows
  }, [q, subject, level, area, mode, priceRange, day, requestSource, sort, seed, live])
  const currentCount = view === 'tutors' ? tutors.length : requests.length
  const services = useMemo(() => rotate(PUBLIC_TUITION_SERVICES.filter(service =>
    (!level || service.level === level) &&
    (!subject || service.subjects.includes(subject)) &&
    (!area || service.area === area) &&
    (!mode || mode === 'online') && !day && !priceRange &&
    matchesText([service.area, service.level, ...service.subjects], q)
  ), seed), [level, subject, area, mode, day, priceRange, q, seed])
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

  const clear = () => { setQ(''); setSubject(''); setLevel(''); setArea(''); setMode(''); setPriceRange(''); setDay('') }
  const changeView = (next: View) => { setView(next); setSort('discover'); clear() }

  return (
    <>
      <h1 className={styles.pageTitle}>Discover tuition</h1>
      <FilterBar priceRange={priceRange} onPriceRange={setPriceRange} view={view} onView={changeView} q={q} onQ={setQ}
        placeholder={view === 'tutors' ? 'Subject, level or tutor' : 'Subject, level or location'}
        subjects={subjectOptions} subject={subject} onSubject={setSubject}
        levels={levelOptions} level={level} onLevel={value => { setLevel(value); setSubject('') }}
        areas={areaOptions} area={area} onArea={setArea}
        modes={modeOptions} mode={mode} onMode={setMode}
        resultCount={currentCount} noun={view === 'tutors' ? 'listing' : 'request'}
        onClear={clear} busy={loading} day={day} days={DAYS} onDay={setDay}
        sort={sort} onSort={setSort} personalized={view === 'tutors' ? !!live?.learnerPreference : !!live?.tutorPreference} />
      <div className={`${styles.list} ${loading ? styles.dim : ''}`} aria-live="polite" aria-busy={loading}>
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
          {tutors.map(tutor => <TutorCard key={tutor.id} t={tutor} />)}
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
        {!loading && !loadError && view === 'students' && live?.signedIn && requests.map(request => <RequestCard key={request.id} r={request} />)}
      </div>
      <BackToTop />
    </>
  )
}
