import styles from '@/app/schools/schools.module.css'

export type SchoolFact = readonly [label: string, value: string | null | undefined]

/** One public presentation for canonical schools and unclaimed directory records.
 * Null or unverified fields are never invented or displayed as factual values.
 */
export function SchoolFacts({facts}:{facts:readonly SchoolFact[]}) {
 const present=facts.filter((fact):fact is readonly [string,string]=>typeof fact[1]==='string'&&fact[1].trim().length>0)
 return <section className={styles.canonicalSection}>
  <h2>School information</h2>
  {present.length>0?<div className={styles.canonicalFacts}>{present.map(([label,value])=>
   <div className={styles.canonicalFact} key={label}><span>{label}</span><strong>{value}</strong></div>
  )}</div>:<p>School information has not been published yet.</p>}
 </section>
}

export function SchoolLocation({county,subCounty}:{county?:string|null;subCounty?:string|null}) {
 const location=[subCounty,county,'Kenya'].filter(Boolean).join(', ')
 return <section className={styles.canonicalSection}><h2>Location</h2>
  <p>{location}</p>
  <p className={styles.canonicalNote}>An exact school map pin is shown only when its location has been verified.</p>
 </section>
}
