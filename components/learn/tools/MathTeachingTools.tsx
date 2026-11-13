'use client'

import { useState } from 'react'
import type { TeachingToolId, TeachingToolSpec } from '@/lib/learn/teachingToolCatalog'
import styles from './TeachingTools.module.css'

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
const fmt = (value: number) => Number(value.toPrecision(8)).toLocaleString('en-KE')

function NumberLine({ spec }: { spec: TeachingToolSpec }) {
  const [position, setPosition] = useState(clamp(spec.number ?? 0, -10, 10))
  return <div className={styles.stack}>
    <label htmlFor="tool-number-line">Move the marker: <strong>{position}</strong></label>
    <input id="tool-number-line" aria-label="Number line position" type="range" min="-10" max="10" step="1" value={position} onChange={e => setPosition(Number(e.target.value))} />
    <div className={styles.numberLine} role="img" aria-label={`Number line from negative ten to ten, marker at ${position}`}>
      {Array.from({ length: 21 }, (_, i) => <span key={i} className={i - 10 === position ? styles.activeTick : ''} title={String(i - 10)}>
        <span aria-hidden="true">{i - 10 === position ? '●' : '·'}</span>
        {i % 5 === 0 ? <small>{i - 10}</small> : null}
      </span>)}
    </div>
    <p className={styles.explain}>{position < 0 ? `${Math.abs(position)} steps left of zero.` : position > 0 ? `${position} steps right of zero.` : 'At zero.'}</p>
    <button type="button" className={styles.secondary} onClick={() => setPosition(0)}>Back to zero</button>
  </div>
}

function PlaceValue({ spec }: { spec: TeachingToolSpec }) {
  const [number, setNumber] = useState(String(Math.floor(clamp(spec.number ?? 20458, 0, 999999))))
  const valid = /^\d{1,6}$/.test(number)
  const digits = valid ? Number(number).toString().split('') : []
  const places = ['hundred thousands', 'ten thousands', 'thousands', 'hundreds', 'tens', 'ones']
  return <div className={styles.stack}>
    <label htmlFor="tool-place-number">Choose a whole number (0–999999)</label>
    <input id="tool-place-number" type="number" min="0" max="999999" step="1" value={number} onChange={e => setNumber(e.target.value)} />
    {!valid ? <p role="alert">Enter a whole number from 0 to 999999.</p>
      : <><div className={styles.digitGrid}>{digits.map((digit, index) => {
        const power = digits.length - index - 1
        return <div key={index}><strong>{digit}</strong><small>{places[5 - power]}</small></div>
      })}</div>
      <p className={styles.explain}>Expanded form: {digits.map((digit, index) => Number(digit) * 10 ** (digits.length - index - 1)).filter(Boolean).map(fmt).join(' + ') || '0'}</p></>}
  </div>
}

function FractionBars() {
  const [a, setA] = useState(1), [b, setB] = useState(2)
  const [c, setC] = useState(2), [d, setD] = useState(3)
  const fraction = (n: number, den: number, name: string, onN: (n: number) => void, onD: (n: number) => void) =>
    <div className={styles.stack}>
      <div className={styles.controlRow}>
        <label>{name} numerator <input type="number" min="0" max={den} value={n} onChange={e => onN(clamp(Math.floor(Number(e.target.value)), 0, den))} /></label>
        <label>denominator <input type="number" min="1" max="12" value={den} onChange={e => { const next = clamp(Math.floor(Number(e.target.value)), 1, 12); onD(next); onN(Math.min(next, n)) }} /></label>
      </div>
      <div className={styles.fractionBar} role="img" aria-label={`${n} of ${den} equal parts shaded`}>
        {Array.from({ length: den }, (_, i) => <span key={i} className={i < n ? styles.filled : ''} />)}
      </div>
      <strong>{n}/{den}</strong>
    </div>
  return <div className={styles.stack}>
    {fraction(a, b, 'First fraction', setA, setB)}
    {fraction(c, d, 'Second fraction', setC, setD)}
    <p className={styles.explain}>{a * d === c * b ? 'The fractions are equal.' : a * d > c * b ? 'The first fraction is greater.' : 'The second fraction is greater.'}</p>
  </div>
}

function MultiplicationArray() {
  const [rows, setRows] = useState(3), [columns, setColumns] = useState(4)
  return <div className={styles.stack}>
    <div className={styles.controlRow}>
      <label>Rows <input type="number" min="1" max="10" value={rows} onChange={e => setRows(clamp(Math.floor(Number(e.target.value)), 1, 10))} /></label>
      <label>Columns <input type="number" min="1" max="10" value={columns} onChange={e => setColumns(clamp(Math.floor(Number(e.target.value)), 1, 10))} /></label>
    </div>
    <div className={styles.array} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 28px))` }}
      role="img" aria-label={`${rows} rows of ${columns} dots: ${rows * columns} dots total`}>
      {Array.from({ length: rows * columns }, (_, i) => <span key={i} />)}
    </div>
    <p className={styles.explain}>{rows} rows × {columns} in each row = <strong>{rows * columns}</strong></p>
  </div>
}

function Clock() {
  const [hour, setHour] = useState(3), [minute, setMinute] = useState(0)
  const point = (angle: number, length: number) => {
    const radians = angle * Math.PI / 180
    return { x: 100 + Math.sin(radians) * length, y: 100 - Math.cos(radians) * length }
  }
  const shortHand = point((hour % 12 + minute / 60) * 30, 44)
  const longHand = point(minute * 6, 65)
  return <div className={styles.stack}>
    <div className={styles.controlRow}>
      <label>Hour <select value={hour} onChange={e => setHour(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select></label>
      <label>Minute <select value={minute} onChange={e => setMinute(Number(e.target.value))}>{Array.from({ length: 60 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}</option>)}</select></label>
    </div>
    <svg className={styles.clock} viewBox="0 0 200 200" role="img" aria-label={`Clock showing ${hour}:${String(minute).padStart(2, '0')}`}>
      <circle cx="100" cy="100" r="90" fill="#fff" stroke="#37664b" strokeWidth="4" />
      {Array.from({ length: 12 }, (_, i) => { const p = point((i + 1) * 30, 74); return <text key={i} x={p.x} y={p.y + 5} textAnchor="middle" fontSize="13" fill="#233c2d">{i + 1}</text> })}
      <line x1="100" y1="100" x2={shortHand.x} y2={shortHand.y} stroke="#255f43" strokeWidth="6" strokeLinecap="round" />
      <line x1="100" y1="100" x2={longHand.x} y2={longHand.y} stroke="#3565a7" strokeWidth="3" strokeLinecap="round" />
      <circle cx="100" cy="100" r="5" fill="#255f43" />
    </svg>
    <p className={styles.explain}>Time: <strong>{hour}:{String(minute).padStart(2, '0')}</strong>. The shorter hand shows hours; the longer hand shows minutes.</p>
    <button type="button" className={styles.secondary} onClick={() => { setHour(3); setMinute(0) }}>Reset clock</button>
  </div>
}

const units = {
  time: { second: 1, minute: 60, hour: 3600 },
  length: { millimetre: 0.001, centimetre: 0.01, metre: 1, kilometre: 1000 },
  mass: { gram: 1, kilogram: 1000 },
} as const

function UnitConverter() {
  const [family, setFamily] = useState<keyof typeof units>('time')
  const [from, setFrom] = useState('hour')
  const [to, setTo] = useState('minute')
  const [amount, setAmount] = useState('2')
  const options = Object.keys(units[family])
  const rates = units[family] as Record<string, number>
  const valid = amount.trim() !== '' && Number.isFinite(Number(amount)) && Number(amount) >= 0 && Number(amount) <= 1000000000
  const result = valid && rates[from] && rates[to] ? Number(amount) * rates[from] / rates[to] : null
  return <div className={styles.stack}>
    <div className={styles.controlRow}>
      <label>Measure <select value={family} onChange={e => {
        const selected = e.target.value as keyof typeof units
        const names = Object.keys(units[selected])
        setFamily(selected); setFrom(names[0]); setTo(names[1] ?? names[0])
      }}><option value="time">Time</option><option value="length">Length</option><option value="mass">Mass</option></select></label>
      <label>Amount <input type="number" min="0" max="1000000000" step="any" value={amount} onChange={e => setAmount(e.target.value)} /></label>
      <label>From <select value={from} onChange={e => setFrom(e.target.value)}>{options.map(x => <option key={x}>{x}</option>)}</select></label>
      <label>To <select value={to} onChange={e => setTo(e.target.value)}>{options.map(x => <option key={x}>{x}</option>)}</select></label>
    </div>
    {result === null ? <p role="alert">Enter an amount between 0 and 1,000,000,000.</p>
      : <p className={styles.explain} role="status"><strong>{fmt(Number(amount))} {from} = {fmt(result)} {to}</strong></p>}
  </div>
}

export default function MathTeachingTool({ spec }: { spec: TeachingToolSpec }) {
  const id: TeachingToolId = spec.id
  switch (id) {
    case 'number-line': return <NumberLine spec={spec} />
    case 'place-value': return <PlaceValue spec={spec} />
    case 'fraction-bars': return <FractionBars />
    case 'multiplication-array': return <MultiplicationArray />
    case 'clock': return <Clock />
    case 'unit-converter': return <UnitConverter />
    default: return null
  }
}
