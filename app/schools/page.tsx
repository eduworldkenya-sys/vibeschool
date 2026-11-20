'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Search, School, SlidersHorizontal, X, MapPin } from 'lucide-react'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import { supabase } from '@/lib/supabase'
import styles from './schools.module.css'
import SchoolFollowButton from './components/SchoolFollowButton'
import { schoolUrl, type PublicSchoolAddress } from '@/lib/school-urls'
import { locationSuggestions, locationSearchCandidate, mergeSchoolMatches, type FilterOption } from '@/lib/school-discovery'

const LIMIT=100
type FollowStatus = 'loading'|'visitor'|'following'|'not-following'

export default function SchoolsDirectoryPage(){
 const [query,setQuery]=useState('')
 const [county,setCounty]=useState('')
 const [subCounty,setSubCounty]=useState('')
 const [level,setLevel]=useState('')
 const [options,setOptions]=useState<FilterOption[]>([])
 const [filtersOpen,setFiltersOpen]=useState(false)
 const [ready,setReady]=useState(false)
 const [entries,setEntries]=useState<PublicSchoolAddress[]>([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [optionsError,setOptionsError]=useState(false)
 const [hasMore,setHasMore]=useState(false)
 const [page,setPage]=useState(0)
 const [retry,setRetry]=useState(0)
 const [follow,setFollow]=useState<{rows:PublicSchoolAddress[];status:'visitor'|'ready'|'error';slugs:Set<string>}|null>(null)
 const suggestions=useMemo(()=>locationSuggestions(query,options,county),[query,options,county])
 const candidate=locationSearchCandidate(suggestions,query)
 const locationCounty=candidate?.option_kind==='county'?candidate.option_value:''
 const locationSub=!subCounty&&candidate?.option_kind==='sub_county'?candidate.option_value:''
 useEffect(()=>{setReady(true)},[])
 useEffect(()=>{
  let active=true
  void supabase.rpc('schools_public_filter_options_v1',{p_county:county||null}).then(({data,error})=>{
   if(active){setOptions(error?[]:((data||[]) as FilterOption[]));setOptionsError(!!error)}
  })
  return()=>{active=false}
 },[county,retry])
 useEffect(()=>{
  let cancelled=false
  setLoading(true);setError('');setPage(0)
  const timer=setTimeout(async()=>{
   try{
    const q=query.trim()
    const params={p_county:county||null,p_sub_county:subCounty||null,p_level:level||null,p_limit:LIMIT}
    const [names,locations]=await Promise.all([
     supabase.rpc('schools_search_urls_public_v2',{...params,p_query:q||null}),
     locationCounty||locationSub?supabase.rpc('schools_search_urls_public_v2',{...params,p_query:null,p_county:locationCounty||params.p_county,p_sub_county:locationSub||params.p_sub_county}):Promise.resolve(null)
    ])
    if(cancelled)return
    if(names.error||locations?.error)throw new Error('search failed')
    const merged=mergeSchoolMatches((names.data||[]) as PublicSchoolAddress[],(locations?.data||[]) as PublicSchoolAddress[],LIMIT)
    setEntries(merged);setHasMore(merged.length===LIMIT)
   }catch{
    if(!cancelled){setError('Could not load schools.');setEntries([]);setHasMore(false)}
   }finally{if(!cancelled)setLoading(false)}
  },query?220:0)
  return()=>{cancelled=true;clearTimeout(timer)}
 },[query,county,subCounty,level,retry,locationCounty,locationSub])
 // Batch follow status for the result set; avoid one authentication/read call per row.
 useEffect(()=>{
  let active=true
  if(!entries.length)return
  void (async()=>{
   try{
    const {data:{user},error:authError}=await supabase.auth.getUser()
    if(!active)return
    if(!user){
     setFollow({rows:entries,status:authError&&authError.name!=='AuthSessionMissingError'?'error':'visitor',slugs:new Set()});return
    }
    const {data,error}=await supabase.from('school_follows').select('school_slug').eq('follower_id',user.id).in('school_slug',entries.map(s=>s.slug))
    if(active)setFollow({rows:entries,status:error?'error':'ready',slugs:new Set((data||[]).map(s=>String(s.school_slug)))})
   }catch{if(active)setFollow({rows:entries,status:'error',slugs:new Set()})}
  })()
  return()=>{active=false}
 },[entries,retry])
 const shown=entries.slice(0,(page+1)*25)
 const activeFilters=Number(!!county)+Number(!!subCounty)+Number(!!level)
 const followStatus=(slug:string):FollowStatus=>follow?.rows!==entries?'loading':follow.status==='visitor'?'visitor':follow.slugs.has(slug)?'following':'not-following'
 function changeCounty(value:string){setCounty(value);setSubCounty('');setOptions(items=>items.filter(o=>o.option_kind==='county'||o.option_kind==='level'));setLevel('')}
 function chooseLocation(kind:FilterOption['option_kind'],value:string){
  if(kind==='county')changeCounty(value)
  else if(kind==='sub_county')setSubCounty(value)
  setQuery('')
 }
 return <div className={`${styles.page} ${styles.directoryPage}`}>
  <PublicHeader product="Schools"/>
  <main id="main-content" className={styles.directoryMain}>
   <div className={styles.directoryTop}><h1 className={styles.directoryTitle}>Discover schools</h1></div>
   <nav aria-label="Schools" className={styles.directoryTabs}><Link href="/schools" aria-current="page">Discover</Link><Link href="/schools/following">Following</Link></nav>
   <div className={styles.directorySearch}>
    <Search size={20} aria-hidden="true"/>
    <input disabled={!ready} aria-label="Search schools" type="search" autoComplete="off" placeholder="School or location" value={query} onChange={e=>setQuery(e.target.value)}/>
    {query&&<button type="button" className={styles.directoryClear} aria-label="Clear search" onClick={()=>setQuery('')}><X size={18}/></button>}
   </div>
   <div className={styles.directoryFilters}>
    <label><span className={styles.directorySr}>County</span><select aria-label="County" disabled={!ready} value={county} onChange={e=>changeCounty(e.target.value)}>
     <option value="">All counties</option>
     {options.filter(o=>o.option_kind==='county').map(o=><option key={o.option_value} value={o.option_value}>{o.option_value}</option>)}
    </select></label>
    <label><span className={styles.directorySr}>Level</span><select aria-label="Level" disabled={!ready} value={level} onChange={e=>setLevel(e.target.value)}>
     <option value="">All levels</option>
     {options.filter(o=>o.option_kind==='level').map(o=><option key={o.option_value} value={o.option_value}>{o.option_value}</option>)}
    </select></label>
    <button type="button" className={styles.directoryFilterButton} disabled={!ready} aria-expanded={filtersOpen} aria-controls="school-more-filters" onClick={()=>setFiltersOpen(v=>!v)}><SlidersHorizontal size={16} aria-hidden="true"/> Filters{activeFilters>0&&<span> ({activeFilters})</span>}</button>
   </div>
   {filtersOpen&&<div id="school-more-filters" className={styles.directoryExtra}>
    <label>Sub-county<select aria-label="Sub-county" value={subCounty} disabled={!county} onChange={e=>setSubCounty(e.target.value)}>
     <option value="">All sub-counties</option>
     {options.filter(o=>o.option_kind==='sub_county').map(o=><option key={o.option_value} value={o.option_value}>{o.option_value}</option>)}
    </select></label>
    {!county&&<small>Select a county first.</small>}
    <button type="button" onClick={()=>{changeCounty('');setQuery('')}}>Reset filters</button>
   </div>}
   {optionsError&&<p role="alert" className={styles.directoryStatus}>Filters unavailable. <button onClick={()=>setRetry(v=>v+1)}>Retry</button></p>}
   {suggestions.length>0&&<div className={styles.directorySuggestions} aria-label="Location suggestions">
    {suggestions.map(s=><button type="button" key={s.option_kind+s.option_value} onClick={()=>chooseLocation(s.option_kind,s.option_value)}><MapPin size={15} aria-hidden="true"/>{s.option_value}{s.option_kind==='county'?' County':''}</button>)}
   </div>}
   <div className={styles.directoryHeading}><h2>{query||activeFilters?'Results':'All schools'}</h2>{!loading&&!error&&<span>{hasMore?LIMIT+'+':entries.length}</span>}</div>
   {error&&<div role="alert" className={styles.directoryStatus}>{error} <button onClick={()=>setRetry(v=>v+1)}>Retry</button></div>}
   {loading?<p role="status" className={styles.directoryStatus}>Loading schools…</p>:<>
    {follow?.rows===entries&&follow.status==='error'&&<p role="alert" className={styles.directoryStatus}>Follow status unavailable. <button onClick={()=>setRetry(v=>v+1)}>Retry</button></p>}
    <div className={styles.directoryList}>{shown.map(s=><article className={styles.directoryItem} key={s.slug}>
      <Link className={styles.directorySchoolLink} href={schoolUrl(s.slug)}>
       <span className={styles.directoryIcon} aria-hidden="true"><School size={23}/></span>
       <span className={styles.directoryInfo}><strong>{s.school_name}</strong><small>{[s.sub_county,s.county,s.school_level,s.ownership_type].filter(Boolean).join(' · ')}</small></span>
      </Link>
      {!(follow?.rows===entries&&follow.status==='error')&&<div className={styles.directoryFollow}><SchoolFollowButton slug={s.slug} compact initialStatus={followStatus(s.slug)}/></div>}
     </article>)}</div>
    {!entries.length&&!error&&<p className={styles.directoryStatus}>No schools found. Try a different name or location.</p>}
    {shown.length<entries.length&&<button className={styles.directoryMore} onClick={()=>setPage(p=>p+1)}>Show more schools</button>}
    {hasMore&&<p className={styles.directoryStatus}>Refine your search to find more schools.</p>}
   </>}
  </main>
  <PublicFooter/>
 </div>
}
