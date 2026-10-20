'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { LockKeyhole } from 'lucide-react'
import styles from './SuccessWishes.module.css'

export default function SchoolAccess() {
  const [schoolId, setSchoolId] = useState('')
  const [studentId, setStudentId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [unauthorised, setUnauthorised] = useState(false)
  const [code, setCode] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  async function issue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setCode(''); setError(''); setUnauthorised(false)
    try {
      const response = await fetch('/api/success-wishes/access', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ schoolId: schoolId.trim(), studentId: studentId.trim() }) })
      const data = await response.json().catch(() => null)
      if (!response.ok) { setUnauthorised(response.status === 401); throw new Error(typeof data?.error === 'string' ? data.error : 'Access could not be issued.') }
      if (typeof data?.code !== 'string') throw new Error('A code was not returned. Contact support before retrying.')
      setCode(data.code); setConfirmed(false)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Access could not be issued.') }
    finally { setBusy(false) }
  }
  return <div className={styles.page}><header className={styles.header}><Link href="/success-wishes" className={styles.brand}>VibeSchool<span style={{ fontSize: 13, fontWeight: 500, letterSpacing: 0 }}> / Success Wishes</span></Link><span className={styles.headerNote}><LockKeyhole size={13} aria-hidden="true"/>School access</span></header><main className={styles.main} id="main-content"><div className={styles.intro}><p className={styles.eyebrow}>Authorised school staff</p><h1>Private inbox access</h1><p>Issue or replace a candidate’s access code. Personal message contents are not shown here.</p></div>{code ? <section className={styles.panel}><h2>Access code issued</h2><label className={styles.field} style={{ marginTop: 18 }}>Private candidate code<input readOnly value={code} autoComplete="off" onFocus={event => event.target.select()}/></label><p className={styles.status}>Shown once. Give this code privately to the verified candidate. Replacing a code invalidates their earlier access.</p><button type="button" className={styles.secondary} style={{ marginTop: 18 }} onClick={() => { setCode(''); setStudentId('') }}>Done — clear code</button></section> : <form className={styles.panel} onSubmit={issue}><h2>Issue or reset access</h2><p className={styles.hint}>Use canonical record IDs from your authorised school workspace.</p><div className={styles.grid} style={{ marginTop: 20 }}><label className={styles.field}>School record ID<input value={schoolId} onChange={event => setSchoolId(event.target.value)} required maxLength={36} pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}" autoComplete="off"/></label><label className={styles.field}>Learner record ID<input value={studentId} onChange={event => setStudentId(event.target.value)} required maxLength={36} pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}" autoComplete="off"/></label></div><label className={styles.consent}><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required/><span>I verified the candidate’s identity and will deliver the code privately. Existing access will be replaced.</span></label>{error && <p className={styles.error} role="alert" style={{ marginTop: 18 }}>{error}</p>}{unauthorised && <Link href="/login/admin" className={styles.secondary}>Sign in as school staff</Link>}<div className={styles.actions}><Link href="/success-wishes" className={styles.quiet}>Back to Success Wishes</Link><button type="submit" className={styles.primary} disabled={busy || !confirmed}>{busy ? 'Issuing…' : 'Issue private code'}</button></div></form>}</main></div>
}
