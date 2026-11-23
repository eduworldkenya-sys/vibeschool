import Link from 'next/link'
import { MINI_EXAMPLES } from '@/lib/public/mini-examples'
import { MiniCard } from './MiniCard'
import styles from './MiniExplore.module.css'

export function MiniHomeSection() {
  return <section aria-labelledby="mini-home-title" className={styles.homeSection}>
    <div className={styles.sectionHeader}>
      <div><span className={styles.eyebrow}>SHARE WHAT YOU KNOW</span><h2 id="mini-home-title">Discover something new.</h2>
        <p>Short explanations, photographs and ideas from educational creators.</p></div>
      <Link href="/explore" className={styles.sectionLink}>Explore Minis <span aria-hidden="true">↗</span></Link>
    </div>
    <div className={styles.homeGrid}>
      {MINI_EXAMPLES.slice(0, 3).map(mini => <MiniCard key={mini.id} mini={mini} />)}
    </div>
    <p className={styles.previewNote}>Illustrative Mini Lessons — creator publishing is not yet active.</p>
  </section>
}
