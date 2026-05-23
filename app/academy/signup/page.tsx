'use client'
import { useState, useRef, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import styles from './signup.module.css'

const VALID_ROLES = ['teacher', 'parent', 'student', 'admin'] as const
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

const ROLE_CONTENT: Record<Role, { descriptor: string }> = {
  teacher: { descriptor: 'Manage classes, lessons and student engagement.' },
  parent:  { descriptor: "Track your child's progress and communications." },
  student: { descriptor: 'View your timetable, marks, attendance and homework.' },
  admin:   { descriptor: 'Manage institution-wide operations and analytics.' },
}

const ROLE_DESTINATIONS: Record<Role, string> = {
  teacher: '/teacher/onboarding/school',
  parent:  '/parent',
  student: '/student',
  admin:   '/admin',
}

function AcademySignUpInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const rawRole      = searchParams.get('role') ?? 'teacher'
  const role: Role   = (VALID_ROLES as readonly string[]).includes(rawRole)
    ? (rawRole as Role)
    : 'teacher'

  const contentRef = useRef<HTMLDivElement>(null)
  const navTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [fullName,        setFullName]        = useState('')
  const [dob,             setDob]             = useState('')
  const [country,         setCountry]         = useState('')
  const [email,           setEmail]           = useState('')
  const [password,        setPassword]        = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword,    setShowPassword]    = useState(false)
  const [showConfirm,     setShowConfirm]     = useState(false)
  const [claimCode,       setClaimCode]       = useState('')
  const [error,           setError]           = useState('')
  const [loading,         setLoading]         = useState(false)

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
      setError('Please enter a valid date of birth.')
      return
    }

    if (!country)            { setError('Country is required.'); return }
    if (!email.trim())       { setError('Email is required.'); return }
    if (!password)           { setError('Password is required.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }

    if (role === 'student') {
      if (!claimCode.trim()) { setError('Claim code is required to create a student account.'); return }
    }

    setLoading(true)

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    })

    if (authError || !authData.user) {
      setLoading(false)
      setError(authError?.message || 'Sign up failed. Please try again.')
      return
    }

    const userId = authData.user.id

    // 2. Insert profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id:            userId,
        full_name:     fullName.trim(),
        date_of_birth: dob,
        country_code:  country,
        role:          role,
      })

    if (profileError) {
      await supabase.auth.signOut()
      setLoading(false)
      setError('Account setup failed. Please try again.')
      return
    }

    // 3. Student claim flow
    if (role === 'student') {
      const code = claimCode.trim().toUpperCase()

      const { data: codeRow, error: codeErr } = await supabase
        .from('student_claim_codes')
        .select('id, student_id, claimed, expires_at')
        .eq('code', code)
        .single()

      if (codeErr || !codeRow) {
        await supabase.auth.signOut()
        setLoading(false)
        setError('Claim code not found. Please check with your teacher.')
        return
      }

      if (codeRow.claimed) {
        await supabase.auth.signOut()
        setLoading(false)
        setError('This claim code has already been used.')
        return
      }

      if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) {
        await supabase.auth.signOut()
        setLoading(false)
        setError('This claim code has expired. Ask your teacher to regenerate it.')
        return
      }

      const { data: student } = await supabase
        .from('students')
        .select('id, class_id, admission_number')
        .eq('id', codeRow.student_id)
        .single()

      if (!student) {
        await supabase.auth.signOut()
        setLoading(false)
        setError('Student record not found. Please contact your teacher.')
        return
      }

      const { data: cls } = await supabase
        .from('classes')
        .select('school_id')
        .eq('id', student.class_id)
        .single()

      const { error: linkErr } = await supabase
        .from('students')
        .update({ profile_id: userId })
        .eq('id', student.id)

      if (linkErr) {
        await supabase.auth.signOut()
        setLoading(false)
        setError('Failed to link your account. Please try again.')
        return
      }

      await supabase
        .from('student_profiles')
        .insert({
          profile_id:   userId,
          school_id:    cls?.school_id ?? null,
          admission_no: student.admission_number ?? '',
          gender:       null,
        })

      await supabase
        .from('student_claim_codes')
        .update({ claimed: true })
        .eq('id', codeRow.id)

      if (cls?.school_id) {
        await supabase
          .from('profiles')
          .update({ school_id: cls.school_id })
          .eq('id', userId)
      }
    }

    setLoading(false)
    fadeOut(ROLE_DESTINATIONS[role])
  }

  const eyeBtn: React.CSSProperties = {
    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#C8A84B', fontSize: 14, padding: 4, lineHeight: 1,
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
          <p className={styles.sub}>{ROLE_CONTENT[role].descriptor}</p>

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
              <select id="country" className={styles.input}
                value={country} onChange={e => setCountry(e.target.value)} disabled={loading}>
                <option value="" disabled>Select country</option>
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="email">EMAIL</label>
              <input id="email" className={styles.input} type="email" autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)} disabled={loading} />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="password">PASSWORD</label>
              <div style={{ position: 'relative' }}>
                <input id="password" className={styles.input} autoComplete="new-password"
                  type={showPassword ? 'text' : 'password'}
                  style={{ paddingRight: 40 }}
                  value={password} onChange={e => setPassword(e.target.value)} disabled={loading} />
                <button type="button" style={eyeBtn} tabIndex={-1}
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="confirmPassword">CONFIRM PASSWORD</label>
              <div style={{ position: 'relative' }}>
                <input id="confirmPassword" className={styles.input} autoComplete="new-password"
                  type={showConfirm ? 'text' : 'password'}
                  style={{ paddingRight: 40 }}
                  value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} disabled={loading} />
                <button type="button" style={eyeBtn} tabIndex={-1}
                  onClick={() => setShowConfirm(v => !v)}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}>
                  {showConfirm ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {role === 'student' && (
              <div className={styles.field}>
                <label className={styles.label} htmlFor="claimCode">CLAIM CODE</label>
                <input id="claimCode" className={styles.input} type="text"
                  placeholder="Enter code from your teacher"
                  value={claimCode}
                  onChange={e => setClaimCode(e.target.value.toUpperCase())}
                  disabled={loading} />
              </div>
            )}

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