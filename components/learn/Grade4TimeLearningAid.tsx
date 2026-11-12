'use client'

import { useState } from 'react'
import { Clock3, RotateCcw, MoveRight } from 'lucide-react'
import styles from './Grade4TimeContentReader.module.css'

/**
 * Original, optional teaching models drawn in the browser. These do not alter
 * the certified lesson manuscript, claim content-library certification, or
 * access protected assessment data.
 */
function ClockExplorer() {
  const [hour, setHour] = useState(8)
  const [minute, setMinute] = useState(25)
  const angleMin = minute * 6 * Math.PI / 180
  const angleHour = ((hour % 12) * 30 + minute * .5) * Math.PI / 180
  const hand = (angle: number, length: number) => ({
    x: 120 + Math.sin(angle) * length,
    y: 116 - Math.cos(angle) * length,
  })
  const minEnd = hand(angleMin, 67)
  const hourEnd = hand(angleHour, 44)
  const digital = String(hour).padStart(2,'0') + ':' + String(minute).padStart(2,'0')
  function change(step: number) {
    const next = ((hour % 12) * 60 + minute + step + 720) % 720
    setHour(Math.floor(next / 60) || 12)
    setMinute(next % 60)
  }
  return <figure className={styles.model} aria-label="Explore analogue and digital clock readings">
    <figcaption className={styles.modelHead}><Clock3 size={19} aria-hidden="true"/>
      <strong>Explore a clock</strong><span>Move the hands in five-minute steps</span>
    </figcaption>
    <div className={styles.clockDisplay}>
      <svg viewBox="0 0 240 232" className={styles.clockSvg} role="img"
        aria-label={'Analogue clock showing ' + digital + '. Short green hand shows hours; blue hand shows minutes.'}>
        <circle cx="120" cy="116" r="103" fill="#fff" stroke="#2d7957" strokeWidth="5"/>
        <circle cx="120" cy="116" r="92" fill="none" stroke="#d9e9dc" strokeWidth="2"/>
        {Array.from({length:60},(_,i) => {
          const a = i * 6 * Math.PI / 180
          const large = i % 5 === 0
          const inner = large ? 85 : 90
          return <line key={i} x1={120+Math.sin(a)*inner} y1={116-Math.cos(a)*inner}
            x2={120+Math.sin(a)*96} y2={116-Math.cos(a)*96}
            stroke={large?'#2d7957':'#9bbdab'} strokeWidth={large?2.5:1.2}/>
        })}
        {Array.from({length:12},(_,i) => {
          const num = i+1
          const a = num * 30 * Math.PI / 180
          return <text key={num} textAnchor="middle" dominantBaseline="central"
            x={120+Math.sin(a)*74} y={116-Math.cos(a)*74}
            fontSize="14" fill="#244f3a" fontWeight="800">{num}</text>
        })}
        <line x1="120" y1="116" x2={hourEnd.x} y2={hourEnd.y}
          stroke="#1c5439" strokeWidth="9" strokeLinecap="round"/>
        <line x1="120" y1="116" x2={minEnd.x} y2={minEnd.y}
          stroke="#326aaf" strokeWidth="5" strokeLinecap="round"/>
        <circle cx="120" cy="116" r="7" fill="#1c5439" stroke="#fff" strokeWidth="2"/>
      </svg>
      <div className={styles.digitalReadout}>
        <span>Digital time</span><output aria-live="polite" aria-atomic="true">{digital}</output>
        <small>Green = hour hand. Blue = minute hand.</small>
      </div>
    </div>
    <div className={styles.modelControls}>
      <button type="button" onClick={()=>change(-5)}>− 5 minutes</button>
      <button type="button" onClick={()=>{setHour(8);setMinute(25)}}>
        <RotateCcw size={14} aria-hidden="true"/> Reset
      </button>
      <button type="button" onClick={()=>change(5)}>+ 5 minutes</button>
    </div>
    <p className={styles.modelNote}>Reset to 08:25 and predict where the long hand will point after ten minutes. Tap + 5 minutes twice to check.</p>
    <p className={styles.modelNote}>Each number on the clock represents five minutes for the long hand. Watch how the short hand gradually moves.</p>
  </figure>
}

function TimeConversionBars() {
  const [extra,setExtra] = useState(35)
  const width = extra/60*110
  return <figure className={styles.model} aria-label="Explore converting hours and minutes">
    <figcaption className={styles.modelHead}><MoveRight size={19} aria-hidden="true"/>
      <strong>See how hours become minutes</strong><span>Two complete hours and extra minutes</span>
    </figcaption>
    <svg viewBox="0 0 370 126" className={styles.barSvg} role="img"
      aria-label={'Two 60-minute bars plus ' + extra + ' minutes, giving ' + (120+extra) + ' minutes.'}>
      <rect x="7" y="25" width="110" height="46" rx="7" fill="#B9D8F7" stroke="#3971BE" strokeWidth="2"/>
      <rect x="123" y="25" width="110" height="46" rx="7" fill="#B9D8F7" stroke="#3971BE" strokeWidth="2"/>
      {extra > 0 && <rect x="239" y="25" width={width} height="46" rx="7" fill="#F8D99B" stroke="#B78023" strokeWidth="2"/>}
      <g fontSize="15" textAnchor="middle" fontWeight="800" fill="#153D6D">
        <text x="62" y="53">60</text><text x="178" y="53">60</text>
      </g>
      {width > 32 && <text x={239+width/2} y="53" fontSize="15" textAnchor="middle" fontWeight="800" fill="#734D10">{extra}</text>}
      <g fontSize="12" textAnchor="middle" fill="#365848">
        <text x="62" y="91">1 hour</text><text x="178" y="91">1 hour</text>
        <text x={239+Math.max(22,width/2)} y="91">{extra} min</text>
      </g>
      <text x="181" y="119" fontSize="11" textAnchor="middle" fill="#52675B">Each long bar represents one complete hour</text>
    </svg>
    <label className={styles.barLabel} htmlFor="time-extra-minutes">Extra minutes: <strong>{extra}</strong></label>
    <input type="range" className={styles.barSlider} id="time-extra-minutes" min={0} max={59}
      value={extra} onChange={event=>setExtra(Number(event.target.value))}/>
    <p className={styles.conversionResult} aria-live="polite">60 + 60 + {extra} = <strong>{120+extra} minutes</strong></p>
    <p className={styles.modelNote}>Change the extra minutes and watch the diagram. One hour always contains 60 minutes.</p>
  </figure>
}

function DayTimeline() {
  return <figure className={styles.model} aria-label="Morning and afternoon time timeline">
    <figcaption className={styles.modelHead}><Clock3 size={19} aria-hidden="true"/>
      <strong>Explore a full day</strong><span>See the difference between a.m. and p.m.</span>
    </figcaption>
    <svg viewBox="0 0 390 96" className={styles.barSvg} role="img"
      aria-label="Midnight starts a.m.; midday starts p.m.; the next midnight starts a new day.">
      <rect x="7" y="30" width="186" height="27" rx="7" fill="#C8E4F5"/>
      <rect x="197" y="30" width="186" height="27" rx="7" fill="#F9DAB1"/>
      <text x="100" y="49" textAnchor="middle" fill="#214F7B" fontSize="15" fontWeight="800">a.m.</text>
      <text x="290" y="49" textAnchor="middle" fill="#88541C" fontSize="15" fontWeight="800">p.m.</text>
      <g textAnchor="middle" fill="#385547" fontSize="11">
        <text x="22" y="15">12 a.m.</text><text x="194" y="15">12 p.m.</text><text x="366" y="15">12 a.m.</text>
        <text x="24" y="78">Midnight</text><text x="194" y="78">Midday</text><text x="366" y="78">Midnight</text>
      </g>
    </svg>
    <p className={styles.modelNote}>a.m. is before midday, while p.m. is from midday until midnight.</p>
  </figure>
}

export default function Grade4TimeLearningAid({lessonNumber,sectionId}:{
  lessonNumber:number
  sectionId:string
}) {
  if (lessonNumber===1 && sectionId==='understand') return <DayTimeline/>
  if (lessonNumber===2 && sectionId==='example') return <ClockExplorer/>
  if (lessonNumber===4 && sectionId==='example') return <TimeConversionBars/>
  return null
}
