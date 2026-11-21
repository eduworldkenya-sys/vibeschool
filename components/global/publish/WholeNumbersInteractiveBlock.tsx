'use client'

import { useId, useState } from 'react'
import type { ContentBlock } from '@/lib/publishTypes'
import {
  boundedWholeNumber, expandedWholeNumber, factorsOf,
  multiplesOf, placeValueCells, romanUpToTen, roundToNearestTen,
} from '@/lib/learn/wholeNumberExplorer'

type Mode = 'place' | 'round' | 'factors' | 'roman'
const MODES: { id: Mode; label: string }[] = [
  { id: 'place', label: 'Place value' },
  { id: 'round', label: 'Rounding' },
  { id: 'factors', label: 'Factors & multiples' },
  { id: 'roman', label: 'Roman numerals' },
]

const SURFACE = '#101b2c'
const BORDER = 'rgba(255,255,255,.16)'
const TEXT = '#f8fafc'
const MUTED = '#cad5e3'
const ACCENT = '#ccff00'
const button = { background: '#202d40', color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '11px 12px', fontWeight: 700 as const }
const field = { display: 'block', width: '100%', minHeight: 44, boxSizing: 'border-box' as const, borderRadius: 10, color: TEXT, background: '#19263a', border: `1px solid ${BORDER}`, fontSize: 18, padding: '9px 12px' }

export function WholeNumbersInteractiveBlock({ block }: { block: ContentBlock }) {
  const controlId = useId()
  const [mode, setMode] = useState<Mode>('place')
  const [input, setInput] = useState('3482')
  const [placeIndex, setPlaceIndex] = useState(0)

  const min = mode === 'factors' || mode === 'roman' ? 1 : 0
  const max = mode === 'round' ? 1000 : mode === 'factors' ? 50 : mode === 'roman' ? 10 : 99999
  const value = boundedWholeNumber(input, min, max)
  const cells = value === null ? [] : placeValueCells(value)
  const selected = cells[Math.min(placeIndex, Math.max(0, cells.length - 1))]
  const bottom = value === null ? 0 : Math.floor(value / 10) * 10
  const rounded = value === null ? null : mode === 'round' ? roundToNearestTen(value) : null

  function switchMode(next: Mode) {
    setMode(next)
    setPlaceIndex(0)
    setInput(next === 'place' ? '3482' : next === 'round' ? '995' : next === 'factors' ? '36' : '6')
  }

  return <section aria-label="Explore whole numbers" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 15, color: TEXT, maxWidth: '100%', overflow: 'hidden' }}>
    <h3 style={{ margin: '0 0 5px', fontWeight: 850, fontSize: 18 }}>{block.content || 'Explore whole numbers'}</h3>
    <p style={{ color: MUTED, margin: '0 0 14px', fontSize: 13, lineHeight: 1.6 }}>Change a number. See the mathematics update immediately. This activity also works without internet.</p>
    <div aria-label="Choose activity" style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 15 }}>
      {MODES.map(option => <button key={option.id} type="button" aria-pressed={mode === option.id}
        onClick={() => switchMode(option.id)}
        style={{ ...button, minHeight: 44, flexGrow: 1, fontSize: 12, background: mode === option.id ? ACCENT : '#202d40', color: mode === option.id ? '#0a1221' : TEXT }}>
        {option.label}
      </button>)}
    </div>
    <label htmlFor={controlId} style={{ display: 'block', color: MUTED, fontSize: 13, marginBottom: 6 }}>
      {mode === 'place' ? 'Whole number (0 to 99,999)' : mode === 'round' ? 'Whole number (0 to 1,000)' : mode === 'factors' ? 'Whole number (1 to 50)' : 'Whole number (1 to 10)'}
    </label>
    <input id={controlId} type="number" inputMode="numeric" min={min} max={max} step={1} value={input}
      onChange={event => { setInput(event.target.value); setPlaceIndex(0) }} style={field} />
    {value === null ? <p role="alert" style={{ color: '#ffb4b4' }}>Enter a whole number from {min.toLocaleString('en-KE')} to {max.toLocaleString('en-KE')}.</p> : <>
      {mode === 'place' && <>
        <p style={{ color: MUTED, fontSize: 13, margin: '12px 0 8px' }}>Tap a digit to see its place and total value.</p>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cells.length},minmax(0,1fr))`, gap: 5 }}>
          {cells.map((cell, index) => <button key={index} type="button" onClick={() => setPlaceIndex(index)}
            aria-pressed={Math.min(placeIndex,cells.length-1) === index}
            aria-label={`Digit ${cell.digit} in the ${cell.label} place`}
            style={{ ...button, padding: '10px 2px', minWidth: 0, background: Math.min(placeIndex,cells.length-1) === index ? ACCENT : '#202d40',
              color: Math.min(placeIndex,cells.length-1) === index ? '#0a1221' : TEXT }}>
            <span style={{ display: 'block', fontSize: 23, fontWeight: 850 }}>{cell.digit}</span>
            <span style={{ fontSize: 10, overflowWrap: 'anywhere' }}>{cell.label}</span>
          </button>)}
        </div>
        <p role="status" aria-live="polite" style={{ color: TEXT, lineHeight: 1.6, margin: '13px 0 5px' }}>
          {selected?.digit ?? 0} in the <strong>{selected?.label ?? 'ones'}</strong> place has total value <strong>{selected?.value.toLocaleString('en-KE') ?? '0'}</strong>.
        </p>
        <p style={{ color: MUTED, fontSize: 13 }}>Expanded form: {expandedWholeNumber(value)}.</p>
      </>}
      {mode === 'round' && <div role="status" aria-live="polite" style={{ marginTop: 14, lineHeight: 1.7 }}>
        <p style={{ margin: 0, color: MUTED, fontSize: 13 }}>The nearest tens are <strong>{bottom.toLocaleString('en-KE')}</strong> and <strong>{(bottom + 10).toLocaleString('en-KE')}</strong>.</p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '13px 0' }}>
          <span>{bottom}</span>
          <div style={{ flex: 1, height: 10, background: '#35435a', borderRadius: 8, position: 'relative' }}>
            <span aria-hidden="true" style={{ position: 'absolute', left: `${(value % 10) * 10}%`, top: -5, width: 16, height: 20, borderRadius: 8, background: ACCENT, transform: 'translateX(-50%)' }} />
          </div>
          <span>{bottom + 10}</span>
        </div>
        <strong>{value.toLocaleString('en-KE')} rounds to {rounded?.toLocaleString('en-KE')}.</strong>
        <p style={{ color: MUTED, fontSize: 13, margin: '6px 0 0' }}>Last digit {value % 10}. Digits 0–4 round down; digits 5–9 round up.</p>
      </div>}
      {mode === 'factors' && <div role="status" aria-live="polite" style={{ marginTop: 14, lineHeight: 1.8 }}>
        <strong>Factors of {value}</strong>
        <p style={{ color: MUTED, margin: '4px 0 12px' }}>{factorsOf(value).join(', ')}. Each factor divides {value} exactly.</p>
        <strong>First four multiples of {value}</strong>
        <p style={{ color: MUTED, margin: '4px 0 5px' }}>{multiplesOf(value).join(', ')}.</p>
        <p style={{ color: MUTED, fontSize: 13 }}>An even number makes complete pairs of counters. {value} is <strong>{value % 2 === 0 ? 'even' : 'odd'}</strong>.</p>
      </div>}
      {mode === 'roman' && <div role="status" aria-live="polite" style={{ marginTop: 14, lineHeight: 1.8 }}>
        <strong style={{ fontSize: 27 }}>{romanUpToTen(value)}</strong>
        <p style={{ color: MUTED, margin: '2px 0 0', fontSize: 13 }}>Roman numerals use I for 1, V for 5, and X for 10. IV means 4; IX means 9.</p>
      </div>}
    </>}
  </section>
}
