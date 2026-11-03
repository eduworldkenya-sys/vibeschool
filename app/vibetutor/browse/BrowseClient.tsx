'use client'

import { useEffect, useState } from 'react'
import styles from '@/components/vibetutor/VibeTutor.module.css'
import FilterBar from '@/components/vibetutor/FilterBar'
import BackToTop from '@/components/vibetutor/BackToTop'
import { AREAS, LEVELS, SUBJECTS, type Mode } from '@/components/vibetutor/data'

type View = 'tutors' | 'students'

export default function BrowseClient({ initialView }: { initialView: View }) {
  const [view, setView] = useState<View>(initialView)
  const [q, setQ] = useState('')
  const [subject, setSubject] = useState('')
  const [level, setLevel] = useState('')
  const [area, setArea] = useState('')
  const [mode, setMode] = useState<Mode | ''>('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setBusy(true)
    const t = setTimeout(() => setBusy(false), 250)
    return () => clearTimeout(t)
  }, [q, subject, level, area, mode, view])

  const clear = () => { setQ(''); setSubject(''); setLevel(''); setArea(''); setMode('') }

  return (
    <>
      <h1 className={styles.pageTitle}>Find holiday tuition</h1>

      <FilterBar
        view={view} onView={setView}
        q={q} onQ={setQ}
        placeholder={view === 'tutors' ? 'Search tutors by name, subject or area' : 'Search requests by subject, level or area'}
        subjects={SUBJECTS} subject={subject} onSubject={setSubject}
        levels={LEVELS} level={level} onLevel={setLevel}
        areas={AREAS} area={area} onArea={setArea}
        mode={mode} onMode={setMode}
        resultCount={0} noun={view === 'tutors' ? 'tutor' : 'request'} onClear={clear} busy={busy}
      />

      <div className={`${styles.list} ${busy ? styles.dim : ''}`} aria-live="polite">
        <div className={styles.empty}>
          <strong>{view === 'tutors' ? 'No tutors listed yet' : 'No tuition requests listed yet'}</strong>
          <p>{view === 'tutors'
            ? 'Tutor profiles will appear here when tutors join VibeTutor.'
            : 'Tuition requests will appear here when learners post them.'}</p>
        </div>
      </div>
      <BackToTop />
    </>
  )
}
