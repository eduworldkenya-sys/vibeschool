'use client'

import {useMemo,useState} from 'react'
import {
  GRADE4_KISWAHILI_SOURCE, GRADE4_KISWAHILI_THEMES,
  GRADE4_KISWAHILI_STRANDS,GRADE4_KISWAHILI_UNITS,
  GRADE4_KISWAHILI_REPORTED_LESSONS,GRADE4_KISWAHILI_ALLOCATED_LESSONS,
  GRADE4_KISWAHILI_WEEKLY_LESSONS
} from '@/lib/curriculum/grade4KiswahiliReference'

type Props={
  onOpenScheme:()=>void
  showExisting:boolean
  onToggleExisting:()=>void
  schemeCount:number
}

const green='#175b43'

/** A native KICD-referenced index; preserving original curriculum and teacher records. */
export default function Grade4KiswahiliMap({onOpenScheme,showExisting,onToggleExisting,schemeCount}:Props){
  const [theme,setTheme]=useState(1)
  const [query,setQuery]=useState('')
  const [expanded,setExpanded]=useState<string|null>(null)
  const visible=useMemo(()=>{
    const q=query.trim().toLocaleLowerCase('sw')
    return GRADE4_KISWAHILI_UNITS.filter(u=>!q
      ? u.theme===theme
      : [u.title,u.strand,u.code,GRADE4_KISWAHILI_THEMES[u.theme-1].title]
        .some(value=>value.toLocaleLowerCase('sw').includes(q)))
  },[theme,query])
  const themeName=GRADE4_KISWAHILI_THEMES[theme-1]
  return <section aria-label="Kiswahili Gredi ya 4 — Mtaala wa KICD" style={{background:'#fff',border:'1px solid #d8e3dd',borderRadius:14,padding:'clamp(14px,3vw,22px)',marginBottom:14,color:'#193b2c'}}>
    <div style={{fontSize:11,fontWeight:800,letterSpacing:'.07em',color:green}}>GREDI YA 4 · KISWAHILI</div>
    <h2 style={{fontSize:23,margin:'5px 0 7px'}}>Mtaala wa Kiswahili</h2>
    <p style={{fontSize:13,color:'#50695a',lineHeight:1.6,margin:'0 0 11px'}}>
      Mada 11 · Stadi 4 · Mada ndogo 52 · Vipindi {GRADE4_KISWAHILI_WEEKLY_LESSONS} kwa wiki.
    </p>
    <a href={GRADE4_KISWAHILI_SOURCE} target="_blank" rel="noopener noreferrer" style={{color:green,fontSize:13,fontWeight:750,textDecoration:'underline'}}>Fungua mtaala rasmi wa KICD (2024)</a>
    <p style={{fontSize:12,color:'#52685c',lineHeight:1.55,margin:'12px 0 15px'}}>Vichwa na mgao wa mada vimefuata muhtasari wa KICD. Maelezo kamili ya matokeo, shughuli na tathmini yako kwenye chapisho rasmi. Hii si nakala ya maandishi yaliyolindwa na hakimiliki.</p>
    <div style={{display:'grid',gap:9,marginBottom:15}}>
      <label htmlFor="grade4-kiswahili-theme" style={{fontSize:12,fontWeight:800}}>Chagua mada</label>
      <select id="grade4-kiswahili-theme" value={theme} onChange={e=>{setTheme(Number(e.target.value));setQuery('');setExpanded(null)}} style={{minHeight:46,width:'100%',padding:'9px 12px',borderRadius:9,border:'1px solid #b7d0c1',background:'#fff',color:'#173b2d',fontSize:15}}>
        {GRADE4_KISWAHILI_THEMES.map(item=><option key={item.number} value={item.number}>{item.number}. {item.title}</option>)}
      </select>
      <label htmlFor="grade4-kiswahili-search" style={{fontSize:12,fontWeight:800}}>Tafuta mada ndogo</label>
      <input id="grade4-kiswahili-search" type="search" value={query} onChange={e=>{setQuery(e.target.value);setExpanded(null)}} placeholder="Kwa mfano: Nomino, Kusoma, Methali" style={{boxSizing:'border-box',minHeight:46,width:'100%',padding:'9px 12px',borderRadius:9,border:'1px solid #b7d0c1',fontSize:15}}/>
    </div>
    {!query&&<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,padding:'9px 0',borderBottom:'1px solid #dde8df',marginBottom:11}}>
      <strong style={{fontSize:16}}>{themeName.number}. {themeName.title}</strong>
      <span style={{fontSize:11,color:'#617b69',whiteSpace:'nowrap'}}>Ukurasa {themeName.sourcePage}</span>
    </div>}
    <div aria-live="polite" style={{display:'grid',gap:14}}>
      {GRADE4_KISWAHILI_STRANDS.map(strand=>{
        const group=visible.filter(u=>u.strand===strand)
        return group.length?<div key={strand}>
          <h3 style={{fontSize:13,color:green,margin:'0 0 8px'}}>{strand}</h3>
          <div style={{display:'grid',gap:7}}>{group.map(unit=><article key={unit.id} style={{border:'1px solid #dce7df',borderRadius:10,padding:11}}>
            <button type="button" aria-expanded={expanded===unit.id} onClick={()=>setExpanded(id=>id===unit.id?null:unit.id)} style={{cursor:'pointer',background:'#fff',width:'100%',border:0,padding:0,textAlign:'left',display:'flex',justifyContent:'space-between',alignItems:'center',gap:9,color:'#193b2c',minHeight:44}}>
              <span><span style={{fontSize:11,fontWeight:800,color:'#53806a'}}>{unit.code} · Vipindi {unit.suggestedLessons}</span>
                <strong style={{display:'block',fontSize:15,marginTop:3}}>{unit.title}</strong></span>
              <span aria-hidden="true" style={{fontSize:19}}>{expanded===unit.id?'−':'+'}</span>
            </button>
            {expanded===unit.id&&<div style={{borderTop:'1px solid #e1eae3',paddingTop:10,marginTop:8,fontSize:12,lineHeight:1.6,color:'#52695c'}}>
              <p style={{margin:'0 0 8px'}}>Mada: {GRADE4_KISWAHILI_THEMES[unit.theme-1].title} · Stadi: {unit.strand}. Rejelea matokeo maalum, shughuli za ujifunzaji na vigezo vya kutathmini katika chapisho rasmi kabla ya kuandaa kipindi.</p>
              {unit.sourceCode!==unit.code&&<p style={{margin:'0 0 8px'}}>Nambari katika muhtasari wa KICD: {unit.sourceCode}. Nambari ya kuvinjari imesawazishwa.</p>}
              <button type="button" onClick={onOpenScheme} style={{width:'100%',minHeight:44,padding:'10px 12px',border:0,borderRadius:9,background:green,color:'#fff',fontWeight:750,cursor:'pointer'}}>Fungua Scheme of Work</button>
            </div>}
          </article>)}</div>
        </div>:null
      })}
      {visible.length===0&&<p role="status" style={{color:'#66796c',fontSize:13}}>Hakuna mada ndogo inayolingana.</p>}
    </div>
    <div style={{padding:'12px 13px',background:'#f7f9f7',border:'1px solid #e0e8e1',borderRadius:10,marginTop:16}}>
      <strong style={{fontSize:12,color:'#3a5846'}}>Uhakiki wa mgao wa vipindi</strong>
      <p style={{fontSize:12,lineHeight:1.6,color:'#52685c',margin:'5px 0 0'}}>Muhtasari wa KICD unaonyesha jumla ya {GRADE4_KISWAHILI_REPORTED_LESSONS}, lakini kujumlisha mgao wa mada ndogo kunatoa {GRADE4_KISWAHILI_ALLOCATED_LESSONS}. Tumehifadhi mgao kama ulivyochapishwa; hatujautengenezea mtaala mgawanyo wa wiki bila uhakiki.</p>
    </div>
    <div style={{marginTop:16,paddingTop:13,borderTop:'1px solid #e2ebe4'}}>
      <strong style={{fontSize:14}}>Scheme of Work</strong>
      <p style={{color:'#536c5a',fontSize:12,lineHeight:1.6,margin:'6px 0 11px'}}>{schemeCount} rekodi zilizohifadhiwa. Kuangalia mtaala hakuhifadhi masomo, hakuhitaji ratiba ya vipindi, wala hakubadilishi mpango wa mwalimu.</p>
      <div style={{display:'flex',gap:9,flexWrap:'wrap'}}>
        <button type="button" onClick={onOpenScheme} style={{background:green,color:'#fff',border:0,borderRadius:9,padding:'10px 14px',minHeight:44,fontWeight:750,cursor:'pointer'}}>Fungua Scheme of Work</button>
        <button type="button" onClick={onToggleExisting} aria-expanded={showExisting} style={{background:'#fff',color:green,border:'1px solid #b4cbba',borderRadius:9,padding:'10px 14px',minHeight:44,fontWeight:750,cursor:'pointer'}}>{showExisting?'Ficha rekodi za awali':'Onyesha rekodi za awali'}</button>
      </div>
    </div>
  </section>
}
