'use client'

import { useMemo, useState } from 'react'
import { GRADE6_KISWAHILI_ITEMISED_TOTAL } from '@/lib/curriculum/grade6KiswahiliReference'
import {
  GRADE6_KISWAHILI_SOURCE_URL, GRADE6_KISWAHILI_THEMES, GRADE6_KISWAHILI_UNITS,
  GRADE6_KISWAHILI_PUBLISHED_TOTAL,
  GRADE6_KISWAHILI_VIBESCHOOL_REVIEW,
} from '@/lib/teaching/grade6KiswahiliCatalog.mjs'

type CatalogRecord = {
  id: string
  name: string
  sub_strand: string
  outcomes: { id: string; outcome_text: string }[]
}
type Props = {
  compact?: boolean
  selectedUnitId?: string
  onSelectUnit?: (id: string) => void
  onPlanUnit?: (id: string) => void
  mappedUnits?: Record<string, CatalogRecord>
  catalogLoading?: boolean
  catalogError?: string
  onOpenScheme?: () => void
  schemeCount?: number
}
const ink = '#173f32'
const muted = '#51665c'
const border = '#d9e5dc'
const inputStyle = { minHeight: 44, padding: '9px 11px', background: '#fff', color: ink, border: '1px solid #cbdacf', borderRadius: 9, width: '100%' } as const

/** Reader and original outcomes belong to VibeSchool; KICD provides only the structural reference. */
export default function Grade6KiswahiliMap({ compact=false, selectedUnitId, onSelectUnit, onPlanUnit, mappedUnits={}, catalogLoading=false, catalogError='', onOpenScheme, schemeCount=0 }: Props) {
  const [localUnitId, setLocalUnitId] = useState('1.1.1')
  const [themeId, setThemeId] = useState(() => GRADE6_KISWAHILI_UNITS.find(u=>u.id===selectedUnitId)?.themeId || 1)
  const [search, setSearch] = useState('')
  const selected=selectedUnitId ?? localUnitId
  const allForTheme=GRADE6_KISWAHILI_UNITS.filter(u=>u.themeId===themeId)
  const visible=useMemo(()=>allForTheme.filter(u=>(u.strand+' '+u.title+' '+u.outcomes.join(' ')).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())),[allForTheme,search])
  const current=allForTheme.find(u=>u.id===selected) || allForTheme[0]
  const saved=mappedUnits[current.id]
  const choose=(id:string)=>{ onSelectUnit?.(id); if(!onSelectUnit)setLocalUnitId(id) }
  const onTheme=(next:number)=>{setThemeId(next); const first=GRADE6_KISWAHILI_UNITS.find(u=>u.themeId===next); if(first)choose(first.id)}
  return <section aria-label="Ramani ya mtaala wa Kiswahili wa Gredi ya 6" style={{ background:'#fff',border:'1px solid '+border,borderRadius:14,padding:compact?14:18,color:ink,marginBottom:14 }}>
    <div style={{fontSize:11,fontWeight:800,letterSpacing:'.08em',color:'#397652'}}>GREDI YA 6 · KISWAHILI</div>
    <h2 style={{fontSize:compact?19:23,margin:'5px 0 8px'}}>Ramani ya mtaala</h2>
    <p style={{fontSize:13,color:muted,lineHeight:1.6,margin:'0 0 12px'}}>Muundo wa mada na mada ndogo umeongozwa na KICD 2024. Matokeo, shughuli na maelezo ya kufundishia ni kazi asilia ya VibeSchool; si maneno rasmi ya KICD.</p>
    <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:13}}>
      {['Mada kuu 11','Mada ndogo 53','Stadi 4','Vipindi 4 kwa wiki','Vipindi 120 vya mpango'].map(s=><span key={s} style={{background:'#edf5ef',padding:'6px 9px',borderRadius:16,fontSize:12,fontWeight:700}}>{s}</span>)}
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,220px),1fr))',gap:10,marginBottom:12}}>
      <label style={{fontWeight:700,fontSize:13}}>Mada kuu
        <select aria-label="Chagua mada kuu" value={themeId} onChange={e=>onTheme(Number(e.target.value))} style={{...inputStyle,marginTop:5}}>
          {GRADE6_KISWAHILI_THEMES.map(t=><option key={t.id} value={t.id}>{t.id}. {t.title}</option>)}
        </select>
      </label>
      <label style={{fontWeight:700,fontSize:13}}>Tafuta stadi
        <input id="kiswahili-grade6-search" type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Mf. sarufi, ufasaha, insha" style={{...inputStyle,marginTop:5}}/>
      </label>
    </div>
    <p style={{fontSize:13,color:muted,margin:'0 0 12px'}}>{GRADE6_KISWAHILI_THEMES[themeId-1]?.context}</p>
    <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:13}}>
      {visible.map(u=><button type="button" key={u.id} aria-pressed={u.id===current.id} onClick={()=>choose(u.id)}
        style={{minHeight:42,padding:'9px 11px',borderRadius:9,border:'1px solid '+(u.id===current.id?ink:border),background:u.id===current.id?ink:'#fff',color:u.id===current.id?'#fff':ink,fontSize:12,fontWeight:700,cursor:'pointer'}}>{u.id} · {u.title}</button>)}
      {visible.length===0&&<p role="status">Hakuna stadi inayolingana na utafutaji.</p>}
    </div>
    <article style={{padding:compact?12:16,borderRadius:12,background:'#f8faf8',border:'1px solid '+border}}>
      <div style={{fontSize:12,color:muted,fontWeight:700}}>{current.strand} · {current.sourceLessons} vya KICD{current.supportLessons>0?' + '+current.supportLessons+' cha marudio cha VibeSchool':''}</div>
      <h3 style={{fontSize:19,margin:'5px 0 12px'}}>{current.title}</h3>
      <h4 style={{fontSize:13,margin:'0 0 6px'}}>Matokeo ya VibeSchool</h4>
      <ol style={{fontSize:13,lineHeight:1.7,paddingLeft:20,margin:'0 0 13px'}}>{current.outcomes.map((x,i)=><li key={i}>{x}</li>)}</ol>
      <h4 style={{fontSize:13,margin:'0 0 6px'}}>Shughuli zilizopendekezwa</h4>
      <ul style={{fontSize:13,lineHeight:1.7,paddingLeft:20,margin:'0 0 13px'}}>{current.experiences.map((x,i)=><li key={i}>{x}</li>)}</ul>
      <div style={{fontSize:13,lineHeight:1.7}}>
        <strong>Swali dadisi:</strong> {current.inquiry.join(' ')}
        <div><strong>Nyenzo:</strong> {current.resources}</div>
        <div><strong>Tathmini:</strong> {current.assessment}</div>
        <div><strong>Umilisi:</strong> {current.competencies}</div>
      </div>
      {onPlanUnit&&<div style={{marginTop:14}}>
        <p style={{fontSize:12,color:muted,marginBottom:8}}>{catalogLoading?'Inapakia utambulisho wa mtaala…':catalogError||(!saved?'Mada ndogo haijaunganishwa kwenye rekodi za mfumo.':saved.outcomes.length+' matokeo yameunganishwa kwenye mfumo.')}</p>
        <button type="button" disabled={!saved||catalogLoading||Boolean(catalogError)} onClick={()=>onPlanUnit(current.id)}
          style={{minHeight:44,border:0,borderRadius:9,padding:'10px 14px',background:ink,color:'#fff',fontWeight:800,opacity:saved&&!catalogLoading&&!catalogError?1:.4,cursor:'pointer'}}>Tayarisha Scheme of Work</button>
      </div>}
    </article>
    {onOpenScheme && <div style={{borderTop:'1px solid '+border,marginTop:14,paddingTop:12}}>
      <p style={{fontSize:12,color:muted,margin:'0 0 8px'}}>Masomo yaliyohifadhiwa kwenye Scheme: {schemeCount}. Hakuna rekodi inayoundwa bila kitendo cha mwalimu.</p>
      <button type="button" onClick={onOpenScheme} style={{minHeight:44,border:0,borderRadius:9,padding:'10px 14px',background:ink,color:'#fff',fontWeight:800,cursor:'pointer'}}>Fungua Scheme of Work</button>
    </div>}
    <p style={{color:muted,fontSize:12,lineHeight:1.6,margin:'12px 0 0'}}>
      KICD imechapisha jumla ya vipindi {GRADE6_KISWAHILI_PUBLISHED_TOTAL}, lakini vipindi vya mada ndogo vinapojumlishwa ni {GRADE6_KISWAHILI_ITEMISED_TOTAL}. VibeSchool imependekeza vipindi {GRADE6_KISWAHILI_VIBESCHOOL_REVIEW} vya marudio ili kufikia 120; hivi si mgawanyo rasmi wa KICD. Ulinganisho wa kila matokeo rasmi bado haujakamilika.{' '}
      <a href={GRADE6_KISWAHILI_SOURCE_URL} target="_blank" rel="noopener noreferrer" style={{color:'#175b43',textDecoration:'underline',fontWeight:700}}>Fungua mtaala asilia wa KICD</a>
    </p>
  </section>
}
