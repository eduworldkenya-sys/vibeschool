'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { EMPTY_CATALOGUE, PATHWAYS, exploreTrack, schoolFilters } from '@/lib/pathways/explorer'
import type { Catalogue, Pathway, Track, Combination, Subject, Career, CareerLink } from '@/lib/pathways/explorer'
import styles from './PathwaysExplorer.module.css'

type Step='pathway'|'subjects'|'careers'|'schools'
type School={school_id:string;school_name:string;county:string|null;pathway_slug:string|null;combination_name:string|null;source_name:string|null;source_url:string|null}
const STEPS:Step[]=['pathway','subjects','careers','schools']
const EMPTY_VIEW={combinations:[],subjects:[],careers:[]} as ReturnType<typeof exploreTrack>

export default function PathwaysExplorer(){
 const [data,setData]=useState<Catalogue>(EMPTY_CATALOGUE)
 const [slug,setSlug]=useState('stem')
 const [trackSlug,setTrackSlug]=useState('pure-sciences')
 const [step,setStep]=useState<Step>('pathway')
 const [areaOpen,setAreaOpen]=useState(false)
 const [subject,setSubject]=useState('')
 const [careerId,setCareerId]=useState('')
 const [combinationId,setCombinationId]=useState('')
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState(false)
 const [retry,setRetry]=useState(0)
 const [schools,setSchools]=useState<School[]>([])
 const [schoolLoading,setSchoolLoading]=useState(false)
 const [schoolError,setSchoolError]=useState(false)
 const panel=useRef<HTMLElement>(null)
 const careerPanel=useRef<HTMLDivElement>(null)
 useEffect(()=>{
  function restore(){const q=new URLSearchParams(window.location.search);const p=q.get('pathway')||window.location.hash.slice(1);setSlug(PATHWAYS.some(x=>x.slug===p)?p:'stem');setTrackSlug(q.get('track')||'pure-sciences');setStep('pathway');setSubject('');setCareerId('');setCombinationId('')}
  restore();window.addEventListener('popstate',restore);window.addEventListener('hashchange',restore)
  return()=>{window.removeEventListener('popstate',restore);window.removeEventListener('hashchange',restore)}
 },[])
 useEffect(()=>{
  let cancelled=false;setLoading(true);setError(false)
  void(async()=>{try{
   const rows=await Promise.all([
    supabase.from('pathways').select('id,slug,name').eq('status','published').eq('verification_state','verified'),
    supabase.from('pathway_tracks').select('id,pathway_id,slug,name').eq('status','published').eq('verification_state','verified').order('official_code'),
    supabase.from('pathway_subject_combinations').select('id,pathway_id,track_id,slug,display_name').eq('status','published').eq('verification_state','verified').order('display_name'),
    supabase.from('pathway_combination_subject_claims').select('combination_id,subject_name,subject_order').order('subject_order'),
    supabase.from('pathway_careers').select('id,slug,name,summary').eq('status','published').eq('verification_state','verified').order('name'),
    supabase.from('pathway_career_links').select('career_id,pathway_id,track_id,explanation').eq('verification_state','verified'),
   ])
   if(cancelled)return
   if(rows.some(r=>r.error))throw new Error('catalogue_unavailable')
   setData({pathways:(rows[0].data??[]) as Pathway[],tracks:(rows[1].data??[]) as Track[],combinations:(rows[2].data??[]) as Combination[],subjects:(rows[3].data??[]) as Subject[],careers:(rows[4].data??[]) as Career[],links:(rows[5].data??[]) as CareerLink[]})
  }catch{if(!cancelled)setError(true)}finally{if(!cancelled)setLoading(false)}})()
  return()=>{cancelled=true}
 },[retry])
 const pathway=data.pathways.find(p=>p.slug===slug)
 const tracks=data.tracks.filter(t=>t.pathway_id===pathway?.id)
 const track=tracks.find(t=>t.slug===trackSlug)??tracks[0]
 const view=pathway&&track?exploreTrack(data,pathway,track):EMPTY_VIEW
 const career=view.careers.find(c=>c.id===careerId)
 const combination=view.combinations.find(c=>c.id===combinationId)
 const combinations=subject?view.combinations.filter(c=>data.subjects.some(s=>s.combination_id===c.id&&s.subject_name===subject)):view.combinations
 useEffect(()=>{
  if(step!=='schools'||!pathway)return
  let cancelled=false;setSchoolLoading(true);setSchoolError(false);setSchools([])
  void(async()=>{try{
   const result=await supabase.rpc('pathways_search_public_schools_v2',schoolFilters(pathway,combination))
   if(cancelled)return
   if(result.error)throw result.error
   setSchools(((result.data??[]) as School[]).filter(s=>s.pathway_slug===pathway.slug))
  }catch{if(!cancelled)setSchoolError(true)}finally{if(!cancelled)setSchoolLoading(false)}})()
  return()=>{cancelled=true}
 },[step,pathway,combination,retry])
 function focus(target:'panel'|'careers'='panel'){requestAnimationFrame(()=>{const el=target==='careers'?careerPanel.current:panel.current;el?.focus({preventScroll:true});if(window.matchMedia('(max-width:760px)').matches)el?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'})})}
 function remember(p:string,t?:string){const q=new URLSearchParams({pathway:p});if(t)q.set('track',t);window.history.replaceState(null,'',`/pathways?${q}`)}
 function choosePathway(p:string){setSlug(p);setTrackSlug('');setAreaOpen(true);setStep('subjects');setSubject('');setCareerId('');setCombinationId('');remember(p);focus()}
 function chooseTrack(t:string){setTrackSlug(t);setAreaOpen(false);setStep('subjects');setSubject('');setCareerId('');setCombinationId('');remember(slug,t)}
 function go(next:Step){setStep(next);if(next!=='pathway')focus(next==='careers'?'careers':'panel')}
 const name=PATHWAYS.find(p=>p.slug===slug)?.name??'Pathway'
 return <div className={styles.page}>
  <nav className={styles.progress} aria-label="Your pathway journey">{STEPS.map((s,i)=><button type="button" key={s} disabled={s!=='pathway'&&(!pathway||!track)} onClick={()=>go(s)} aria-current={step===s?'step':undefined}><span className={styles.circle}>{i<STEPS.indexOf(step)?'✓':i+1}</span><span>{s[0].toUpperCase()+s.slice(1)}</span></button>)}</nav>
  <div className={styles.heading}><div><h1>Choose your pathway</h1><p>Explore options. Choose what suits you.</p></div><Link href="/pathways/check" className={styles.help}><span>Not sure? </span>Help me choose</Link></div>
  <div className={styles.explorer}>
   <div className={styles.picker}>
    <div className={styles.wheel} role="group" aria-label="Choose a pathway"><svg viewBox="0 0 440 440" aria-hidden="true"><path d="M220 220 L31.21 111 A218 218 0 0 1 408.79 111 Z" fill="#0c345c"/><path d="M220 220 L220 438 A218 218 0 0 1 31.21 111 Z" fill="#bce9e1"/><path d="M220 220 L408.79 111 A218 218 0 0 1 220 438 Z" fill="#ffe3a0"/></svg>
     {PATHWAYS.map(p=><button type="button" key={p.slug} className={`${styles.sector} ${styles[p.tone]}`} aria-pressed={slug===p.slug} disabled={loading||!data.pathways.some(x=>x.slug===p.slug)} onClick={()=>choosePathway(p.slug)}><span>{p.name==='Social Sciences'?<>Social<br/>Sciences</>:p.name==='Arts & Sports'?<>Arts &amp;<br/>Sports</>:p.name}</span></button>)}<span className={styles.center}>Explore</span>
    </div>
    <div className={styles.cards} role="group" aria-label="Choose a pathway">{PATHWAYS.map(p=><button type="button" className={`${styles.pathwayCard} ${styles[p.tone]}`} key={p.slug} aria-pressed={slug===p.slug} disabled={loading||!data.pathways.some(x=>x.slug===p.slug)} onClick={()=>choosePathway(p.slug)}><span>{p.name}</span><span aria-hidden="true">›</span></button>)}</div>
   </div>
   <section ref={panel} tabIndex={-1} className={styles.panel} aria-label={`${name} details`} aria-busy={loading}>
    {loading?<p role="status">Loading pathways…</p>:error?<div role="alert"><p>Couldn’t load pathways.</p><button type="button" className={styles.outline} onClick={()=>setRetry(v=>v+1)}>Try again</button></div>:!pathway||!track?<p>No study areas published yet. <Link href="/pathways/check">Help me choose</Link></p>:<>
     <div className={styles.breadcrumb}><button type="button" onClick={()=>go('subjects')}>‹ {name}</button>{step==='schools'&&<span>› Schools</span>}</div>
     {step==='schools'?<>
      <h2>Find schools</h2><p className={styles.caption}>{combination?.display_name??`${pathway.name} offerings · no subject combination selected`}</p>
      {schoolLoading?<p role="status">Finding schools…</p>:schoolError?<div role="alert"><p>Couldn’t load schools.</p><button type="button" className={styles.outline} onClick={()=>setRetry(v=>v+1)}>Try again</button></div>:schools.length?<div className={styles.schoolList}>{schools.map((s,i)=><article className={styles.school} key={`${s.school_id}-${i}`}><h3><Link href={`/schools/${s.school_id}`}>{s.school_name} →</Link></h3><p>{s.county}</p><span>✓ Verified offering</span>{s.combination_name&&<p>{s.combination_name}</p>}{s.source_url&&/^https?:\/\//.test(s.source_url)&&<a href={s.source_url} target="_blank" rel="noopener noreferrer">{s.source_name||'View source'} ↗</a>}</article>)}</div>:<div className={styles.state}><p>No verified school matches yet.</p><p className={styles.caption}>This doesn’t mean schools don’t offer it.</p><Link href="/schools">Search all schools →</Link></div>}
      <button type="button" className={styles.outline} onClick={()=>go('subjects')}>← Back to subjects</button>
     </>:<>
      <button type="button" className={styles.changeArea} aria-label="Change study area" aria-expanded={areaOpen} onClick={()=>setAreaOpen(v=>!v)}><span>{track.name}</span><small>Change⌄</small></button>
      <div className={`${styles.studyArea} ${areaOpen?styles.areaOpen:''}`}><h2>Choose a study area</h2><div className={styles.tracks}>{tracks.map(t=><button type="button" key={t.id} aria-pressed={track.id===t.id} onClick={()=>chooseTrack(t.slug)}><span>{t.name}</span><span aria-hidden="true">›</span></button>)}</div></div>
      <div className={styles.details}><h2><span className={styles.desktopTitle}>Explore {track.name}</span><span className={styles.mobileTitle}>Subjects &amp; careers</span></h2>
       <div className={styles.columns}><div><h3>Subjects</h3><div className={styles.chips}>{view.subjects.map(s=><button type="button" key={s} aria-pressed={s===subject} onClick={()=>{setSubject(subject===s?'':s);setCombinationId('');setStep('subjects')}}>{s}</button>)}</div>{!view.subjects.length&&<p className={styles.caption}>Subject details coming soon.</p>}</div>
        <div ref={careerPanel} tabIndex={-1}><h3>Careers</h3><div className={styles.careers}>{view.careers.map(c=><button type="button" key={c.id} aria-pressed={careerId===c.id} onClick={()=>{setCareerId(careerId===c.id?'':c.id);setStep('careers')}}><span>{c.name}</span><span aria-hidden="true">›</span></button>)}</div>{!view.careers.length&&<p className={styles.caption}>Career links coming soon.</p>}</div>
       </div>
       {career&&<div className={styles.careerDetail} role="status"><strong>{career.name}</strong><p>{career.summary}</p>{career.explanation&&<p>{career.explanation}</p>}{career.pathwayOnly&&<small>Linked to {pathway.name}. Check specific entry requirements separately.</small>}</div>}
       {combinations.length>0&&<details className={styles.combinations}><summary>Subject combinations</summary><div>{combinations.map(c=><button type="button" key={c.id} aria-pressed={c.id===combinationId} onClick={()=>setCombinationId(combinationId===c.id?'':c.id)}>{c.display_name}</button>)}</div></details>}
       <button type="button" className={styles.findSchools} onClick={()=>go('schools')}>Find schools <span aria-hidden="true">→</span></button>
      </div>
     </>}
    </>}
   </section>
  </div><p className={styles.guidance}>Guidance, not placement. School matches use verified offerings.</p>
 </div>
}
