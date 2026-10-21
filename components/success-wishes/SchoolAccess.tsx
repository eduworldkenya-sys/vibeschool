'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useRef, useState } from 'react'
import { LockKeyhole, Search } from 'lucide-react'
import styles from './SuccessWishes.module.css'
import SchoolParticipation from './SchoolParticipation'
import SchoolReports from './SchoolReports'
import SchoolViewing from './SchoolViewing'

type Candidate = { id: string; name: string; admissionNumber: string | null }

export default function SchoolAccess() {
  const [schoolId, setSchoolId] = useState('')
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([])
  const [schoolError, setSchoolError] = useState('')
  const [loadingSchools, setLoadingSchools] = useState(true)
  useEffect(() => {
    let live = true
    fetch('/api/success-wishes/my-schools', { credentials: 'same-origin', cache: 'no-store' })
      .then(async response => {
        const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(body.error || 'School accounts could not be loaded.')
        return body as { schools?: { id: string; name: string }[] }
      }).then(body => {
        if (!live) return
        const items = Array.isArray(body.schools) ? body.schools : []
        setSchools(items)
        if (items.length === 1) setSchoolId(items[0].id)
      }).catch(reason => {
        if (live) setSchoolError(reason instanceof Error ? reason.message : 'School lookup failed.')
      }).finally(() => { if (live) setLoadingSchools(false) })
    return () => { live = false }
  }, [])
  const [candidateQuery, setCandidateQuery] = useState('')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [student, setStudent] = useState<Candidate | null>(null)
  const [searched, setSearched] = useState(false)
  const [searching, setSearching] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [unauthorised, setUnauthorised] = useState(false)
  const [code, setCode] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  useEffect(() => {
    if (!code) return
    const timeout = window.setTimeout(() => setCode(''), 60_000)
    const clearIfHidden = () => { if (document.visibilityState === 'hidden') setCode('') }
    document.addEventListener('visibilitychange', clearIfHidden)
    return () => { window.clearTimeout(timeout); document.removeEventListener('visibilitychange', clearIfHidden) }
  }, [code])
  const searchEpoch = useRef(0)
  const changeSchool = (value: string) => {
    searchEpoch.current++
    setSchoolId(value); setStudent(null); setCandidates([]); setSearched(false)
    setConfirmed(false); setCode('')
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const epoch = ++searchEpoch.current
    setSearching(true); setError(''); setUnauthorised(false); setSearched(false)
    setCandidates([]); setStudent(null); setConfirmed(false)
    try {
      const params = new URLSearchParams({ schoolId: schoolId.trim(), q: candidateQuery.trim() })
      const response = await fetch(`/api/success-wishes/candidates?${params}`, {
        credentials: 'same-origin', cache: 'no-store',
      })
      const result: { candidates?: Candidate[]; error?: string } = await response.json().catch(() => ({}))
      if (epoch !== searchEpoch.current) return
      if (!response.ok) {
        setUnauthorised(response.status === 401)
        throw new Error(result.error || 'The candidate search is unavailable.')
      }
      setCandidates(Array.isArray(result.candidates) ? result.candidates : [])
      setSearched(true)
    } catch (reason) {
      if (epoch === searchEpoch.current) setError(reason instanceof Error ? reason.message : 'Search failed.')
    } finally { if (epoch === searchEpoch.current) setSearching(false) }
  }

  async function issue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!student || !confirmed) return
    setBusy(true); setCode(''); setError(''); setUnauthorised(false)
    try {
      const response = await fetch('/api/success-wishes/access', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId: schoolId.trim(), studentId: student.id }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        setUnauthorised(response.status === 401)
        throw new Error(typeof data?.error === 'string' ? data.error : 'Access could not be issued.')
      }
      if (typeof data?.code !== 'string') throw new Error('The code was not returned. Contact support before retrying.')
      setCode(data.code)
      setConfirmed(false)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Access could not be issued.') }
    finally { setBusy(false) }
  }

  return <div className={styles.page}>
    <header className={styles.header}>
      <Link href="/success-wishes" className={styles.brand}>VibeSchool
        <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: 0 }}> / Success Wishes</span>
      </Link>
      <span className={styles.headerNote}><LockKeyhole size={13} aria-hidden="true"/>School access</span>
    </header>
    <main className={styles.main} id="main-content">
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Authorised school staff</p>
        <h1>Private inbox access</h1>
        <p>Find a candidate within your school and privately issue an access code. Messages are not visible to staff.</p>
      </div>
      {code ? <section className={styles.panel}>
        <h2>Code issued for {student?.name || 'candidate'}</h2>
        <label className={styles.field} style={{ marginTop: 18 }}>Private candidate code
          <input readOnly value={code} autoComplete="off" onFocus={event => event.target.select()}/>
        </label>
        <p className={styles.status}>Shown only once. Privately hand it to the verified candidate. A new code invalidates earlier inbox sessions.</p>
        <button type="button" className={styles.secondary} style={{ marginTop: 18 }}
          onClick={() => { setCode(''); setStudent(null); setConfirmed(false); setCandidateQuery(''); setCandidates([]); setSearched(false) }}>
          Done — clear code
        </button>
      </section> : <>
        <form className={styles.panel} onSubmit={search}>
          <h2>Find a candidate</h2>
          <p className={styles.hint}>Only authorised school administrators can use this search.</p>
          <div className={styles.grid} style={{ marginTop: 16 }}>
            <label className={styles.field}>Your school
              <select value={schoolId} onChange={event => changeSchool(event.target.value)}
                disabled={loadingSchools} required>
                <option value="">{loadingSchools ? 'Loading schools…' : 'Select your school'}</option>
                {schools.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              {schoolError && <small role="alert">{schoolError}</small>}
            </label>
            <label className={styles.field}>Candidate name
              <input value={candidateQuery} onChange={event => { searchEpoch.current++; setCandidateQuery(event.target.value); setCandidates([]); setSearched(false); setStudent(null); setConfirmed(false) }}
                required minLength={2} maxLength={80} autoComplete="off" placeholder="Search name"/>
            </label>
          </div>
          <div className={styles.actions}>
            <button type="submit" disabled={searching || candidateQuery.trim().length < 2} className={styles.primary}>
              <Search size={16} aria-hidden="true"/>{searching ? 'Searching…' : 'Find candidate'}
            </button>
          </div>
          {searched && candidates.length === 0 && <p className={styles.status} role="status">No current candidate matched. Check the school and name.</p>}
          {candidates.length > 0 && <div className={styles.results} aria-label="Matching candidates">
            {candidates.map(candidate => <button type="button" key={candidate.id} className={styles.school}
              aria-pressed={student?.id === candidate.id}
              onClick={() => { setStudent(candidate); setConfirmed(false) }}>
              <div><strong>{candidate.name}</strong><span>Admission: {candidate.admissionNumber || 'Not assigned'}</span></div>
              <span aria-hidden="true">{student?.id === candidate.id ? '✓' : '→'}</span>
            </button>)}
          </div>}
        </form>
        {student && <form className={styles.panel} onSubmit={issue}>
          <h2>Issue access for {student.name}</h2>
          <p className={styles.hint}>Confirm identity using the school's records before replacing an existing code.</p>
          <label className={styles.consent}>
            <input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required/>
            <span>I have verified this candidate and will hand the one-time code privately to them. Previous access will be revoked.</span>
          </label>
          <div className={styles.actions}>
            <button type="submit" className={styles.primary} disabled={!confirmed || busy}>
              {busy ? 'Issuing…' : 'Issue private code'}
            </button>
          </div>
        </form>}
      </>}
      <SchoolParticipation schoolId={schoolId}/>
      <SchoolReports schoolId={schoolId}/>
      <SchoolViewing key={schoolId} schoolId={schoolId}/>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {unauthorised && <Link href="/login/admin" className={styles.secondary}>Sign in as school staff</Link>}
    </main>
  </div>
}
