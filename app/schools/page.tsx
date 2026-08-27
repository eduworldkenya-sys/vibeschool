'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import { supabase } from '@/lib/supabase'
import styles from './schools.module.css'

type School={school_id:string;school_name:string;county:string|null;sub_county:string|null;ward:string|null;school_category:string|null;ownership_type:string|null;gender_type:string|null;accommodation_type:string|null;cluster:string|null;knec_code:string|null}
type PendingSchool={request_id:string;school_name:string;county:string|null;sub_county:string|null;ward:string|null;school_level:string|null;submitted_at:string}
type LocationOption={option_type:'county'|'sub_county'|'ward';value:string}
type MissingDraft={name:string;county:string;subCounty:string;ward:string;level:string;code:string;notes:string}

const KENYA_COUNTIES=['Baringo','Bomet','Bungoma','Busia','Elgeyo/Marakwet','Embu','Garissa','Homa Bay','Isiolo','Kajiado','Kakamega','Kericho','Kiambu','Kilifi','Kirinyaga','Kisii','Kisumu','Kitui','Kwale','Laikipia','Lamu','Machakos','Makueni','Mandera','Marsabit','Meru','Migori','Mombasa','Murang’a','Nairobi','Nakuru','Nandi','Narok','Nyamira','Nyandarua','Nyeri','Samburu','Siaya','Taita/Taveta','Tana River','Tharaka-Nithi','Trans Nzoia','Turkana','Uasin Gishu','Vihiga','Wajir','West Pokot'] as const
const emptyMissing:MissingDraft={name:'',county:'',subCounty:'',ward:'',level:'',code:'',notes:''}

async function fetchLocationOptions(county:string,subCounty:string){
  const {data,error}=await supabase.rpc('schools_location_options_public_v1',{p_county:county||null,p_sub_county:subCounty||null})
  if(error) return [] as LocationOption[]
  return (data??[]) as LocationOption[]
}

export default function SchoolsDirectoryPage(){
  const [query,setQuery]=useState('')
  const [county,setCounty]=useState('')
  const [subCounty,setSubCounty]=useState('')
  const [ward,setWard]=useState('')
  const [level,setLevel]=useState('')
  const [subCounties,setSubCounties]=useState<string[]>([])
  const [wards,setWards]=useState<string[]>([])
  const [missingSubCounties,setMissingSubCounties]=useState<string[]>([])
  const [missingWards,setMissingWards]=useState<string[]>([])
  const [missingOtherSubCounty,setMissingOtherSubCounty]=useState('')
  const [missingOtherWard,setMissingOtherWard]=useState('')
  const [rows,setRows]=useState<School[]>([])
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
    let canonicalResult=await supabase.rpc('schools_search_public_v2',{p_query:query.trim()||null,p_county:county||null,p_sub_county:subCounty||null,p_ward:ward||null,p_school_category:schoolCategory,p_ownership_type:null,p_gender_type:null,p_accommodation_type:null,p_limit:100})
    if(canonicalResult.error){
      canonicalResult=await supabase.rpc('schools_search_public_v1',{p_query:query.trim()||null,p_county:county||null,p_sub_county:subCounty||null,p_school_category:schoolCategory,p_ownership_type:null,p_gender_type:null,p_accommodation_type:null,p_limit:100})
    }
    let pendingResult=await supabase.rpc('schools_search_community_pending_v2',{p_query:query.trim()||null,p_county:county||null,p_sub_county:subCounty||null,p_ward:ward||null,p_level:level||null,p_limit:25})
    if(pendingResult.error){
      pendingResult=await supabase.rpc('schools_search_community_pending_v1',{p_query:query.trim()||null,p_county:county||null,p_sub_county:subCounty||null,p_level:level||null,p_limit:25})
    }
    if(canonicalResult.error){setRows([]);setPendingRows([]);setError('School information could not be loaded right now. Please retry.')}
    else {setRows((canonicalResult.data??[]) as School[]);setPendingRows(pendingResult.error?[]:(pendingResult.data??[]) as PendingSchool[])}
    setLoading(false);setSearched(true)
  }

  useEffect(()=>{void load()},[])
  useEffect(()=>{
    setSubCounty('');setWard('');setWards([])
    if(!county){setSubCounties([]);return}
    void fetchLocationOptions(county,'').then(options=>setSubCounties(options.filter(o=>o.option_type==='sub_county').map(o=>o.value)))
  },[county])
  useEffect(()=>{
    setWard('')
    if(!county||!subCounty){setWards([]);return}
    void fetchLocationOptions(county,subCounty).then(options=>setWards(options.filter(o=>o.option_type==='ward').map(o=>o.value)))
  },[county,subCounty])
  useEffect(()=>{
    setMissing(current=>({...current,subCounty:'',ward:''}));setMissingOtherSubCounty('');setMissingOtherWard('');setMissingWards([])
    if(!missing.county){setMissingSubCounties([]);return}
    void fetchLocationOptions(missing.county,'').then(options=>setMissingSubCounties(options.filter(o=>o.option_type==='sub_county').map(o=>o.value)))
  },[missing.county])
  useEffect(()=>{
    setMissing(current=>({...current,ward:''}));setMissingOtherWard('')
    if(!missing.county||!missing.subCounty||missing.subCounty==='__OTHER__'){setMissingWards([]);return}
    void fetchLocationOptions(missing.county,missing.subCounty).then(options=>setMissingWards(options.filter(o=>o.option_type==='ward').map(o=>o.value)))
  },[missing.county,missing.subCounty])

  function submit(e:FormEvent){e.preventDefault();void load()}
  function openMissing(){setMissing({...emptyMissing,name:query,county,subCounty,ward,level});setMissingOtherSubCounty('');setMissingOtherWard('');setFeedback('');setShowMissing(true)}
  async function submitMissing(e:FormEvent){
    e.preventDefault();setFeedback('')
    if(missing.name.trim().length<3){setFeedback('Enter the school name as you know it.');return}
    const finalSubCounty=missing.subCounty==='__OTHER__'?missingOtherSubCounty.trim():missing.subCounty
    const finalWard=missing.ward==='__OTHER__'?missingOtherWard.trim():missing.ward
    setSaving(true)
    const {data:{user}}=await supabase.auth.getUser()
    if(!user){setSaving(false);setFeedback('Sign in first so VibeSchool can retain and reconcile your submission.');return}
    const {data,error}=await supabase.rpc('submit_school_discovery_request',{p_name:missing.name.trim(),p_county:missing.county||null,p_sub_county:finalSubCounty||null,p_ward:finalWard||null,p_level:missing.level||null,p_school_code:missing.code.trim()||null,p_lat:null,p_lng:null,p_alternative_name:null,p_notes:missing.notes.trim()||null,p_contact_name:null,p_contact_phone:null})
    setSaving(false)
    if(error){setFeedback('We could not save this request. Please check the details and try again.');return}
    setFeedback(`Request ${String(data).slice(0,8)} received. It is now visible as community submitted while VibeSchool verifies the school.`);await load()
  }

  const totalResults=rows.length+pendingRows.length
  return <div className={styles.page}>
    <PublicHeader product="Schools"/>
    <main id="main-content" className={styles.main}>
      <section className={styles.hero}><span className={styles.eyebrow}>KENYA SCHOOL DIRECTORY</span><h1 className={styles.title}>Find a school. Understand what is known.</h1><p className={styles.lead}>Search by school name, county, sub-county and ward. Location choices narrow as you go, so users do not need to know the exact spelling.</p></section>
      <section className={styles.panel} aria-label="Find a school">
        <form onSubmit={submit}><div className={styles.searchGrid}>
          <label className={styles.field}><span>School name</span><input className={styles.input} value={query} onChange={e=>setQuery(e.target.value)} placeholder="e.g. Gilgil Township"/></label>
          <label className={styles.field}><span>County</span><select className={styles.select} value={county} onChange={e=>setCounty(e.target.value)}><option value="">All counties</option>{KENYA_COUNTIES.map(v=><option key={v} value={v}>{v}</option>)}</select></label>
          <label className={styles.field}><span>Sub-county</span><select className={styles.select} value={subCounty} disabled={!county||subCounties.length===0} onChange={e=>setSubCounty(e.target.value)}><option value="">{!county?'Choose county first':subCounties.length===0?'Not yet indexed':'All sub-counties'}</option>{subCounties.map(v=><option key={v} value={v}>{v}</option>)}</select></label>
          <label className={styles.field}><span>Ward</span><select className={styles.select} value={ward} disabled={!subCounty||wards.length===0} onChange={e=>setWard(e.target.value)}><option value="">{!subCounty?'Choose sub-county first':wards.length===0?'Not yet indexed':'All wards'}</option>{wards.map(v=><option key={v} value={v}>{v}</option>)}</select></label>
          <label className={styles.field}><span>Level</span><select className={styles.select} value={level} onChange={e=>setLevel(e.target.value)}><option value="">Any level</option><option value="PRIMARY">Primary</option><option value="JUNIOR">Junior School</option><option value="SENIOR_SECONDARY">Senior School</option></select></label>
        </div><div className={styles.actions}><button className={styles.primary} disabled={loading}>{loading?'Searching…':'Search schools'}</button><button type="button" className={styles.secondary} onClick={openMissing}>Add a missing school</button></div></form>
        <div className={styles.notice}><strong>Location guide:</strong> all 47 counties are always available. Sub-counties and wards load progressively from verified reference data.</div>
      </section>
      {error&&<div role="alert" className={`${styles.status} ${styles.error}`}>{error}</div>}
      {!loading&&!error&&<><div className={styles.resultsHeader}><div><span className={styles.eyebrow}>DIRECTORY RESULTS</span><h2>{totalResults} school{totalResults===1?'':'s'} found</h2></div><span className={styles.small}>Canonical + clearly labelled pending submissions</span></div><div className={styles.cards}>{rows.map(s=><Link className={styles.card} href={`/schools/${s.school_id}`} key={s.school_id}><div><h3 className={styles.schoolName}>{s.school_name}</h3><p className={styles.meta}>{[s.ward,s.sub_county,s.county].filter(Boolean).join(' · ')||'Location not yet verified'}</p></div><div className={styles.chips}>{[s.school_category,s.ownership_type,s.gender_type,s.accommodation_type].filter(Boolean).map(v=><span className={styles.chip} key={v}>{v}</span>)}</div><span className={styles.small}>View school profile →</span></Link>)}</div>
      {pendingRows.length>0&&<section className={styles.section}><div className={styles.resultsHeader}><div><span className={styles.eyebrow}>COMMUNITY SUBMITTED</span><h2>Verification pending</h2></div></div><div className={styles.cards}>{pendingRows.map(s=><article className={styles.card} key={s.request_id}><div><h3 className={styles.schoolName}>{s.school_name}</h3><p className={styles.meta}>{[s.ward,s.sub_county,s.county].filter(Boolean).join(' · ')||'Approximate location not supplied'}</p></div><span className={styles.small}>Verification pending · official claims withheld</span></article>)}</div></section>}
      {searched&&totalResults===0&&<div className={`${styles.panel} ${styles.empty}`}><h2>Can’t find the school?</h2><p className={styles.meta}>Send the name and location you know and VibeSchool will hold it for verification.</p><div className={styles.actions}><button className={styles.primary} onClick={openMissing}>Send missing school</button></div></div>}</>}
      {showMissing&&<section className={`${styles.panel} ${styles.section}`}><h2>Add a missing school</h2><form onSubmit={submitMissing}><div className={styles.searchGrid}>
        <label className={styles.field}><span>School name *</span><input className={styles.input} value={missing.name} onChange={e=>setMissing({...missing,name:e.target.value})}/></label>
        <label className={styles.field}><span>County</span><select className={styles.select} value={missing.county} onChange={e=>setMissing({...missing,county:e.target.value})}><option value="">Choose county</option>{KENYA_COUNTIES.map(v=><option key={v} value={v}>{v}</option>)}</select></label>
        <label className={styles.field}><span>Sub-county</span><select className={styles.select} value={missing.subCounty} disabled={!missing.county} onChange={e=>setMissing({...missing,subCounty:e.target.value})}><option value="">Choose sub-county</option>{missingSubCounties.map(v=><option key={v} value={v}>{v}</option>)}<option value="__OTHER__">Not listed — type it</option></select></label>
        {missing.subCounty==='__OTHER__'&&<label className={styles.field}><span>Sub-county name</span><input className={styles.input} value={missingOtherSubCounty} onChange={e=>setMissingOtherSubCounty(e.target.value)}/></label>}
        <label className={styles.field}><span>Ward</span><select className={styles.select} value={missing.ward} disabled={!missing.subCounty} onChange={e=>setMissing({...missing,ward:e.target.value})}><option value="">Choose ward</option>{missingWards.map(v=><option key={v} value={v}>{v}</option>)}<option value="__OTHER__">Not listed — type it</option></select></label>
        {missing.ward==='__OTHER__'&&<label className={styles.field}><span>Ward name</span><input className={styles.input} value={missingOtherWard} onChange={e=>setMissingOtherWard(e.target.value)}/></label>}
        <label className={styles.field}><span>Level</span><select className={styles.select} value={missing.level} onChange={e=>setMissing({...missing,level:e.target.value})}><option value="">Unknown</option><option value="PRIMARY">Primary</option><option value="JUNIOR">Junior School</option><option value="SENIOR_SECONDARY">Senior School</option></select></label>
        <label className={styles.field}><span>KNEC / NEMIS / MoE code</span><input className={styles.input} value={missing.code} onChange={e=>setMissing({...missing,code:e.target.value})}/></label>
        <label className={styles.field}><span>Supporting detail</span><input className={styles.input} value={missing.notes} onChange={e=>setMissing({...missing,notes:e.target.value})}/></label>
      </div>{feedback&&<div className={`${styles.status} ${feedback.startsWith('Request')?styles.success:styles.error}`}>{feedback}{feedback.startsWith('Sign in')&&<> <Link href="/login/global">Sign in</Link></>}</div>}<div className={styles.actions}><button className={styles.primary} disabled={saving}>{saving?'Sending…':'Send for verification'}</button><button type="button" className={styles.secondary} onClick={()=>setShowMissing(false)}>Cancel</button></div></form></section>}
    </main><PublicFooter/>
  </div>
}
