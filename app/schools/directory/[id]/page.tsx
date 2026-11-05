'use client'

import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import { supabase } from '@/lib/supabase'
import styles from '../../schools.module.css'

type DirectorySchool={directory_id:string;school_name:string;county:string|null;sub_county:string|null;school_level:string|null;ownership_type:string|null;knec_code:string|null;latitude:number|null;longitude:number|null;is_verified:boolean}
export default function DirectorySchoolPage(){
 const {id}=useParams<{id:string}>()
 const params=useSearchParams()
 const name=params.get('name')||''
 const [school,setSchool]=useState<DirectorySchool|null>(null)
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 useEffect(()=>{
  let active=true
  async function load(){
   if(!name){setError('School details unavailable.');setLoading(false);return}
   const {data,error}=await supabase.rpc('schools_directory_search_public_v1',{p_query:name,p_county:null,p_sub_county:null,p_level:null,p_limit:100})
   if(!active)return
   if(error){setError('Could not load school details.')}else{
    const match=((data||[]) as DirectorySchool[]).find(s=>s.directory_id===id)
    if(match)setSchool(match);else setError('School not found.')
   }
   setLoading(false)
  }
  void load()
  return ()=>{active=false}
 },[id,name])
 const facts=school?[
  ['County',school.county],['Sub-county',school.sub_county],['Level',school.school_level],['Ownership',school.ownership_type],['KNEC code',school.knec_code]
 ].filter(([,v])=>Boolean(v)):[]
 return <div className={styles.page}><PublicHeader product="Schools"/>
 <main id="main-content" className={styles.directoryMain}>
  <Link className={styles.back} href="/schools">← All schools</Link>
  {loading?<p role="status" className={styles.directoryStatus}>Loading school…</p>:error?<p role="alert" className={styles.directoryStatus}>{error}</p>:school&&<>
   <div className={styles.siteCover} style={{marginTop:24}}>
    <span className={styles.siteUnclaimed}>Directory school page</span>
    <div className={styles.siteEmblem} aria-hidden="true">S</div>
    <h1 className={styles.siteTitle}>{school.school_name}</h1>
    <p className={styles.siteLocation}>{[school.sub_county,school.county].filter(Boolean).join(' · ')}</p>
   </div>
   <section className={styles.siteSection} style={{marginTop:22}}>
    <h2>School information</h2>
    <div className={styles.siteFacts}>{facts.map(([label,value])=><div className={styles.siteFact} key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
   </section>
  </>}
 </main><PublicFooter/></div>
}
