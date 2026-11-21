'use client'
import { useMemo } from 'react'
import Link from 'next/link'
import {
 GRADE4_MATHEMATICS_UNITS,
 GRADE4_MATHEMATICS_SOURCE_URL,
 GRADE4_MATHEMATICS_LESSONS
} from '@/lib/teaching/grade4MathematicsCatalog.mjs'
import { GRADE4_MATH_KICD_REFERENCE, GRADE4_MATH_KICD_SHARED } from '@/lib/teaching/grade4MathematicsKicdReference.mjs'

const green='#175b43'
export default function Grade4MathematicsMap({
 selectedUnitId='1.1',onSelectUnit,onPlanUnit=undefined,mappedUnits={},catalogLoading=false,catalogError='',compact=false
}){
 const strands=[...new Set(GRADE4_MATHEMATICS_UNITS.map(unit=>unit.strand))]
 const chosen=GRADE4_MATHEMATICS_UNITS.find(unit=>unit.id===selectedUnitId)||GRADE4_MATHEMATICS_UNITS[0]
 const record=mappedUnits[chosen.id]
 const reference=GRADE4_MATH_KICD_REFERENCE[chosen.id]
 const units=useMemo(()=>GRADE4_MATHEMATICS_UNITS.filter(unit=>unit.strand===chosen.strand),[chosen.strand])
 return <section aria-label="Grade 4 Mathematics KICD-referenced curriculum map" style={{background:'#fff',border:'1px solid #d9e7df',borderRadius:15,padding:16,marginBottom:14}}>
  <div style={{fontSize:11,color:green,fontWeight:800,letterSpacing:'.06em'}}>GRADE 4 · MATHEMATICS · CURRICULUM</div>
  <h2 style={{fontSize:22,color:'#163d2d',margin:'6px 0'}}>What to learn · How to teach</h2>
  <p style={{fontSize:13,lineHeight:1.6,color:'#456252',margin:'0 0 10px'}}>
   4 strands · 19 sub-strands · 5 Mathematics lessons per week (KICD). {GRADE4_MATHEMATICS_LESSONS} VibeSchool-planned periods across the year. Whole Numbers uses a 20-lesson VibeSchool pacing allocation, not a claimed KICD count. Teaching notes below are independently authored reference summaries; they are not published textbook content or official certification.
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
     {record.outcomes.map(item=><li key={item.id}>
      <span>{item.outcome_text}</span>
      {chosen.id==='2.6' && <Link href={`/teacher/outcome-package?outcomeId=${encodeURIComponent(item.id)}`}
        style={{display:'block',fontSize:12,color:green,fontWeight:750,margin:'5px 0 12px'}}>
        Open this outcome's published notes, guide and exercises
      </Link>}
     </li>)}
    </ol>}
   <div style={{borderTop:'1px solid #d8e8df',paddingTop:12,marginTop:11}}>
    <strong style={{fontSize:13,color:'#14392a'}}>Suggested learning experiences</strong>
    <ul style={{fontSize:13,color:'#345746',lineHeight:1.6,paddingLeft:18,margin:'6px 0 11px'}}>
     {chosen.experiences.map((experience,i)=><li key={i}>{experience}</li>)}
    </ul>
    <strong style={{fontSize:13,color:'#14392a'}}>Key inquiry questions</strong>
    <ul style={{fontSize:13,color:'#345746',lineHeight:1.6,paddingLeft:18,margin:'6px 0 12px'}}>
     {chosen.inquiry.map((question,i)=><li key={i}>{question}</li>)}
    </ul>
    <details style={{border:'1px solid #d5e4d9',borderRadius:10,padding:'10px 12px',margin:'9px 0'}}>
     <summary style={{cursor:'pointer',color:'#175b43',fontWeight:750,fontSize:13}}>KICD context · competencies, values and assessment</summary>
     <div style={{fontSize:13,lineHeight:1.65,color:'#345746',paddingTop:10}}>
      {reference?.competency&&<p style={{margin:'0 0 7px'}}><strong>Core competencies:</strong> {reference.competency}</p>}
      {reference?.value&&<p style={{margin:'0 0 7px'}}><strong>Values:</strong> {reference.value}</p>}
      {reference?.pci&&<p style={{margin:'0 0 7px'}}><strong>Pertinent and contemporary issues:</strong> {reference.pci}</p>}
      {reference?.subjectLink&&<p style={{margin:'0 0 7px'}}><strong>Links to other learning areas:</strong> {reference.subjectLink}</p>}
      {!reference?.competency&&<p style={{margin:'0 0 7px'}}>Unit-specific competencies, values, PCIs and links require checking against the official sub-strand pages; no unsupported source claims are inserted here.</p>}
      <p style={{margin:'0 0 7px'}}><strong>Suggested KICD resources:</strong> {reference?.materials}</p>
      <p style={{margin:'0 0 7px'}}><strong>Non-formal learning:</strong> {reference?.beyondClass}</p>
      <p style={{margin:'0 0 7px'}}><strong>Assessment approach:</strong> {GRADE4_MATH_KICD_SHARED.methods}</p>
      <p style={{margin:'0 0 7px'}}><strong>Performance levels:</strong> {GRADE4_MATH_KICD_SHARED.levels.join(' · ')}</p>
     </div>
    </details>
    <details style={{border:'1px solid #d5e4d9',borderRadius:10,padding:'10px 12px',margin:'9px 0'}}>
     <summary style={{cursor:'pointer',color:'#175b43',fontWeight:750,fontSize:13}}>Subject outcomes · learning beyond class · community service</summary>
     <div style={{fontSize:13,lineHeight:1.65,color:'#345746',paddingTop:10}}>
      <p style={{margin:'0 0 7px'}}><strong>Primary Mathematics aims:</strong> {GRADE4_MATH_KICD_SHARED.primaryOutcomes}</p>
      <p style={{margin:'0 0 7px'}}><strong>Learning beyond class:</strong> {GRADE4_MATH_KICD_SHARED.nonFormal}</p>
      <p style={{margin:'0 0 7px'}}><strong>Community Service Learning:</strong> {GRADE4_MATH_KICD_SHARED.community}</p>
      <p style={{margin:'0 0 7px'}}>National education goals, general outcomes and detailed per-skill rubrics remain in the <a href={GRADE4_MATHEMATICS_SOURCE_URL} target="_blank" rel="noreferrer" style={{color:green,fontWeight:700}}>official KICD design</a>.</p>
      <p style={{margin:0}}>{GRADE4_MATH_KICD_SHARED.officialSourceNotice}</p>
     </div>
    </details>
   </div>
   <p style={{fontSize:12,color:'#466653',margin:'10px 0 7px'}}><strong>Resources:</strong> {chosen.resources}</p>
   <p style={{fontSize:12,color:'#466653',margin:'0 0 11px'}}><strong>Assessment:</strong> {chosen.assessment}</p>
   {onPlanUnit&&record?<button type="button" onClick={()=>onPlanUnit(chosen.id)}
    style={{border:0,background:green,color:'#fff',fontWeight:800,borderRadius:10,padding:'11px 14px',minHeight:44,width:'100%',cursor:'pointer'}}>Open this sub-strand in Scheme of Work</button>:null}
  </div>
 </section>
}
