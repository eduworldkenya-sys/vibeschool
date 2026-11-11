'use client'

import {useMemo, useState} from 'react'
import {
  GRADE8_KISWAHILI_SOURCE,
  GRADE8_KISWAHILI_STRANDS,
  GRADE8_KISWAHILI_THEMES,
  GRADE8_KISWAHILI_UNITS,
} from '@/lib/curriculum/grade8KiswahiliReference'

type Props = {
  onOpenScheme: () => void
  showExisting: boolean
  onToggleExisting: () => void
  schemeCount: number
}

/** KICD-referenced annual reader. No official protected text is republished. */
export default function Grade8KiswahiliMap({onOpenScheme,showExisting,onToggleExisting,schemeCount}: Props) {
  const [selectedTheme, setSelectedTheme] = useState(1)
  const [search, setSearch] = useState('')
  const theme = GRADE8_KISWAHILI_THEMES[selectedTheme - 1]
  const sections = GRADE8_KISWAHILI_UNITS.filter(unit => unit.themeNumber === selectedTheme)
  const matchingThemes = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('sw')
    return !q ? GRADE8_KISWAHILI_THEMES : GRADE8_KISWAHILI_THEMES.filter(t =>
      t.title.toLocaleLowerCase('sw').includes(q) || String(t.number) === q ||
      t.topics.some(topic => topic.toLocaleLowerCase('sw').includes(q))
    )
  }, [search])
  const chooseTheme = (number: number) => {setSelectedTheme(number);setSearch('')}
  return <section aria-label="Kiswahili Gredi ya 8 — Mtaala" style={{background:'#fff',border:'1px solid #d8e5dc',borderRadius:16,padding:'clamp(14px,3vw,22px)',marginBottom:18,color:'#193a2e'}}>
    <header>
      <div style={{fontSize:11,color:'#28654d',fontWeight:800,letterSpacing:'.06em'}}>MAKTABA YA MTAALA · GREDI YA 8</div>
      <h2 style={{fontSize:'clamp(22px,3vw,28px)',lineHeight:1.2,margin:'8px 0'}}>Kiswahili</h2>
      <p style={{color:'#536a5e',fontSize:13,lineHeight:1.6,margin:'0 0 12px'}}>Mada 15 · Stadi 4 · Mada ndogo 60 · Vipindi 120 vilivyopendekezwa · Vipindi 4 kwa wiki.</p>
      <p style={{color:'#536a5e',fontSize:12,lineHeight:1.6,margin:'0 0 14px'}}>Muhtasari wa mada kutoka KICD, toleo lililorekebishwa 2024. Unaweza kusoma bila kupanga ratiba au wiki.</p>
      <a href={GRADE8_KISWAHILI_SOURCE} target="_blank" rel="noopener noreferrer" style={{fontSize:13,color:'#175b43',fontWeight:700,textDecoration:'underline',textUnderlineOffset:3}}>Soma mtaala rasmi wa KICD</a>
    </header>
    <div style={{margin:'20px 0 14px'}}>
      <label htmlFor="kiswahili-grade8-search" style={{fontSize:12,fontWeight:700,display:'block',marginBottom:7}}>Tafuta mada au mada ndogo</label>
      <input id="kiswahili-grade8-search" type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Kwa mfano: Haki za Watoto, Sarufi…" style={{minHeight:44,width:'100%',boxSizing:'border-box',fontSize:15,padding:'10px 12px',border:'1px solid #a5bdaf',borderRadius:9}} />
      {search ? <nav aria-label="Matokeo ya mada" style={{display:'grid',gap:5,marginTop:8}}>
        {matchingThemes.map(t=><button key={t.number} type="button" onClick={()=>chooseTheme(t.number)} style={{textAlign:'left',minHeight:44,padding:'9px 12px',border:'1px solid #d8e7dd',borderRadius:8,background:'#f6faf7',color:'#193a2e',cursor:'pointer'}}><strong>{t.number}.</strong> {t.title}</button>)}
        {matchingThemes.length===0&&<p role="status" style={{fontSize:13}}>Hakuna mada inayolingana na utafutaji huu.</p>}
      </nav> : <div style={{display:'flex',gap:7,overflowX:'auto',padding:'8px 0'}} aria-label="Chagua mada">{GRADE8_KISWAHILI_THEMES.map(t=><button key={t.number} type="button" onClick={()=>setSelectedTheme(t.number)} aria-pressed={selectedTheme===t.number} title={t.title} style={{flex:'0 0 auto',minWidth:44,minHeight:44,padding:8,fontWeight:700,cursor:'pointer',borderRadius:9,border:'1px solid #bad5c5',background:selectedTheme===t.number?'#175b43':'#fff',color:selectedTheme===t.number?'#fff':'#175b43'}}>{t.number}</button>)}</div>}
    </div>
    <article style={{border:'1px solid #dae7dd',borderRadius:12,overflow:'hidden'}}>
      <div style={{padding:'13px 15px',background:'#f3f8f4',borderBottom:'1px solid #dae7dd'}}>
        <div style={{fontSize:11,fontWeight:800,color:'#47715a'}}>MADA {selectedTheme} · UKURASA WA MTAALA {theme.sourcePage}</div>
        <h3 style={{fontSize:18,margin:'4px 0 0'}}>{theme.title}</h3>
      </div>
      <div style={{padding:12,display:'grid',gap:9}}>{sections.map((unit,i)=><div key={unit.code} style={{padding:12,border:'1px solid #e0e9e2',borderRadius:9}}>
        <div style={{fontSize:11,fontWeight:800,color:'#28654d',marginBottom:5}}>{unit.code} · {GRADE8_KISWAHILI_STRANDS[i]} · VIPINDI 2</div>
        <h4 style={{fontSize:15,margin:0,lineHeight:1.45}}>{unit.title}</h4>
      </div>)}</div>
    </article>
    <div style={{display:'flex',justifyContent:'space-between',gap:8,marginTop:12}}>
      <button type="button" disabled={selectedTheme===1} onClick={()=>setSelectedTheme(n=>n-1)} style={{minHeight:44,border:'1px solid #b9cfbf',borderRadius:9,padding:'10px 12px',background:'#fff',color:'#175b43',opacity:selectedTheme===1 ? 0.5 : 1}}>Mada iliyotangulia</button>
      <button type="button" disabled={selectedTheme===15} onClick={()=>setSelectedTheme(n=>n+1)} style={{minHeight:44,border:'1px solid #b9cfbf',borderRadius:9,padding:'10px 12px',background:'#e9f4ec',color:'#175b43',opacity:selectedTheme===15 ? 0.5 : 1}}>Mada inayofuata</button>
    </div>
    <div style={{borderTop:'1px solid #dfe8e1',marginTop:17,paddingTop:15}}>
      <h3 style={{fontSize:16,margin:'0 0 7px'}}>Mpango wa mwalimu</h3>
      <p style={{fontSize:12,lineHeight:1.6,color:'#526b5f',margin:'0 0 11px'}}>Masomo {schemeCount} yaliyohifadhiwa kwenye Scheme of Work. Muhtasari huu unaonesha vichwa vya KICD, si matokeo yote rasmi, shughuli au mgawanyo wa wiki. Ratiba na mpango wa kila shule huhifadhiwa kando.</p>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <button type="button" onClick={onOpenScheme} style={{border:0,borderRadius:9,minHeight:44,padding:'10px 14px',background:'#175b43',color:'#fff',fontWeight:750,cursor:'pointer'}}>Fungua Scheme of Work</button>
        <button type="button" onClick={onToggleExisting} aria-expanded={showExisting} style={{border:'1px solid #a6c1b1',borderRadius:9,minHeight:44,padding:'10px 14px',background:'#fff',color:'#175b43',fontWeight:750,cursor:'pointer'}}>{showExisting?'Ficha rekodi zilizohifadhiwa':'Angalia rekodi zilizohifadhiwa'}</button>
      </div>
      <p style={{fontSize:11,color:'#6a7d71',margin:'12px 0 0',lineHeight:1.5}}>Maelezo ya matokeo maalum na shughuli kamili yanapatikana kwenye chanzo rasmi. Uchapishaji wa maandishi hayo ndani ya VibeSchool unahitaji idhini ya KICD.</p>
    </div>
  </section>
}
