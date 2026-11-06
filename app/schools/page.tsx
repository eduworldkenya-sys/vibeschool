'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import { supabase } from '@/lib/supabase'
import styles from './schools.module.css'
import { schoolUrl, type PublicSchoolAddress } from '@/lib/school-urls'

type Entry = {id:string;name:string;county:string|null;subCounty:string|null;level:string|null;ownership:string|null;href:string}
type FilterOption = {option_kind:'county'|'sub_county'|'level';option_value:string}
const LIMIT=100

export default function SchoolsDirectoryPage(){
 const [query,setQuery]=useState('')
 const [county,setCounty]=useState('')
 const [subCounty,setSubCounty]=useState('')
 const [level,setLevel]=useState('')
 const [options,setOptions]=useState<FilterOption[]>([])
 // Prevent early typing being discarded before React attaches the input handler.
 const [ready,setReady]=useState(false)
 useEffect(()=>{setReady(true)},[])
 const [entries,setEntries]=useState<Entry[]>([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [hasMore,setHasMore]=useState(false)
 const [page,setPage]=useState(0)
 const [retry,setRetry]=useState(0)
 useEffect(()=>{
  let active=true
  void supabase.rpc('schools_public_filter_options_v1',{p_county:county||null}).then(({data,error})=>{
   if(active)setOptions(error?[]:((data||[]) as FilterOption[]))
  })
  return()=>{active=false}
 },[county])
 useEffect(()=>{
  let cancelled=false
  const timer=setTimeout(async()=>{
   setLoading(true);setError('')
   const q=query.trim()
   const result=await supabase.rpc('schools_search_urls_public_v2',{p_query:q||null,p_county:county||null,p_sub_county:subCounty||null,p_level:level||null,p_limit:LIMIT})
   if(cancelled)return
   if(result.error){setError('Could not load schools. Try again.');setEntries([]);setHasMore(false);setLoading(false);return}
   const merged=((result.data||[]) as PublicSchoolAddress[]).map(s=>({id:s.slug,name:s.school_name,county:s.county,subCounty:s.sub_county,level:s.school_level,ownership:s.ownership_type,href:schoolUrl(s.slug)}))
   setEntries(merged);setHasMore(merged.length===LIMIT);setLoading(false)
  },query?220:0)
  return ()=>{cancelled=true;clearTimeout(timer)}
 },[query,county,subCounty,level,retry])
 const shown=entries.slice(0,(page+1)*25)
 return <div className={styles.page}>
  <PublicHeader product="Schools"/>
  <main id="main-content" className={styles.directoryMain}>
   <h1 className={styles.directoryTitle}>Find a school</h1>
   <div className={styles.directorySearch}>
    <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></svg>
    <input disabled={!ready} aria-label="Search schools" type="search" autoComplete="off" placeholder="Search school name..." value={query} onChange={e=>{setQuery(e.target.value);setPage(0)}}/>
   </div>
   <div className={styles.directoryFilters} aria-label="Filter schools">
    <label><span>County</span><select value={county} onChange={e=>{setCounty(e.target.value);setSubCounty('');setPage(0)}}>
     <option value="">All counties</option>
     {options.filter(o=>o.option_kind==='county').map(o=><option key={o.option_value} value={o.option_value}>{o.option_value}</option>)}
    </select></label>
    <label><span>Sub-county</span><select value={subCounty} disabled={!county} onChange={e=>{setSubCounty(e.target.value);setPage(0)}}>
     <option value="">All sub-counties</option>
     {options.filter(o=>o.option_kind==='sub_county').map(o=><option key={o.option_value} value={o.option_value}>{o.option_value}</option>)}
    </select></label>
    <label><span>Level</span><select value={level} onChange={e=>{setLevel(e.target.value);setPage(0)}}>
     <option value="">All levels</option>
     {options.filter(o=>o.option_kind==='level').map(o=><option key={o.option_value} value={o.option_value}>{o.option_value}</option>)}
    </select></label>
   </div>
   <div className={styles.directoryHeading}><h2>{query||county||subCounty||level?'Schools':'All schools'}</h2></div>
   {error&&<div role="alert" className={styles.directoryStatus}>{error} <button onClick={()=>setRetry(v=>v+1)}>Retry</button></div>}
   {loading?<p role="status" className={styles.directoryStatus}>Loading schools…</p>:<>
    <div className={styles.directoryList}>{shown.map(s=>{
     const content=<><span className={styles.directoryIcon} aria-hidden="true"><svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 21V7l9-4 9 4v14M3 10h18M9 21v-7h6v7M7 13h1m8 0h1"/></svg></span><span className={styles.directoryInfo}><strong>{s.name}</strong><small>{[s.subCounty,s.county,s.level].filter(Boolean).join(' · ')}</small></span>{s.href&&<span className={styles.directoryArrow} aria-hidden="true">›</span>}</>
     return <Link className={styles.directoryItem} key={s.id} href={s.href!}>{content}</Link>
    })}</div>
    {!entries.length&&!error&&<p className={styles.directoryStatus}>No schools found.</p>}
    {shown.length<entries.length&&<button className={styles.directoryMore} onClick={()=>setPage(p=>p+1)}>Show more schools</button>}
    {hasMore&&<p className={styles.directoryStatus}>Refine your search or filters to find more schools.</p>}
   </>}
  </main>
  <PublicFooter/>
 </div>
}
