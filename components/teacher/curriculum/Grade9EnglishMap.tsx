'use client'

import { useMemo, useState } from 'react'
import curriculum from '@/content/curriculum/grade9-english-2024-index.json'

type Props = {
  compact?: boolean
  onOpenScheme?: () => void
}

const ink = '#193b30'
const border = '#dce8df'
const muted = '#536b5f'

/**
 * A native, read-only index of KICD Grade 9 English (2024 revised).
 * Only the theme/sub-strand structure and proposed lesson allocations are indexed.
 * This component is NOT an official transcript, verified outcome inventory,
 * automatic weekly scheme, or permission to reproduce the KICD publication.
 */
export default function Grade9EnglishMap({ compact = false, onOpenScheme }: Props) {
  const [selectedTheme, setSelectedTheme] = useState(1)
  const [search, setSearch] = useState('')
  const query = search.trim().toLowerCase()
  const selected = curriculum.themes.find(theme => theme.number === selectedTheme) ?? curriculum.themes[0]
  const visible = useMemo(() => {
    if (!query) return [selected]
    return curriculum.themes
      .map(theme => ({
        ...theme,
        units: theme.title.toLowerCase().includes(query)
          ? theme.units
          : theme.units.filter(unit =>
              [unit.code, unit.strand, unit.title, unit.focus].some(value => value.toLowerCase().includes(query))
            ),
      }))
      .filter(theme => theme.units.length > 0)
  }, [query, selected])

  return (
    <section aria-label="Grade 9 English annual curriculum" style={{ color: ink, border: `1px solid ${border}`, background: '#fff', borderRadius: 16, padding: compact ? 14 : 18, marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', color: '#48785e' }}>GRADE 9 · ENGLISH · ANNUAL CURRICULUM</div>
      <h2 style={{ fontSize: compact ? 19 : 23, margin: '5px 0 7px' }}>English curriculum map</h2>
      <p style={{ fontSize: 13, lineHeight: 1.6, color: muted, margin: '0 0 13px' }}>
        Browse the learning sequence by theme and skill. This structured VibeSchool index follows the revised 2024 KICD design; it does not replace the source's full learning outcomes and guidance.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 13 }}>
        {['15 themes', '75 sub-strands', '150 suggested lessons', '5 lessons per week'].map(value =>
          <span key={value} style={{ background: '#edf6f0', borderRadius: 20, color: ink, fontSize: 12, fontWeight: 750, padding: '6px 10px' }}>{value}</span>
        )}
      </div>
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', marginBottom: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 800 }}>
          Theme
          <select id="grade9-english-theme" value={selectedTheme} onChange={event => { setSelectedTheme(Number(event.target.value)); setSearch('') }}
            style={{ display: 'block', width: '100%', minHeight: 44, marginTop: 5, borderRadius: 9, border: `1px solid ${border}`, padding: '9px 10px', background: '#fff', color: ink, fontSize: 14 }}>
            {curriculum.themes.map(theme => <option key={theme.number} value={theme.number}>{theme.number}. {theme.title}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12, fontWeight: 800 }}>
          Find a topic or sub-strand
          <input id="grade9-english-search" type="search" value={search} onChange={event => setSearch(event.target.value)}
            placeholder="e.g. reading, interview, 3.1.1"
            style={{ display: 'block', width: '100%', minHeight: 44, marginTop: 5, borderRadius: 9, border: `1px solid ${border}`, padding: '9px 10px', color: ink, fontSize: 14 }} />
        </label>
      </div>
      {visible.length === 0 ? <p role="status" style={{ color: muted, fontSize: 13 }}>No matching topics. Try another search.</p> : visible.map(theme => (
        <article key={theme.number} style={{ border: `1px solid ${border}`, borderRadius: 12, marginBottom: 10, overflow: 'hidden' }}>
          <header style={{ background: '#f4f8f5', padding: '13px 14px' }}>
            <div style={{ fontSize: 11, color: muted, fontWeight: 800 }}>THEME {theme.number} · KICD PRINTED PAGE {theme.printedPage}</div>
            <h3 style={{ margin: '5px 0 0', fontSize: 17 }}>{theme.title}</h3>
          </header>
          <div style={{ padding: '5px 14px 12px' }}>
            {theme.units.map(unit => (
              <div key={unit.code} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderBottom: `1px solid ${border}` }}>
                <span style={{ minWidth: 52, fontSize: 11, fontWeight: 800, color: '#317258', paddingTop: 2 }}>{unit.code}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 750, fontSize: 13 }}>{unit.title}</div>
                  <div style={{ fontSize: 12, color: muted, marginTop: 4 }}>{unit.focus === 'Literature' ? 'Reading · Literature' : unit.strand} · {unit.suggestedLessons} suggested lessons</div>
                </div>
              </div>
            ))}
          </div>
        </article>
      ))}
      <p style={{ fontSize: 12, color: muted, lineHeight: 1.55, margin: '12px 0' }}>
        Lesson counts are suggested allocations, not assigned teaching weeks. Source headings have been cross-checked; source-to-outcome certification and teacher-specific Scheme links are separate checks.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
        {onOpenScheme && <button type="button" onClick={onOpenScheme}
          style={{ minHeight: 44, border: 0, borderRadius: 9, background: '#24634b', color: '#fff', fontSize: 13, fontWeight: 800, padding: '10px 15px', cursor: 'pointer' }}>Open Scheme of Work</button>}
        <a href={curriculum.officialIndexUrl} target="_blank" rel="noopener noreferrer" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', padding: '10px 15px', boxSizing: 'border-box', borderRadius: 9, border: `1px solid ${border}`, color: ink, background: '#fff', fontWeight: 750, fontSize: 13 }}>
          View original KICD source
        </a>
      </div>
    </section>
  )
}
