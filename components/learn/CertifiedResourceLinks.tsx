'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { certifiedResourceHref, useCertifiedInteractiveResources } from '@/lib/learn/useCertifiedInteractiveResources'
import styles from './SchoolLearnLibrary.module.css'

/** Read-only discovery. Uncertified and private content is never a catalogue item. */
export default function CertifiedResourceLinks({ grade, subject }: { grade: string; subject: string }) {
  const { status, resources } = useCertifiedInteractiveResources(grade, subject)
  return <section aria-label="Released interactive resources" style={{ marginTop: 16 }}>
    <h3 style={{ marginBottom: 8 }}>Interactive learning</h3>
    {status === 'loading' && <p className={styles.description} role="status">Checking available activities…</p>}
    {status === 'error' && <p className={styles.description} role="status">Interactive resources could not be loaded. Try again later.</p>}
    {status === 'ready' && resources.length === 0 &&
      <p className={styles.description}>No certified interactive resources are available for this subject yet.</p>}
    {status === 'ready' && resources.length > 0 && <div className={styles.linksRow}>
      {resources.map(item => <Link key={item.id} className={styles.buttonSecondary} href={certifiedResourceHref(item)}>
        {item.title} <ChevronRight size={16} aria-hidden="true"/>
      </Link>)}
    </div>}
  </section>
}
