'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { VisualLearningAsset } from '@/components/learn/VisualLearningAsset'
type Visual = { id: string; title: string; grade: string; subject: string; caption: string; type: string }
export default function LearnVisualLibrary() {
  const [grade,setGrade] = useState('')
  const [search,setSearch] = useState('')
  const [visuals,setVisuals] = useState<Visual[]>([])
  const [state,setState] = useState<'loading'|'ready'|'error'>('loading')
  useEffect(()=>{
    let active = true
    const controller = new AbortController()
    setState('loading')
    void fetch('/api/visual-library?grade='+encodeURIComponent(grade),{cache:'no-store',signal:controller.signal})
      .then(async r=>{if(!r.ok)throw Error('visuals-unavailable');return r.json()})
      .then(data=>{if(active){setVisuals(Array.isArray(data.visuals)?data.visuals:[]);setState('ready')}})
      .catch(()=>{if(active)setState('error')})
    return ()=>{active=false;controller.abort()}
  },[grade])
  const filtered=visuals.filter(v=>!search.trim()||[v.title,v.subject,v.caption].join(' ').toLowerCase().includes(search.trim().toLowerCase()))
  return <main style={{maxWidth:980,margin:'0 auto',padding:'24px 16px 80px',color:'#183d2b',fontFamily:'system-ui,sans-serif'}}>
    <Link href="/learn" style={{color:'#276746'}}>← Learn</Link>
    <h1 style={{fontSize:28,margin:'16px 0 5px'}}>Visual Learning Library</h1>
    <p style={{fontSize:14,lineHeight:1.6,color:'#54705c'}}>Find published diagrams, illustrations and models. Only approved learning visuals are displayed.</p>
    <div style={{display:'flex',gap:12,flexWrap:'wrap',margin:'20px 0'}}>
      <label style={{display:'grid',gap:5,fontSize:13}}>Grade
        <select value={grade} onChange={e=>setGrade(e.target.value)} style={{minHeight:44,border:'1px solid #c5d9cb',borderRadius:9,padding:'8px 12px'}}>
          <option value="">All grades</option>{Array.from({length:9},(_,i)=><option key={i+1} value={String(i+1)}>Grade {i+1}</option>)}
        </select></label>
      <label style={{display:'grid',gap:5,fontSize:13,flex:1,minWidth:200}}>Search visuals
        <input placeholder="e.g. fraction diagram" value={search} onChange={e=>setSearch(e.target.value)}
          style={{minHeight:44,border:'1px solid #c5d9cb',borderRadius:9,padding:'8px 12px'}}/>
      </label>
    </div>
    {state==='loading'?<p role="status">Loading published visuals…</p>:state==='error'?<p role="alert">Visuals cannot be loaded right now.</p>:
      filtered.length===0?<p>No published visuals match your selection yet.</p>:
      <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,270px),1fr))',gap:15}}>
        {filtered.map(v=><article key={v.id} style={{border:'1px solid #d9e5dc',borderRadius:14,padding:14,background:'#fff'}}>
          <h2 style={{fontSize:17,margin:'0 0 6px'}}>{v.title}</h2>
          <p style={{fontSize:12,color:'#56715e'}}>{v.grade} · {v.subject} · {v.type.replaceAll('_',' ')}</p>
          <VisualLearningAsset id={v.id}/>
        </article>)}
      </section>}
  </main>
}
