'use client'
import { SchoolFooter } from '../../components/SchoolFooter'
import Link from 'next/link'
import {useParams,usePathname} from 'next/navigation'
import {useEffect,useState} from 'react'
import {supabase} from '@/lib/supabase'
import {PublicHeader} from '@/components/public/PublicHeader'

import {SchoolCover} from '../../components/SchoolCover'
import styles from '../../schools.module.css'
type School={school_name:string;county:string|null;sub_county:string|null;school_category:string|null;ownership_type:string|null;gender_type:string|null;accommodation_type:string|null;knec_code:string|null;pathway_slug:string|null;pathway_name:string|null;combination_name:string|null}
const pages=['about','academics','news','contact']
export default function SchoolSubpage(){
 const {schoolId,section}=useParams<{schoolId:string;section:string}>()
 const pathname=usePathname()
 const schoolBase=pathname.startsWith('/school/gilgiltownship')?'/school/gilgiltownship':'/schools/'+schoolId
 const [rows,setRows]=useState<School[]>([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 useEffect(()=>{let active=true;setLoading(true);void(async()=>{const r=await supabase.rpc('schools_get_public_profile_v1',{p_school_id:schoolId});if(active){setRows((r.data||[]) as School[]);setError(r.error?'Could not load school.':'');setLoading(false)}})();return()=>{active=false}},[schoolId])
 const school=rows[0]
 const title=section==='about'?'About':section==='academics'?'Academics':section==='news'?'News':'Contact'
 const facts=school?([['Education level',school.school_category],['Ownership',school.ownership_type],['Accommodation',school.accommodation_type],['Gender',school.gender_type],['County',school.county],['Sub-county',school.sub_county],['KNEC code',school.knec_code]] as [string,string|null][]).filter(([,v])=>v):[]
 return <div className={styles.page}><PublicHeader product="Schools"/><main id="main-content" className={styles.main}>
 <nav className={styles.schoolBreadcrumb} aria-label="Breadcrumb"><Link href="/schools">Schools</Link><span>/</span><Link href={schoolBase}>{school?.school_name||'School'}</Link><span>/</span><span aria-current="page">{title}</span></nav>
 {loading?<p role="status">Loading school…</p>:error?<p role="alert">{error}</p>:!school||!pages.includes(section)?<p role="alert">School page unavailable.</p>:<>
 <section className={styles.canonicalHero}><SchoolCover name={school.school_name}/><h1 className={styles.canonicalTitle}>{school.school_name}</h1><p>{[school.sub_county,school.county].filter(Boolean).join(', ')}</p></section>
 <nav className={styles.schoolPageNav} aria-label="School pages">{[['Home',''],['About','about'],['Academics','academics'],['News','news'],['Contact','contact']].map(([label,slug])=><Link key={label} aria-current={slug===section?'page':undefined} href={schoolBase+(slug?'/'+slug:'')}>{label}</Link>)}</nav>
 <div className={styles.canonicalBody}><section className={styles.canonicalSection}><h2>{title==='Contact'?'Contact & location':title==='News'?'News & announcements':title==='About'?'About the school':title}</h2>
 {section==='about'&&<><p>{school.school_name} is located in {[school.sub_county,school.county,'Kenya'].filter(Boolean).join(', ')}.</p><div className={styles.canonicalFacts}>{facts.map(([label,value])=><div key={label} className={styles.canonicalFact}><span>{label}</span><strong>{value}</strong></div>)}</div></>}
 {section==='academics'&&<><p>Education level: {school.school_category||'Not specified'}</p>{rows.some(r=>r.pathway_slug)?rows.filter(r=>r.pathway_slug).map((r,i)=><article key={i}><h3>{r.pathway_name}</h3>{r.combination_name&&<p>{r.combination_name}</p>}</article>):<p>No additional programmes have been confirmed.</p>}</>}
 {section==='news'&&<p>No official announcements have been published here yet.</p>}
 {section==='contact'&&<><p>{[school.sub_county,school.county,'Kenya'].filter(Boolean).join(', ')}</p><p>Official contact details and exact coordinates have not been published.</p></>}
 </section></div></>}
 </main><SchoolFooter name={school?.school_name} location={[school?.sub_county,school?.county].filter(Boolean).join(', ')}/></div>
}
