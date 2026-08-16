"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import styles from './signup.module.css'

const COUNTRIES = [
  { code: 'KE', name: 'Kenya' },
  { code: 'UG', name: 'Uganda' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'JP', name: 'Japan' },
]

const MIN_DOB = new Date()
MIN_DOB.setFullYear(MIN_DOB.getFullYear() - 120)
const MAX_DOB = new Date()
MAX_DOB.setFullYear(MAX_DOB.getFullYear() - 5)

export default function GlobalSignUp() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [dob, setDob] = useState('')
  const [country, setCountry] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmationSent, setConfirmationSent] = useState(false)

  async function handleSubmit() {
    if (loading) return
    setError('')
    if (!fullName.trim()) { setError('Full name is required.'); return }
    if (!dob) { setError('Date of birth is required.'); return }
    const dobDate = new Date(dob)
    if (Number.isNaN(dobDate.getTime()) || dobDate < MIN_DOB || dobDate > MAX_DOB) { setError('Please enter a valid date of birth.'); return }
    if (!country) { setError('Country is required.'); return }
    if (!email.trim()) { setError('Email is required.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }

    setLoading(true)
    try {
      const callback = `${window.location.origin}/auth/callback?intent=signup&role=global_user`
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: callback, data: { full_name: fullName.trim() } },
      })

      if (authError || !authData.user) {
        setError('Sign up failed. If you already registered, sign in instead.')
        return
      }
      if (!authData.session) {
        setConfirmationSent(true)
        return
      }

      const claim = await supabase.rpc('claim_my_initial_role', { p_role: 'global_user' })
      if (claim.error || claim.data !== 'global_user') {
        router.replace('/auth/error?reason=role_claim_failed')
        return
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim(), date_of_birth: dob, country_code: country })
        .eq('id', authData.user.id)
      if (profileError) {
        router.replace('/auth/error?reason=profile_resolution_failed')
        return
      }

      const { data: onboarding, error: onboardingError } = await supabase.rpc('get_my_onboarding_state')
      const destination = onboarding && typeof onboarding === 'object' && !Array.isArray(onboarding) && typeof onboarding.destination === 'string' ? onboarding.destination : null
      if (onboardingError || !destination) {
        router.replace('/auth/error?reason=onboarding_resolution_failed')
        return
      }
      router.replace(destination)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div id="global-signup-root" className={styles.root}>
      <div className={styles.content}>
        <button className={styles.back} onClick={() => router.push('/')} aria-label="Back to sign in">←</button>
        <p className={styles.world}>GLOBAL</p>
        <p className={styles.heading}>CREATE ACCOUNT</p>
        <p className={styles.sub}>For international networks and independent learners.</p>

        {confirmationSent ? (
          <p className={styles.sub} role="status">Check your email to confirm your account. VibeSchool will continue setup after confirmation.</p>
        ) : (
          <div className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="fullName">FULL NAME</label>
              <input id="fullName" className={styles.input} type="text" autoComplete="name" value={fullName} onChange={e => setFullName(e.target.value)} disabled={loading} />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="dob">DATE OF BIRTH</label>
              <input id="dob" className={styles.input} type="date" min={MIN_DOB.toISOString().split('T')[0]} max={MAX_DOB.toISOString().split('T')[0]} value={dob} onChange={e => setDob(e.target.value)} disabled={loading} />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="country">COUNTRY</label>
              <select id="country" className={styles.input} value={country} onChange={e => setCountry(e.target.value)} disabled={loading}>
                <option value="" disabled>Select country</option>
                {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="email">EMAIL</label>
              <input id="email" className={styles.input} type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} disabled={loading} />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="password">PASSWORD</label>
              <div style={{ position: 'relative' }}>
                <input id="password" className={styles.input} type={showPw ? 'text' : 'password'} autoComplete="new-password" style={{ paddingRight: 42 }} value={password} onChange={e => setPassword(e.target.value)} disabled={loading} onKeyDown={e => { if (e.key === 'Enter') void handleSubmit() }} />
                <button type="button" onClick={() => setShowPw(v => !v)} aria-label={showPw ? 'Hide password' : 'Show password'} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1 }}>{showPw ? 'Hide' : 'Show'}</button>
              </div>
            </div>
            {error && <p className={styles.error} role="alert">{error}</p>}
            <button className={styles.submit} onClick={() => void handleSubmit()} disabled={loading}>{loading ? 'CREATING ACCOUNT…' : 'CREATE ACCOUNT'}</button>
          </div>
        )}

        <p className={styles.switch}>Already have an account? <button type="button" className={styles.switchLink} onClick={() => router.push('/login/global')}>Sign in</button></p>
      </div>
    </div>
  )
}
