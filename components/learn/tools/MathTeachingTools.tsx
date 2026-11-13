'use client'

import { useId, useState } from 'react'
import type { TeachingToolId, TeachingToolSpec } from '@/lib/learn/teachingToolCatalog'
import styles from './TeachingTools.module.css'

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
const fmt = (value: number) => Number(value.toPrecision(8)).toLocaleString('en-KE')

function NumberLine({ spec }: { spec: TeachingToolSpec }) {
  const inputId = useId()
  const lower = spec.min ?? -10, upper = spec.max ?? 10
  const min = lower < upper && lower >= -1000 && upper <= 1000 ? lower : -10
  const max = lower < upper && lower >= -1000 && upper <= 1000 ? upper : 10
  const step = spec.step ?? 1
  const [position, setPosition] = useState(clamp(spec.number ?? 0, min, max))
  const ticks = Array.from({ length: 11 }, (_, i) => min + (max - min) * i / 10)
  return <div className={styles.stack}>
    <label htmlFor={inputId}>Move the marker: <strong>{fmt(position)}</strong></label>
    <input id={inputId} aria-label="Number line position" type="range" min={min} max={max} step={step}
      value={position} onChange={e => setPosition(Number(e.target.value))} />
    <div className={styles.numberLine} role="img" aria-label={'Number line from '+min+' to '+max+', marker at '+position}>
      {ticks.map((tick, i) => <span key={i} aria-hidden="true"><small>{fmt(tick)}</small></span>)}
    </div>
    <p className={styles.explain}>The marker is at <strong>{fmt(position)}</strong>.
      {position < 0 ? ' It is left of zero.' : position > 0 ? ' It is right of zero.' : ' It is at zero.'}</p>
    <button type="button" className={styles.secondary} onClick={() => setPosition(clamp(0,min,max))}>Back towards zero</button>
  </div>
}

function PlaceValue({ spec }: { spec: TeachingToolSpec }) {
  const inputId = useId()
  const [number, setNumber] = useState(String(Math.floor(clamp(spec.number ?? 20458, 0, 999999999999))))
  const valid = /^\d{1,12}$/.test(number) && Number(number) <= 999999999999
  const digits = valid ? String(Number(number)).split('') : []
  const places = ['hundred billions', 'ten billions', 'billions', 'hundred millions', 'ten millions',
    'millions', 'hundred thousands', 'ten thousands', 'thousands', 'hundreds', 'tens', 'ones']
  return <div className={styles.stack}>
    <label htmlFor={inputId}>Choose a whole number (0 to 999,999,999,999)</label>
    <input id={inputId} type="number" min="0" max="999999999999" step="1" value={number} onChange={e => setNumber(e.target.value)} />
    {!valid ? <p role="alert">Enter a whole number of up to twelve digits.</p>
      : <><div className={styles.digitGrid}>{digits.map((digit,index) => {
        const power=digits.length-index-1
        return <div key={index}><strong>{digit}</strong><small>{places[11-power]}</small></div>
      })}</div>
      <p className={styles.explain}>Expanded form: {digits.map((digit,index) =>
        Number(digit) ? digit + '0'.repeat(digits.length-index-1) : '')
        .filter(Boolean).join(' + ') || '0'}</p></>}
  </div>
}

function FractionBars() {
  const [a,setA]=useState(3), [b,setB]=useState(2)
  const [c,setC]=useState(2), [d,setD]=useState(3)
  const fraction=(n:number,den:number,name:string,onN:(n:number)=>void,onD:(n:number)=>void)=>
    <div className={styles.stack}>
      <div className={styles.controlRow}>
        <label>{name} numerator <input type="number" min="0" max={den*3} value={n}
          onChange={e=>onN(clamp(Math.floor(Number(e.target.value)),0,den*3))}/></label>
        <label>denominator <input type="number" min="1" max="12" value={den}
          onChange={e=>{const next=clamp(Math.floor(Number(e.target.value)),1,12);onD(next);onN(Math.min(next*3,n))}}/></label>
      </div>
      <div className={styles.fractionSet} role="img" aria-label={n+' of '+den+' equal parts shaded; '+Math.floor(n/den)+' wholes and '+(n%den)+' extra parts'}>
        {Array.from({length:Math.max(1,Math.ceil(n/den))},(_,barIndex)=>
          <div className={styles.fractionBar} key={barIndex}>
            {Array.from({length:den},(_,index)=>
              <span aria-hidden="true" key={index} className={barIndex*den+index<n?styles.filled:''}/>)}
          </div>)}
      </div>
      <strong>{n}/{den}</strong>
    </div>
  return <div className={styles.stack}>
    {fraction(a,b,'First fraction',setA,setB)}
    {fraction(c,d,'Second fraction',setC,setD)}
    <p className={styles.explain}>{a*d===c*b?'The fractions are equal.':a*d>c*b?'The first fraction is greater.':'The second fraction is greater.'}</p>
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
  capacity: { millilitre: 1, litre: 1000 },
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
      }}><option value="time">Time</option><option value="length">Length</option><option value="mass">Mass</option><option value="capacity">Capacity</option></select></label>
      <label>Amount <input type="number" min="0" max="1000000000" step="any" value={amount} onChange={e => setAmount(e.target.value)} /></label>
      <label>From <select value={from} onChange={e => setFrom(e.target.value)}>{options.map(x => <option key={x}>{x}</option>)}</select></label>
      <label>To <select value={to} onChange={e => setTo(e.target.value)}>{options.map(x => <option key={x}>{x}</option>)}</select></label>
    </div>
    {result === null ? <p role="alert">Enter an amount between 0 and 1,000,000,000.</p>
      : <p className={styles.explain} role="status"><strong>{fmt(Number(amount))} {from} = {fmt(result)} {to}</strong></p>}
  </div>
}

function DataChart({spec}:{spec:TeachingToolSpec}) {
  const points=spec.points ?? []
  const max=Math.max(1,...points.map(x=>x.value))
  const highest=points.reduce((best,next)=>next.value>best.value?next:best,points[0])
  return <div className={styles.stack}>
    <div className={styles.dataChart} role="img" aria-label={'Bar chart of '+points.map(p=>p.label+': '+fmt(p.value)).join(', ')}>
      {points.map((point,index)=><div key={index} className={styles.dataRow}>
        <span>{point.label}</span>
        <div className={styles.dataTrack}><div style={{width:(point.value/max*100)+'%'}}/></div>
        <strong>{fmt(point.value)}</strong>
      </div>)}
    </div>
    <p className={styles.explain}>Largest value: {highest?.label} ({fmt(highest?.value ?? 0)}). Compare the bars to describe the data.</p>
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
    case 'data-chart': return <DataChart spec={spec} />
    default: return null
  }
}
