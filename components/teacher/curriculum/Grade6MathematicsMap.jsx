'use client'
import { useMemo, useState } from 'react'
import {
  GRADE6_MATHEMATICS_UNITS, GRADE6_MATHEMATICS_SOURCE_URL, GRADE6_MATHEMATICS_LESSONS
} from '@/lib/teaching/grade6MathematicsCatalog.mjs'

const green = '#175b43'
const line = { fontSize:13, color:'#345746', lineHeight:1.6 }

/**
 * @param {{
 *   selectedUnitId?: string,
 *   onSelectUnit?: (id: string) => void,
 *   onPlanUnit?: (id: string) => void,
 *   mappedUnits?: Record<string, { outcomes: Array<{ id: string, outcome_text: string }> }>,
 *   catalogLoading?: boolean,
 *   catalogError?: string,
 *   compact?: boolean
 * }} props
 */
export default function Grade6MathematicsMap({
  selectedUnitId='1.1',onSelectUnit=()=>{},onPlanUnit=undefined,mappedUnits={},catalogLoading=false,catalogError='',compact=false
}){
  const [showIndex,setShowIndex]=useState(false)
  const [query,setQuery]=useState('')
  const chosen=GRADE6_MATHEMATICS_UNITS.find(u=>u.id===selectedUnitId)||GRADE6_MATHEMATICS_UNITS[0]
  const strands=[...new Set(GRADE6_MATHEMATICS_UNITS.map(u=>u.strand))]
  const list=useMemo(()=>GRADE6_MATHEMATICS_UNITS.filter(u=>!query.trim()||
    [u.id,u.title,u.strand,...u.outcomes].some(t=>t.toLowerCase().includes(query.toLowerCase().trim()))),[query])
  const record=mappedUnits[chosen.id]
  const index=GRADE6_MATHEMATICS_UNITS.indexOf(chosen)
  const choose=(id)=>{onSelectUnit?.(id);setShowIndex(false);setQuery('')}
  const bul=(items)=><ul style={{...line,paddingLeft:18,margin:'8px 0'}}>{items.map((item,i)=><li key={i}>{item}</li>)}</ul>
  return <section aria-label="Grade 6 Mathematics annual curriculum map" style={{background:'#fff',border:'1px solid #d9e7df',borderRadius:14,padding:'clamp(12px,3vw,20px)',marginBottom:14}}>
    <div style={{fontSize:11,color:green,fontWeight:800,letterSpacing:'.06em'}}>GRADE 6 · MATHEMATICS · CURRICULUM</div>
    <h2 style={{fontSize:22,color:'#163d2d',margin:'6px 0'}}>What learners should achieve</h2>
    <p style={{...line,margin:'0 0 8px'}}>4 strands · 16 sub-strands · {GRADE6_MATHEMATICS_LESSONS} suggested lessons · 5 lessons per week.</p>
    <p style={{...line,fontSize:12,margin:'0 0 8px'}}>Structure and lesson allocation reference the revised KICD 2024 design. Outcomes, activities, inquiry prompts and assessments are original VibeSchool teaching guidance; full KICD outcome-by-outcome certification is pending.</p>
    <a href={GRADE6_MATHEMATICS_SOURCE_URL} target="_blank" rel="noreferrer" style={{display:'inline-block',fontWeight:700,fontSize:13,color:green,marginBottom:14}}>Read the original KICD curriculum</a>
    <nav aria-label="Grade 6 Mathematics strands" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(135px,1fr))',gap:8,marginBottom:13}}>
      {strands.map(strand=><button key={strand} type="button" onClick={()=>choose(GRADE6_MATHEMATICS_UNITS.find(u=>u.strand===strand).id)}
      aria-pressed={chosen.strand===strand} style={{minHeight:50,border:'1px solid #b8d2c0',borderRadius:9,padding:'8px 10px',fontWeight:700,color:green,background:chosen.strand===strand?'#e7f4eb':'#fff',cursor:'pointer'}}>{strand}</button>)}
    </nav>
    <div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap',alignItems:'center',marginBottom:12}}>
      <h3 style={{fontSize:18,margin:0,color:'#173f31'}}>{chosen.id} {chosen.title}</h3>
      <button type="button" onClick={()=>setShowIndex(x=>!x)} aria-expanded={showIndex} style={{minHeight:44,padding:'8px 12px',borderRadius:9,border:'1px solid #b7d2c3',color:green,background:'#fff',fontWeight:700,cursor:'pointer'}}>{showIndex?'Close topics':'All 16 topics'}</button>
    </div>
    {showIndex && <div style={{border:'1px solid #dce8df',borderRadius:10,padding:10,marginBottom:12}}>
      <label htmlFor="grade6-maths-search" style={{...line,fontWeight:700}}>Find a sub-strand or outcome</label>
      <input id="grade6-maths-search" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search all 16 topics" style={{boxSizing:'border-box',width:'100%',minHeight:44,borderRadius:8,border:'1px solid #b0c6b9',padding:'8px 12px',fontSize:15}}/>
      <div style={{maxHeight:290,overflowY:'auto',display:'grid',gap:5,marginTop:8}}>
      {list.map(u=><button key={u.id} type="button" onClick={()=>choose(u.id)} aria-current={u.id===chosen.id?'true':undefined} style={{minHeight:44,textAlign:'left',border:'1px solid #e0eae2',borderRadius:9,padding:10,background:u.id===chosen.id?'#edf6ef':'#fff',color:'#234a36',cursor:'pointer'}}><strong>{u.id}</strong> {u.title} · {u.lessons} lessons</button>)}
      {!list.length&&<p style={line}>No matching topic.</p>}</div>
    </div>}
    <article style={{background:'#f8fbf9',borderRadius:10,padding:13}}>
      <p style={{...line,fontSize:12,margin:'0 0 10px'}}>{chosen.strand} · {chosen.lessons} suggested lessons</p>
      <h4 style={{fontSize:14,margin:'0 0 5px'}}>Specific learning outcomes</h4>
      {catalogLoading?<p role="status" style={line}>Connecting curriculum records…</p>
        :catalogError?<p role="alert" style={{...line,color:'#9f1239'}}>{catalogError}</p>
        :!record?<p role="status" style={line}>Canonical outcome linkage has not been published.</p>
        :bul(record.outcomes.map(o=>o.outcome_text))}
      {onPlanUnit && record && <button type="button" onClick={()=>onPlanUnit(chosen.id)} style={{width:'100%',minHeight:44,border:0,borderRadius:9,background:green,color:'#fff',padding:12,fontWeight:800,cursor:'pointer'}}>Prepare this topic in Scheme of Work</button>}
      {!compact && <>
       <h4 style={{fontSize:14,margin:'14px 0 5px'}}>Suggested learning experiences</h4>{bul(chosen.experiences)}
       <h4 style={{fontSize:14,margin:'14px 0 5px'}}>Key inquiry questions</h4>{bul(chosen.inquiry)}
       <h4 style={{fontSize:14,margin:'14px 0 5px'}}>Resources</h4><p style={line}>{chosen.resources}</p>
       <h4 style={{fontSize:14,margin:'14px 0 5px'}}>Assessment guidance</h4><p style={line}>{chosen.assessment}</p>
       <h4 style={{fontSize:14,margin:'14px 0 5px'}}>Competencies and values</h4><p style={line}>{chosen.competencies}</p>
      </>}
    </article>
    <div style={{display:'flex',gap:8,justifyContent:'space-between',marginTop:12}}>
      <button type="button" disabled={index===0} onClick={()=>choose(GRADE6_MATHEMATICS_UNITS[index-1].id)} style={{minHeight:44,borderRadius:9,border:'1px solid #bccfc2',background:'#fff',color:green,padding:'9px 13px',opacity:index===0?0.5:1}}>Previous</button>
      <button type="button" disabled={index===GRADE6_MATHEMATICS_UNITS.length-1} onClick={()=>choose(GRADE6_MATHEMATICS_UNITS[index+1].id)} style={{minHeight:44,borderRadius:9,border:0,background:green,color:'#fff',padding:'9px 13px',opacity:index===GRADE6_MATHEMATICS_UNITS.length-1?0.5:1}}>Next topic</button>
    </div>
  </section>
}
