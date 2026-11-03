'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import styles from '@/components/vibetutor/VibeTutor.module.css'
import FilterBar from '@/components/vibetutor/FilterBar'
import BackToTop from '@/components/vibetutor/BackToTop'
import { AREAS, LEVELS, SAMPLE_REQUESTS, SUBJECTS, modeLabel, type Mode } from '@/components/vibetutor/data'

export default function FindStudents() {
  const [q, setQ] = useState('')
  const [subject, setSubject] = useState('')
  const [level, setLevel] = useState('')
  const [area, setArea] = useState('')
  const [mode, setMode] = useState<Mode | ''>('')

  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    return SAMPLE_REQUESTS.filter(r =>
      (!subject || r.subject === subject) &&
      (!level || r.level === level) &&
      (!area || r.area === area) &&
      (!mode || r.mode === mode) &&
      (!term || [r.subject, r.level, r.area].some(v => v.toLowerCase().includes(term)))
    )
  }, [q, subject, level, area, mode])

  const [busy, setBusy] = useState(false)
  useEffect(() => {
    setBusy(true)
    const t = setTimeout(() => setBusy(false), 400)
    return () => clearTimeout(t)
  }, [q, subject, level, area, mode])

  const clear = () => { setQ(''); setSubject(''); setLevel(''); setArea(''); setMode('') }

  return (
    <>
      <Link href="/vibetutor" className={styles.back}>← VibeTutor</Link>
      <h1 className={styles.title}>Students who need tuition</h1>
      <FilterBar
        q={q} onQ={setQ} placeholder="Search requests by subject, level or area"
        subjects={SUBJECTS} subject={subject} onSubject={setSubject}
        levels={LEVELS} level={level} onLevel={setLevel}
        areas={AREAS} area={area} onArea={setArea}
        mode={mode} onMode={setMode}
        resultCount={results.length} noun="request" onClear={clear} busy={busy}
      />
      <div className={`${styles.list} ${busy ? styles.dim : ''}`} aria-live="polite">
        {results.length === 0 && <p className={styles.empty}>No sample requests match these filters.</p>}
        {results.map(r => (
          <article key={r.id} className={styles.item}>
            <h2 className={styles.itemTitle}>{r.subject} · {r.level}</h2>
            <p className={styles.meta}>
              <span className={styles.badge}>{modeLabel(r.mode)}</span>
              {r.learnerLabel} · {r.area}
            </p>
            <p className={styles.meta}>Budget KSh {r.budgetKes} per hour · {r.schedule}</p>
          </article>
        ))}
      </div>
      <p className={styles.notice}>Sample requests only. Learner details are shown only after a request is verified.</p>
      <BackToTop />
    </>
  )
}
