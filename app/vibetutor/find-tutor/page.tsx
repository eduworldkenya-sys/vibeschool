'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import styles from '@/components/vibetutor/VibeTutor.module.css'
import { AREAS, LEVELS, SAMPLE_TUTORS, SUBJECTS, modeLabel, type Mode } from '@/components/vibetutor/data'

export default function FindTutor() {
  const [subject, setSubject] = useState('')
  const [level, setLevel] = useState('')
  const [area, setArea] = useState('')
  const [mode, setMode] = useState<Mode | ''>('')

  const results = useMemo(() => SAMPLE_TUTORS.filter(t =>
    (!subject || t.subjects.includes(subject)) &&
    (!level || t.levels.includes(level)) &&
    (!area || t.area === area) &&
    (!mode || t.mode === mode || t.mode === 'either')
  ), [subject, level, area, mode])

  return (
    <>
      <Link href="/vibetutor" className={styles.back}>← VibeTutor</Link>
      <h1 className={styles.title}>Find a tutor</h1>
      <div className={styles.notice}>Sample tutors only. Contact details are not shown in this preview.</div>
      <div className={styles.filters}>
        <label className={styles.field}>Subject
          <select className={styles.select} value={subject} onChange={e => setSubject(e.target.value)}>
            <option value="">Any subject</option>
            {SUBJECTS.map(s => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className={styles.field}>Level
          <select className={styles.select} value={level} onChange={e => setLevel(e.target.value)}>
            <option value="">Any level</option>
            {LEVELS.map(s => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className={styles.field}>Area
          <select className={styles.select} value={area} onChange={e => setArea(e.target.value)}>
            <option value="">Any area</option>
            {AREAS.map(s => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className={styles.field}>Mode
          <select className={styles.select} value={mode} onChange={e => setMode(e.target.value as Mode | '')}>
            <option value="">Online or in person</option>
            <option value="online">Online</option>
            <option value="physical">In person</option>
          </select>
        </label>
      </div>
      <div className={styles.list} aria-live="polite">
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
    </>
  )
}
