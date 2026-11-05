'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import { supabase } from '@/lib/supabase'
import styles from '../schools.module.css'

type ProfileRow={school_id:string;school_name:string;county:string|null;sub_county:string|null;school_category:string|null;ownership_type:string|null;gender_type:string|null;accommodation_type:string|null;cluster:string|null;knec_code:string|null;pathway_slug:string|null;pathway_name:string|null;combination_slug:string|null;combination_name:string|null;verified_at:string|null;source_authority:string|null;source_name:string|null;source_url:string|null;source_reference:string|null;source_observed_at:string|null}
type TrustRow={school_id:string;verified_claim_count:number;profile_completeness:number;trust_state:'canonical_identity'|'verified_claims';last_verified_at:string|null}

export default function SchoolProfilePage(){
 const params=useParams<{schoolId:string}>();const schoolId=params.schoolId
 const [rows,setRows]=useState<ProfileRow[]>([]);const [trust,setTrust]=useState<TrustRow|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState('')
 const [showCorrection,setShowCorrection]=useState(false);const [notes,setNotes]=useState('');const [showClaim,setShowClaim]=useState(false);const [claimRole,setClaimRole]=useState('');const [claimEvidence,setClaimEvidence]=useState('');const [claimPhone,setClaimPhone]=useState('');const [saving,setSaving]=useState(false);const [feedback,setFeedback]=useState('')
 useEffect(()=>{let cancelled=false;void(async()=>{const [profileResult,trustResult]=await Promise.all([supabase.rpc('schools_get_public_profile_v1',{p_school_id:schoolId}),supabase.rpc('schools_profile_trust_public_v1',{p_school_id:schoolId})]);if(cancelled)return;if(profileResult.error){setError('This school profile could not be loaded.');setRows([])}else setRows((profileResult.data??[]) as ProfileRow[]);if(!trustResult.error)setTrust(((trustResult.data??[])[0]??null) as TrustRow|null);setLoading(false)})();return()=>{cancelled=true}},[schoolId])
 async function requireUser(){const {data:{user}}=await supabase.auth.getUser();return user}
 async function submitCorrection(e:FormEvent){e.preventDefault();setFeedback('');if(notes.trim().length<10){setFeedback('Please describe the correction in a little more detail.');return}setSaving(true);const user=await requireUser();if(!user){setSaving(false);setFeedback('Sign in first so VibeSchool can retain and review your correction.');return}const {data,error}=await supabase.rpc('submit_school_correction_request',{p_school_id:schoolId,p_notes:notes.trim(),p_contact_name:null,p_contact_phone:null});setSaving(false);setFeedback(error?'We could not save this correction right now. Please try again.':`Correction ${String(data).slice(0,8)} received for review. The public profile will not change until it is verified.`)}
 async function submitClaim(e:FormEvent){e.preventDefault();setFeedback('');if(claimRole.trim().length<2){setFeedback('Tell us your role at the school.');return}setSaving(true);const user=await requireUser();if(!user){setSaving(false);setFeedback('Sign in first so VibeSchool can verify who is requesting management access.');return}const {data,error}=await supabase.rpc('submit_school_profile_claim_v1',{p_school_id:schoolId,p_role_at_school:claimRole.trim(),p_evidence_note:claimEvidence.trim()||null,p_contact_phone:claimPhone.trim()||null});setSaving(false);setFeedback(error?'We could not submit this claim. It may already be awaiting review.':`Claim ${String(data).slice(0,8)} received. Nothing on the public profile changes until VibeSchool verifies your authority.`)}
 const school=rows[0];const offerings=rows.filter(r=>r.pathway_slug)
 // A historically sourced, approximate map point for this canonical school identity only.
 // Never label this coordinate as a verified school entrance or use it to assert present-day location accuracy.
 const approximateLocation=schoolId==='c51ec2ae-5b70-4f69-887d-54eb9f312db7'
  ? {latitude:-0.501556,longitude:36.323889,source:'https://data.afro.co.ke/schools/gilgil-township-pri-sch/'}
  : null
 const completeness=trust?.profile_completeness??0
 return <div className={styles.page}><PublicHeader product="Schools"/><main id="main-content" className={styles.main}><Link href="/schools" className={styles.back}>← School directory</Link>
 {loading&&<div className={styles.status}>Loading school profile…</div>}{error&&<div role="alert" className={`${styles.status} ${styles.error}`}>{error}</div>}{!loading&&!error&&!school&&<div className={styles.status}>This school is not available in the public directory.</div>}
 {school&&<>
 <section className={styles.siteCover} aria-label="School website">
   <div className={styles.siteCoverTop}><span>School website on VibeSchool</span><span className={styles.siteUnclaimed}>Public school profile</span></div>
   <div className={styles.siteEmblem} aria-hidden="true">S</div>
   <h1 className={styles.siteTitle}>{school.school_name}</h1>
   <p className={styles.siteLocation}>{[school.sub_county,school.county].filter(Boolean).join(' · ')||'Location not yet confirmed'}</p>
   <p className={styles.siteIntro}>Discover this school, its available information and learning programmes.</p>
   <div className={styles.siteQuickLinks}><a href="#about-school">About</a><a href="#school-programmes">Academics</a><a href="#school-contact">Contact</a></div>
 </section>
 <div className={styles.siteContent}>
 <section id="about-school" className={styles.siteSection}>
   <div className={styles.siteSectionHeading}><span className={styles.eyebrow}>ABOUT THE SCHOOL</span><h2>Welcome to {school.school_name}</h2></div>
   <p className={styles.siteBody}>This is a public school profile provided by VibeSchool. The school has not yet published its own welcome message or website content here.</p>
   <div className={styles.siteFacts}>
     {([['Education level',school.school_category],['County',school.county],['Sub-county',school.sub_county],['School type',school.ownership_type],['Day or boarding',school.accommodation_type]] as [string,string|null][]).filter(([,value])=>Boolean(value)).map(([label,value])=><div className={styles.siteFact} key={label}><span>{label}</span><strong>{value}</strong></div>)}
   </div>
 </section>
 <section id="school-programmes" className={styles.siteSection}>
   <div className={styles.siteSectionHeading}><span className={styles.eyebrow}>ACADEMICS</span><h2>Learning and programmes</h2></div>
   {offerings.length===0?<p className={styles.siteBody}>No programmes have been independently confirmed for publication here yet. This does not mean the school does not offer them.</p>:<div className={styles.siteOfferings}>{offerings.map((o,index)=><article className={styles.offering} key={`${o.pathway_slug}-${o.combination_slug??index}`}><span className={styles.verified}>Verified offering</span><h3>{o.pathway_name}</h3>{o.combination_name&&<p>{o.combination_name}</p>}{o.source_url&&<a href={o.source_url} target="_blank" rel="noreferrer noopener">View source</a>}</article>)}</div>}
 </section>
 <section id="school-contact" className={styles.siteSection}>
   <div className={styles.siteSectionHeading}><span className={styles.eyebrow}>CONTACT & LOCATION</span><h2>Find the school</h2></div>
   <p className={styles.siteBody}>{[school.sub_county,school.county,'Kenya'].filter(Boolean).join(', ')}. Official contact details have not been published on this page.</p>
   {approximateLocation&&<div className={styles.siteMap}>
     <p className={styles.siteMapLabel}>Approximate location · historical school record</p>
     <iframe
       title={`Approximate map location of ${school.school_name}`}
       src="https://www.openstreetmap.org/export/embed.html?bbox=36.310000%2C-0.511000%2C36.338000%2C-0.492000&layer=mapnik&marker=-0.501556%2C36.323889"
       loading="lazy"
       referrerPolicy="no-referrer"
       className={styles.siteMapFrame}
     />
     <div className={styles.siteMapFooter}>
       <span>This point comes from an older school directory. It may not mark the current school entrance.</span>
       <a href="https://www.openstreetmap.org/?mlat=-0.501556&mlon=36.323889#map=16/-0.501556/36.323889" target="_blank" rel="noopener noreferrer">Open larger map</a>
       <a href={approximateLocation.source} target="_blank" rel="noopener noreferrer">Location source</a>
     </div>
   </div>}
 </section>
 <p className={styles.siteDisclosure}>School identity and directory information do not mean that the school has claimed or approved this website. Only verified school representatives can manage published school content.</p>
 </div>
 <section className={`${styles.panel} ${styles.section}`}><span className={styles.eyebrow}>SCHOOL MANAGEMENT</span><h2>Do you manage this school?</h2><p className={styles.meta}>Authorized representatives can request management access. Claiming a profile does not make school-supplied information “VibeSchool verified”; evidence remains labelled by source.</p>{!showClaim?<div className={styles.actions}><button className={styles.primary} onClick={()=>{setShowClaim(true);setShowCorrection(false);setFeedback('')}}>Claim this school</button></div>:<form onSubmit={submitClaim}><div className={styles.searchGrid}><label className={styles.field}><span>Your role *</span><input className={styles.input} value={claimRole} onChange={e=>setClaimRole(e.target.value)} placeholder="Headteacher, deputy, administrator…"/></label><label className={styles.field}><span>School contact</span><input className={styles.input} value={claimPhone} onChange={e=>setClaimPhone(e.target.value)} placeholder="Optional phone"/></label><label className={styles.field}><span>Evidence / context</span><input className={styles.input} value={claimEvidence} onChange={e=>setClaimEvidence(e.target.value)} placeholder="How can VibeSchool verify your authority?"/></label></div>{feedback&&<div className={`${styles.status} ${feedback.startsWith('Claim ') ? styles.success:styles.error}`}>{feedback}{feedback.startsWith('Sign in')&&<> <Link href="/login/global">Sign in</Link></>}</div>}<div className={styles.actions}><button className={styles.primary} disabled={saving}>{saving?'Sending…':'Request management access'}</button><button type="button" className={styles.secondary} onClick={()=>setShowClaim(false)}>Cancel</button></div></form>}</section>
 <section className={`${styles.panel} ${styles.section}`}><span className={styles.eyebrow}>COMMUNITY ASSISTED, VERIFIED BEFORE PUBLISHING</span><h2>Something missing or incorrect?</h2><p className={styles.meta}>Send a correction. It enters a review queue and cannot overwrite the canonical school record automatically.</p>{!showCorrection?<div className={styles.actions}><button className={styles.secondary} onClick={()=>{setShowCorrection(true);setShowClaim(false);setFeedback('')}}>Suggest a correction</button></div>:<form onSubmit={submitCorrection}><label className={styles.field}><span>What should VibeSchool check?</span><textarea className={styles.textarea} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Describe the correction and, if possible, the evidence."/></label>{feedback&&<div className={`${styles.status} ${feedback.startsWith('Correction')?styles.success:styles.error}`}>{feedback}{feedback.startsWith('Sign in')&&<> <Link href="/login/global">Sign in</Link></>}</div>}<div className={styles.actions}><button className={styles.primary} disabled={saving}>{saving?'Sending…':'Send for review'}</button><button type="button" className={styles.secondary} onClick={()=>setShowCorrection(false)}>Cancel</button></div></form>}</section>
 </>}</main><PublicFooter/></div>
}
