import Link from 'next/link'
import styles from './PathwaysNav.module.css'
const items=[['/pathways','Pathways'],['/learn/careers','Careers'],['/pathways/subjects','Subjects'],['/pathways/check','Discover'],['/pathways/schools','Schools']] as const
export default function PathwaysNav({active}:{active:typeof items[number][0]}) {
 return <nav className={styles.nav} aria-label="Explore Pathways">{items.map(([href,label])=><Link key={href} href={href} aria-current={active===href?'page':undefined}>{label}</Link>)}</nav>
}
