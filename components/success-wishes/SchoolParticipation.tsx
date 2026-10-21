'use client'

import { useState } from 'react'
import styles from './SuccessWishes.module.css'

export default function SchoolParticipation({ schoolId }: { schoolId: string }) {
  const [status, setStatus] = useState<boolean | null>(null)
  const [sponsored, setSponsored] = useState(false)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [lastSchool, setLastSchool] = useState('')
  const ready = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(schoolId.trim())
  const stale = lastSchool !== schoolId.trim()

  async function call(method: 'GET' | 'POST', optIn?: boolean) {
    if (!ready || busy) return
    setBusy(true); setError(''); setMessage('')
    try {
      const response = await fetch(method === 'GET'
        ? `/api/success-wishes/participation?schoolId=${encodeURIComponent(schoolId.trim())}`
        : '/api/success-wishes/participation', {
          method, cache: 'no-store', credentials: 'same-origin',
          ...(method === 'POST' ? {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ schoolId: schoolId.trim(), optIn, confirmSchoolConsent: consent }),
          } : {}),
        })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(typeof result?.error === 'string' ? result.error : 'School setup is unavailable.')
      setLastSchool(schoolId.trim())
      setStatus(result.enabled === true)
      setSponsored(result.sponsoredText === true)
      setMessage(typeof result.message === 'string' ? result.message : '')
      setConsent(false)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update participation.') }
    finally { setBusy(false) }
  }

  return <section className={styles.panel}>
    <h2>School participation</h2>
    <p className={styles.hint}>A school administrator must opt in before candidates can receive Success Wishes. This does not authorise payments or free messages.</p>
    <div className={styles.actions}>
      <button type="button" className={styles.secondary} disabled={!ready || busy}
        onClick={() => void call('GET')}>{busy ? 'Checking…' : 'Check school status'}</button>
    </div>
    {!stale && status !== null && <p className={styles.status} role="status">
      School: <strong>{status ? 'Participating' : 'Not participating'}</strong>
      {status && sponsored && ' · Sponsored text approved'}
    </p>}
    {(!status || stale) && <label className={styles.consent}>
      <input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)}/>
      <span>I am authorised to opt this school in, and the school has agreed to privately deliver candidate messages and follow its child-safety and retention responsibilities.</span>
    </label>}
    <div className={styles.actions}>
      {(!status || stale) && <button type="button" className={styles.primary}
        disabled={!ready || !consent || busy} onClick={() => void call('POST', true)}>
        Register school participation
      </button>}
      {!stale && status === true && <button type="button" className={styles.secondary}
        disabled={busy} onClick={() => void call('POST', false)}>
        Stop participation and revoke inbox sessions
      </button>}
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {message && <p className={styles.notice} role="status">{message}</p>}
  </section>
}
