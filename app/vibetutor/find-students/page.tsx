'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import styles from '@/components/vibetutor/VibeTutor.module.css'
import { AREAS, LEVELS, SAMPLE_REQUESTS, SUBJECTS, modeLabel, type Mode } from '@/components/vibetutor/data'

export default function FindStudents() {
  const [subject, setSubject] = useState('')
  const [level, setLevel] = useState('')
  const [area, setArea] = useState('')
  const [mode, setMode] = useState<Mode | ''>('')
  const [q, setQ] = useState('')

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

  return (
    <>
      <Link href="/vibetutor" className={styles.back}>← VibeTutor</Link>
      <h1 className={styles.title}>Students who need tuition</h1>
      <div className={styles.notice}>Sample requests only. Learner details are shown only after a request is verified.</div>
      <label className={styles.field} style={{ marginTop: 16 }}>Search by subject, level or area
        <input className={styles.input} type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="e.g. English, Kisumu" />
      </label>
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
            <option value="">Any</option>
            <option value="online">Online</option>
            <option value="physical">In person</option>
          </select>
        </label>
      </div>
      <div className={styles.list} aria-live="polite">
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
    </>
  )
}
