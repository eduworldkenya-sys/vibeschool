'use client'

import { useEffect, useMemo, useState } from 'react'
import styles from '@/components/vibetutor/VibeTutor.module.css'
import FilterBar from '@/components/vibetutor/FilterBar'
import BackToTop from '@/components/vibetutor/BackToTop'
import { TutorCard, RequestCard } from '@/components/vibetutor/Cards'
import { AREAS, DEMO_REQUESTS, DEMO_TUTORS, LEVELS, SUBJECTS_BY_LEVEL, type Mode } from '@/components/vibetutor/data'

type View = 'tutors' | 'students'
export default function BrowseClient({ initialView }: { initialView: View }) {
  const [view, setView] = useState<View>(initialView)
  const [q, setQ] = useState('')
  const [subject, setSubject] = useState('')
  const [level, setLevel] = useState('')
  const [area, setArea] = useState('')
  const [mode, setMode] = useState<Mode | ''>('')
  const [busy, setBusy] = useState(false)
  const subjects = level ? SUBJECTS_BY_LEVEL[level] || [] : []
  const tutors = useMemo(() => {
    const term = q.trim().toLowerCase()
    return DEMO_TUTORS.filter(t =>
      (!level || t.levels.includes(level)) &&
      (!subject || t.subjects.includes(subject)) &&
      (!area || t.area === area) &&
      (!mode || t.mode === mode || t.mode === 'either') &&
      (!term || [t.name, t.area, ...t.subjects, ...t.levels].some(value => value.toLowerCase().includes(term)))
    )
  }, [q, subject, level, area, mode])
  const requests = useMemo(() => {
    const term = q.trim().toLowerCase()
    return DEMO_REQUESTS.filter(r =>
      (!level || r.level === level) &&
      (!subject || r.subjects.includes(subject)) &&
      (!area || r.area === area) &&
      (!mode || r.mode === mode || r.mode === 'either') &&
      (!term || [r.learnerLabel, r.area, r.level, ...r.subjects].some(value => value.toLowerCase().includes(term)))
    )
  }, [q, subject, level, area, mode])
  useEffect(() => {
    setBusy(true)
    const timer = setTimeout(() => setBusy(false), 250)
    return () => clearTimeout(timer)
  }, [q, subject, level, area, mode, view])
  const clear = () => { setQ(''); setSubject(''); setLevel(''); setArea(''); setMode('') }
  const count = view === 'tutors' ? tutors.length : requests.length
  return (
    <>
      <h1 className={styles.pageTitle}>Find holiday tuition</h1>
      <FilterBar view={view} onView={setView} q={q} onQ={setQ}
        placeholder={view === 'tutors' ? 'Search tutors by name, subject or area' : 'Search requests by subject, level or area'}
        subjects={subjects} subject={subject} onSubject={setSubject}
        levels={LEVELS} level={level} onLevel={setLevel}
        areas={AREAS} area={area} onArea={setArea}
        mode={mode} onMode={setMode} resultCount={count} noun={view === 'tutors' ? 'tutor' : 'request'}
        onClear={clear} busy={busy} />
      <div className={`${styles.list} ${busy ? styles.dim : ''}`} aria-live="polite">
        {view === 'tutors' && tutors.length === 0 && <p className={styles.empty}>No example tutors match these filters.</p>}
        {view === 'students' && requests.length === 0 && <p className={styles.empty}>No example requests match these filters.</p>}
        {view === 'tutors' && tutors.map(tutor => <TutorCard key={tutor.id} t={tutor} />)}
        {view === 'students' && requests.map(request => <RequestCard key={request.id} r={request} />)}
      </div>
      <BackToTop />
    </>
  )
}
