'use client'
import { useMemo } from 'react'
import {
 GRADE8_MATHEMATICS_UNITS,
 GRADE8_MATHEMATICS_SOURCE_URL,
 GRADE8_MATHEMATICS_LESSONS
} from '@/lib/teaching/grade8MathematicsCatalog.mjs'

const green='#175b43'
export default function Grade8MathematicsMap({
 selectedUnitId='1.1',onSelectUnit,onPlanUnit,termSelected=false,mappedUnits={},catalogLoading=false,catalogError=''
}){
 const strands=[...new Set(GRADE8_MATHEMATICS_UNITS.map(unit=>unit.strand))]
 const chosen=GRADE8_MATHEMATICS_UNITS.find(unit=>unit.id===selectedUnitId)||GRADE8_MATHEMATICS_UNITS[0]
 const record=mappedUnits[chosen.id]
 const units=useMemo(()=>GRADE8_MATHEMATICS_UNITS.filter(unit=>unit.strand===chosen.strand),[chosen.strand])
 return <section aria-label="Grade 8 Mathematics KICD-referenced curriculum map" style={{background:'#fff',border:'1px solid #d9e7df',borderRadius:15,padding:16,marginBottom:14}}>
  <div style={{fontSize:11,color:green,fontWeight:800,letterSpacing:'.06em'}}>GRADE 8 · MATHEMATICS · CURRICULUM</div>
  <h2 style={{fontSize:22,color:'#163d2d',margin:'6px 0'}}>What learners should achieve</h2>
  <p style={{fontSize:13,lineHeight:1.6,color:'#456252',margin:'0 0 10px'}}>
   5 strands · 16 sub-strands · {GRADE8_MATHEMATICS_LESSONS} suggested lessons · 5 lessons per week.
   Structure and lesson allocations follow the KICD 2024 revised design. Teaching outcome guidance is independently authored by VibeSchool, not reproduced official KICD text.
  </p>
  <a href={GRADE8_MATHEMATICS_SOURCE_URL} target="_blank" rel="noreferrer" style={{display:'inline-block',fontWeight:700,fontSize:13,color:green,marginBottom:16}}>
   Read the original KICD curriculum on KICD's website ↗
  </a>
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(145px,1fr))',gap:8,marginBottom:14}}>
   {strands.map(strand=><button type="button" key={strand} onClick={()=>onSelectUnit(GRADE8_MATHEMATICS_UNITS.find(unit=>unit.strand===strand).id)}
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
    !record?<p role="status">Canonical source linkage is not yet available.</p>:
    <ol style={{fontSize:13,color:'#345746',lineHeight:1.6,paddingLeft:19,margin:'7px 0 11px'}}>
     {record.outcomes.map(item=><li key={item.id}>{item.outcome_text}</li>)}
    </ol>}
   {record && <p style={{fontSize:12,color:'#456252',lineHeight:1.5,margin:'8px 0'}}>
     {record.outcomes.length} VibeSchool-authored learning outcomes are linked by canonical identity for Scheme planning. Source-exact KICD outcome verification is separate and remains pending.
   </p>}
   {onPlanUnit&&record?<button type="button" onClick={()=>onPlanUnit(chosen.id)}
    style={{border:0,background:green,color:'#fff',fontWeight:800,borderRadius:10,padding:'11px 14px',minHeight:44,width:'100%',cursor:'pointer'}}>Open this sub-strand in Scheme of Work</button>:null}
   {record&&onPlanUnit&&!termSelected&&<p style={{fontSize:12,color:'#456252',margin:'8px 0 0'}}>You can open the Scheme now. Select a term before saving a lesson.</p>}
  </div>
 </section>
}
