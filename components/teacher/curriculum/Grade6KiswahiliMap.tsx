'use client'
import {useMemo,useState} from 'react'
import {GRADE6_KISWAHILI_SOURCE,GRADE6_KISWAHILI_STRANDS,GRADE6_KISWAHILI_THEMES,GRADE6_KISWAHILI_UNITS,GRADE6_KISWAHILI_WEEKLY_LESSONS,GRADE6_KISWAHILI_PRINTED_TOTAL,GRADE6_KISWAHILI_ITEMISED_TOTAL} from '@/lib/curriculum/grade6KiswahiliReference'
type Props={onOpenScheme:()=>void;schemeCount:number}
export default function Grade6KiswahiliMap({onOpenScheme,schemeCount}:Props){
 const [selectedTheme,setSelectedTheme]=useState(1)
 const [search,setSearch]=useState('')
 const theme=GRADE6_KISWAHILI_THEMES[selectedTheme-1]
 const units=GRADE6_KISWAHILI_UNITS.filter(u=>u.themeNumber===selectedTheme)
 const themes=useMemo(()=>{
  const q=search.trim().toLocaleLowerCase('sw')
  return q?GRADE6_KISWAHILI_THEMES.filter(t=>t.title.toLocaleLowerCase('sw').includes(q)||String(t.number)===q||GRADE6_KISWAHILI_UNITS.some(u=>u.themeNumber===t.number&&u.title.toLocaleLowerCase('sw').includes(q))):GRADE6_KISWAHILI_THEMES
 },[search])
 const select=(n:number)=>{setSelectedTheme(n);setSearch('')}
 return <section aria-label="Kiswahili Gredi ya 6 — Mtaala" style={{background:'#fff',border:'1px solid #d8e5dc',borderRadius:14,padding:'clamp(14px,3vw,22px)',marginBottom:18,color:'#193a2e'}}>
  <header><div style={{fontSize:11,fontWeight:800,color:'#28654d'}}>GREDI YA 6 · KISWAHILI</div><h2 style={{margin:'8px 0',fontSize:24}}>Ramani ya Mtaala</h2>
  <p style={{fontSize:13,lineHeight:1.6}}>Mada 11 · Stadi 4 · Mada ndogo {GRADE6_KISWAHILI_UNITS.length} · Vipindi {GRADE6_KISWAHILI_WEEKLY_LESSONS} kwa wiki.</p>
  <p style={{fontSize:12,lineHeight:1.6,color:'#66572b'}}>KICD imechapisha jumla ya vipindi {GRADE6_KISWAHILI_PRINTED_TOTAL}, lakini mgawanyo wa mada ndogo uliorodheshwa ni {GRADE6_KISWAHILI_ITEMISED_TOTAL}. Kwa hivyo VibeSchool haitengenezi mpangilio wa wiki kiotomatiki kutokana na takwimu hizi zisizolingana.</p>
  <p style={{fontSize:12,lineHeight:1.6,color:'#536a5e'}}>Huu ni muhtasari wa muundo wa KICD wa 2024, si nakala ya matokeo maalumu au shughuli zote rasmi. Mwalimu anaweza kusoma bila ratiba.</p>
  <a href={GRADE6_KISWAHILI_SOURCE} target="_blank" rel="noopener noreferrer" style={{color:'#175b43',fontWeight:700,fontSize:13}}>Fungua mtaala rasmi wa KICD</a></header>
  <div style={{margin:'18px 0 12px'}}><label htmlFor="kiswahili-grade6-search" style={{display:'block',fontSize:13,fontWeight:700,marginBottom:6}}>Tafuta mada au mada ndogo</label><input id="kiswahili-grade6-search" type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tafuta mada…" style={{boxSizing:'border-box',width:'100%',minHeight:44,padding:10,fontSize:15,borderRadius:9,border:'1px solid #b9cec0'}}/>
  {search?<div style={{display:'grid',gap:7,marginTop:8}}>{themes.map(t=><button type="button" key={t.number} onClick={()=>select(t.number)} style={{minHeight:44,padding:10,textAlign:'left',border:'1px solid #d8e7dd',borderRadius:9,background:'#f6faf7'}}>{t.number}. {t.title}</button>)}{themes.length===0&&<p role="status">Hakuna mada iliyopatikana.</p>}</div>:<div style={{display:'flex',gap:7,overflowX:'auto',padding:'9px 0'}} aria-label="Chagua mada">{GRADE6_KISWAHILI_THEMES.map(t=><button type="button" key={t.number} onClick={()=>select(t.number)} aria-pressed={selectedTheme===t.number} title={t.title} style={{flex:'0 0 auto',minWidth:44,minHeight:44,borderRadius:8,border:'1px solid #b8d4c0',fontWeight:700,background:selectedTheme===t.number?'#175b43':'#fff',color:selectedTheme===t.number?'#fff':'#175b43'}}>{t.number}</button>)}</div>}</div>
  <article style={{border:'1px solid #d8e7dd',borderRadius:12,overflow:'hidden'}}><div style={{padding:14,background:'#f3f8f4'}}><div style={{fontSize:12}}>MADA {theme.number}</div><h3 style={{fontSize:18,margin:'5px 0 0'}}>{theme.title}</h3></div><div style={{padding:12,display:'grid',gap:9}}>{units.map(u=><div key={u.code} style={{border:'1px solid #e0e9e2',padding:12,borderRadius:9}}><div style={{fontSize:11,color:'#28654d',fontWeight:700}}>{u.code} · {GRADE6_KISWAHILI_STRANDS[u.strand-1]} · Vipindi {u.lessons}</div><div style={{fontSize:15,fontWeight:700,marginTop:5}}>{u.title}</div></div>)}</div></article>
  <div style={{display:'flex',justifyContent:'space-between',gap:8,marginTop:12}}><button type="button" disabled={selectedTheme===1} onClick={()=>setSelectedTheme(n=>n-1)} style={{minHeight:44,padding:10,borderRadius:8,border:'1px solid #b9cfbf'}}>Mada iliyotangulia</button><button type="button" disabled={selectedTheme===11} onClick={()=>setSelectedTheme(n=>n+1)} style={{minHeight:44,padding:10,borderRadius:8,border:'1px solid #b9cfbf'}}>Mada inayofuata</button></div>
  <div style={{borderTop:'1px solid #dfe8e1',marginTop:17,paddingTop:14}}><h3 style={{fontSize:16,margin:'0 0 8px'}}>Mpango wa Kazi</h3><p style={{fontSize:12,color:'#526b5f'}}>Masomo yaliyohifadhiwa: {schemeCount}. Rekodi za mwalimu hazibadilishwi na ramani hii. Hakuna masomo yanayohifadhiwa bila kitendo cha mwalimu.</p><button type="button" onClick={onOpenScheme} style={{minHeight:44,border:0,borderRadius:9,padding:'11px 16px',background:'#175b43',color:'#fff',fontWeight:800}}>Fungua Scheme of Work</button></div>
 </section>
}
