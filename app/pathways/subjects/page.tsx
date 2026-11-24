'use client'
import {useEffect,useState} from 'react'
import Link from 'next/link'
import {PublicHeader} from '@/components/public/PublicHeader'
import {PublicFooter} from '@/components/public/PublicFooter'
import PathwaysNav from '@/components/pathways/PathwaysNav'
import {supabase} from '@/lib/supabase'
import type {Pathway,Track,Combination} from '@/lib/pathways/explorer'
export default function SubjectsPage(){
 const [data,setData]=useState<{paths:Pathway[];tracks:Track[];combinations:Combination[]}|null>(null)
 const [error,setError]=useState(false)
 const [retry,setRetry]=useState(0)
 useEffect(()=>{let cancelled=false;setError(false);setData(null);void(async()=>{try{
 const [p,t,c]=await Promise.all([
 supabase.from('pathways').select('id,slug,name').eq('status','published').eq('verification_state','verified'),
 supabase.from('pathway_tracks').select('id,pathway_id,slug,name').eq('status','published').eq('verification_state','verified').order('official_code'),
 supabase.from('pathway_subject_combinations').select('id,pathway_id,track_id,slug,display_name').eq('status','published').eq('verification_state','verified').order('display_name')])
 if(p.error||t.error||c.error)throw Error('catalogue')
 if(!cancelled)setData({paths:(p.data??[]) as Pathway[],tracks:(t.data??[]) as Track[],combinations:(c.data??[]) as Combination[]})
 }catch{if(!cancelled)setError(true)}})();return()=>{cancelled=true}},[retry])
 return <><PublicHeader product="Pathways"/><PathwaysNav active="/pathways/subjects"/><main id="main-content" style={{maxWidth:1120,margin:'auto',padding:'24px 20px 48px',color:'#0c345c'}}><h1>Subjects</h1><p>Kenya Senior School · Verified subject combinations</p>
 {error?<div role="alert">Could not load subjects. <button onClick={()=>setRetry(n=>n+1)}>Try again</button></div>:!data?<p role="status">Loading subjects…</p>:data.paths.length===0?<p>No verified pathways published.</p>:data.paths.map(p=><section key={p.id} style={{border:'1px solid #d9dde3',margin:'20px 0'}}><h2 style={{margin:0,padding:16,background:p.slug==='stem'?'#0c345c':p.slug==='social-sciences'?'#bce9e1':'#ffe3a0',color:p.slug==='stem'?'white':'#080e27'}}>{p.name}</h2>{data.tracks.filter(t=>t.pathway_id===p.id).map(t=><details key={t.id} style={{padding:'12px 16px',borderBottom:'1px solid #d9dde3'}}><summary style={{cursor:'pointer',minHeight:44,fontWeight:700}}>{t.name}</summary><p><Link href={'/pathways?pathway='+encodeURIComponent(p.slug)+'&track='+encodeURIComponent(t.slug)}>Explore study area and careers →</Link></p>{data.combinations.filter(c=>c.track_id===t.id&&c.pathway_id===p.id).map(c=><div key={c.id} style={{display:'flex',flexWrap:'wrap',justifyContent:'space-between',gap:12,padding:'12px 0',borderTop:'1px solid #e3e8ee'}}><span>{c.display_name}</span><Link href={'/pathways/schools?pathway='+encodeURIComponent(p.slug)+'&combination='+encodeURIComponent(c.slug)}>Find schools →</Link></div>)}{!data.combinations.some(c=>c.track_id===t.id&&c.pathway_id===p.id)&&<p>No verified combinations published.</p>}</details>)}</section>)}
 <p>Guidance, not placement. Confirm current requirements with official education services.</p></main><PublicFooter/></>
}
