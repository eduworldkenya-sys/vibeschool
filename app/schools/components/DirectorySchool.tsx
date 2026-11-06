'use client'
import { SchoolFooter } from '@/app/schools/components/SchoolFooter'

import Link from 'next/link'
import type { PublicSchoolAddress } from '@/lib/school-urls'
import { schoolUrl, SCHOOL_SECTIONS } from '@/lib/school-urls'
import { PublicHeader } from '@/components/public/PublicHeader'

import styles from '@/app/schools/schools.module.css'
import { SchoolCover } from '@/app/schools/components/SchoolCover'
import { SchoolFacts, SchoolLocation } from '@/app/schools/components/SchoolPublicFacts'

export default function DirectorySchoolPage({school,section}:{school:PublicSchoolAddress;section?:string}){
 const facts: [string,string|null][] = school?[
  ['County',school.county],['Sub-county',school.sub_county],['Level',school.school_level],['Ownership',school.ownership_type],['KNEC code',school.knec_code]
 ]:[]
 return <div className={styles.page}><PublicHeader product="Schools"/>
 <main id="main-content" className={styles.directoryMain}>
  <nav aria-label="Breadcrumb" className={styles.schoolBreadcrumb}><Link href="/schools">Schools</Link><span aria-hidden="true">/</span><span aria-current="page">{school?.school_name||"School"}</span></nav>
  <>
   <section className={styles.canonicalHero}><SchoolCover name={school.school_name}/><h1 className={styles.canonicalTitle}>{school.school_name}</h1><p className={styles.canonicalLocation}>{[school.sub_county,school.county].filter(Boolean).join(', ')}</p><div className={styles.canonicalChips}>{[school.school_level,school.ownership_type].filter(Boolean).map(value=><span key={value}>{value}</span>)}</div></section>
   <nav className={styles.schoolPageNav} aria-label="School pages">{[['Home',''],...SCHOOL_SECTIONS.map(v=>[v.charAt(0).toUpperCase()+v.slice(1),v])].map(([label,path])=><Link key={label} aria-current={(section||'')===path?'page':undefined} href={schoolUrl(school.slug)+(path?'/'+path:'')}>{label}</Link>)}</nav>
   <div className={styles.canonicalBody}>{section&&section!=='about'?<section className={styles.canonicalSection}><h2>{section.charAt(0).toUpperCase()+section.slice(1)}</h2><p>{section==='academics'?`Education level: ${school.school_level||'Not specified'}`:section==='news'?'No official announcements have been published here yet.':'Official contact details have not been published.'}</p></section>:null}<SchoolFacts facts={facts}/><SchoolLocation county={school.county} subCounty={school.sub_county}/><p className={styles.canonicalNote}>Directory information · This school has not claimed this page</p></div>
  </>
 </main><SchoolFooter name={school?.school_name} location={[school?.sub_county,school?.county].filter(Boolean).join(', ')}/></div>
}
