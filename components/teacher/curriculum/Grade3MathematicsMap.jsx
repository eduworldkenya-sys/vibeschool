'use client'
import { useMemo, useState } from 'react'
import {
  GRADE3_MATHEMATICS_UNITS,
  GRADE3_MATHEMATICS_LESSONS,
  GRADE3_MATHEMATICS_SOURCE_URL,
} from '@/lib/teaching/grade3MathematicsCatalog.mjs'

const green = '#175b43'
const ink = '#173f31'
const info = {fontSize:13,lineHeight:1.6,color:'#345746'}

export default function Grade3MathematicsMap({
  selectedUnitId='1.1',onSelectUnit=()=>{},onOpenScheme=undefined,
  onPlanUnit=undefined,mappedUnits={},catalogLoading=false,catalogError=''
}){
  const [search,setSearch]=useState('')
  const [showAll,setShowAll]=useState(false)
  const current=GRADE3_MATHEMATICS_UNITS.find(x=>x.id===selectedUnitId)||GRADE3_MATHEMATICS_UNITS[0]
  const selectedIndex=GRADE3_MATHEMATICS_UNITS.indexOf(current)
  const record=mappedUnits[current.id]
  const strands=[...new Set(GRADE3_MATHEMATICS_UNITS.map(unit=>unit.strand))]
  const matches=useMemo(()=>{
    const value=search.trim().toLowerCase()
    return GRADE3_MATHEMATICS_UNITS.filter(unit=>!value||[unit.id,unit.strand,unit.title].some(v=>v.toLowerCase().includes(value)))
  },[search])
  const choose=id=>{onSelectUnit(id);setShowAll(false);setSearch('')}
  return <section aria-label="Grade 3 Mathematics curriculum outline" style={{background:'#fff',border:'1px solid #d9e7df',borderRadius:14,padding:'clamp(12px,3vw,20px)',marginBottom:14}}>
    <div style={{fontSize:11,color:green,fontWeight:800,letterSpacing:'.06em'}}>GRADE 3 · MATHEMATICAL ACTIVITIES · CURRICULUM MAP</div>
    <h2 style={{fontSize:21,color:ink,margin:'6px 0'}}>Explore what to teach</h2>
    <p style={{...info,margin:'0 0 8px'}}>3 strands · 14 sub-strands · {GRADE3_MATHEMATICS_LESSONS} suggested lessons · 5 periods a week.</p>
    <p style={{...info,fontSize:12,margin:'0 0 12px'}}>This is the revised 2024 curriculum outline, not yet a complete learning-outcome reference. You can explore topics without setting a timetable. A Scheme lesson is saved only when its canonical learning outcomes are connected.</p>
    <a href={GRADE3_MATHEMATICS_SOURCE_URL} target="_blank" rel="noopener noreferrer" style={{display:'inline-block',fontSize:13,fontWeight:750,color:green,marginBottom:14}}>Open publisher curriculum design</a>
    <nav aria-label="Grade 3 Mathematical Activities strands" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:8,marginBottom:14}}>
      {strands.map(strand=><button key={strand} type="button" onClick={()=>choose(GRADE3_MATHEMATICS_UNITS.find(unit=>unit.strand===strand).id)} aria-pressed={strand===current.strand} style={{minHeight:48,border:'1px solid #bad0c2',borderRadius:10,padding:9,background:strand===current.strand?'#e9f5ef':'#fff',color:green,fontWeight:750,cursor:'pointer'}}>{strand}</button>)}
    </nav>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap',marginBottom:12}}>
      <h3 style={{margin:0,color:ink,fontSize:18}}>{current.id} {current.title}</h3>
      <button type="button" onClick={()=>setShowAll(v=>!v)} aria-expanded={showAll} style={{minHeight:44,padding:'8px 12px',borderRadius:9,border:'1px solid #b7d2c3',background:'#fff',color:green,fontWeight:750}}>{showAll?'Close topic list':'All 14 topics'}</button>
    </div>
    {showAll&&<div style={{border:'1px solid #dce8df',borderRadius:10,padding:10,marginBottom:12}}>
      <label htmlFor="grade3-math-topic-search" style={{...info,fontWeight:750}}>Find a topic</label>
      <input id="grade3-math-topic-search" type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Numbers, Time, Fractions…" style={{width:'100%',minHeight:44,boxSizing:'border-box',fontSize:15,border:'1px solid #b0c6b9',borderRadius:8,padding:'8px 12px'}}/>
      <div style={{display:'grid',gap:6,maxHeight:320,overflowY:'auto',marginTop:8}}>
        {matches.map(unit=><button key={unit.id} type="button" onClick={()=>choose(unit.id)} style={{minHeight:44,textAlign:'left',border:'1px solid #e0eae2',borderRadius:9,padding:10,background:unit.id===current.id?'#edf6ef':'#fff',color:ink,cursor:'pointer'}}><strong>{unit.id} {unit.title}</strong> · {unit.lessons} lessons</button>)}
        {!matches.length&&<p style={info}>No topic matches.</p>}
      </div>
    </div>}
    <article style={{background:'#f8fbf9',borderRadius:10,padding:14}}>
      <p style={{...info,fontSize:12,margin:'0 0 8px'}}>{current.strand} · {current.lessons} suggested lessons</p>
      <h4 style={{margin:'0 0 6px',fontSize:14,color:ink}}>Specific learning outcomes</h4>
      {catalogLoading?<p role="status" style={{...info,margin:'0 0 12px'}}>Connecting lesson outcomes…</p>
        :catalogError?<p role="alert" style={{...info,color:'#9f1239',margin:'0 0 12px'}}>{catalogError}</p>
        :record?<><p style={{...info,fontSize:12,margin:'0 0 7px'}}>VibeSchool original learning objectives, pending official source-exact reconciliation.</p><ul style={{...info,paddingLeft:20,margin:'0 0 12px'}}>{record.outcomes.map(o=><li key={o.id}>{o.outcome_text}</li>)}</ul></>
        :<p role="status" style={{...info,margin:'0 0 12px'}}>Not yet linked to verified learning outcomes. The mapped Scheme requires original VibeSchool outcomes to be installed.</p>}
      <h4 style={{fontSize:14,color:ink,margin:'10px 0 5px'}}>Learning experiences</h4>
      <ul style={{...info,paddingLeft:20,margin:'0 0 10px'}}>{current.experiences.map(x=><li key={x}>{x}</li>)}</ul>
      <h4 style={{fontSize:14,color:ink,margin:'10px 0 5px'}}>Inquiry and assessment</h4>
      <p style={{...info,margin:'0 0 6px'}}>{current.inquiry.join(' ')}</p>
      <p style={{...info,margin:'0 0 10px'}}>{current.assessment}</p>
      <h4 style={{margin:'0 0 6px',fontSize:14,color:ink}}>Scheme of Work</h4>
      <p style={{...info,margin:'0 0 12px'}}>Open the normal Scheme workspace for your class and term. Selecting a topic here does not create a lesson or replace your saved Scheme.</p>
      {onPlanUnit&&record&&<button type="button" onClick={()=>onPlanUnit(current.id)} style={{width:'100%',minHeight:44,padding:12,border:0,borderRadius:9,background:green,color:'#fff',fontWeight:800,cursor:'pointer',marginBottom:8}}>Prepare linked Scheme lesson</button>}
      {onOpenScheme&&<button type="button" onClick={()=>onOpenScheme(current.id)} style={{width:'100%',minHeight:44,padding:12,border:0,borderRadius:9,background:green,color:'#fff',fontWeight:800,cursor:'pointer'}}>Open Scheme of Work</button>}
    </article>
    <div style={{display:'flex',justifyContent:'space-between',gap:8,marginTop:12}}>
      <button type="button" disabled={selectedIndex===0} onClick={()=>choose(GRADE3_MATHEMATICS_UNITS[selectedIndex-1].id)} style={{minHeight:44,border:'1px solid #bccfc2',borderRadius:9,padding:'9px 13px',background:'#fff',color:green,opacity:selectedIndex===0?0.5:1}}>Previous</button>
      <button type="button" disabled={selectedIndex===GRADE3_MATHEMATICS_UNITS.length-1} onClick={()=>choose(GRADE3_MATHEMATICS_UNITS[selectedIndex+1].id)} style={{minHeight:44,border:0,borderRadius:9,padding:'9px 13px',background:green,color:'#fff',opacity:selectedIndex===GRADE3_MATHEMATICS_UNITS.length-1?0.5:1}}>Next topic</button>
    </div>
  </section>
}
