'use client'
import { useMemo } from 'react'
import {
 GRADE4_MATHEMATICS_UNITS,
 GRADE4_MATHEMATICS_SOURCE_URL,
 GRADE4_MATHEMATICS_LESSONS
} from '@/lib/teaching/grade4MathematicsCatalog.mjs'

const green='#175b43'
export default function Grade4MathematicsMap({
 selectedUnitId='1.1',onSelectUnit,onPlanUnit=undefined,mappedUnits={},catalogLoading=false,catalogError='',compact=false
}){
 const strands=[...new Set(GRADE4_MATHEMATICS_UNITS.map(unit=>unit.strand))]
 const chosen=GRADE4_MATHEMATICS_UNITS.find(unit=>unit.id===selectedUnitId)||GRADE4_MATHEMATICS_UNITS[0]
 const record=mappedUnits[chosen.id]
 const units=useMemo(()=>GRADE4_MATHEMATICS_UNITS.filter(unit=>unit.strand===chosen.strand),[chosen.strand])
 return <section aria-label="Grade 4 Mathematics KICD-referenced curriculum map" style={{background:'#fff',border:'1px solid #d9e7df',borderRadius:15,padding:16,marginBottom:14}}>
  <div style={{fontSize:11,color:green,fontWeight:800,letterSpacing:'.06em'}}>GRADE 4 · MATHEMATICS · CURRICULUM</div>
  <h2 style={{fontSize:22,color:'#163d2d',margin:'6px 0'}}>What learners should achieve</h2>
  <p style={{fontSize:13,lineHeight:1.6,color:'#456252',margin:'0 0 10px'}}>
   4 strands · 19 sub-strands · {GRADE4_MATHEMATICS_LESSONS} suggested lessons · 5 lessons per week.
   The 2024 KICD design supplies the strand and sub-strand structure; VibeSchool provides independently authored teaching guidance. Whole Numbers has a 20-lesson VibeSchool pacing allocation because the published table does not show a lesson count. No official KICD text has been reproduced.
  </p>
  <a href={GRADE4_MATHEMATICS_SOURCE_URL} target="_blank" rel="noreferrer" style={{display:'inline-block',fontWeight:700,fontSize:13,color:green,marginBottom:16}}>
   Read the original KICD curriculum on KICD's website ↗
  </a>
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(145px,1fr))',gap:8,marginBottom:14}}>
   {strands.map(strand=><button type="button" key={strand} onClick={()=>onSelectUnit(GRADE4_MATHEMATICS_UNITS.find(unit=>unit.strand===strand).id)}
     aria-pressed={chosen.strand===strand}
     style={{border:'1px solid #c7d9cd',background:chosen.strand===strand?'#e6f3eb':'#fff',color:'#173f31',borderRadius:9,minHeight:45,padding:'8px 10px',fontWeight:700,textAlign:'left',cursor:'pointer'}}>{strand}</button>)}
  </div>
  <div style={{display:'flex',flexWrap:'wrap',gap:7,marginBottom:14}}>
   {units.map(unit=><button key={unit.id} type="button" onClick={()=>onSelectUnit(unit.id)} aria-pressed={chosen.id===unit.id}
    style={{border:'1px solid #d5e4d9',background:chosen.id===unit.id?'#175b43':'#fff',color:chosen.id===unit.id?'#fff':'#325443',borderRadius:10,padding:'9px 12px',minHeight:40,cursor:'pointer',fontWeight:700}}>
    {unit.id} {unit.title}</button>)}
  </div>
  <div style={{background:'#f6fbf7',borderRadius:12,padding:14}}>
   <h3 style={{color:'#14392a',fontSize:18,margin:'0 0 7px'}}>{chosen.id} {chosen.title}</h3>
   <p style={{fontSize:12,color:'#466653',margin:'0 0 8px'}}>{chosen.lessons} suggested lessons</p>
   <strong style={{fontSize:13}}>VibeSchool learning-outcome guidance</strong>
   {catalogLoading?<p role="status">Connecting canonical learning records…</p>:
    catalogError?<p role="alert" style={{color:'#9f1239'}}>{catalogError}</p>:
    !record?(!compact?<p role="status">Canonical source linkage is not yet available.</p>:null):
    <ol style={{fontSize:13,color:'#345746',lineHeight:1.6,paddingLeft:19,margin:'7px 0 11px'}}>
     {record.outcomes.map(item=><li key={item.id}>{item.outcome_text}</li>)}
    </ol>}
   <p style={{fontSize:12,color:'#466653',margin:'10px 0 7px'}}><strong>Resources:</strong> {chosen.resources}</p>
   <p style={{fontSize:12,color:'#466653',margin:'0 0 11px'}}><strong>Assessment:</strong> {chosen.assessment}</p>
   {onPlanUnit&&record?<button type="button" onClick={()=>onPlanUnit(chosen.id)}
    style={{border:0,background:green,color:'#fff',fontWeight:800,borderRadius:10,padding:'11px 14px',minHeight:44,width:'100%',cursor:'pointer'}}>Open this sub-strand in Scheme of Work</button>:null}
  </div>
 </section>
}
