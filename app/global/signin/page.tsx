'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import styles from './signin.module.css'

const COUNTRIES = [
  { code: 'KE', name: 'Kenya' },
  { code: 'US', name: 'United States' },
  { code: 'DE', name: 'Germany' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
]

export default function GlobalSignIn() {
  const router     = useRouter()
  const contentRef = useRef<HTMLDivElement>(null)

  const [mode,     setMode]     = useState<'signin' | 'signup'>('signin')
  const [fullName, setFullName] = useState('')
  const [dob,      setDob]      = useState('')
  const [country,  setCountry]  = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  function fadeOut(destination: string) {
    if (!contentRef.current) return
    contentRef.current.style.transition = 'opacity 280ms ease-in'
    contentRef.current.style.opacity    = '0'
    setTimeout(() => router.push(destination), 280)
  }

  function switchMode(next: 'signin' | 'signup') { setError(''); setMode(next) }

  async function handleSubmit() {
    setError('')

    if (mode === 'signin') {
      if (!email.trim() || !password) { setError('Email and password are required.'); return }
      setLoading(true)
      const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      setLoading(false)
      if (authError) { setError(authError.message); return }
      fadeOut('/global/dashboard')
      return
    }

    if (!fullName.trim())    { setError('Full name is required.'); return }
    if (!dob)                { setError('Date of birth is required.'); return }
    if (!country)            { setError('Country is required.'); return }
    if (!email.trim())       { setError('Email is required.'); return }
    if (!password)           { setError('Password is required.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }

    setLoading(true)
    const { data: authData, error: authError } = await supabase.auth.signUp({ email: email.trim(), password })
    if (authError || !authData.user) {
      setLoading(false)
      setError(authError?.message || 'Sign up failed. Please try again.')
      return
    }
    const { error: profileError } = await supabase.from('profiles').insert({
      id: authData.user.id, full_name: fullName.trim(), date_of_birth: dob, country_code: country,
    })
    setLoading(false)
    if (profileError) { setError(profileError.message); return }
    fadeOut('/global/dashboard')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); handleSubmit() }
  }

  return (
    <>
      <svg aria-hidden focusable="false" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        <defs>
          <filter id="grain-global-signin">
            <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves={4} stitchTiles="stitch" result="noise" />
            <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise" />
            <feBlend in="SourceGraphic" in2="grayNoise" mode="overlay" />
          </filter>
        </defs>
      </svg>

      <div id="global-signin-root" className={styles.root}>
        <div id="scan-line" aria-hidden />
        <div className={styles.content} ref={contentRef}>

          <button className={styles.back} onClick={() => fadeOut('/select')} aria-label="Back to world select">←</button>

          <p className={styles.world}>GLOBAL</p>
          <p className={styles.heading}>{mode === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}</p>
          <p className={styles.sub}>For international networks and independent learners.</p>

          <div className={styles.toggle}>
            <button className={`${styles.toggleBtn} ${mode === 'signin' ? styles.toggleActive : ''}`} onClick={() => switchMode('signin')} disabled={loading}>SIGN IN</button>
            <button className={`${styles.toggleBtn} ${mode === 'signup' ? styles.toggleActive : ''}`} onClick={() => switchMode('signup')} disabled={loading}>SIGN UP</button>
          </div>

          <div className={styles.form}>
            {mode === 'signup' && (
              <>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="fullName">FULL NAME</label>
                  <input id="fullName" className={styles.input} type="text" autoComplete="name" value={fullName} onChange={e => setFullName(e.target.value)} onKeyDown={handleKeyDown} disabled={loading} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="dob">DATE OF BIRTH</label>
                  <input id="dob" className={styles.input} type="date" value={dob} onChange={e => setDob(e.target.value)} disabled={loading} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="country">COUNTRY</label>
                  <select id="country" className={styles.input} value={country} onChange={e => setCountry(e.target.value)} disabled={loading}>
                    <option value="" disabled>Select country</option>
                    {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                  </select>
                </div>
              </>
            )}

            <div className={styles.field}>
              <label className={styles.label} htmlFor="email">EMAIL</label>
              <input id="email" className={styles.input} type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={handleKeyDown} disabled={loading} />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="password">PASSWORD</label>
              <input id="password" className={styles.input} type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={handleKeyDown} disabled={loading} />
            </div>

            {error && <p className={styles.error} role="alert">{error}</p>}

            <button className={styles.submit} onClick={handleSubmit} disabled={loading}>
              {loading ? (mode === 'signin' ? 'SIGNING IN…' : 'CREATING ACCOUNT…') : (mode === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT')}
            </button>

            <div className={styles.divider}>
              <span className={styles.dividerLine} />
              <span className={styles.dividerText}>OR</span>
              <span className={styles.dividerLine} />
            </div>

            <button className={styles.google} disabled aria-disabled="true">
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
                <path fill="rgba(255,255,255,0.3)" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="rgba(255,255,255,0.3)" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="rgba(255,255,255,0.3)" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="rgba(255,255,255,0.3)" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>Continue with Google</span>
              <span className={styles.googleSoon}>coming soon</span>
            </button>
          </div>

        </div>
      </div>
    </>
  )
}