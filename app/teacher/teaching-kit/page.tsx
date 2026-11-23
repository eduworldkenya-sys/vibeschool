'use client'
import {Suspense, useCallback, useEffect, useState} from 'react'
import Link from 'next/link'
import {teachingKitBackHref} from '@/lib/teaching/teachingKitContext'
import {useRouter, useSearchParams} from 'next/navigation'
import {supabase} from '@/lib/supabase'
import {TeachingLibrary} from '@/components/live-classroom/LiveTeachingLibrary'
import {SlideCanvas} from '@/components/live-classroom/LiveSlideCanvas'
import type {LiveSlide} from '@/components/live-classroom/LiveSlideProtocol'

type Presentation = {id:string;title:string;revision:number;slides:LiveSlide[]}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const button = {border:'1px solid #d3ded9',padding:'10px 14px',borderRadius:4,background:'#fff',color:'#163b2e',fontWeight:700,cursor:'pointer'} as const
function SlidesWorkspace(){
  const params=useSearchParams(),router=useRouter()
  const rawClass=params.get('classId')
  const classId=rawClass&&uuid.test(rawClass)?rawClass:null
  const [authorized,setAuthorized]=useState(false)
  const [error,setError]=useState('')
  const [deck,setDeck]=useState<Presentation|null>(null)
  const [page,setPage]=useState(0)
  useEffect(()=>{
    let active=true
    void supabase.auth.getUser().then(({data,error})=>{
      if(!active)return
      if(error||!data.user){router.replace('/login/teacher');return}
      setAuthorized(true)
    }).catch(()=>{if(active)setError('Unable to verify your account.')})
    return()=>{active=false}
  },[router])
  // Reuse the canonical teacher-owned Live materials commands even when no
  // Live session exists. The RPC checks the authenticated teacher identity.
  const command=useCallback(async (action:string,id:string|null=null,version:number|null=null,payload:Record<string,unknown>={})=>{
    if(!authorized)throw new Error('Sign in as a teacher to open presentations.')
    const {data,error}=await supabase.rpc('vibe_live_command',{
      p_action:action,p_class_id:classId,p_session_id:id,p_version:version,p_payload:{...payload,host:true},
    })
    if(error)throw new Error(error.message||'Unable to access presentations.')
    if(data===null||typeof data!=='object')throw new Error('Invalid presentation response.')
    return data
  },[classId,authorized])
  if(error)return <main style={{padding:18}} role="alert">{error}</main>
  if(!authorized)return <main style={{padding:18}} role="status">Opening your teaching slides…</main>
  if(deck){
    const slide=deck.slides[page]
    return <main aria-label="In-class presentation" style={{position:'fixed',inset:0,zIndex:1200,overflowY:'auto',background:'#eaf0ed',padding:14,color:'#172f25'}}>
      <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap',maxWidth:1100,margin:'0 auto 12px'}}>
        <div><strong>{deck.title}</strong><div style={{fontSize:12,color:'#4b6659'}}>In class · on this device only · {page+1} / {deck.slides.length}</div></div>
        <button type="button" style={button} onClick={()=>{setDeck(null);setPage(0)}}>Close presentation</button>
      </header>
      <div style={{maxWidth:1100,margin:'0 auto'}}>{slide&&<SlideCanvas slide={slide} number={page+1} total={deck.slides.length}/>}</div>
      <nav aria-label="Presentation slides" style={{display:'flex',gap:8,justifyContent:'center',alignItems:'center',margin:'12px auto',flexWrap:'wrap'}}>
        <button style={button} type="button" disabled={page===0} onClick={()=>setPage(n=>n-1)}>Previous</button>
        <span aria-live="polite" style={{fontSize:13}}>Slide {page+1} of {deck.slides.length}</span>
        <button style={button} type="button" disabled={page===deck.slides.length-1} onClick={()=>setPage(n=>n+1)}>Next</button>
      </nav>
      <p style={{fontSize:12,textAlign:'center',color:'#506b5e'}}>Presenter notes stay private in the editor. Nothing is broadcast to learners.</p>
    </main>
  }
  return <main style={{maxWidth:1120,margin:'0 auto',padding:'16px',background:'#f7faf8',minHeight:'100vh',color:'#172f25'}}>
    <header style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',marginBottom:18}}>
      <div><span style={{fontSize:11,color:'#547365',fontWeight:750}}>TEACHING KIT</span><h1 style={{margin:'4px 0',fontSize:24}}>Slides</h1><p style={{fontSize:13,margin:0,color:'#506b5e'}}>Create once. Use in class or load in Live Lesson.</p></div>
      <Link href={teachingKitBackHref(params)} style={button}>Lesson Plans</Link>
    </header>
    <TeachingLibrary command={command} currentDeck={null} onUse={material=>{setDeck(material);setPage(0)}}/>
  </main>
}
export default function TeachingKitSlidesPage(){return <Suspense fallback={<main style={{padding:18}}>Opening slides…</main>}><SlidesWorkspace/></Suspense>}
