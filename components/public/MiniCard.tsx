import Link from 'next/link'
import type { MiniExample } from '@/lib/public/mini-examples'
import { MiniArtwork } from './MiniArtwork'
import styles from './MiniExplore.module.css'

export function MiniCard({ mini }: { mini: MiniExample }) {
  return <Link href={'/explore?mini=' + encodeURIComponent(mini.id)} className={styles.miniCard}>
    <MiniArtwork kind={mini.cover} />
    <div className={styles.miniCardBody}>
      <span className={styles.subject}>{mini.tags.map(tag=>'#'+tag).join(' ')} · {mini.minutes} min</span>
      <h3>{mini.title}</h3>
      <p>{mini.summary}</p>
      <span className={styles.creatorLine}>Illustrative Mini · Tap to read <span aria-hidden="true">↗</span></span>
    </div>
  </Link>
}
