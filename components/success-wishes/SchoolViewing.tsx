'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import styles from './SuccessWishes.module.css'

type Window = { id: string; weekday: number; startsAt: string; endsAt: string; venue: string; guidance: string; isActive: boolean }
const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function SchoolViewing({ schoolId }: { schoolId: string }) {
  const [windows, setWindows] = useState<Window[]>([])
  const [weekday, setWeekday] = useState(1)
  const [startsAt, setStartsAt] = useState('15:00')
  const [endsAt, setEndsAt] = useState('16:00')
  const [venue, setVenue] = useState('')
  const [guidance, setGuidance] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loaded, setLoaded] = useState(false)
  const ready = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(schoolId.trim())

  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch('/api/success-wishes/viewing-windows?schoolId=' + encodeURIComponent(schoolId), {
      credentials: 'same-origin', cache: 'no-store', signal,
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) throw new Error(typeof payload?.error === 'string' ? payload.error : 'The school schedule could not load.')
    return Array.isArray(payload?.windows) ? payload.windows as Window[] : []
  }, [schoolId])

  useEffect(() => {
    const controller = new AbortController()
    setWindows([]); setLoaded(false); setError(''); setNotice('')
    if (!ready) return () => controller.abort()
    load(controller.signal).then(value => {
      if (!controller.signal.aborted) { setWindows(value); setLoaded(true) }
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Schedule unavailable.')
    })
    return () => controller.abort()
  }, [load, ready])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!ready || busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch('/api/success-wishes/viewing-windows', {
        method: 'POST', cache: 'no-store', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId, weekday, startsAt, endsAt, venue: venue.trim(), guidance: guidance.trim() }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(typeof body?.error === 'string' ? body.error : 'Could not save a viewing session.')
      setWindows(await load())
      setLoaded(true)
      setVenue(''); setGuidance('')
      setNotice('School viewing session saved. Candidates see it only after opening their private inbox.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save a viewing session.') }
    finally { setBusy(false) }
  }

  async function remove(id: string) {
    if (!ready || busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch('/api/success-wishes/viewing-windows', {
        method: 'DELETE', cache: 'no-store', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId, id }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(typeof body?.error === 'string' ? body.error : 'Could not remove this session.')
      setWindows(await load())
      setNotice('School viewing session removed.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not remove this session.') }
    finally { setBusy(false) }
  }

  return <section className={styles.panel}>
    <h2>Candidate viewing times</h2>
    <p className={styles.hint}>For candidates without personal phones. Set supervised school-device times in Kenya time (EAT). Staff cannot view the messages; candidates must use their own private codes and sign out.</p>
    {!ready && <p className={styles.status}>Select your school to manage viewing sessions.</p>}
    {loaded && windows.length === 0 && <p className={styles.status}>No school-device viewing times have been scheduled.</p>}
    {windows.length > 0 && <div className={styles.results}>
      {windows.map(item => <div key={item.id} className={styles.school}>
        <div><strong>{days[item.weekday]} · {item.startsAt.slice(0, 5)}–{item.endsAt.slice(0, 5)} EAT</strong>
          <span>{item.venue}{item.guidance ? ' · ' + item.guidance : ''}</span>
        </div>
        <button type="button" className={styles.quiet} disabled={busy} onClick={() => void remove(item.id)}>Remove</button>
      </div>)}
    </div>}
    <form onSubmit={event => void save(event)} className={styles.section}>
      <div className={styles.grid}>
        <label className={styles.field}>Day
          <select value={weekday} disabled={!ready || busy} onChange={event => setWeekday(Number(event.target.value))}>
            {days.map((day, index) => <option key={day} value={index}>{day}</option>)}
          </select>
        </label>
        <label className={styles.field}>Viewing location
          <input value={venue} disabled={!ready || busy} onChange={event => setVenue(event.target.value)}
            required minLength={2} maxLength={120} placeholder="e.g. School library"/>
        </label>
        <label className={styles.field}>From (EAT)
          <input type="time" value={startsAt} disabled={!ready || busy} required onChange={event => setStartsAt(event.target.value)}/>
        </label>
        <label className={styles.field}>Until (EAT)
          <input type="time" value={endsAt} disabled={!ready || busy} required min={startsAt} onChange={event => setEndsAt(event.target.value)}/>
        </label>
      </div>
      <label className={styles.field}>Candidate instructions (optional)
        <input value={guidance} disabled={!ready || busy} onChange={event => setGuidance(event.target.value)}
          maxLength={320} placeholder="e.g. Ask the duty teacher for the device"/>
      </label>
      <div className={styles.actions}><button className={styles.secondary} type="submit"
        disabled={!ready || busy || venue.trim().length < 2 || startsAt >= endsAt || windows.length >= 14}>
        {busy ? 'Saving…' : 'Add viewing time'}
      </button></div>
    </form>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}
  </section>
}
