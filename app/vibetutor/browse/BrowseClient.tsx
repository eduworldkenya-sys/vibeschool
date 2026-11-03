'use client'

import { useEffect, useMemo, useState } from 'react'
import styles from '@/components/vibetutor/VibeTutor.module.css'
import FilterBar from '@/components/vibetutor/FilterBar'
import BackToTop from '@/components/vibetutor/BackToTop'
import { TutorCard, RequestCard } from '@/components/vibetutor/Cards'
import { AREAS, DEMO_REQUESTS, DEMO_TUTORS, LEVELS, SUBJECTS, type Mode } from '@/components/vibetutor/data'

type View = 'tutors' | 'students'

export default function BrowseClient({ initialView }: { initialView: View }) {
  const [view, setView] = useState<View>(initialView)
  const [q, setQ] = useState('')
  const [subject, setSubject] = useState('')
  const [level, setLevel] = useState('')
  const [area, setArea] = useState('')
  const [mode, setMode] = useState<Mode | ''>('')

  const tutors = useMemo(() => {
    const term = q.trim().toLowerCase()
    return DEMO_TUTORS.filter(t =>
      (!subject || t.subjects.includes(subject)) &&
      (!level || t.levels.includes(level)) &&
      (!area || t.area === area) &&
      (!mode || t.mode === mode || t.mode === 'either') &&
      (!term || [t.name, t.area, ...t.subjects, ...t.levels].some(v => v.toLowerCase().includes(term)))
    )
  }, [q, subject, level, area, mode])

  const requests = useMemo(() => {
    const term = q.trim().toLowerCase()
    return DEMO_REQUESTS.filter(r =>
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
  }, [q, subject, level, area, mode, view])

  const clear = () => { setQ(''); setSubject(''); setLevel(''); setArea(''); setMode('') }
  const count = view === 'tutors' ? tutors.length : requests.length

  return (
    <>
      <h1 className={styles.pageTitle}>Find holiday tuition</h1>
      <p className={styles.notice}>
        Demo data. These listings are fictional and only show how the page works.
      </p>

      <FilterBar
        view={view} onView={setView}
        q={q} onQ={setQ}
        placeholder={view === 'tutors' ? 'Search tutors by name, subject or area' : 'Search requests by subject, level or area'}
        subjects={SUBJECTS} subject={subject} onSubject={setSubject}
        levels={LEVELS} level={level} onLevel={setLevel}
        areas={AREAS} area={area} onArea={setArea}
        mode={mode} onMode={setMode}
        resultCount={count} noun={view === 'tutors' ? 'tutor' : 'request'} onClear={clear} busy={busy}
      />

      <div className={`${styles.list} ${busy ? styles.dim : ''}`} aria-live="polite">
        {view === 'tutors' && tutors.length === 0 && <p className={styles.empty}>No demo tutors match these filters.</p>}
        {view === 'students' && requests.length === 0 && <p className={styles.empty}>No demo requests match these filters.</p>}
        {view === 'tutors' && tutors.map(t => <TutorCard key={t.id} t={t} />)}
        {view === 'students' && requests.map(r => <RequestCard key={r.id} r={r} />)}
      </div>
      <BackToTop />
    </>
  )
}
