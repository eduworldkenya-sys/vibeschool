'use client'
import { useMemo } from 'react'
import {GRADE8_ENGLISH_UNITS,GRADE8_ENGLISH_THEMES,GRADE8_ENGLISH_SOURCE_URL,GRADE8_ENGLISH_LESSONS} from '@/lib/teaching/grade8EnglishCatalog.mjs'

const green='#175b43'
export default function Grade8EnglishMap({
 selectedUnitId='01-LS',onSelectUnit,onPlanUnit,mappedUnits={},catalogLoading=false,catalogError=''
}){
 const selected=GRADE8_ENGLISH_UNITS.find(unit=>unit.id===selectedUnitId)||GRADE8_ENGLISH_UNITS[0]
 const theme=GRADE8_ENGLISH_THEMES.find(item=>item.id===selected.theme)
 const units=useMemo(()=>GRADE8_ENGLISH_UNITS.filter(u=>u.theme===selected.theme),[selected.theme])
 return <section aria-label="Grade 8 English KICD-referenced curriculum map"
  style={{background:'#fff',border:'1px solid #d8e3dd',borderRadius:14,padding:16,marginBottom:14}}>
  <div style={{fontSize:11,fontWeight:800,color:green,letterSpacing:'.07em'}}>GRADE 8 · ENGLISH</div>
  <h2 style={{fontSize:21,margin:'5px 0 7px',color:'#14372a'}}>Curriculum map</h2>
  <p style={{fontSize:13,color:'#486355',lineHeight:1.55,margin:'0 0 10px'}}>
   15 KICD themes · 4 language strands · {GRADE8_ENGLISH_LESSONS} VibeSchool-planned lessons · 5 per week.
   Our learning guidance is independently written. It is not official KICD wording.
  </p>
  <a href={GRADE8_ENGLISH_SOURCE_URL} target="_blank" rel="noreferrer"
    style={{color:green,fontWeight:700,fontSize:12,display:'inline-block',marginBottom:13}}>
    Official KICD curriculum (2024 revision)
  </a>
  <label htmlFor="g8-english-theme" style={{fontSize:12,fontWeight:800,color:'#254c39',display:'block',marginBottom:6}}>Choose a theme</label>
  <select id="g8-english-theme" value={String(theme.id)}
    onChange={e=>onSelectUnit(GRADE8_ENGLISH_UNITS.find(u=>u.theme===Number(e.target.value))?.id||'01-LS')}
    style={{width:'100%',minHeight:46,padding:10,borderRadius:10,border:'1px solid #a9c5b4',background:'#fff',fontWeight:700,color:'#173a2c',marginBottom:13}}>
    {GRADE8_ENGLISH_THEMES.map(item=><option key={item.id} value={item.id}>{item.id}. {item.title}</option>)}
  </select>
  <p style={{color:'#486355',fontSize:12,margin:'0 0 10px'}}>Five curriculum planning units in this theme · 10 suggested lessons. The two Reading units support informational and literary texts.</p>
  {catalogLoading&&<p role="status" style={{fontSize:12}}>Connecting saved curriculum outcomes…</p>}
  {catalogError&&<p role="alert" style={{color:'#9f1239',fontSize:12}}>{catalogError}</p>}
  <div style={{display:'grid',gap:9}}>
   {units.map(unit=>{
    const record=mappedUnits[unit.id]
    return <article key={unit.id} style={{border:'1px solid #d9e7de',borderRadius:12,padding:13,background:unit.id===selected.id?'#f1f8f3':'#fff'}}>
     <div style={{color:green,fontSize:11,fontWeight:800}}>{unit.strand} · 2 lessons</div>
     <h3 style={{fontSize:16,color:'#173a2c',margin:'4px 0 7px'}}>{unit.title.split(': ').slice(1).join(': ')}</h3>
     {record?.outcomes?.length? <ul style={{paddingLeft:19,margin:'0 0 9px',color:'#314d3c',fontSize:13,lineHeight:1.55}}>
      {record.outcomes.map(outcome=><li key={outcome.id}>{outcome.outcome_text}</li>)}
     </ul>:<p style={{fontSize:12,color:'#64776a',margin:'0 0 8px'}}>Saved learning outcomes are not yet available for this unit.</p>}
     {onPlanUnit&&record?.outcomes?.length&&!catalogError&&<button type="button" onClick={()=>onPlanUnit(unit.id)}
      style={{background:green,color:'#fff',border:0,borderRadius:9,minHeight:44,padding:'10px 13px',fontWeight:800,cursor:'pointer',width:'100%'}}>
      Plan this in Scheme of Work
     </button>}
    </article>
   })}
  </div>
  <p style={{fontSize:11,color:'#577063',lineHeight:1.5,margin:'12px 0 0'}}>VibeSchool skill units are planning aids, not certified KICD sub-strand IDs. A Scheme lesson is created only when a teacher saves it.</p>
 </section>
}
