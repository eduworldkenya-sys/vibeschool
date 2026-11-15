import styles from '../schools.module.css'
import { officialWhatsAppHref } from '@/lib/public/whatsapp'
const SUPPORT=officialWhatsAppHref('Hello VibeSchool, I need help with a school page.')
export function SchoolFooter({name,location}:{name?:string|null;location?:string|null}){
 return <footer className={styles.schoolSiteFooter}>
 <div><strong>{name||'School information'}</strong>{location&&<p>{location}</p>}</div>
 <a href={SUPPORT} target="_blank" rel="noopener noreferrer" aria-label="Contact VibeSchool on WhatsApp">Contact VibeSchool · WhatsApp</a>
 <small>Powered by VibeSchool</small>
 </footer>
}
