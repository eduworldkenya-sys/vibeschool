'use client'

import { useMemo, useState } from 'react'
import { TrackedLink } from '@/components/public/TrackedLink'

const areas = ['Education & Curriculum','Engineering & Data','Product & Design','Schools & Partnerships','Support & Operations','Growth & Communication'] as const

export function CareerInterest(){
  const [area,setArea]=useState<(typeof areas)[number]>('Education & Curriculum')
  const href=useMemo(()=>`https://wa.me/254728232157?text=${encodeURIComponent(`Hello VibeSchool. I am interested in future opportunities in ${area}.\n\nA little about me: `)}`,[area])
  return <section aria-labelledby="talent-interest" style={{width:'min(1060px,calc(100% - 36px))',margin:'28px auto',padding:'30px',border:'1px solid #dedfe7',borderRadius:22,background:'#fff'}}>
    <p style={{margin:0,fontSize:11,fontWeight:850,letterSpacing:'.14em',color:'#725815'}}>TALENT INTEREST</p>
    <h2 id="talent-interest" style={{fontSize:30,margin:'8px 0'}}>Interested in building with us later?</h2>
    <p style={{maxWidth:720,color:'#656575',lineHeight:1.65}}>There is no promise of an open role. This simply starts a genuine conversation so VibeSchool can meet people who may fit future work.</p>
    <label style={{display:'grid',gap:8,maxWidth:520,fontWeight:800,fontSize:13}}>Area of interest<select value={area} onChange={e=>setArea(e.target.value as typeof area)} style={{minHeight:48,border:'1px solid #d8dbe3',borderRadius:11,padding:'0 12px',background:'#fff'}}>{areas.map(x=><option key={x}>{x}</option>)}</select></label>
    <TrackedLink href={href} event="public_careers_interest" external target="_blank" rel="noopener noreferrer" style={{display:'inline-flex',marginTop:18,padding:'12px 17px',borderRadius:10,background:'#111827',color:'#fff',textDecoration:'none',fontWeight:850}}>Express interest on WhatsApp</TrackedLink>
    <p style={{margin:'12px 0 0',fontSize:12,color:'#7b7b89'}}>Do not send identity documents, certificates or sensitive personal information until a real recruitment process explicitly asks for them through an appropriate channel.</p>
  </section>
}
