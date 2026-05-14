'use client'
import { useState, useRef, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import styles from './signin.module.css'

const VALID_ROLES = ['teacher', 'parent', 'admin'] as const

type Role = typeof VALID_ROLES[number]

function AcademySignInInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const rawRole = searchParams.get('role') ?? 'teacher'

  const role: Role = (VALID_ROLES as readonly string[]).includes(rawRole)
    ? (rawRole as Role)
    : 'teacher'

  const contentRef = useRef<HTMLDivElement>(null)
  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    return () => {
      if (navTimer.current) clearTimeout(navTimer.current)
    }
  }, [])

  function fadeOut(destination: string) {
    if (!contentRef.current) return

    contentRef.current.style.transition = 'opacity 280ms ease-in'
    contentRef.current.style.opacity = '0'

    navTimer.current = setTimeout(() => {
      router.push(destination)
    }, 280)
  }

  async function handleSubmit() {
    setError('')

    if (!email.trim() || !password) {
      setError('Email and password are required.')
      return
    }

    setLoading(true)

    const { error: authError } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

    setLoading(false)

    if (authError) {
      setError(authError.message)
      return
    }

    fadeOut(
      role === 'teacher'
        ? '/academy/dashboard'
        : `/${role}`
    )
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  const eyeBtn: React.CSSProperties = {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#C8A84B',
    fontSize: 14,
    padding: 4,
    lineHeight: 1,
  }

  return (
    <>
      <svg
        aria-hidden
        focusable="false"
        style={{
          position: 'absolute',
          width: 0,
          height: 0,
          overflow: 'hidden',
        }}
      >
        <defs>
          <filter id="grain-academy-signin">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.68"
              numOctaves={4}
              stitchTiles="stitch"
              result="noise"
            />

            <feColorMatrix
              type="saturate"
              values="0"
              in="noise"
              result="grayNoise"
            />

            <feBlend
              in="SourceGraphic"
              in2="grayNoise"
              mode="overlay"
            />
          </filter>
        </defs>
      </svg>

      <div id="academy-signin-root" className={styles.root}>
        <div id="scan-line" aria-hidden />

        <div className={styles.content} ref={contentRef}>
          <button
            className={styles.back}
            onClick={() => fadeOut('/academy/select-role')}
            aria-label="Back to role select"
          >
            ←
          </button>

          <p className={styles.world}>
            ACADEMY · {role.toUpperCase()}
          </p>

          <p className={styles.heading}>SIGN IN</p>

          <p className={styles.sub}>
            For schools, teachers and institutions.
          </p>

          <div className={styles.form}>
            <div className={styles.field}>
              <label
                className={styles.label}
                htmlFor="email"
              >
                EMAIL
              </label>

              <input
                id="email"
                className={styles.input}
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
              />
            </div>

            <div className={styles.field}>
              <label
                className={styles.label}
                htmlFor="password"
              >
                PASSWORD
              </label>

              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  className={styles.input}
                  autoComplete="current-password"
                  type={showPassword ? 'text' : 'password'}
                  style={{ paddingRight: 40 }}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                />

                <button
                  type="button"
                  style={eyeBtn}
                  tabIndex={-1}
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={
                    showPassword
                      ? 'Hide password'
                      : 'Show password'
                  }
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}

            <button
              className={styles.submit}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? 'SIGNING IN…' : 'SIGN IN'}
            </button>
          </div>

          <p className={styles.switch}>
            No account?{' '}
            <span
              className={styles.switchLink}
              role="button"
              tabIndex={0}
              onClick={() =>
                fadeOut(`/academy/signup?role=${role}`)
              }
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  fadeOut(`/academy/signup?role=${role}`)
                }
              }}
            >
              Create account
            </span>
          </p>
        </div>
      </div>
    </>
  )
}

export default function AcademySignIn() {
  return (
    <Suspense>
      <AcademySignInInner />
    </Suspense>
  )
}