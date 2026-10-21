'use client'

import { useState } from 'react'
import styles from './SuccessWishes.module.css'

type Report = { id: string; reason: string; createdAt: string; status: string }
export default function SchoolReports({ schoolId }: { schoolId: string }) {
  const [reports, setReports] = useState<Report[]>([])
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [verified, setVerified] = useState<Record<string, boolean>>({})
  const [lastSchool, setLastSchool] = useState('')
  const ready = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(schoolId.trim())
  const active = lastSchool === schoolId.trim()

  async function refresh() {
    if (!ready || busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch(`/api/success-wishes/reports?schoolId=${encodeURIComponent(schoolId.trim())}`,
        { credentials: 'same-origin', cache: 'no-store' })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || 'Reports are unavailable.')
      setReports(Array.isArray(body?.reports) ? body.reports : [])
      setLastSchool(schoolId.trim()); setLoaded(true); setVerified({})
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load reports.') }
    finally { setBusy(false) }
  }

  async function resolve(reportId: string) {
    if (!ready || busy || !verified[reportId]) return
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch('/api/success-wishes/reports', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId: schoolId.trim(), reportId }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || 'Could not resolve this report.')
      setReports(previous => previous.filter(item => item.id !== reportId))
      setVerified(previous => ({ ...previous, [reportId]: false }))
      setNotice('Report review recorded. The content remains hidden from the candidate.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update the report.') }
    finally { setBusy(false) }
  }

  return <section className={styles.panel}>
    <h2>Safety reports</h2>
    <p className={styles.hint}>View candidate-reported concerns for your school. Message contents remain private and reported content stays hidden.</p>
    <div className={styles.actions}>
      <button type="button" className={styles.secondary} disabled={!ready || busy}
        onClick={() => void refresh()}>{busy ? 'Checking…' : 'Review reports'}</button>
    </div>
    {active && loaded && reports.length === 0 && <p className={styles.status}>No open reports for this school.</p>}
    {active && reports.map(report => <article className={styles.section} key={report.id}>
      <p className={styles.status}><strong>Reported {new Date(report.createdAt).toLocaleDateString('en-KE')}</strong></p>
      <p className={styles.messageText}>{report.reason}</p>
      <label className={styles.consent}>
        <input type="checkbox" checked={verified[report.id] === true}
          onChange={event => setVerified(prev => ({ ...prev, [report.id]: event.target.checked }))}/>
        <span>I have reviewed and documented the appropriate safeguarding follow-up.</span>
      </label>
      <button type="button" className={styles.secondary} disabled={busy || !verified[report.id]}
        onClick={() => void resolve(report.id)}>Mark reviewed</button>
    </article>)}
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
  </section>
}
