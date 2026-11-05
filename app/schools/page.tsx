'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import { supabase } from '@/lib/supabase'
import styles from './schools.module.css'

type School = {school_id:string;school_name:string;county:string|null;sub_county:string|null;school_category:string|null;ownership_type:string|null}
type DirectorySchool = {directory_id:string;school_name:string;county:string|null;sub_county:string|null;school_level:string|null;ownership_type:string|null}
type Entry = {id:string;name:string;county:string|null;subCounty:string|null;level:string|null;ownership:string|null;href:string|null}
const key = (s:Entry) => [s.name,s.county,s.subCounty].map(v=>(v||'').trim().toLocaleLowerCase()).join('|')
const LIMIT=100

export default function SchoolsDirectoryPage(){
 const [query,setQuery]=useState('')
 const [entries,setEntries]=useState<Entry[]>([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [hasMore,setHasMore]=useState(false)
 const [page,setPage]=useState(0)
 useEffect(()=>{
  let cancelled=false
  const timer=setTimeout(async()=>{
   setLoading(true);setError('')
   const q=query.trim()
   const [primary,directory]=await Promise.all([
    supabase.rpc('schools_search_public_v2',{p_query:q||null,p_county:null,p_sub_county:null,p_ward:null,p_school_category:null,p_ownership_type:null,p_gender_type:null,p_accommodation_type:null,p_limit:LIMIT}),
    supabase.rpc('schools_directory_search_public_v1',{p_query:q||null,p_county:null,p_sub_county:null,p_level:null,p_limit:LIMIT})
   ])
   if(cancelled)return
   if(primary.error&&directory.error){setError('Could not load schools. Try again.');setEntries([]);setHasMore(false);setLoading(false);return}
   const a=((primary.data||[]) as School[]).map(s=>({id:s.school_id,name:s.school_name,county:s.county,subCounty:s.sub_county,level:s.school_category,ownership:s.ownership_type,href:'/schools/'+encodeURIComponent(s.school_id)}))
   const b=((directory.data||[]) as DirectorySchool[]).map(s=>({id:s.directory_id,name:s.school_name,county:s.county,subCounty:s.sub_county,level:s.school_level,ownership:s.ownership_type,href:null}))
   const seen=new Set<string>()
   const merged=[...a,...b].filter(s=>{const k=key(s);if(seen.has(k))return false;seen.add(k);return true}).sort((x,y)=>x.name.localeCompare(y.name))
   setEntries(merged);setHasMore((primary.data||[]).length===LIMIT||(directory.data||[]).length===LIMIT);setLoading(false)
  },query?220:0)
  return ()=>{cancelled=true;clearTimeout(timer)}
 },[query])
 const shown=entries.slice(0,(page+1)*25)
 return <div className={styles.page}>
  <PublicHeader product="Schools"/>
  <main id="main-content" className={styles.directoryMain}>
   <h1 className={styles.directoryTitle}>Find a school</h1>
   <div className={styles.directorySearch}>
    <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></svg>
    <input aria-label="Search schools" type="search" autoComplete="off" placeholder="Search school name..." value={query} onChange={e=>{setQuery(e.target.value);setPage(0)}}/>
   </div>
   <div className={styles.directoryHeading}><h2>{query?'Schools':'All schools'}</h2></div>
   {error&&<div role="alert" className={styles.directoryStatus}>{error} <button onClick={()=>setQuery(q=>q+' ')}>Retry</button></div>}
   {loading?<p role="status" className={styles.directoryStatus}>Loading schools…</p>:<>
    <div className={styles.directoryList}>{shown.map(s=>{
     const content=<><span className={styles.directoryIcon} aria-hidden="true"><svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 21V7l9-4 9 4v14M3 10h18M9 21v-7h6v7M7 13h1m8 0h1"/></svg></span><span className={styles.directoryInfo}><strong>{s.name}</strong><small>{[s.subCounty,s.county,s.level].filter(Boolean).join(' · ')}</small></span>{s.href&&<span className={styles.directoryArrow} aria-hidden="true">›</span>}</>
     return s.href?<Link className={styles.directoryItem} key={s.id} href={s.href}>{content}</Link>:<div className={styles.directoryItem} key={'directory-'+s.id}>{content}</div>
    })}</div>
    {!entries.length&&!error&&<p className={styles.directoryStatus}>No schools found.</p>}
    {shown.length<entries.length&&<button className={styles.directoryMore} onClick={()=>setPage(p=>p+1)}>Show more schools</button>}
    {hasMore&&<p className={styles.directoryStatus}>Search by school name to find more schools.</p>}
   </>}
  </main>
  <PublicFooter/>
 </div>
}
