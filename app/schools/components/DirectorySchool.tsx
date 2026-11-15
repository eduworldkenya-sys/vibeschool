'use client'
import Link from 'next/link'
import type { PublicSchoolAddress } from '@/lib/school-urls'
import { PublicHeader } from '@/components/public/PublicHeader'
import { SchoolFooter } from '@/app/schools/components/SchoolFooter'
import { SchoolCover } from '@/app/schools/components/SchoolCover'
import { SchoolLocation } from '@/app/schools/components/SchoolPublicFacts'
import SchoolVisitorHome from '@/components/schools/SchoolVisitorHome'
import styles from '@/app/schools/schools.module.css'

export default function DirectorySchoolPage({ school, section }: {
  school: PublicSchoolAddress; section?: string
}) {
  const facts: [string, string | null][] = [
    ['County', school.county],
    ['Sub-county', school.sub_county],
    ['Level', school.school_level],
    ['Ownership', school.ownership_type],
    ['KNEC code', school.knec_code],
  ]
  return <div className={styles.page}>
    <PublicHeader product="Schools" />
    <main id="main-content" className={styles.directoryMain}>
      <nav aria-label="Breadcrumb" className={styles.schoolBreadcrumb}>
        <Link href="/schools">Schools</Link><span aria-hidden="true">/</span>
        <span aria-current="page">{school.school_name}</span>
      </nav>
      <section className={styles.canonicalHero}>
        <SchoolCover name={school.school_name}/>
        <h1 className={styles.canonicalTitle}>{school.school_name}</h1>
        <p className={styles.canonicalLocation}>{[school.sub_county, school.county].filter(Boolean).join(', ')}</p>
        <div className={styles.canonicalChips}>
          {[school.school_level, school.ownership_type].filter(Boolean).map(value => <span key={value}>{value}</span>)}
        </div>
      </section>
      <SchoolVisitorHome slug={school.slug} section={section} facts={facts}/>
      <details className={styles.schoolVisitorMore}>
        <summary>Location & source</summary>
        <SchoolLocation county={school.county} subCounty={school.sub_county}
          kind={school.source_kind} sourceId={school.source_id} name={school.school_name}/>
        <p className={styles.canonicalNote}>VibeSchool directory listing. Information is updated as sources are confirmed.</p>
      </details>
    </main>
    <SchoolFooter name={school.school_name} location={[school.sub_county, school.county].filter(Boolean).join(', ')}/>
  </div>
}
