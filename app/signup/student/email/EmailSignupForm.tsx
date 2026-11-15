'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { checkLearnerEmailSession, sendLearnerEmail, signOutLearnerEmail, verifyLearnerEmail, saveIndependentEmailGrade } from './actions'
import styles from './signup.module.css'
import LearningLevelSelect from '@/components/learner/LearningLevelSelect'
import { useAuthAppearance } from '@/app/auth/useAuthAppearance'

export default function EmailSignupForm({ linkFailed }: { linkFailed: boolean }) {
  const [email, setEmail] = useState('')
  const [signedIn, setSignedIn] = useState(false)
  const [level, setLevel] = useState('')
  const [choice, setChoice] = useState('')
  const appearance = useAuthAppearance()
  const router = useRouter()
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
    if (!level || !choice || busy) return
    setBusy(true); setError('')
    const data = new FormData()
    data.set('level', level)
    data.set('choice', choice)
    try {
      const result = await saveIndependentEmailGrade(data)
      if (result.error) setError(result.error)
      else if (result.saved) router.replace(result.destination === '/student/college' ? '/student/college' : '/student')
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

  return <main className={`${styles.shell} vs-auth`} data-auth-theme={appearance}><section className={styles.card}>
    <a href="/signup/student" className={styles.back}>← Learner signup</a>
    <h1>{signedIn ? 'Start learning' : 'Sign up with email'}</h1>
    {!signedIn && <p>Use your email to continue.</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {checking ? <p role="status">Checking your session…</p> : signedIn ? <>
      <LearningLevelSelect level={level} choice={choice} onLevelChange={setLevel} onChoiceChange={setChoice} disabled={busy}/>
      <button className={styles.primary} type="button" disabled={!level || !choice || busy} onClick={()=>void saveGrade()}>{busy?'Saving…':'Continue'}</button>
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
