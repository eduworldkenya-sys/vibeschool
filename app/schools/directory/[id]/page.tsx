'use client'
import { SchoolFooter } from '../../components/SchoolFooter'

import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { PublicHeader } from '@/components/public/PublicHeader'

import { supabase } from '@/lib/supabase'
import styles from '../../schools.module.css'
import { SchoolCover } from '../../components/SchoolCover'

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
  <nav aria-label="Breadcrumb" className={styles.schoolBreadcrumb}><Link href="/schools">Schools</Link><span aria-hidden="true">/</span><span aria-current="page">{school?.school_name||"School"}</span></nav>
  {loading?<p role="status" className={styles.directoryStatus}>Loading school…</p>:error?<p role="alert" className={styles.directoryStatus}>{error}</p>:school&&<>
   <section className={styles.canonicalHero}><SchoolCover name={school.school_name}/><h1 className={styles.canonicalTitle}>{school.school_name}</h1><p className={styles.canonicalLocation}>{[school.sub_county,school.county].filter(Boolean).join(', ')}</p><div className={styles.canonicalChips}>{[school.school_level,school.ownership_type].filter(Boolean).map(value=><span key={value}>{value}</span>)}</div></section>
   <div className={styles.canonicalBody}><section className={styles.canonicalSection}><h2>School information</h2><div className={styles.canonicalFacts}>{facts.map(([label,value])=><div className={styles.canonicalFact} key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></section><p className={styles.canonicalNote}>Directory information · This school has not claimed this page</p></div>
  </>}
 </main><SchoolFooter name={school?.school_name} location={[school?.sub_county,school?.county].filter(Boolean).join(', ')}/></div>
}
