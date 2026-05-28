'use client'
import { useState, useRef, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import styles from './signin.module.css'

const VALID_ROLES = ['teacher', 'parent', 'student', 'admin'] as const
type Role = typeof VALID_ROLES[number]

function AcademySignInInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawRole = searchParams.get('role') ?? 'teacher'
  const role: Role = (VALID_ROLES as readonly string[]).includes(rawRole)
    ? (rawRole as Role)
    : 'teacher'

  const contentRef = useRef<HTMLDivElement>(null)
  const navTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error,        setError]        = useState('')
  const [loading,      setLoading]      = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  useEffect(() => {
    return () => { if (navTimer.current) clearTimeout(navTimer.current) }
  }, [])

  function fadeOut(destination: string) {
    if (!contentRef.current) return
    contentRef.current.style.transition = 'opacity 280ms ease-in'
    contentRef.current.style.opacity    = '0'
    navTimer.current = setTimeout(() => { window.location.href = destination }, 280)
  }

  async function routeByProfile(userId: string) {
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    if (profileErr || !profile) {
      setError('Could not load your profile. Please try again.')
      setLoading(false)
      return
    }

    const actualRole = (profile.role as Role) ?? role
    const destinations: Record<Role, string> = {
      teacher: '/teacher',
      parent:  '/parent',
      student: '/student',
      admin:   '/admin',
    }
    fadeOut(destinations[actualRole] ?? `/${actualRole}`)
  }

  async function handleSubmit() {
    setError('')
    if (!email.trim() || !password) {
      setError('Email and password are required.')
      return
    }
    setLoading(true)

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({ email: email.trim(), password })

    if (authError || !authData.user) {
      setLoading(false)
      setError(authError?.message || 'Sign in failed. Please try again.')
      return
    }

    await routeByProfile(authData.user.id)
    setLoading(false)
  }

  async function handleGoogle() {
    setError('')
    setGoogleLoading(true)

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?role=${role}`,
      },
    })

    if (oauthError) {
      setGoogleLoading(false)
      setError(oauthError.message || 'Google sign in failed.')
    }
    // Supabase redirects — no further action needed here
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); handleSubmit() }
  }

  const eyeBtn: React.CSSProperties = {
    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#C8A84B', fontSize: 14, padding: 4, lineHeight: 1,
  }

  const dividerStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 12,
    margin: '4px 0',
  }

  const dividerLine: React.CSSProperties = {
    flex: 1, height: 1,
    background: 'rgba(196,149,48,0.15)',
  }

  const dividerText: React.CSSProperties = {
    fontFamily: 'monospace', fontSize: 9,
    color: 'rgba(255,255,255,0.22)',
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
  }

  const googleBtn: React.CSSProperties = {
    width: '100%',
    background: '#0A0A1E',
    border: '1px solid rgba(196,149,48,0.28)',
    borderRadius: 6,
    padding: '12px 0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    cursor: googleLoading ? 'not-allowed' : 'pointer',
    opacity: googleLoading ? 0.5 : 1,
    transition: 'border-color 180ms ease-out',
  }

  const googleLabel: React.CSSProperties = {
    fontFamily: 'monospace',
    fontSize: 11,
    color: 'rgba(255,255,255,0.72)',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  }

  const legalStyle: React.CSSProperties = {
    marginTop: 32,
    fontFamily: 'monospace',
    fontSize: 9,
    color: 'rgba(255,255,255,0.22)',
    letterSpacing: '0.04em',
    textAlign: 'center',
    lineHeight: 1.8,
  }

  return (
    <>
      <svg aria-hidden focusable="false" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        <defs>
          <filter id="grain-academy-signin">
            <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves={4} stitchTiles="stitch" result="noise" />
            <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise" />
            <feBlend in="SourceGraphic" in2="grayNoise" mode="overlay" />
          </filter>
        </defs>
      </svg>

      <div id="academy-signin-root" className={styles.root}>
        <div id="scan-line" aria-hidden />
        <div className={styles.content} ref={contentRef}>

          <button className={styles.back} onClick={() => fadeOut('/academy/select-role')} aria-label="Back to role select">←</button>

          <p className={styles.world}>ACADEMY · {role.toUpperCase()}</p>
          <p className={styles.heading}>SIGN IN</p>
          <p className={styles.sub}>For schools, teachers and institutions.</p>

          <div className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="email">EMAIL</label>
              <input id="email" className={styles.input} type="email" autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={handleKeyDown} disabled={loading} />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="password">PASSWORD</label>
              <div style={{ position: 'relative' }}>
                <input id="password" className={styles.input} autoComplete="current-password"
                  type={showPassword ? 'text' : 'password'}
                  style={{ paddingRight: 40 }}
                  value={password} onChange={e => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown} disabled={loading} />
                <button type="button" style={eyeBtn} tabIndex={-1}
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {error && <p className={styles.error} role="alert">{error}</p>}

            <button className={styles.submit} onClick={handleSubmit} disabled={loading}>
              {loading ? 'SIGNING IN…' : 'SIGN IN'}
            </button>

            <div style={dividerStyle} aria-hidden>
              <div style={dividerLine} />
              <span style={dividerText}>or</span>
              <div style={dividerLine} />
            </div>

            <button
              type="button"
              style={googleBtn}
              onClick={handleGoogle}
              disabled={googleLoading}
              aria-label="Continue with Google"
              onMouseEnter={e => { if (!googleLoading) (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(196,149,48,0.62)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(196,149,48,0.28)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span style={googleLabel}>
                {googleLoading ? 'Redirecting…' : 'Continue with Google'}
              </span>
            </button>
          </div>

          <p className={styles.switch}>
            No account?{' '}
            <span className={styles.switchLink} role="button" tabIndex={0}
              onClick={() => fadeOut(`/academy/signup?role=${role}`)}
              onKeyDown={e => { if (e.key === 'Enter') fadeOut(`/academy/signup?role=${role}`) }}>
              Create account
            </span>
          </p>

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

export default function AcademySignIn() {
  return <Suspense><AcademySignInInner /></Suspense>
}
