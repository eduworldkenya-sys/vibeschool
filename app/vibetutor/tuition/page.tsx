'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import styles from '@/components/vibetutor/VibeTutor.module.css'
import { TUITION_AREA_ALLOCATIONS, TUITION_SERVICES } from '@/components/vibetutor/tuitionServices'

export default function TuitionServicesPage() {
  const [search, setSearch] = useState('')
  const [area, setArea] = useState('')
  const [level, setLevel] = useState('')
  const results = useMemo(() => {
    const term = search.trim().toLowerCase()
    return TUITION_SERVICES.filter(s =>
      (!area || s.area === area) && (!level || s.level === level) &&
      (!term || [s.area, s.level, ...s.subjects].join(' ').toLowerCase().includes(term)))
  }, [area, level, search])
  return (
    <>
      <h1 className={styles.pageTitle}>VibeSchool online tuition</h1>
      <p className={styles.muted}>Choose a subject and area. Your tutor, availability and rate will be confirmed after your request.</p>
      <div className={styles.form}>
        <input className={styles.input} aria-label="Search tuition" placeholder="Search subject or area" value={search} onChange={e => setSearch(e.target.value)} />
        <select className={styles.input} aria-label="Area" value={area} onChange={e => setArea(e.target.value)}>
          <option value="">All areas</option>
          {TUITION_AREA_ALLOCATIONS.map(([name]) => <option key={name}>{name}</option>)}
        </select>
        <select className={styles.input} aria-label="Level" value={level} onChange={e => setLevel(e.target.value)}>
          <option value="">All levels</option>
          {[...new Set(TUITION_SERVICES.map(s => s.level))].map(value => <option key={value}>{value}</option>)}
        </select>
      </div>
      <p className={styles.meta} aria-live="polite">{results.length} tuition options</p>
      <div className={styles.list}>
        {results.map(s => (
          <article className={styles.card} key={s.id}>
            <div className={styles.cardHead}>
              <div className={styles.cardTitleWrap}>
                <h2 className={styles.cardTitle}>{s.subjects.join(' & ')}</h2>
                <p className={styles.muted}>{s.level} · {s.area}</p>
              </div>
              <span className={styles.tag}>Online</span>
            </div>
            <p className={styles.meta}>VibeSchool · Tutor to be confirmed</p>
            <Link className={styles.cardAction} href={'/vibetutor/post-request?service=' + encodeURIComponent(s.id)}>Request tuition</Link>
          </article>
        ))}
        {!results.length && <p className={styles.empty}>No tuition options match these filters.</p>}
      </div>
      <Link className={styles.emptyAction} href="/vibetutor/browse">Browse registered tutors</Link>
    </>
  )
}
