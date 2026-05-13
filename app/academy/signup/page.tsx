'use client'
import { useState, useRef, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import styles from './signup.module.css'

const VALID_ROLES = ['teacher', 'parent', 'admin'] as const
type Role = typeof VALID_ROLES[number]

const COUNTRIES = [
  { code: 'KE', name: 'Kenya' },
  { code: 'US', name: 'United States' },
  { code: 'DE', name: 'Germany' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
]

const MIN_DOB = new Date()
MIN_DOB.setFullYear(MIN_DOB.getFullYear() - 120)
const MAX_DOB = new Date()
MAX_DOB.setFullYear(MAX_DOB.getFullYear() - 5)

function AcademySignUpInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const rawRole      = searchParams.get('role') ?? 'teacher'
  const role: Role   = (VALID_ROLES as readonly string[]).includes(rawRole)
    ? (rawRole as Role)
    : 'teacher'

  const contentRef = useRef<HTMLDivElement>(null)
  const navTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [fullName, setFullName] = useState('')
  const [dob,      setDob]      = useState('')
  const [country,  setCountry]  = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [code,     setCode]     = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  useEffect(() => {
    return () => { if (navTimer.current) clearTimeout(navTimer.current) }
  }, [])

  function fadeOut(destination: string) {
    if (!contentRef.current) return
    contentRef.current.style.transition = 'opacity 280ms ease-in'
    contentRef.current.style.opacity    = '0'
    navTimer.current = setTimeout(() => router.push(destination), 280)
  }

  async function handleSubmit() {
    setError('')

    if (!fullName.trim())    { setError('Full name is required.'); return }
    if (!dob)                { setError('Date of birth is required.'); return }

    const dobDate = new Date(dob)
    if (isNaN(dobDate.getTime()) || dobDate < MIN_DOB || dobDate > MAX_DOB) {
      setError('Please enter a valid date of birth.'); return
    }

    if (!country)            { setError('Country is required.'); return }
    if (!email.trim())       { setError('Email is required.'); return }
    if (!password)           { setError('Password is required.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (code.trim() && !/^\d{6}$/.test(code.trim())) {
      setError('Invitation code must be exactly 6 digits.'); return
    }

    setLoading(true)

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    })

    if (authError || !authData.user) {
      setLoading(false)
      setError(authError?.message || 'Sign up failed. Please try again.')
      return
    }

    const { error: profileError } = await supabase.from('profiles').insert({
      id:            authData.user.id,
      full_name:     fullName.trim(),
      date_of_birth: dob,
      country_code:  country,
    })

    if (profileError) {
      await supabase.auth.signOut()
      setLoading(false)
      setError('Account setup failed. Please try again.')
      return
    }

    if (code.trim()) {
      await fetch('/api/validate-invitation', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ code: code.trim(), commit: true }),
      })
    }

    setLoading(false)
    fadeOut('/academy/dashboard')
  }

  return (
    <>
      <svg aria-hidden focusable="false" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        <defs>
          <filter id="grain-academy-signup">
            <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves={4} stitchTiles="stitch" result="noise" />
            <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise" />
            <feBlend in="SourceGraphic" in2="grayNoise" mode="overlay" />
          </filter>
        </defs>
      </svg>

      <div id="academy-signup-root" className={styles.root}>
        <div id="scan-line" aria-hidden />
        <div className={styles.content} ref={contentRef}>

          <button className={styles.back} onClick={() => fadeOut(`/academy/signin?role=${role}`)} aria-label="Back to sign in">←</button>

          <p className={styles.world}>ACADEMY · {role.toUpperCase()}</p>
          <p className={styles.heading}>CREATE ACCOUNT</p>
          <p className={styles.sub}>For schools, teachers and institutions.</p>

          <div className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="fullName">FULL NAME</label>
              <input id="fullName" className={styles.input} type="text" autoComplete="name"
                value={fullName} onChange={e => setFullName(e.target.value)} disabled={loading} />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="dob">DATE OF BIRTH</label>
              <input id="dob" className={styles.input} type="date"
                min={MIN_DOB.toISOString().split('T')[0]}
                max={MAX_DOB.toISOString().split('T')[0]}
                value={dob} onChange={e => setDob(e.target.value)} disabled={loading} />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="country">COUNTRY</label>
              <select id="country" className={styles.input} value={country}
                onChange={e => setCountry(e.target.value)} disabled={loading}>
                <option value="" disabled>Select country</option>
                {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="email">EMAIL</label>
              <input id="email" className={styles.input} type="email" autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)} disabled={loading} />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="password">PASSWORD</label>
              <input id="password" className={styles.input} type="password" autoComplete="new-password"
                value={password} onChange={e => setPassword(e.target.value)} disabled={loading} />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="code">
                INVITATION CODE <span className={styles.optional}>(optional)</span>
              </label>
              <input id="code" className={styles.input} type="text" inputMode="numeric" maxLength={6}
                placeholder="6-digit code" value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))} disabled={loading} />
            </div>

            {error && <p className={styles.error} role="alert">{error}</p>}

            <button className={styles.submit} onClick={handleSubmit} disabled={loading}>
              {loading ? 'CREATING ACCOUNT…' : 'CREATE ACCOUNT'}
            </button>
          </div>

          <p className={styles.switch}>
            Already have an account?{' '}
            <span className={styles.switchLink} role="button" tabIndex={0}
              onClick={() => fadeOut(`/academy/signin?role=${role}`)}
              onKeyDown={e => { if (e.key === 'Enter') fadeOut(`/academy/signin?role=${role}`) }}>
              Sign in
            </span>
          </p>

        </div>
      </div>
    </>
  )
}

export default function AcademySignUp() {
  return <Suspense><AcademySignUpInner /></Suspense>
}