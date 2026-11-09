'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { checkLearnerEmailSession, sendLearnerEmail, signOutLearnerEmail, verifyLearnerEmail, saveIndependentEmailGrade } from './actions'
import styles from './signup.module.css'
import { LEARNER_GRADES } from '@/lib/learner/independent-grade'

export default function EmailSignupForm({ linkFailed }: { linkFailed: boolean }) {
  const [email, setEmail] = useState('')
  const [signedIn, setSignedIn] = useState(false)
  const [grade, setGrade] = useState('')
  const [gradeSaved, setGradeSaved] = useState(false)
  const [checking, setChecking] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(linkFailed ? 'This link could not be verified. Request a new email and open it on this browser.' : '')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let mounted = true
    checkLearnerEmailSession()
      .then(active => { if (mounted) setSignedIn(active) })
      .catch(() => { if (mounted) setError('Could not check your session. You can still sign in below.') })
      .finally(() => { if (mounted) setChecking(false) })
    return () => { mounted = false }
  }, [])

  async function requestCode(form: FormData) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await sendLearnerEmail(form)
      if (result.error) setError(result.error)
      else if (result.email) {
        setEmail(result.email)
        setNotice('Check your inbox for a code or sign-in link.')
      }
    } catch {
      setError('Could not connect. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const form = new FormData(event.currentTarget)
    if (!email) return requestCode(form)

    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await verifyLearnerEmail(form)
      if (result.error) setError(result.error)
      else if (result.signedIn) {
        setEmail('')
        setSignedIn(true)
      }
    } catch {
      setError('Could not connect. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function saveGrade() {
    if (!grade || busy) return
    setBusy(true); setError('')
    const data = new FormData()
    data.set('grade', grade)
    try {
      const result = await saveIndependentEmailGrade(data)
      if (result.error) setError(result.error)
      else setGradeSaved(true)
    } catch { setError('Could not save grade. Try again.') }
    finally { setBusy(false) }
  }

  async function signOut() {
    setBusy(true)
    setError('')
    try {
      const result = await signOutLearnerEmail()
      if (result.error) setError(result.error)
      else setSignedIn(false)
    } catch {
      setError('Could not sign out. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return <main className={styles.shell}><section className={styles.card}>
    <a href="/signup/student" className={styles.back}>← Learner signup</a>
    <h1>{signedIn ? 'Start learning' : 'Sign up with email'}</h1>
    <p>{signedIn ? 'Your email is verified. Open the reading library to start.' : 'Use an email you can open on this phone.'}</p>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {checking ? <p role="status">Checking your session…</p> : signedIn ? <>
      {!gradeSaved && <><label htmlFor="independent-grade">Choose your grade or form</label><select id="independent-grade" value={grade} onChange={e=>setGrade(e.target.value)} style={{display:'block',width:'100%',padding:13,borderRadius:8,margin:'10px 0'}}><option value="">Select grade</option>{LEARNER_GRADES.map(value=><option key={value} value={value}>{value}</option>)}</select><button className={styles.primary} type="button" disabled={!grade || busy} onClick={()=>void saveGrade()}>{busy?'Saving…':'Save grade and continue'}</button></>}
      {gradeSaved && <a className={styles.primary} href="/global/read">Open reading library</a>}
      <p>Independent learners can access the reading library. School-only areas are not included in this account yet.</p>
      <button className={styles.secondary} type="button" disabled={busy} onClick={() => void signOut()}>Sign out</button>
    </> : <form key={email ? 'verify' : 'send'} onSubmit={submit}>
      {email ? <>
        <input type="hidden" name="email" value={email} />
        <p>Check the verification email sent to <strong className={styles.address}>{email}</strong>.</p>
        <label htmlFor="learner-email-code">Verification code</label>
        <input id="learner-email-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required disabled={busy} />
      </> : <>
        <label htmlFor="learner-email">Email address</label>
        <input id="learner-email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} required disabled={busy} />
      </>}
      <button className={styles.primary} type="submit" disabled={busy}>{busy ? 'Please wait…' : email ? 'Verify and continue' : 'Send verification email'}</button>
      {email && <div className={styles.actions}>
        <button className={styles.secondary} type="button" disabled={busy} onClick={() => {
          const form = new FormData()
          form.set('email', email)
          void requestCode(form)
        }}>Resend email</button>
        <button className={styles.secondary} type="button" disabled={busy} onClick={() => { setEmail(''); setError(''); setNotice('') }}>Use a different email</button>
      </div>}
    </form>}
  </section></main>
}
