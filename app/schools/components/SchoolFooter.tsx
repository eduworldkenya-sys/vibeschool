import styles from '../schools.module.css'
const SUPPORT='https://wa.me/254728232157?text=Hello%20VibeSchool%2C%20I%20need%20help%20with%20a%20school%20page.'
export function SchoolFooter({name,location}:{name?:string|null;location?:string|null}){
 return <footer className={styles.schoolSiteFooter}>
 <div><strong>{name||'School information'}</strong>{location&&<p>{location}</p>}</div>
 <a href={SUPPORT} target="_blank" rel="noopener noreferrer" aria-label="Contact VibeSchool on WhatsApp">Contact VibeSchool · WhatsApp</a>
 <small>Powered by VibeSchool</small>
 </footer>
}
