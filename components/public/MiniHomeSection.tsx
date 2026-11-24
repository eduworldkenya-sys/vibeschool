import Link from 'next/link'
import styles from './MiniExplore.module.css'
import { MiniLiveHome } from './MiniLiveHome'

export function MiniHomeSection() {
  if (process.env.NEXT_PUBLIC_MINI_LESSONS_BACKEND_ENABLED === 'true') return <MiniLiveHome />
  return <section aria-labelledby="mini-home-title" className={styles.homeSection}>
    <div className={styles.sectionHeader}>
      <div><h2 id="mini-home-title">Mini Lessons</h2>
        <p>Short explanations, photographs and ideas from educational creators.</p></div>
      <Link href="/explore" className={styles.sectionLink}>Explore Minis</Link>
    </div>
    <p className={styles.subline}>Publishing is not yet available.</p>
  </section>
}
