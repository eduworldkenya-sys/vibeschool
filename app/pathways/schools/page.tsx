'use client'

import type { CSSProperties } from 'react'
import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { searchPublicSchools, type PublicSchoolResult } from '@/lib/pathways/public'

const PATHWAYS = [
  { value: '', label: 'Any pathway' },
  { value: 'stem', label: 'STEM' },
  { value: 'social-sciences', label: 'Social Sciences' },
  { value: 'arts-and-sports-science', label: 'Arts & Sports Science' },
]

export default function PathwaySchoolsPage() {
  const [query, setQuery] = useState('')
  const [county, setCounty] = useState('')
  const [pathway, setPathway] = useState('')
  const [results, setResults] = useState<PublicSchoolResult[]>([])
  const [searched, setSearched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const data = await searchPublicSchools({ query, county, pathwaySlug: pathway, limit: 40 })
      setResults(data)
      setSearched(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Schools could not be searched.')
    } finally {
      setBusy(false)
    }
  }

  return <main style={S.root}><div style={S.shell}>
    <Link href="/pathways" style={S.back}>← Pathways</Link>
    <div style={S.kicker}>SENIOR SCHOOL DISCOVERY</div>
    <h1 style={S.h1}>Find a school without guessing what it offers.</h1>
    <p style={S.lead}>Search VibeSchool's canonical school identities. If you filter by a pathway, a school appears only when that offering has verified evidence in the Pathways knowledge system.</p>

    <form onSubmit={submit} style={S.searchCard}>
      <label style={S.label}>School name</label>
      <input value={query} onChange={event => setQuery(event.target.value)} placeholder="e.g. Alliance, Kapsabet, Kenya High" style={S.input} />
      <div style={S.twoCol}>
        <label style={S.field}>County<input value={county} onChange={event => setCounty(event.target.value)} placeholder="e.g. Nairobi" style={S.input} /></label>
        <label style={S.field}>Pathway<select value={pathway} onChange={event => setPathway(event.target.value)} style={S.input}>{PATHWAYS.map(item => <option key={item.value || 'any'} value={item.value}>{item.label}</option>)}</select></label>
      </div>
      <button disabled={busy} style={S.primary}>{busy ? 'Searching…' : 'Search schools'}</button>
    </form>

    {error && <div role="alert" style={S.error}>{error}</div>}

    {searched && !error && <section style={{ marginTop: 20 }}>
      <div style={S.resultHead}><h2 style={S.h2}>{results.length ? `${results.length} result${results.length === 1 ? '' : 's'}` : 'No verified results yet'}</h2><span style={S.small}>Maximum 40 per search</span></div>
      {results.length === 0 ? <div style={S.empty}>
        <strong>No school matched this verified filter.</strong>
        <p style={S.body}>{pathway ? 'This does not mean no school offers the pathway. It means VibeSchool does not yet have a verified offering record matching this search. Try without the pathway filter, or check again as authoritative coverage grows.' : 'Try a shorter school name or remove the county filter.'}</p>
      </div> : <div style={S.list}>{results.map(item => <article key={`${item.schoolId}:${item.pathwaySlug ?? ''}:${item.combinationSlug ?? ''}`} style={S.schoolCard}>
        <div style={S.schoolTop}><div><h3 style={S.schoolName}>{item.schoolName}</h3><p style={S.meta}>{[item.subCounty, item.county].filter(Boolean).join(', ') || 'Location not verified'}</p></div>{item.offeringVerifiedAt && <span style={S.verified}>Verified offering</span>}</div>
        <div style={S.tags}>
          {item.genderType && <span style={S.tag}>{item.genderType}</span>}
          {item.accommodationType && <span style={S.tag}>{item.accommodationType}</span>}
          {item.schoolCategory && <span style={S.tag}>{item.schoolCategory}</span>}
          {item.cluster && <span style={S.tag}>{item.cluster}</span>}
        </div>
        {item.pathwayName && <div style={S.offering}><strong>{item.pathwayName}</strong>{item.combinationName && <span>{item.combinationName}</span>}<small>Offering evidence last verified {item.offeringVerifiedAt ? new Date(item.offeringVerifiedAt).toLocaleDateString('en-KE') : '—'}</small></div>}
      </article>)}</div>}
    </section>}

    {!searched && <section style={S.trust}>
      <strong>Why results may be fewer than another directory</strong>
      <p style={S.body}>VibeSchool separates discovery from trusted identity. This public finder does not present unmatched directory candidates as canonical schools, and it does not claim a pathway offering until that relationship has verified source evidence.</p>
    </section>}

    <section style={S.next}><h2 style={S.h2}>Not sure which pathway to search?</h2><p style={S.body}>Start with the free quick check, then return here when you know which direction you want to explore.</p><Link href="/pathways/check" style={S.secondary}>Check my direction — free</Link></section>
  </div></main>
}

const S: Record<string, CSSProperties> = {
  root: { minHeight: '100dvh', background: '#f7f7fb', color: '#111827', padding: '26px 16px 60px' },
  shell: { maxWidth: 820, margin: '0 auto' },
  back: { display: 'inline-block', marginBottom: 28, color: '#4f46e5', fontWeight: 800, fontSize: 13, textDecoration: 'none' },
  kicker: { fontSize: 10, fontWeight: 900, letterSpacing: '.16em', color: '#725815', marginBottom: 9 },
  h1: { fontSize: 'clamp(32px,6vw,50px)', lineHeight: 1.06, letterSpacing: '-.035em', margin: '0 0 14px' },
  h2: { fontSize: 18, margin: 0, letterSpacing: '-.015em' },
  lead: { maxWidth: 680, color: '#626b7b', lineHeight: 1.65, fontSize: 14, margin: '0 0 24px' },
  searchCard: { background: '#fff', border: '1px solid #e2e4ea', borderRadius: 20, padding: 18 },
  label: { display: 'grid', gap: 6, fontSize: 11, fontWeight: 800, color: '#4b5563' },
  field: { display: 'grid', gap: 6, fontSize: 11, fontWeight: 800, color: '#4b5563' },
  input: { width: '100%', boxSizing: 'border-box', padding: '12px 13px', border: '1px solid #d8dae2', borderRadius: 11, background: '#fff', color: '#111827', fontSize: 14, marginTop: 6 },
  twoCol: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10, marginTop: 12 },
  primary: { width: '100%', marginTop: 14, border: 'none', borderRadius: 12, background: '#4f46e5', color: '#fff', padding: '13px 15px', fontWeight: 850, cursor: 'pointer' },
  secondary: { display: 'inline-block', marginTop: 10, border: '1px solid #d8dae2', borderRadius: 12, background: '#fff', color: '#3730a3', padding: '11px 14px', fontWeight: 850, fontSize: 12, textDecoration: 'none' },
  error: { marginTop: 14, padding: 13, borderRadius: 12, background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', fontSize: 12 },
  resultHead: { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', marginBottom: 10 },
  small: { color: '#8a91a0', fontSize: 10 },
  list: { display: 'grid', gap: 10 },
  schoolCard: { background: '#fff', border: '1px solid #e2e4ea', borderRadius: 17, padding: 16 },
  schoolTop: { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' },
  schoolName: { margin: 0, fontSize: 16 },
  meta: { margin: '4px 0 0', color: '#737b89', fontSize: 11 },
  verified: { background: '#ecfdf5', color: '#047857', borderRadius: 999, padding: '5px 8px', fontSize: 9, fontWeight: 850, whiteSpace: 'nowrap' },
  tags: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  tag: { background: '#f3f4f6', color: '#5b6475', borderRadius: 999, padding: '5px 8px', fontSize: 9, fontWeight: 750 },
  offering: { display: 'grid', gap: 3, marginTop: 13, padding: 12, borderRadius: 12, background: '#eef2ff', color: '#312e81', fontSize: 11 },
  empty: { background: '#fff', border: '1px solid #e2e4ea', borderRadius: 17, padding: 18 },
  trust: { marginTop: 20, padding: 16, border: '1px solid #fde68a', borderRadius: 16, background: '#fffbeb', fontSize: 12 },
  next: { marginTop: 22, padding: 18, border: '1px solid #e2e4ea', borderRadius: 18, background: '#fff' },
  body: { color: '#626b7b', fontSize: 12, lineHeight: 1.55, margin: '6px 0 0' },
}
