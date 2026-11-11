'use client'
import {useMemo,useState,useEffect} from 'react'
import {
 GRADE4_INDIGENOUS_THEMES,GRADE4_INDIGENOUS_UNITS,
 GRADE4_INDIGENOUS_SOURCE_URL,GRADE4_INDIGENOUS_LESSONS
} from '@/lib/teaching/grade4IndigenousCatalog.mjs'

const green='#175b43',border='#d9e5dc'
/** Planning/editorial reference: outcomes need local-language expert adaptation before learner publication. */
export default function Grade4IndigenousMap({
 selectedUnitId='01-LS',onSelectUnit,onPlanUnit,mappedUnits={},
 catalogLoading=false,catalogError='',schemeCount=0,compact=false,showExisting=false,onToggleExisting
}){
 const [themeId,setThemeId]=useState(1)
 const [expanded,setExpanded]=useState('')
 const [search,setSearch]=useState('')
 const selected=GRADE4_INDIGENOUS_UNITS.find(x=>x.id===selectedUnitId)||GRADE4_INDIGENOUS_UNITS[0]
 useEffect(()=>{if(selected.theme!==themeId)setThemeId(selected.theme)},[selected.theme])
 const units=useMemo(()=>GRADE4_INDIGENOUS_UNITS.filter(u=>u.theme===themeId),[themeId])
 const themes=useMemo(()=>GRADE4_INDIGENOUS_THEMES.filter(t=>t.name.toLowerCase().includes(search.toLowerCase())),[search])
 const goto=(id)=>{onSelectUnit?.(id);setExpanded(id)}
 return <section aria-label="Grade 4 Indigenous Languages KICD-referenced curriculum map"
 style={{background:'#fff',border:'1px solid '+border,borderRadius:14,padding:compact?13:17,marginBottom:16,color:'#173d2d'}}>
  <p style={{fontSize:11,fontWeight:800,color:green,letterSpacing:'.07em',margin:'0 0 5px'}}>GRADE 4 · INDIGENOUS LANGUAGES</p>
  <h2 style={{fontSize:22,margin:'0 0 7px'}}>Curriculum map</h2>
  <p style={{fontSize:13,color:'#476150',lineHeight:1.6,margin:'0 0 9px'}}>
   Nine KICD themes · 3 official strands · 27 theme-based sub-strand units · 6 cross-strand showcase lessons · {GRADE4_INDIGENOUS_LESSONS} lessons in the source design.
  </p>
  <a href={GRADE4_INDIGENOUS_SOURCE_URL} target="_blank" rel="noopener noreferrer"
   style={{display:'inline-block',color:green,fontWeight:800,fontSize:13,marginBottom:15,textDecoration:'underline'}}>Read original KICD revised 2024 curriculum</a>
  <div role="note" style={{border:'1px solid #e2d8b4',background:'#fffaf0',padding:13,borderRadius:10,fontSize:12,lineHeight:1.6,marginBottom:15}}>
   <strong>Language adaptation required.</strong> These are original VibeSchool teaching guides written in English,
   not fluent-speaker-certified lessons in any named Indigenous Language. A teacher should use the school’s selected
   community language, check vocabulary, orthography and cultural accuracy with proficient speakers, and only then
   prepare learner-facing material. KICD does not assign these 60 sessions to individual school weeks.
  </div>
  <label htmlFor="g4-indigenous-find" style={{fontSize:12,fontWeight:800}}>Find a theme</label>
  <input id="g4-indigenous-find" type="search" placeholder="Find a theme, e.g. Weather"
   value={search} onChange={e=>setSearch(e.target.value)}
   style={{display:'block',width:'100%',boxSizing:'border-box',minHeight:44,background:'#fff',color:'#163f2f',padding:10,border:'1px solid #a6bfad',borderRadius:9,margin:'6px 0 10px'}}/>
  <label htmlFor="g4-indigenous-theme" style={{fontSize:12,fontWeight:800}}>Choose theme or showcase</label>
  <select id="g4-indigenous-theme" value={String(themeId)} onChange={e=>{const n=Number(e.target.value);setThemeId(n);const first=GRADE4_INDIGENOUS_UNITS.find(u=>u.theme===n);if(first)goto(first.id)}}
    style={{width:'100%',background:'#fff',color:'#193b2b',border:'1px solid #a8c2ae',borderRadius:9,minHeight:46,padding:10,margin:'6px 0 13px'}}>
   {themes.map(t=><option key={t.number} value={t.number}>{t.number}. {t.name}</option>)}
   <option value="10">Cross-strand language skills showcase</option>
  </select>
  {catalogLoading&&<p role="status" style={{fontSize:12}}>Connecting saved curriculum guidance…</p>}
  {catalogError&&<p role="alert" style={{fontSize:12,color:'#a41638'}}>{catalogError}</p>}
  <div style={{display:'grid',gap:10}}>
    {units.map(unit=>{
      const mapped=mappedUnits[unit.id]
      const open=expanded===unit.id||unit.id===selected.id
      return <article key={unit.id} style={{border:'1px solid '+border,borderRadius:11,padding:13,background:open?'#f4faf6':'#fff'}}>
       <div style={{fontSize:11,fontWeight:800,color:green}}>{unit.crossStrand?'CROSS-STRAND SHOWCASE':unit.strand} · {unit.lessons} source-design lessons</div>
       <h3 style={{fontSize:16,margin:'6px 0 7px'}}>{unit.title}</h3>
       <p style={{fontSize:12,color:'#53665b',margin:'0 0 8px'}}>Focus: {unit.focusDetail}</p>
       <button type="button" onClick={()=>{setExpanded(open?'':unit.id);onSelectUnit?.(unit.id)}}
        style={{minHeight:44,background:'#fff',border:'1px solid #b9d2bf',color:green,borderRadius:9,padding:'9px 13px',fontWeight:800,cursor:'pointer',marginBottom:open?10:0}}>
         {open?'Hide teaching guide':'View teaching guide'}
       </button>
       {open && <div>
        {mapped?.outcomes?.length ? <ul style={{paddingLeft:20,fontSize:13,lineHeight:1.65,margin:'0 0 9px'}}>
          {mapped.outcomes.map(o=><li key={o.id}>{o.outcome_text}</li>)}
        </ul>:<p style={{fontSize:12,color:'#6a786d'}}>Persisted VibeSchool teaching outcomes are not connected for this unit.</p>}
        <p style={{fontSize:12,lineHeight:1.55,margin:'8px 0'}}><strong>Key inquiry:</strong> {unit.inquiry[0]}</p>
        <p style={{fontSize:12,lineHeight:1.55,margin:'8px 0'}}><strong>Experience:</strong> {unit.experiences[0]}</p>
        <p style={{fontSize:12,lineHeight:1.55,margin:'8px 0'}}><strong>Assessment:</strong> {unit.assessment}</p>
        {onPlanUnit&&mapped?.outcomes?.length>0&&!catalogError&&<button type="button" onClick={()=>onPlanUnit(unit.id)}
          style={{minHeight:44,width:'100%',padding:'10px 14px',border:0,borderRadius:9,background:green,color:'#fff',fontWeight:800,cursor:'pointer'}}>Prepare this in Scheme of Work</button>}
       </div>}
      </article>
    })}
  </div>
  <p style={{fontSize:12,lineHeight:1.55,color:'#52675a',marginTop:13}}>
   {schemeCount} existing saved Scheme lessons. The annual plan is a read-only suggested schedule until a teacher saves a lesson.
   The six showcasing lessons are cross-strand, not a fourth KICD strand.
  </p>
  {onToggleExisting&&<button type="button" onClick={onToggleExisting} aria-expanded={showExisting}
    style={{border:'1px solid #a8c0b1',background:'#fff',color:green,borderRadius:9,padding:'10px 14px',minHeight:44,cursor:'pointer',fontWeight:800}}>
     {showExisting?'Hide earlier weekly curriculum records':'View earlier weekly curriculum records'}
   </button>}
 </section>
}
