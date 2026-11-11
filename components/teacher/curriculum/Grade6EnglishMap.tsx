'use client'

import { useMemo, useState } from 'react'
import {
  GRADE6_ENGLISH_SOURCE_URL, GRADE6_ENGLISH_THEMES, GRADE6_ENGLISH_UNITS,
} from '@/lib/teaching/grade6EnglishCatalog.mjs'

type CatalogRecord = {
  id: string
  name: string
  sub_strand: string
  outcomes: { id: string; outcome_text: string }[]
}

type Props = {
  compact?: boolean
  selectedUnitId?: string
  onSelectUnit?: (id: string) => void
  onPlanUnit?: (id: string) => void
  mappedUnits?: Record<string, CatalogRecord>
  catalogLoading?: boolean
  catalogError?: string
}

const border = '#dae6de'
const ink = '#173f32'
const muted = '#52675c'
const control = { minHeight: 44, border: '1px solid #ccdcd1', borderRadius: 9, padding: '9px 12px', background: '#fff', color: ink, width: '100%' } as const

/** Source-attributed VibeSchool reader, not a copy of the protected KICD PDF. */
export default function Grade6EnglishMap({
  compact = false, selectedUnitId, onSelectUnit, onPlanUnit,
  mappedUnits = {}, catalogLoading = false, catalogError = '',
}: Props) {
  const [localUnit, setLocalUnit] = useState('1.1')
  const [themeId, setThemeId] = useState(1)
  const [search, setSearch] = useState('')
  const selected = selectedUnitId ?? localUnit
  const current = GRADE6_ENGLISH_UNITS.find(unit => unit.id === selected) ?? GRADE6_ENGLISH_UNITS[0]
  const theme = GRADE6_ENGLISH_THEMES.find(item => item.id === themeId) ?? GRADE6_ENGLISH_THEMES[0]
  const matches = useMemo(() => GRADE6_ENGLISH_UNITS.filter(unit =>
    (unit.strand + ' ' + unit.title + ' ' + unit.outcomes.join(' ')).toLowerCase().includes(search.trim().toLowerCase())
  ), [search])
  const setUnit = (id: string) => { onSelectUnit?.(id); if (!onSelectUnit) setLocalUnit(id) }
  const mapped = mappedUnits[current.id]
  const card = { background: '#fff', border: `1px solid ${border}`, borderRadius: 14, padding: compact ? 14 : 18 } as const

  return (
    <section aria-label="Grade 6 English KICD-aligned curriculum map" style={{ ...card, color: ink, marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', color: '#3f7756' }}>GRADE 6 · ENGLISH LANGUAGE</div>
      <h2 style={{ margin: '6px 0', fontSize: compact ? 19 : 23 }}>Curriculum map</h2>
      <p style={{ margin: '0 0 12px', color: muted, fontSize: 13, lineHeight: 1.6 }}>
        Follow the KICD revised 2024 strand, sub-strand and theme structure. Learning outcomes and teaching ideas here are written by VibeSchool; they are not official KICD wording.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 14 }}>
        {['4 strands', '10 summary sub-strands', '13 themes', '150 suggested lessons', '5 lessons per week'].map(label =>
          <span key={label} style={{ background: '#eff6f1', padding: '6px 9px', borderRadius: 20, color: ink, fontWeight: 700, fontSize: 12 }}>{label}</span>
        )}
      </div>
      <div style={{ display: 'grid', gap: 11, gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))' }}>
        <label style={{ fontWeight: 700, fontSize: 13 }}>Teaching theme
          <select aria-label="Grade 6 teaching theme" value={themeId} onChange={e => setThemeId(Number(e.target.value))} style={{ ...control, marginTop: 5 }}>
            {GRADE6_ENGLISH_THEMES.map(item => <option key={item.id} value={item.id}>{item.id}. {item.title}</option>)}
          </select>
        </label>
        <label style={{ fontWeight: 700, fontSize: 13 }}>Find a skill or outcome
          <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="e.g. fluency, tenses, composition" style={{ ...control, marginTop: 5 }} />
        </label>
      </div>
      <p style={{ fontSize: 13, color: muted, lineHeight: 1.5, margin: '10px 0 13px' }}>
        <strong>{theme.title}.</strong> Teaching context: {theme.context}. The skill list below spans the full year; teachers apply skills through these 13 themes.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 14 }}>
        {matches.map(unit =>
          <button type="button" key={unit.id} onClick={() => setUnit(unit.id)} aria-pressed={current.id === unit.id}
            style={{ minHeight: 40, borderRadius: 9, padding: '8px 11px', fontWeight: current.id === unit.id ? 800 : 600, background: current.id === unit.id ? ink : '#fff', color: current.id === unit.id ? '#fff' : ink, border: `1px solid ${current.id === unit.id ? ink : border}`, cursor: 'pointer', fontSize: 12 }}>
            {unit.id} · {unit.title}
          </button>
        )}
        {matches.length === 0 && <p role="status">No matching skill. Try another term.</p>}
      </div>
      <article style={{ background: '#f8faf8', border: `1px solid ${border}`, borderRadius: 12, padding: compact ? 12 : 16 }}>
        <div style={{ fontSize: 12, color: muted, fontWeight: 700 }}>{current.strand} · {current.lessons} suggested lessons</div>
        <h3 style={{ fontSize: 19, margin: '5px 0 12px' }}>{current.title}</h3>
        <h4 style={{ fontSize: 13, margin: '0 0 6px' }}>VibeSchool learning outcomes</h4>
        <ol style={{ margin: '0 0 14px', paddingLeft: 20, fontSize: 13, lineHeight: 1.7 }}>
          {current.outcomes.map((outcome, i) => <li key={i}>{outcome}</li>)}
        </ol>
        <h4 style={{ fontSize: 13, margin: '0 0 6px' }}>Suggested learning experiences</h4>
        <ul style={{ margin: '0 0 14px', paddingLeft: 20, fontSize: 13, lineHeight: 1.7 }}>
          {current.experiences.map((experience, i) => <li key={i}>{experience}</li>)}
        </ul>
        <div style={{ fontSize: 13, lineHeight: 1.7, color: ink }}>
          <strong>Key inquiry:</strong> {current.inquiry.join(' ')}
          <div><strong>Resources:</strong> {current.resources}</div>
          <div><strong>Assessment:</strong> {current.assessment}</div>
          <div><strong>Core competencies:</strong> {current.competencies}</div>
        </div>
        {onPlanUnit && <div style={{ marginTop: 14 }}>
          <p style={{ color: mapped ? '#28654d' : muted, fontSize: 12, margin: '0 0 8px' }}>
            {catalogLoading ? 'Checking saved curriculum identities…' : catalogError ? catalogError : mapped ? `Linked to ${mapped.outcomes.length} persisted learning outcomes` : 'Not yet connected to persisted learning outcomes.'}
          </p>
          <button type="button" disabled={!mapped || catalogLoading || Boolean(catalogError)} onClick={() => onPlanUnit(current.id)}
            style={{ minHeight: 44, background: ink, opacity: mapped && !catalogLoading && !catalogError ? 1 : .45, color: '#fff', fontWeight: 800, border: 0, padding: '10px 16px', borderRadius: 10, cursor: mapped ? 'pointer' : 'not-allowed' }}>
            Plan this skill in Scheme of Work
          </button>
        </div>}
      </article>
      <p style={{ fontSize: 12, color: muted, margin: '12px 0 0', lineHeight: 1.6 }}>
        Annual sub-strand totals are KICD source facts. Term/week pacing is a school planning suggestion, not an official KICD schedule. Official outcome-by-outcome reconciliation remains pending.{' '}
        <a href={GRADE6_ENGLISH_SOURCE_URL} target="_blank" rel="noopener noreferrer" style={{ color: '#185b41', fontWeight: 700, textDecoration: 'underline' }}>View original KICD source</a>
      </p>
    </section>
  )
}
