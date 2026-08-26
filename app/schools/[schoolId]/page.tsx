'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import { supabase } from '@/lib/supabase'
import styles from '../schools.module.css'

type ProfileRow = {
  school_id:string; school_name:string; county:string|null; sub_county:string|null; school_category:string|null;
  ownership_type:string|null; gender_type:string|null; accommodation_type:string|null; cluster:string|null; knec_code:string|null;
  pathway_slug:string|null; pathway_name:string|null; combination_slug:string|null; combination_name:string|null; verified_at:string|null;
  source_authority:string|null; source_name:string|null; source_url:string|null; source_reference:string|null; source_observed_at:string|null;
}

export default function SchoolProfilePage(){
  const params=useParams<{schoolId:string}>()
  const schoolId=params.schoolId
  const [rows,setRows]=useState<ProfileRow[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [showCorrection,setShowCorrection]=useState(false)
  const [notes,setNotes]=useState('')
  const [saving,setSaving]=useState(false)
  const [feedback,setFeedback]=useState('')

  useEffect(()=>{
    let cancelled=false
    void (async()=>{
      const {data,error}=await supabase.rpc('schools_get_public_profile_v1',{p_school_id:schoolId})
      if(cancelled)return
      if(error){setError('This school profile could not be loaded.');setRows([])} else setRows((data??[]) as ProfileRow[])
      setLoading(false)
    })()
    return()=>{cancelled=true}
  },[schoolId])

  async function submitCorrection(e:FormEvent){
    e.preventDefault();setFeedback('')
    if(notes.trim().length<10){setFeedback('Please describe the correction in a little more detail.');return}
    setSaving(true)
    const {data:{user}}=await supabase.auth.getUser()
    if(!user){setSaving(false);setFeedback('Sign in first so VibeSchool can retain and review your correction.');return}
    const {data,error}=await supabase.rpc('submit_school_correction_request',{p_school_id:schoolId,p_notes:notes.trim(),p_contact_name:null,p_contact_phone:null})
    setSaving(false)
    if(error){setFeedback('We could not save this correction right now. Please try again.');return}
    setFeedback(`Correction ${String(data).slice(0,8)} received for review. The public profile will not change until it is verified.`)
  }

  const school=rows[0]
  const offerings=rows.filter(r=>r.pathway_slug)

  return <div className={styles.page}>
    <PublicHeader product="Schools"/>
    <main id="main-content" className={styles.main}>
      <Link href="/schools" className={styles.back}>← School directory</Link>
      {loading&&<div className={styles.status}>Loading school profile…</div>}
      {error&&<div role="alert" className={`${styles.status} ${styles.error}`}>{error}</div>}
      {!loading&&!error&&!school&&<div className={styles.status}>This school is not available in the public directory.</div>}
      {school&&<>
        <section className={styles.profileHero}>
          <span className={styles.eyebrow}>CANONICAL SCHOOL PROFILE</span>
          <h1 className={styles.title}>{school.school_name}</h1>
          <p className={styles.lead}>{[school.sub_county,school.county].filter(Boolean).join(' · ')||'Location not yet verified'}</p>
          <div className={styles.chips}>{[school.school_category,school.ownership_type,school.gender_type,school.accommodation_type].filter(Boolean).map(v=><span className={styles.chip} key={v}>{v}</span>)}</div>
        </section>

        <section className={styles.facts}>
          <div className={styles.fact}><strong>County</strong><span>{school.county||'Not yet verified'}</span></div>
          <div className={styles.fact}><strong>Sub-county</strong><span>{school.sub_county||'Not yet verified'}</span></div>
          <div className={styles.fact}><strong>School code</strong><span>{school.knec_code||'Not shown / not verified'}</span></div>
          <div className={styles.fact}><strong>Level</strong><span>{school.school_category||'Not yet verified'}</span></div>
          <div className={styles.fact}><strong>Ownership</strong><span>{school.ownership_type||'Not yet verified'}</span></div>
          <div className={styles.fact}><strong>Boarding / day</strong><span>{school.accommodation_type||'Not yet verified'}</span></div>
        </section>

        <section className={styles.section}>
          <span className={styles.eyebrow}>PATHWAYS & OFFERINGS</span>
          <h2>Verified senior-school information</h2>
          {offerings.length===0?<div className={styles.notice}><strong>Not yet verified here.</strong> VibeSchool is not making a pathway or subject-combination claim for this school until current source-backed evidence is available.</div>:offerings.map((o,index)=><article className={styles.offering} key={`${o.pathway_slug}-${o.combination_slug??index}`}>
            <span className={styles.verified}>✓ Verified offering</span>
            <h3>{o.pathway_name}</h3>
            {o.combination_name&&<p>{o.combination_name}</p>}
            <p className={styles.source}>{[o.source_authority,o.source_name].filter(Boolean).join(' · ')}</p>
            {o.source_url&&<a href={o.source_url} target="_blank" rel="noreferrer noopener">View source ↗</a>}
          </article>)}
        </section>

        <section className={`${styles.panel} ${styles.section}`}>
          <span className={styles.eyebrow}>COMMUNITY ASSISTED, VERIFIED BEFORE PUBLISHING</span>
          <h2>Something missing or incorrect?</h2>
          <p className={styles.meta}>Send a correction. It enters a review queue and does not overwrite the canonical school record automatically.</p>
          {!showCorrection?<div className={styles.actions}><button className={styles.secondary} onClick={()=>{setShowCorrection(true);setFeedback('')}}>Suggest a correction</button></div>:<form onSubmit={submitCorrection}>
            <label className={styles.field}><span>What should VibeSchool check?</span><textarea className={styles.textarea} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="For example: the school is in Gilgil Sub-county, not Naivasha; please verify against…"/></label>
            {feedback&&<div className={`${styles.status} ${feedback.startsWith('Correction')?styles.success:styles.error}`}>{feedback}{feedback.startsWith('Sign in')&&<> <Link href="/login/global">Sign in</Link></>}</div>}
            <div className={styles.actions}><button className={styles.primary} disabled={saving}>{saving?'Sending…':'Send for review'}</button><button type="button" className={styles.secondary} onClick={()=>setShowCorrection(false)}>Cancel</button></div>
          </form>}
        </section>
      </>}
    </main>
    <PublicFooter/>
  </div>
}
