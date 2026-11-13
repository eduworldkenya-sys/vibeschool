'use client'
import { useMemo } from 'react'
import {
  GRADE3_MATHEMATICS_UNITS,
  GRADE3_MATHEMATICS_LESSONS,
  GRADE3_MATHEMATICS_SOURCE_URL,
  GRADE3_MATHEMATICS_WEEKLY_ALLOCATION,
} from '@/lib/teaching/grade3MathematicsCatalog.mjs'

const green='#175b43'
export default function Grade3MathematicsMap({
  selectedUnitId='1.1',onSelectUnit=()=>{},onPlanUnit,
  mappedUnits={},catalogLoading=false,catalogError='',compact=false
}){
  const chosen=GRADE3_MATHEMATICS_UNITS.find(unit=>unit.id===selectedUnitId)||GRADE3_MATHEMATICS_UNITS[0]
  const strands=[...new Set(GRADE3_MATHEMATICS_UNITS.map(unit=>unit.strand))]
  const units=useMemo(()=>GRADE3_MATHEMATICS_UNITS.filter(unit=>unit.strand===chosen.strand),[chosen.strand])
  const record=mappedUnits[chosen.id]
  return <section aria-label="Grade 3 Mathematics curriculum map" style={{background:'#fff',color:'#183e30',border:'1px solid #d9e7df',borderRadius:15,padding:compact?13:18,marginBottom:14}}>
    <div style={{fontSize:11,color:green,fontWeight:800,letterSpacing:'.06em'}}>GRADE 3 · MATHEMATICAL ACTIVITIES</div>
    <h2 style={{fontSize:22,margin:'6px 0'}}>Curriculum Map</h2>
    <p style={{fontSize:13,lineHeight:1.6,color:'#456252',margin:'0 0 10px'}}>
      3 strands · 14 sub-strands · {GRADE3_MATHEMATICS_LESSONS} suggested lessons · {GRADE3_MATHEMATICS_WEEKLY_ALLOCATION} per week.
      The headings and lesson counts follow the KICD revised 2024 curriculum. Teaching guides and outcomes here are VibeSchool-original, not verified word-for-word KICD transcription.
    </p>
    <a href={GRADE3_MATHEMATICS_SOURCE_URL} target="_blank" rel="noopener noreferrer" style={{display:'inline-block',fontSize:13,fontWeight:700,color:green,marginBottom:14}}>
      Read the official KICD source
    </a>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:8,marginBottom:12}}>
      {strands.map(strand=><button type="button" key={strand} onClick={()=>onSelectUnit(GRADE3_MATHEMATICS_UNITS.find(unit=>unit.strand===strand).id)}
        aria-pressed={chosen.strand===strand}
        style={{border:'1px solid #bed9c7',borderRadius:9,minHeight:44,padding:'9px 11px',fontWeight:750,color:green,textAlign:'left',background:chosen.strand===strand?'#eaf5ee':'#fff',cursor:'pointer'}}>
        {strand} · {GRADE3_MATHEMATICS_UNITS.filter(u=>u.strand===strand).reduce((n,u)=>n+u.lessons,0)} lessons
      </button>)}
    </div>
    <div style={{display:'flex',flexWrap:'wrap',gap:7,marginBottom:14}}>
      {units.map(unit=><button type="button" key={unit.id} onClick={()=>onSelectUnit(unit.id)} aria-pressed={chosen.id===unit.id}
        style={{border:'1px solid #c9e0d0',borderRadius:9,background:chosen.id===unit.id?green:'#fff',
          color:chosen.id===unit.id?'#fff':'#315843',minHeight:44,padding:'8px 12px',cursor:'pointer',fontWeight:700}}>
        {unit.id} {unit.title} · {unit.lessons}
      </button>)}
    </div>
    <article style={{background:'#f5faf6',border:'1px solid #d9e9de',borderRadius:11,padding:13}}>
      <h3 style={{fontSize:18,margin:'0 0 5px'}}>{chosen.id} {chosen.title}</h3>
      <p style={{fontSize:12,color:'#476555',margin:'0 0 10px'}}>{chosen.lessons} suggested lessons · Plan into your selected school term and week</p>
      <strong style={{fontSize:13}}>Learning-outcome guidance</strong>
      {catalogLoading?<p role="status">Loading canonical outcome links…</p>:
        catalogError?<p role="alert" style={{color:'#9f1239'}}>{catalogError}</p>:
        record?<ol style={{fontSize:13,lineHeight:1.6,paddingLeft:20,margin:'7px 0'}}>{record.outcomes.map(outcome=><li key={outcome.id}>{outcome.outcome_text}</li>)}</ol>:
        <p role="status" style={{fontSize:13}}>A canonical outcome link has not been confirmed. The Scheme save control remains unavailable.</p>}
      <p style={{fontSize:13,lineHeight:1.5,margin:'8px 0'}}><strong>Explore:</strong> {chosen.experiences.join(' ')}</p>
      <p style={{fontSize:13,lineHeight:1.5,margin:'8px 0'}}><strong>Ask:</strong> {chosen.inquiry.join(' ')}</p>
      <p style={{fontSize:13,lineHeight:1.5,margin:'8px 0'}}><strong>Resources:</strong> {chosen.resources}</p>
      <p style={{fontSize:13,lineHeight:1.5,margin:'8px 0 12px'}}><strong>Assessment:</strong> {chosen.assessment}</p>
      {onPlanUnit&&record&&<button type="button" onClick={()=>onPlanUnit(chosen.id)} style={{background:green,color:'#fff',border:0,borderRadius:9,minHeight:44,padding:'10px 14px',fontWeight:800,cursor:'pointer',width:'100%'}}>Add this sub-strand to Scheme of Work</button>}
    </article>
  </section>
}
