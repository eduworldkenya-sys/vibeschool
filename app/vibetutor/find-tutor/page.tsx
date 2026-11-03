'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import styles from '@/components/vibetutor/VibeTutor.module.css'
import FilterBar from '@/components/vibetutor/FilterBar'
import BackToTop from '@/components/vibetutor/BackToTop'
import { AREAS, LEVELS, SAMPLE_TUTORS, SUBJECTS, modeLabel, type Mode } from '@/components/vibetutor/data'

export default function FindTutor() {
  const [q, setQ] = useState('')
  const [subject, setSubject] = useState('')
  const [level, setLevel] = useState('')
  const [area, setArea] = useState('')
  const [mode, setMode] = useState<Mode | ''>('')

  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    return SAMPLE_TUTORS.filter(t =>
      (!subject || t.subjects.includes(subject)) &&
      (!level || t.levels.includes(level)) &&
      (!area || t.area === area) &&
      (!mode || t.mode === mode || t.mode === 'either') &&
      (!term || [t.name, t.area, ...t.subjects, ...t.levels].some(v => v.toLowerCase().includes(term)))
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
      <h1 className={styles.title}>Find a tutor</h1>
      <FilterBar
        q={q} onQ={setQ} placeholder="Search tutors by name, subject or area"
        subjects={SUBJECTS} subject={subject} onSubject={setSubject}
        levels={LEVELS} level={level} onLevel={setLevel}
        areas={AREAS} area={area} onArea={setArea}
        mode={mode} onMode={setMode}
        resultCount={results.length} noun="tutor" onClear={clear} busy={busy}
      />
      <div className={`${styles.list} ${busy ? styles.dim : ''}`} aria-live="polite">
        {results.length === 0 && <p className={styles.empty}>No sample tutors match these filters.</p>}
        {results.map(t => (
          <article key={t.id} className={styles.item}>
            <h2 className={styles.itemTitle}>{t.name}</h2>
            <p className={styles.meta}>
              <span className={styles.badge}>{modeLabel(t.mode)}</span>
              {t.subjects.join(', ')} · {t.levels.join(', ')} · {t.area}
            </p>
            <p className={styles.meta}>From KSh {t.rateKes} per hour{t.holidayAvailable ? ' · Available this holiday' : ''}</p>
          </article>
        ))}
      </div>
      <p className={styles.notice}>Sample tutors only. Contact details are not shown in this preview.</p>
      <BackToTop />
    </>
  )
}
