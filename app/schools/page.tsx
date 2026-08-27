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
type DropdownOption={value:string;label:string}
type DropdownProps={id:string;label:string;value:string;placeholder:string;options:DropdownOption[];disabled?:boolean;openId:string|null;setOpenId:(id:string|null)=>void;onChange:(value:string)=>void}

const emptyMissing:MissingDraft={name:'',county:'',subCounty:'',ward:'',level:'',code:'',notes:''}
const schoolKey=(name:string,county:string|null,subCounty:string|null)=>`${name.trim().toLowerCase()}|${(county??'').trim().toLowerCase()}|${(subCounty??'').trim().toLowerCase()}`

function Dropdown({id,label,value,placeholder,options,disabled=false,openId,setOpenId,onChange}:DropdownProps){
  const isOpen=openId===id
  const selected=options.find(option=>option.value===value)
  return <div className={styles.field}>
    <span>{label}</span>
    <div className={`${styles.dropdown} ${disabled?styles.dropdownDisabled:''}`}>
      <button
        type="button"
        className={styles.dropdownButton}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={()=>setOpenId(isOpen?null:id)}
      >
        <span>{selected?.label||placeholder}</span><span aria-hidden="true" className={styles.chevron}>⌄</span>
      </button>
      {isOpen&&!disabled&&<div className={styles.dropdownMenu} role="listbox" aria-label={label}>
        <button type="button" role="option" aria-selected={value===''} className={styles.dropdownOption} onClick={()=>{onChange('');setOpenId(null)}}>{placeholder}</button>
        {options.filter(option=>option.value!=='').map(option=><button
          type="button"
          role="option"
          aria-selected={value===option.value}
          className={`${styles.dropdownOption} ${value===option.value?styles.dropdownOptionSelected:''}`}
          key={option.value}
          onClick={()=>{onChange(option.value);setOpenId(null)}}
        >{option.label}</button>)}
      </div>}
    </div>
  </div>
}

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
  const [openDropdown,setOpenDropdown]=useState<string|null>(null)

  async function load(){
    setLoading(true);setError('');setOpenDropdown(null)
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
  function openMissing(){setMissing({...emptyMissing,name:query,county,subCounty,ward,level});setFeedback('');setShowMissing(true);setOpenDropdown(null)}

  async function submitMissing(e:FormEvent){
    e.preventDefault();setFeedback('')
    if(missing.name.trim().length<3){setFeedback('Enter the school name as you know it.');return}
    setSaving(true)
    const {data:{user}}=await supabase.auth.getUser()
    if(!user){setSaving(false);setFeedback('Sign in first so VibeSchool can retain and reconcile your submission.');return}
    const {data,error}=await supabase.rpc('submit_school_discovery_request',{p_name:missing.name.trim(),p_county:missing.county||null,p_sub_county:missing.subCounty||null,p_ward:missing.ward||null,p_level:missing.level||null,p_school_code:missing.code.trim()||null,p_lat:null,p_lng:null,p_alternative_name:null,p_notes:missing.notes.trim()||null,p_contact_name:null,p_contact_phone:null})
    setSaving(false)
    if(error){setFeedback('We could not save this request. Please check the details and try again.');return}
    setFeedback(`Request ${String(data).slice(0,8)} received. VibeSchool will review it before adding or changing a verified school profile.`)
    await load()
  }

  const totalResults=rows.length+discoveryRows.length+pendingRows.length
  const countyOptions=counties.map(v=>({value:v,label:v}))
  const subCountyOptions=subCounties.map(v=>({value:v,label:v}))
  const wardOptions=wards.map(v=>({value:v,label:v}))
  const levelOptions=[{value:'PRIMARY',label:'Primary'},{value:'JUNIOR',label:'Junior School'},{value:'SENIOR_SECONDARY',label:'Senior School'}]

  return <div className={styles.page}>
    <PublicHeader product="Schools"/>
    <main id="main-content" className={styles.main}>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>VIBESCHOOL SCHOOL EXPLORER</span>
        <h1 className={styles.title}>Find a school and explore what it offers.</h1>
        <p className={styles.lead}>Search schools across Kenya by name and location. Verified profiles show information VibeSchool has checked; directory listings help you discover schools while details are still being confirmed.</p>
      </section>

      <section className={styles.panel} aria-label="Find a school">
        <form onSubmit={submit}>
          <div className={styles.searchGrid}>
            <label className={styles.field}><span>School name</span><input className={styles.input} value={query} onChange={e=>setQuery(e.target.value)} placeholder="e.g. Gilgil Township"/></label>
            <Dropdown id="county" label="County" value={county} placeholder="All counties" options={countyOptions} openId={openDropdown} setOpenId={setOpenDropdown} onChange={setCounty}/>
            <Dropdown id="subcounty" label="Sub-county" value={subCounty} placeholder={!county?'Choose county first':subCounties.length===0?'All sub-counties':'All sub-counties'} options={subCountyOptions} disabled={!county||subCounties.length===0} openId={openDropdown} setOpenId={setOpenDropdown} onChange={setSubCounty}/>
            <Dropdown id="ward" label="Ward" value={ward} placeholder={!subCounty?'Choose sub-county first':'All wards'} options={wardOptions} disabled={!subCounty||wards.length===0} openId={openDropdown} setOpenId={setOpenDropdown} onChange={setWard}/>
            <Dropdown id="level" label="Level" value={level} placeholder="Any level" options={levelOptions} openId={openDropdown} setOpenId={setOpenDropdown} onChange={setLevel}/>
          </div>
          <div className={styles.actions}><button className={styles.primary} disabled={loading}>{loading?'Searching…':'Search schools'}</button><button type="button" className={styles.secondary} onClick={openMissing}>Add a missing school</button></div>
        </form>
        <div className={styles.notice}><strong>About the results:</strong> A “Verified profile” has school details checked by VibeSchool. A “Directory listing” helps you find the school while some details are still being verified.</div>
      </section>

      <section className={styles.section} aria-label="What you can do with Schools">
        <div className={styles.resultsHeader}><div><span className={styles.eyebrow}>MORE THAN A LIST</span><h2>School information that helps you decide</h2></div></div>
        <div className={styles.cards}>
          <article className={styles.card}><div><h3 className={styles.schoolName}>Senior School pathways</h3><p className={styles.meta}>Explore STEM, Social Sciences and Arts & Sports Science pathways where school information has been confirmed.</p></div><Link className={styles.small} href="/pathways/schools">Explore school pathways →</Link></article>
          <article className={styles.card}><div><h3 className={styles.schoolName}>Clear, checked information</h3><p className={styles.meta}>If a pathway, code or school detail is missing, it simply means we have not confirmed that information yet.</p></div><Link className={styles.small} href="/pathways/check">Check a learner’s direction →</Link></article>
          <article className={styles.card}><div><h3 className={styles.schoolName}>Help improve the directory</h3><p className={styles.meta}>Can’t find a school or spotted something that needs updating? Send the information and VibeSchool will review it.</p></div><button type="button" className={styles.secondary} onClick={openMissing}>Contribute school information</button></article>
        </div>
      </section>

      {error&&<div role="alert" className={`${styles.status} ${styles.error}`}>{error}</div>}
      {!loading&&!error&&<>
        <div className={styles.resultsHeader}><div><span className={styles.eyebrow}>DIRECTORY RESULTS</span><h2>{totalResults} school{totalResults===1?'':'s'} found</h2></div><span className={styles.small}>Verified profiles, directory listings and submitted schools</span></div>

        {rows.length>0&&<section className={styles.section} aria-label="Verified school profiles"><div className={styles.resultsHeader}><div><h2>Verified school profiles</h2></div><span className={styles.small}>Checked by VibeSchool</span></div><div className={styles.cards}>{rows.map(s=><Link className={styles.card} href={`/schools/${s.school_id}`} key={s.school_id}><div><h3 className={styles.schoolName}>{s.school_name}</h3><p className={styles.meta}>{[s.ward,s.sub_county,s.county].filter(Boolean).join(' · ')||'Location not yet confirmed'}</p></div><div className={styles.chips}>{[s.school_category,s.ownership_type,s.gender_type,s.accommodation_type].filter(Boolean).map(v=><span className={styles.chip} key={v}>{v}</span>)}<span className={styles.chip}>Verified profile</span></div><span className={styles.small}>View school profile →</span></Link>)}</div></section>}

        {discoveryRows.length>0&&<section className={styles.section} aria-label="National school directory records"><div className={styles.resultsHeader}><div><h2>Directory matches</h2></div><span className={styles.small}>Some details still being checked</span></div><div className={styles.cards}>{discoveryRows.map(s=><article className={styles.card} key={s.directory_id}><div><h3 className={styles.schoolName}>{s.school_name}</h3><p className={styles.meta}>{[s.sub_county,s.county].filter(Boolean).join(' · ')||'Location not supplied'}</p></div><div className={styles.chips}>{[s.school_level,s.ownership_type,s.knec_code?`KNEC ${s.knec_code}`:null].filter(Boolean).map(v=><span className={styles.chip} key={v}>{v}</span>)}<span className={styles.chip}>Directory listing</span></div><span className={styles.small}>School details are still being verified</span></article>)}</div></section>}

        {pendingRows.length>0&&<section className={styles.section} aria-label="Community submitted schools"><div className={styles.resultsHeader}><div><h2>Recently submitted schools</h2></div><span className={styles.small}>Review pending</span></div><div className={styles.cards}>{pendingRows.map(s=><article className={styles.card} key={s.request_id}><div><h3 className={styles.schoolName}>{s.school_name}</h3><p className={styles.meta}>{[s.ward,s.sub_county,s.county].filter(Boolean).join(' · ')||'Approximate location not supplied'}</p></div><div className={styles.chips}>{s.school_level&&<span className={styles.chip}>{s.school_level}</span>}<span className={styles.chip}>Submitted</span></div><span className={styles.small}>Waiting for review</span></article>)}</div></section>}

        {searched&&totalResults===0&&<div className={`${styles.panel} ${styles.empty}`}><h2>Can’t find the school?</h2><p className={styles.meta}>Send us the school name and location you know. We will review it and add it to the directory when the information can be confirmed.</p><div className={styles.actions}><button className={styles.primary} onClick={openMissing}>Send missing school</button></div></div>}
      </>}

      {showMissing&&<section className={`${styles.panel} ${styles.section}`} aria-label="Add a missing school"><h2>Add a missing school</h2><p className={styles.meta}>Send the details you know. VibeSchool will review them before adding or changing a verified school profile.</p><form onSubmit={submitMissing}><div className={styles.searchGrid}>
        <label className={styles.field}><span>School name *</span><input className={styles.input} value={missing.name} onChange={e=>setMissing({...missing,name:e.target.value})}/></label>
        <Dropdown id="missing-county" label="County" value={missing.county} placeholder="Choose county" options={countyOptions} openId={openDropdown} setOpenId={setOpenDropdown} onChange={value=>setMissing({...missing,county:value})}/>
        <label className={styles.field}><span>Sub-county</span><input className={styles.input} value={missing.subCounty} onChange={e=>setMissing({...missing,subCounty:e.target.value})} placeholder="e.g. Gilgil"/></label>
        <label className={styles.field}><span>Ward</span><input className={styles.input} value={missing.ward} onChange={e=>setMissing({...missing,ward:e.target.value})} placeholder="Optional"/></label>
        <Dropdown id="missing-level" label="Level" value={missing.level} placeholder="Unknown" options={levelOptions} openId={openDropdown} setOpenId={setOpenDropdown} onChange={value=>setMissing({...missing,level:value})}/>
        <label className={styles.field}><span>KNEC / NEMIS / MoE code</span><input className={styles.input} value={missing.code} onChange={e=>setMissing({...missing,code:e.target.value})} placeholder="Optional — do not guess"/></label>
        <label className={styles.field}><span>Supporting detail</span><input className={styles.input} value={missing.notes} onChange={e=>setMissing({...missing,notes:e.target.value})} placeholder="Area, landmark, official source…"/></label>
      </div>{feedback&&<div className={`${styles.status} ${feedback.startsWith('Request')?styles.success:styles.error}`}>{feedback}{feedback.startsWith('Sign in')&&<> <Link href="/login/global">Sign in</Link></>}</div>}<div className={styles.actions}><button className={styles.primary} disabled={saving}>{saving?'Sending…':'Send for verification'}</button><button type="button" className={styles.secondary} onClick={()=>{setShowMissing(false);setOpenDropdown(null)}}>Cancel</button></div></form></section>}
    </main>
    <PublicFooter/>
  </div>
}