"use client";
'use client'
import { useState, useRef, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import styles from './complete-profile.module.css'

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

const ROLE_LABELS: Record<Role, string> = {
  teacher: 'Teacher',
  parent:  'Parent',
  student: 'Student',
  admin:   'Admin',
}

const ROLE_DESTINATIONS: Record<Role, string> = {
  teacher: '/teacher/onboarding/school',
  parent:  '/parent',
  student: '/student',
  admin:   '/admin',
}

function CompleteProfileInner() {
  const router     = useRouter()
  const contentRef = useRef<HTMLDivElement>(null)
  const navTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [fullName,   setFullName]   = useState('')
  const [country,    setCountry]    = useState('')
  const [role,       setRole]       = useState<Role>('teacher')
  const [claimCode,  setClaimCode]  = useState('')
  const [error,      setError]      = useState('')
  const [loading,    setLoading]    = useState(false)
  const [checking,   setChecking]   = useState(true)

  useEffect(() => {
    return () => { if (navTimer.current) clearTimeout(navTimer.current) }
  }, [])

  // Check session and whether profile already exists
  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        window.location.href = '/academy/signin'
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (profile) {
        // Profile already complete — route them normally
        const r = profile.role as Role
        window.location.href = ROLE_DESTINATIONS[r] ?? '/academy/select-role'
        return
      }

      // Pre-fill name from Google if available
      const googleName = session.user.user_metadata?.full_name ?? ''
      if (googleName) setFullName(googleName)

      setChecking(false)
    }
    check()
  }, [router])

  function fadeOut(destination: string) {
    if (!contentRef.current) return
    contentRef.current.style.transition = 'opacity 280ms ease-in'
    contentRef.current.style.opacity    = '0'
    navTimer.current = setTimeout(() => { window.location.href = destination }, 280)
  }

  async function handleSubmit() {
    setError('')
    if (!fullName.trim()) { setError('Full name is required.'); return }
    if (!country)         { setError('Country is required.'); return }
    if (role === 'student' && !claimCode.trim()) {
      setError('Claim code is required for student accounts.')
      return
    }

    setLoading(true)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setLoading(false)
      setError('Session expired. Please sign in again.')
      window.location.href = '/academy/signin'
      return
    }

    const userId = session.user.id

    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id:           userId,
        full_name:    fullName.trim(),
        country_code: country,
        role:         role,
      })

    if (profileError) {
      setLoading(false)
      setError('Failed to save profile. Please try again.')
      return
    }

    if (role === 'student') {
      const code = claimCode.trim().toUpperCase()

      const { data: codeRow, error: codeErr } = await supabase
        .from('student_claim_codes')
        .select('id, student_id, claimed, expires_at')
        .eq('code', code)
        .single()

      if (codeErr || !codeRow) {
        setLoading(false)
        setError('Claim code not found. Check with your teacher.')
        return
      }

      if (codeRow.claimed) {
        setLoading(false)
        setError('This claim code has already been used.')
        return
      }

      if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) {
        setLoading(false)
        setError('Claim code expired. Ask your teacher to regenerate it.')
        return
      }

      const { data: student } = await supabase
        .from('students')
        .select('id, class_id, admission_number')
        .eq('id', codeRow.student_id)
        .single()

      if (!student) {
        setLoading(false)
        setError('Student record not found. Contact your teacher.')
        return
      }

      const { data: cls } = await supabase
        .from('classes')
        .select('school_id')
        .eq('id', student.class_id)
        .single()

      await supabase.from('students').update({ profile_id: userId }).eq('id', student.id)

      await supabase.from('student_profiles').insert({
        profile_id:   userId,
        school_id:    cls?.school_id ?? null,
        admission_no: student.admission_number ?? '',
        gender:       null,
      })

      await supabase.from('student_claim_codes').update({ claimed: true }).eq('id', codeRow.id)

      if (cls?.school_id) {
        await supabase.from('profiles').update({ school_id: cls.school_id }).eq('id', userId)
      }
    }

    setLoading(false)
    fadeOut(ROLE_DESTINATIONS[role])
  }

  const legalStyle: React.CSSProperties = {
    marginTop: 32, fontFamily: 'monospace', fontSize: 9,
    color: 'rgba(255,255,255,0.22)', letterSpacing: '0.04em',
    textAlign: 'center', lineHeight: 1.8,
  }

  if (checking) {
    return (
      <div id="complete-profile-root" className={styles.root}>
        <div className={styles.content}>
          <p className={styles.world}>ACADEMY</p>
          <p className={styles.sub}>Checking session…</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <svg aria-hidden focusable="false" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        <defs>
          <filter id="grain-complete-profile">
            <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves={4} stitchTiles="stitch" result="noise" />
            <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise" />
            <feBlend in="SourceGraphic" in2="grayNoise" mode="overlay" />
          </filter>
        </defs>
      </svg>

      <div id="complete-profile-root" className={styles.root}>
        <div id="scan-line" aria-hidden />
        <div className={styles.content} ref={contentRef}>

          <p className={styles.world}>ACADEMY · WELCOME</p>
          <p className={styles.heading}>COMPLETE PROFILE</p>
          <p className={styles.sub}>A few details to get you started.</p>

          <div className={styles.form}>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="fullName">FULL NAME</label>
              <input id="fullName" className={styles.input} type="text" autoComplete="name"
                value={fullName} onChange={e => setFullName(e.target.value)} disabled={loading} />
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
              <label className={styles.label}>I AM A</label>
              <div className={styles.roleGrid}>
                {VALID_ROLES.map(r => (
                  <button
                    key={r}
                    type="button"
                    className={`${styles.roleBtn} ${role === r ? styles.roleBtnActive : ''}`}
                    onClick={() => setRole(r)}
                    disabled={loading}
                  >
                    {ROLE_LABELS[r]}
                  </button>
                ))}
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
              {loading ? 'SAVING…' : 'ENTER VIBESCHOOL'}
            </button>

          </div>

          <p style={legalStyle}>
            By continuing you agree to our{' '}
            <a href="#" style={{ color: 'rgba(200,168,75,0.45)', textDecoration: 'none' }}>Terms &amp; Conditions</a>
            {' '}and{' '}
            <a href="#" style={{ color: 'rgba(200,168,75,0.45)', textDecoration: 'none' }}>Privacy Policy</a>
          </p>

        </div>
      </div>
    </>
  )
}

export default function CompleteProfile() {
  return <Suspense><CompleteProfileInner /></Suspense>
}
