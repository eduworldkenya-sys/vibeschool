"use client"

import React, { useMemo, useState } from 'react'

const TEXT = '#ffffff'
const MUTED = 'rgba(255,255,255,0.58)'
const ACCENT = '#CCFF00'
const CARD = '#111827'
const INNER = '#0b1220'
const BORDER = 'rgba(255,255,255,0.09)'

export type LabObservation = {
  label: string
  value: number
}

export type InteractiveLabConfig = {
  title: string
  question: string
  instructions: string
  sampleValues?: string
  unit?: string
  binSize?: number
  interpretationPrompt?: string
  conclusionHint?: string
}

export function InteractiveLab({ config }: { config: InteractiveLabConfig }) {
  const [rawValues, setRawValues] = useState(config.sampleValues ?? '')
  const [prediction, setPrediction] = useState('')
  const [interpretation, setInterpretation] = useState('')
  const [showHint, setShowHint] = useState(false)

  const numbers = useMemo(
    () => rawValues.split(',').map(value => Number(value.trim())).filter(Number.isFinite),
    [rawValues],
  )

  const summary = useMemo(() => {
    if (!numbers.length) return null
    const min = Math.min(...numbers)
    const max = Math.max(...numbers)
    const mean = numbers.reduce((sum, value) => sum + value, 0) / numbers.length
    return { min, max, mean, range: max - min }
  }, [numbers])

  const bins = useMemo(() => {
    if (!numbers.length) return [] as LabObservation[]
    const size = Math.max(1, config.binSize ?? 5)
    const start = Math.floor(Math.min(...numbers) / size) * size
    const end = Math.ceil(Math.max(...numbers) / size) * size
    const result: LabObservation[] = []

    for (let lower = start; lower <= end; lower += size) {
      const upper = lower + size - 1
      result.push({
        label: `${lower}-${upper}`,
        value: numbers.filter(value => value >= lower && value <= upper).length,
      })
    }

    return result
  }, [numbers, config.binSize])

  const peak = Math.max(1, ...bins.map(bin => bin.value))

  return (
    <section style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 16 }}>
      <div style={{ color: ACCENT, fontSize: 10, fontWeight: 900, letterSpacing: '0.12em', marginBottom: 5 }}>VIBE LAB · REUSABLE</div>
      <h3 style={{ color: TEXT, fontSize: 18, margin: '0 0 6px', lineHeight: 1.35 }}>{config.title}</h3>
      <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.6, margin: '0 0 12px' }}>{config.question}</p>

      <div style={{ background: INNER, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 12, marginBottom: 12 }}>
        <div style={{ color: ACCENT, fontSize: 10, fontWeight: 900, marginBottom: 5 }}>METHOD</div>
        <div style={{ color: TEXT, fontSize: 12, lineHeight: 1.6 }}>{config.instructions}</div>
      </div>

      <label style={{ display: 'block', color: MUTED, fontSize: 11, fontWeight: 800, marginBottom: 10 }}>
        Prediction
        <textarea value={prediction} onChange={event => setPrediction(event.target.value)} rows={2} placeholder="What do you expect to observe, and why?" style={{ width: '100%', boxSizing: 'border-box', marginTop: 5, background: INNER, color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 10, fontFamily: 'inherit' }} />
      </label>

      <label style={{ display: 'block', color: MUTED, fontSize: 11, fontWeight: 800 }}>
        Observations / measurements {config.unit ? `(${config.unit})` : ''}
        <textarea value={rawValues} onChange={event => setRawValues(event.target.value)} rows={3} placeholder="Enter comma-separated numerical observations" style={{ width: '100%', boxSizing: 'border-box', marginTop: 5, background: INNER, color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 10, fontFamily: 'inherit' }} />
      </label>

      {numbers.length > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginTop: 12 }}>
            {[
              ['n', numbers.length],
              ['mean', summary?.mean.toFixed(1) ?? '—'],
              ['range', summary?.range ?? '—'],
              ['min–max', summary ? `${summary.min}–${summary.max}` : '—'],
            ].map(([label, value]) => (
              <div key={String(label)} style={{ background: INNER, borderRadius: 9, padding: 8, textAlign: 'center', border: `1px solid ${BORDER}` }}>
                <div style={{ color: MUTED, fontSize: 9, fontWeight: 800 }}>{String(label).toUpperCase()}</div>
                <div style={{ color: TEXT, fontSize: 13, fontWeight: 900, marginTop: 3 }}>{String(value)}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'end', gap: 6, minHeight: 145, marginTop: 14, overflowX: 'auto' }}>
            {bins.map(bin => (
              <div key={bin.label} style={{ minWidth: 46, flex: 1, textAlign: 'center' }}>
                <div style={{ height: `${Math.max(8, (bin.value / peak) * 105)}px`, background: 'rgba(204,255,0,0.72)', borderRadius: '6px 6px 2px 2px', color: '#090D16', fontWeight: 900, paddingTop: 4 }}>{bin.value}</div>
                <div style={{ color: MUTED, fontSize: 9, marginTop: 5 }}>{bin.label}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <label style={{ display: 'block', color: MUTED, fontSize: 11, fontWeight: 800, marginTop: 12 }}>
        {config.interpretationPrompt ?? 'Interpretation and conclusion'}
        <textarea value={interpretation} onChange={event => setInterpretation(event.target.value)} rows={3} placeholder="Use your evidence to explain the biological pattern." style={{ width: '100%', boxSizing: 'border-box', marginTop: 5, background: INNER, color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 10, fontFamily: 'inherit' }} />
      </label>

      {config.conclusionHint && (
        <button type="button" onClick={() => setShowHint(value => !value)} style={{ width: '100%', marginTop: 10, border: `1px solid ${BORDER}`, borderRadius: 10, background: INNER, color: ACCENT, padding: 10, fontWeight: 850 }}>
          {showHint ? 'Hide thinking hint' : 'Need a thinking hint?'}
        </button>
      )}

      {showHint && config.conclusionHint && (
        <div style={{ marginTop: 8, color: TEXT, fontSize: 12, lineHeight: 1.6, background: 'rgba(204,255,0,0.06)', borderRadius: 10, padding: 10 }}>
          {config.conclusionHint}
        </div>
      )}
    </section>
  )
}
