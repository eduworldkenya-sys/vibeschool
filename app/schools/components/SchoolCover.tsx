import styles from '../schools.module.css'

/** Neutral directory artwork, never a photograph of an unrelated school. */
export function SchoolCover({name,photoUrl}:{name:string;photoUrl?:string|null}){
 return <div className={styles.schoolCover} aria-label={photoUrl?'School photograph':'School image placeholder'}>
  {photoUrl?<img src={photoUrl} alt={name} loading="lazy" className={styles.schoolCoverPhoto}/>:<svg aria-hidden="true" viewBox="0 0 120 72" width="104" height="70" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
   <path d="M12 64V25L60 5l48 20v39M12 31h96M45 64V43h30v21M26 43h8m52 0h8M26 53h8m52 0h8M6 64h108"/>
  </svg>}
 </div>
}
