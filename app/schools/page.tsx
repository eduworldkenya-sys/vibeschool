'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import { supabase } from '@/lib/supabase'
import styles from './schools.module.css'

type School = {
  school_id:string
  school_name:string
  county:string|null
  sub_county:string|null
  school_category:string|null
  ownership_type:string|null
  gender_type:string|null
  accommodation_type:string|null
  cluster:string|null
  knec_code:string|null
}

type PendingSchool = {
  request_id:string
  school_name:string
  county:string|null
  sub_county:string|null
  school_level:string|null
  submitted_at:string
}

type MissingDraft = { name:string; county:string; subCounty:string; level:string; code:string; notes:string }

const emptyMissing:MissingDraft={name:'',county:'',subCounty:'',level:'',code:'',notes:''}

export default function SchoolsDirectoryPage(){
  const [query,setQuery]=useState('')
  const [county,setCounty]=useState('')
  const [subCounty,setSubCounty]=useState('')
  const [level,setLevel]=useState('')
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
    const [canonicalResult,pendingResult]=await Promise.all([
      supabase.rpc('schools_search_public_v1',{
        p_query:query.trim()||null,
        p_county:county.trim()||null,
        p_sub_county:subCounty.trim()||null,
        p_school_category:schoolCategory,
        p_ownership_type:null,
        p_gender_type:null,
        p_accommodation_type:null,
        p_limit:100,
      }),
      supabase.rpc('schools_search_community_pending_v1',{
        p_query:query.trim()||null,
        p_county:county.trim()||null,
        p_sub_county:subCounty.trim()||null,
        p_level:level||null,
        p_limit:25,
      }),
    ])
    if(canonicalResult.error){setRows([]);setPendingRows([]);setError('School information could not be loaded right now.')}
    else {
      setRows((canonicalResult.data??[]) as School[])
      setPendingRows(pendingResult.error?[]:(pendingResult.data??[]) as PendingSchool[])
    }
    setLoading(false);setSearched(true)
  }

  useEffect(()=>{void load()},[])
  function submit(e:FormEvent){e.preventDefault();void load()}
  function openMissing(){
    setMissing(current=>({...current,name:query||current.name,county:county||current.county,subCounty:subCounty||current.subCounty,level:level||current.level}))
    setFeedback('');setShowMissing(true)
  }

  async function submitMissing(e:FormEvent){
    e.preventDefault();setFeedback('')
    if(missing.name.trim().length<3){setFeedback('Enter the school name as you know it.');return}
    setSaving(true)
    const {data:{user}}=await supabase.auth.getUser()
    if(!user){setSaving(false);setFeedback('Sign in first so VibeSchool can retain and reconcile your submission.');return}
    const {data,error}=await supabase.rpc('submit_school_discovery_request',{
      p_name:missing.name.trim(),p_county:missing.county.trim()||null,p_sub_county:missing.subCounty.trim()||null,
      p_ward:null,p_level:missing.level||null,p_school_code:missing.code.trim()||null,p_lat:null,p_lng:null,
      p_alternative_name:null,p_notes:missing.notes.trim()||null,p_contact_name:null,p_contact_phone:null,
    })
    setSaving(false)
    if(error){setFeedback('We could not save this request. Please check the details and try again.');return}
    setFeedback(`Request ${String(data).slice(0,8)} received. It is now visible as community submitted while VibeSchool verifies the school.`)
    await load()
  }

  const totalResults=rows.length+pendingRows.length

  return <div className={styles.page}>
    <PublicHeader product="Schools"/>
    <main id="main-content" className={styles.main}>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>KENYA SCHOOL DIRECTORY</span>
        <h1 className={styles.title}>Find a school. Understand what is known.</h1>
        <p className={styles.lead}>Search VibeSchool’s canonical school records and clearly labelled community submissions. Public profiles separate verified information from information that has not yet been confirmed.</p>
      </section>

      <section className={styles.panel} aria-label="Find a school">
        <form onSubmit={submit}>
          <div className={styles.searchGrid}>
            <label className={styles.field}><span>School name</span><input className={styles.input} value={query} onChange={e=>setQuery(e.target.value)} placeholder="e.g. Gilgil Township"/></label>
            <label className={styles.field}><span>County</span><input className={styles.input} value={county} onChange={e=>setCounty(e.target.value)} placeholder="e.g. Nakuru"/></label>
            <label className={styles.field}><span>Sub-county</span><input className={styles.input} value={subCounty} onChange={e=>setSubCounty(e.target.value)} placeholder="e.g. Gilgil"/></label>
            <label className={styles.field}><span>Level</span><select className={styles.select} value={level} onChange={e=>setLevel(e.target.value)}><option value="">Any level</option><option value="PRIMARY">Primary</option><option value="JUNIOR">Junior School</option><option value="SENIOR_SECONDARY">Senior School</option></select></label>
          </div>
          <div className={styles.actions}><button className={styles.primary} disabled={loading}>{loading?'Searching…':'Search schools'}</button><button type="button" className={styles.secondary} onClick={openMissing}>Add a missing school</button></div>
        </form>
        <div className={styles.notice}><strong>Trust rule:</strong> community submissions can appear publicly as <em>verification pending</em>, but they cannot claim verified school codes, contacts, pathways or other official facts until reconciled.</div>
      </section>

      {error&&<div role="alert" className={`${styles.status} ${styles.error}`}>{error}</div>}
      {!loading&&!error&&<>
        <div className={styles.resultsHeader}><div><span className={styles.eyebrow}>DIRECTORY RESULTS</span><h2>{totalResults} school{totalResults===1?'':'s'} found</h2></div><span className={styles.small}>Canonical + clearly labelled pending submissions</span></div>
        <div className={styles.cards}>{rows.map(s=><Link className={styles.card} href={`/schools/${s.school_id}`} key={s.school_id}>
          <div><h3 className={styles.schoolName}>{s.school_name}</h3><p className={styles.meta}>{[s.sub_county,s.county].filter(Boolean).join(' · ')||'Location not yet verified'}</p></div>
          <div className={styles.chips}>{[s.school_category,s.ownership_type,s.gender_type,s.accommodation_type].filter(Boolean).map(v=><span className={styles.chip} key={v}>{v}</span>)}</div>
          <span className={styles.small}>View school profile →</span>
        </Link>)}</div>

        {pendingRows.length>0&&<section className={styles.section} aria-label="Community submitted schools"><div className={styles.resultsHeader}><div><span className={styles.eyebrow}>COMMUNITY SUBMITTED</span><h2>Verification pending</h2></div><span className={styles.small}>Not yet canonical</span></div><div className={styles.cards}>{pendingRows.map(s=><article className={styles.card} key={s.request_id}>
          <div><h3 className={styles.schoolName}>{s.school_name}</h3><p className={styles.meta}>{[s.sub_county,s.county].filter(Boolean).join(' · ')||'Approximate location not supplied'}</p></div>
          <div className={styles.chips}>{s.school_level&&<span className={styles.chip}>{s.school_level}</span>}<span className={styles.chip}>Community submitted</span></div>
          <span className={styles.small}>Verification pending · official claims withheld</span>
        </article>)}</div></section>}

        {searched&&totalResults===0&&<div className={`${styles.panel} ${styles.empty}`}><h2>Can’t find the school?</h2><p className={styles.meta}>Send the name and location you know. VibeSchool will publish it only as a clearly labelled pending submission while identity and stronger evidence are checked.</p><div className={styles.actions}><button className={styles.primary} onClick={openMissing}>Send missing school</button></div></div>}
      </>}

      {showMissing&&<section className={`${styles.panel} ${styles.section}`} aria-label="Add a missing school">
        <h2>Add a missing school</h2><p className={styles.meta}>You do not need every detail. School name plus approximate location is enough to start reconciliation.</p>
        <form onSubmit={submitMissing}>
          <div className={styles.searchGrid}>
            <label className={styles.field}><span>School name *</span><input className={styles.input} value={missing.name} onChange={e=>setMissing({...missing,name:e.target.value})}/></label>
            <label className={styles.field}><span>County</span><input className={styles.input} value={missing.county} onChange={e=>setMissing({...missing,county:e.target.value})}/></label>
            <label className={styles.field}><span>Sub-county</span><input className={styles.input} value={missing.subCounty} onChange={e=>setMissing({...missing,subCounty:e.target.value})}/></label>
            <label className={styles.field}><span>Level</span><select className={styles.select} value={missing.level} onChange={e=>setMissing({...missing,level:e.target.value})}><option value="">Unknown</option><option value="PRIMARY">Primary</option><option value="JUNIOR">Junior School</option><option value="SENIOR_SECONDARY">Senior School</option></select></label>
            <label className={styles.field}><span>KNEC / NEMIS / MoE code</span><input className={styles.input} value={missing.code} onChange={e=>setMissing({...missing,code:e.target.value})} placeholder="Optional — do not guess"/></label>
            <label className={styles.field}><span>Supporting detail</span><input className={styles.input} value={missing.notes} onChange={e=>setMissing({...missing,notes:e.target.value})} placeholder="Area, landmark, official source…"/></label>
          </div>
          {feedback&&<div className={`${styles.status} ${feedback.startsWith('Request')?styles.success:styles.error}`}>{feedback}{feedback.startsWith('Sign in')&&<> <Link href="/login/global">Sign in</Link></>}</div>}
          <div className={styles.actions}><button className={styles.primary} disabled={saving}>{saving?'Sending…':'Send for verification'}</button><button type="button" className={styles.secondary} onClick={()=>setShowMissing(false)}>Cancel</button></div>
        </form>
      </section>}
    </main>
    <PublicFooter/>
  </div>
}
