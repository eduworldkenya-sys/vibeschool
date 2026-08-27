'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import { supabase } from '@/lib/supabase'
import styles from './schools.module.css'

type School={school_id:string;school_name:string;county:string|null;sub_county:string|null;ward:string|null;school_category:string|null;ownership_type:string|null;gender_type:string|null;accommodation_type:string|null;cluster:string|null;knec_code:string|null}
type DiscoverySchool={directory_id:string;school_name:string;county:string|null;sub_county:string|null;school_level:string|null;ownership_type:string|null;knec_code:string|null;latitude:number|null;longitude:number|null;is_verified:boolean}
type PendingSchool={request_id:string;school_name:string;county:string|null;sub_county:string|null;ward:string|null;school_level:string|null;submitted_at:string}
type LocationOption={option_type:'county'|'sub_county'|'ward';value:string}
type MissingDraft={name:string;county:string;subCounty:string;ward:string;level:string;code:string;notes:string}

const emptyMissing:MissingDraft={name:'',county:'',subCounty:'',ward:'',level:'',code:'',notes:''}
const schoolKey=(name:string,county:string|null,subCounty:string|null)=>`${name.trim().toLowerCase()}|${(county??'').trim().toLowerCase()}|${(subCounty??'').trim().toLowerCase()}`

async function fetchLocationOptions(county:string,subCounty:string){
  const {data,error}=await supabase.rpc('schools_location_options_public_v1',{p_county:county||null,p_sub_county:subCounty||null})
  if(error)return [] as LocationOption[]
  return (data??[]) as LocationOption[]
}

export default function SchoolsDirectoryPage(){
  const [query,setQuery]=useState('')
  const [county,setCounty]=useState('')
  const [subCounty,setSubCounty]=useState('')
  const [ward,setWard]=useState('')
  const [level,setLevel]=useState('')
  const [counties,setCounties]=useState<string[]>([])
  const [subCounties,setSubCounties]=useState<string[]>([])
  const [wards,setWards]=useState<string[]>([])
  const [rows,setRows]=useState<School[]>([])
  const [discoveryRows,setDiscoveryRows]=useState<DiscoverySchool[]>([])
  const [pendingRows,setPendingRows]=useState<PendingSchool[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [searched,setSearched]=useState(false)
  const [showMissing,setShowMissing]=useState(false)
  const [missing,setMissing]=useState<MissingDraft>(emptyMissing)
  const [saving,setSaving]=useState(false)
  const [feedback,setFeedback]=useState('')

  async function load(){
    setLoading(true);setError('')
    const schoolCategory=level?level.toLowerCase():null
    const [canonicalResult,discoveryResult,pendingResult]=await Promise.all([
      supabase.rpc('schools_search_public_v2',{p_query:query.trim()||null,p_county:county||null,p_sub_county:subCounty||null,p_ward:ward||null,p_school_category:schoolCategory,p_ownership_type:null,p_gender_type:null,p_accommodation_type:null,p_limit:100}),
      supabase.rpc('schools_directory_search_public_v1',{p_query:query.trim()||null,p_county:county||null,p_sub_county:subCounty||null,p_level:level||null,p_limit:100}),
      supabase.rpc('schools_search_community_pending_v2',{p_query:query.trim()||null,p_county:county||null,p_sub_county:subCounty||null,p_ward:ward||null,p_level:level||null,p_limit:25}),
    ])
    const canonical=(canonicalResult.data??[]) as School[]
    const canonicalKeys=new Set(canonical.map(s=>schoolKey(s.school_name,s.county,s.sub_county)))
    setRows(canonical)
    setDiscoveryRows(discoveryResult.error?[]:((discoveryResult.data??[]) as DiscoverySchool[]).filter(s=>!canonicalKeys.has(schoolKey(s.school_name,s.county,s.sub_county))))
    setPendingRows(pendingResult.error?[]:(pendingResult.data??[]) as PendingSchool[])
    if(canonicalResult.error&&discoveryResult.error)setError('School information could not be loaded right now.')
    setLoading(false);setSearched(true)
  }

  useEffect(()=>{void fetchLocationOptions('','').then(o=>setCounties(o.filter(v=>v.option_type==='county').map(v=>v.value)));void load()},[])
  useEffect(()=>{setSubCounty('');setWard('');setWards([]);if(!county){setSubCounties([]);return}void fetchLocationOptions(county,'').then(o=>setSubCounties(o.filter(v=>v.option_type==='sub_county').map(v=>v.value)))},[county])
  useEffect(()=>{setWard('');if(!county||!subCounty){setWards([]);return}void fetchLocationOptions(county,subCounty).then(o=>setWards(o.filter(v=>v.option_type==='ward').map(v=>v.value)))},[county,subCounty])

  function submit(e:FormEvent){e.preventDefault();void load()}
  function openMissing(){setMissing({...emptyMissing,name:query,county,subCounty,ward,level});setFeedback('');setShowMissing(true)}

  async function submitMissing(e:FormEvent){
    e.preventDefault();setFeedback('')
    if(missing.name.trim().length<3){setFeedback('Enter the school name as you know it.');return}
    setSaving(true)
    const {data:{user}}=await supabase.auth.getUser()
    if(!user){setSaving(false);setFeedback('Sign in first so VibeSchool can retain and reconcile your submission.');return}
    const {data,error}=await supabase.rpc('submit_school_discovery_request',{p_name:missing.name.trim(),p_county:missing.county||null,p_sub_county:missing.subCounty||null,p_ward:missing.ward||null,p_level:missing.level||null,p_school_code:missing.code.trim()||null,p_lat:null,p_lng:null,p_alternative_name:null,p_notes:missing.notes.trim()||null,p_contact_name:null,p_contact_phone:null})
    setSaving(false)
    if(error){setFeedback('We could not save this request. Please check the details and try again.');return}
    setFeedback(`Request ${String(data).slice(0,8)} received. VibeSchool will reconcile it before any canonical school is created.`)
    await load()
  }

  const totalResults=rows.length+discoveryRows.length+pendingRows.length

  return <div className={styles.page}>
    <PublicHeader product="Schools"/>
    <main id="main-content" className={styles.main}>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>VIBESCHOOL SCHOOL EXPLORER</span>
        <h1 className={styles.title}>Find a school. See what is known, what is verified, and what comes next.</h1>
        <p className={styles.lead}>Search Kenya’s national school discovery directory, then open richer VibeSchool profiles where identity and school claims have been verified. Discovery records stay useful without being presented as official proof.</p>
      </section>

      <section className={styles.panel} aria-label="Find a school">
        <form onSubmit={submit}>
          <div className={styles.searchGrid}>
            <label className={styles.field}><span>School name</span><input className={styles.input} value={query} onChange={e=>setQuery(e.target.value)} placeholder="e.g. Gilgil Township"/></label>
            <label className={styles.field}><span>County</span><select className={styles.select} value={county} onChange={e=>setCounty(e.target.value)}><option value="">All counties</option>{counties.map(v=><option key={v} value={v}>{v}</option>)}</select></label>
            <label className={styles.field}><span>Sub-county</span><select className={styles.select} value={subCounty} disabled={!county||subCounties.length===0} onChange={e=>setSubCounty(e.target.value)}><option value="">{!county?'Choose county first':subCounties.length===0?'All / not yet indexed':'All sub-counties'}</option>{subCounties.map(v=><option key={v} value={v}>{v}</option>)}</select></label>
            <label className={styles.field}><span>Ward</span><select className={styles.select} value={ward} disabled={!subCounty||wards.length===0} onChange={e=>setWard(e.target.value)}><option value="">{!subCounty?'Choose sub-county first':wards.length===0?'All / not yet indexed':'All wards'}</option>{wards.map(v=><option key={v} value={v}>{v}</option>)}</select></label>
            <label className={styles.field}><span>Level</span><select className={styles.select} value={level} onChange={e=>setLevel(e.target.value)}><option value="">Any level</option><option value="PRIMARY">Primary</option><option value="JUNIOR">Junior School</option><option value="SENIOR_SECONDARY">Senior School</option></select></label>
          </div>
          <div className={styles.actions}><button className={styles.primary} disabled={loading}>{loading?'Searching…':'Search schools'}</button><button type="button" className={styles.secondary} onClick={openMissing}>Add a missing school</button></div>
        </form>
        <div className={styles.notice}><strong>How to read results:</strong> “VibeSchool verified profile” means the school has passed the canonical identity layer. “Directory record” means VibeSchool can help you discover the school, but stronger claims are withheld until verification.</div>
      </section>

      <section className={styles.section} aria-label="What you can do with Schools">
        <div className={styles.resultsHeader}><div><span className={styles.eyebrow}>MORE THAN A LIST</span><h2>School information that helps you decide</h2></div></div>
        <div className={styles.cards}>
          <article className={styles.card}><div><h3 className={styles.schoolName}>Senior School pathways</h3><p className={styles.meta}>Explore STEM, Social Sciences and Arts & Sports Science offerings only where VibeSchool has source-backed evidence.</p></div><Link className={styles.small} href="/pathways/schools">Explore verified pathways →</Link></article>
          <article className={styles.card}><div><h3 className={styles.schoolName}>Evidence, not guesses</h3><p className={styles.meta}>A missing pathway, code or school attribute means “not yet verified here” — not “No”. Profiles preserve source and verification boundaries.</p></div><Link className={styles.small} href="/pathways/check">Check a learner’s direction →</Link></article>
          <article className={styles.card}><div><h3 className={styles.schoolName}>Help improve the directory</h3><p className={styles.meta}>Report a missing school or correction. Community input enters review and cannot overwrite canonical school information automatically.</p></div><button type="button" className={styles.secondary} onClick={openMissing}>Contribute school information</button></article>
        </div>
      </section>

      {error&&<div role="alert" className={`${styles.status} ${styles.error}`}>{error}</div>}
      {!loading&&!error&&<>
        <div className={styles.resultsHeader}><div><span className={styles.eyebrow}>DIRECTORY RESULTS</span><h2>{totalResults} school{totalResults===1?'':'s'} found</h2></div><span className={styles.small}>Verified profiles + discovery records + pending contributions</span></div>

        {rows.length>0&&<section className={styles.section} aria-label="Verified school profiles"><div className={styles.resultsHeader}><div><h2>VibeSchool verified profiles</h2></div><span className={styles.small}>Canonical identity</span></div><div className={styles.cards}>{rows.map(s=><Link className={styles.card} href={`/schools/${s.school_id}`} key={s.school_id}><div><h3 className={styles.schoolName}>{s.school_name}</h3><p className={styles.meta}>{[s.ward,s.sub_county,s.county].filter(Boolean).join(' · ')||'Location not yet verified'}</p></div><div className={styles.chips}>{[s.school_category,s.ownership_type,s.gender_type,s.accommodation_type].filter(Boolean).map(v=><span className={styles.chip} key={v}>{v}</span>)}<span className={styles.chip}>Verified profile</span></div><span className={styles.small}>View school profile →</span></Link>)}</div></section>}

        {discoveryRows.length>0&&<section className={styles.section} aria-label="National school directory records"><div className={styles.resultsHeader}><div><h2>National directory matches</h2></div><span className={styles.small}>Discovery evidence · not yet canonical</span></div><div className={styles.cards}>{discoveryRows.map(s=><article className={styles.card} key={s.directory_id}><div><h3 className={styles.schoolName}>{s.school_name}</h3><p className={styles.meta}>{[s.sub_county,s.county].filter(Boolean).join(' · ')||'Location not supplied'}</p></div><div className={styles.chips}>{[s.school_level,s.ownership_type,s.knec_code?`KNEC ${s.knec_code}`:null].filter(Boolean).map(v=><span className={styles.chip} key={v}>{v}</span>)}<span className={styles.chip}>Directory record</span></div><span className={styles.small}>Identity/profile verification still in progress</span></article>)}</div></section>}

        {pendingRows.length>0&&<section className={styles.section} aria-label="Community submitted schools"><div className={styles.resultsHeader}><div><h2>Community submitted</h2></div><span className={styles.small}>Verification pending</span></div><div className={styles.cards}>{pendingRows.map(s=><article className={styles.card} key={s.request_id}><div><h3 className={styles.schoolName}>{s.school_name}</h3><p className={styles.meta}>{[s.ward,s.sub_county,s.county].filter(Boolean).join(' · ')||'Approximate location not supplied'}</p></div><div className={styles.chips}>{s.school_level&&<span className={styles.chip}>{s.school_level}</span>}<span className={styles.chip}>Community submitted</span></div><span className={styles.small}>Official claims withheld until reviewed</span></article>)}</div></section>}

        {searched&&totalResults===0&&<div className={`${styles.panel} ${styles.empty}`}><h2>Can’t find the school?</h2><p className={styles.meta}>Send the name and location you know. VibeSchool will reconcile it against the national directory, aliases, identifiers and stronger evidence before creating a canonical profile.</p><div className={styles.actions}><button className={styles.primary} onClick={openMissing}>Send missing school</button></div></div>}
      </>}

      {showMissing&&<section className={`${styles.panel} ${styles.section}`} aria-label="Add a missing school"><h2>Add a missing school</h2><p className={styles.meta}>This creates a discovery request only. It cannot overwrite or automatically create a verified school profile.</p><form onSubmit={submitMissing}><div className={styles.searchGrid}>
        <label className={styles.field}><span>School name *</span><input className={styles.input} value={missing.name} onChange={e=>setMissing({...missing,name:e.target.value})}/></label>
        <label className={styles.field}><span>County</span><select className={styles.select} value={missing.county} onChange={e=>setMissing({...missing,county:e.target.value})}><option value="">Choose county</option>{counties.map(v=><option key={v} value={v}>{v}</option>)}</select></label>
        <label className={styles.field}><span>Sub-county</span><input className={styles.input} value={missing.subCounty} onChange={e=>setMissing({...missing,subCounty:e.target.value})} placeholder="e.g. Gilgil"/></label>
        <label className={styles.field}><span>Ward</span><input className={styles.input} value={missing.ward} onChange={e=>setMissing({...missing,ward:e.target.value})} placeholder="Optional"/></label>
        <label className={styles.field}><span>Level</span><select className={styles.select} value={missing.level} onChange={e=>setMissing({...missing,level:e.target.value})}><option value="">Unknown</option><option value="PRIMARY">Primary</option><option value="JUNIOR">Junior School</option><option value="SENIOR_SECONDARY">Senior School</option></select></label>
        <label className={styles.field}><span>KNEC / NEMIS / MoE code</span><input className={styles.input} value={missing.code} onChange={e=>setMissing({...missing,code:e.target.value})} placeholder="Optional — do not guess"/></label>
        <label className={styles.field}><span>Supporting detail</span><input className={styles.input} value={missing.notes} onChange={e=>setMissing({...missing,notes:e.target.value})} placeholder="Area, landmark, official source…"/></label>
      </div>{feedback&&<div className={`${styles.status} ${feedback.startsWith('Request')?styles.success:styles.error}`}>{feedback}{feedback.startsWith('Sign in')&&<> <Link href="/login/global">Sign in</Link></>}</div>}<div className={styles.actions}><button className={styles.primary} disabled={saving}>{saving?'Sending…':'Send for verification'}</button><button type="button" className={styles.secondary} onClick={()=>setShowMissing(false)}>Cancel</button></div></form></section>}
    </main>
    <PublicFooter/>
  </div>
}
