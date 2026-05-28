'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { JetBrains_Mono } from 'next/font/google'
import { supabase } from '@/lib/supabase'

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
})

// ── Types ────────────────────────────────────────────────────────────────────

const ROLES = ['Teacher', 'Parent', 'Student', 'Admin'] as const
type Role = typeof ROLES[number]
type DbRole = 'teacher' | 'parent' | 'student' | 'admin'

const ROLE_DB: Record<Role, DbRole> = {
  Teacher: 'teacher',
  Parent:  'parent',
  Student: 'student',
  Admin:   'admin',
}

const ALLOWED_ROLES = new Set<DbRole>(['teacher', 'parent', 'student', 'admin'])

const DASHBOARD: Record<DbRole, string> = {
  teacher: '/teacher',
  parent:  '/parent',
  student: '/student',
  admin:   '/admin',
}

function isDbRole(r: unknown): r is DbRole {
  return typeof r === 'string' && ALLOWED_ROLES.has(r as DbRole)
}

// ── Auth errors ──────────────────────────────────────────────────────────────

const SAFE_AUTH_ERRORS: Record<string, string> = {
  'Invalid login credentials': 'Incorrect email or password.',
  'Email not confirmed':       'Please confirm your email before signing in.',
  'User not found':            'No account found with that email.',
  'Too many requests':         'Too many attempts. Please wait and try again.',
}

function friendlyAuthError(msg: string): string {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'No internet connection. Check your network.'
  }
  for (const [key, friendly] of Object.entries(SAFE_AUTH_ERRORS)) {
    if (msg.includes(key)) return friendly
  }
  return 'Sign in failed. Please try again.'
}

// ── Styles ───────────────────────────────────────────────────────────────────

const S = {
  root: {
    minHeight: '100dvh',
    background: '#0d0d1f',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 20px',
  },
  wordmark: {
    fontSize: 32,
    fontWeight: 800,
    color: '#fff',
    letterSpacing: -1,
    marginBottom: 4,
    fontFamily: 'sans-serif',
  },
  gold: { color: '#C8A84B' },
  tagline: {
    fontSize: 10,
    letterSpacing: '0.3em',
    color: 'rgba(255,255,255,0.3)',
    marginBottom: 32,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(200,168,75,0.15)',
    borderRadius: 16,
    padding: '28px 24px',
  },
  tabs: {
    display: 'flex',
    background: 'rgba(0,0,0,0.3)',
    borderRadius: 10,
    padding: 4,
    marginBottom: 24,
    gap: 4,
  },
  tabNote: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.25)',
    marginBottom: 10,
    letterSpacing: '0.1em',
  },
  label: {
    fontSize: 9,
    letterSpacing: '0.2em',
    color: 'rgba(255,255,255,0.35)',
    marginBottom: 10,
    display: 'block',
  },
  roleRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 8,
    marginBottom: 20,
  },
  inputBase: {
    width: '100%',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(200,168,75,0.2)',
    borderRadius: 8,
    padding: '13px 14px',
    color: '#fff',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box' as const,
    marginBottom: 14,
  },
  pwWrap: { position: 'relative' as const },
  eye: {
    position: 'absolute' as const,
    right: 14,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    color: '#C8A84B',
    cursor: 'pointer',
    padding: 4,
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
  },
  forgotRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginBottom: 16,
  },
  forgot: {
    fontSize: 10,
    color: '#C8A84B',
    letterSpacing: '0.1em',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    textDecoration: 'underline' as const,
  },
  primaryBtn: {
    width: '100%',
    padding: '14px 0',
    borderRadius: 8,
    border: 'none',
    background: '#C8A84B',
    color: '#0d0d1f',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    letterSpacing: '0.08em',
    marginBottom: 16,
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  divLine: {
    flex: 1,
    height: 1,
    background: 'rgba(255,255,255,0.08)',
  },
  divText: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.25)',
    letterSpacing: '0.2em',
  },
  googleBtn: {
    width: '100%',
    padding: '13px 0',
    borderRadius: 8,
    border: '1px solid rgba(200,168,75,0.25)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.1em',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  error: {
    color: '#f87171',
    fontSize: 12,
    marginBottom: 12,
    textAlign: 'center' as const,
  },
  loader: {
    minHeight: '100dvh',
    background: '#0d0d1f',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loaderText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    letterSpacing: '0.2em',
  },
  trapped: {
    color: '#f87171',
    fontSize: 13,
    textAlign: 'center' as const,
    lineHeight: 1.7,
  },
  signupNote: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center' as const,
    marginBottom: 20,
    lineHeight: 1.6,
  },
}

function busyStyle(base: React.CSSProperties): React.CSSProperties {
  return { ...base, opacity: 0.5, cursor: 'not-allowed' }
}

// ── Icons ────────────────────────────────────────────────────────────────────

function EyeOpenIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

// ── Component ────────────────────────────────────────────────────────────────

export default function RootPage() {
  const router = useRouter()

  const [initialising, setInitialising] = useState(true)
  const [trappedRole,  setTrappedRole]  = useState(false)
  const [authMode,     setAuthMode]     = useState<'signin' | 'signup'>('signin')
  const [role,         setRole]         = useState<Role>('Teacher')
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [showPw,       setShowPw]       = useState(false)
  const [error,        setError]        = useState('')
  const [loading,      setLoading]      = useState(false)
  const [gLoading,     setGLoading]     = useState(false)

  const passwordRef  = useRef<HTMLInputElement>(null)
  const inflightRef  = useRef(false)
  const gInflightRef = useRef(false)

  const isBusy = loading || gLoading

  // ── Session check ──────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!alive) return
      if (!user) { setInitialising(false); return }

      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!alive) return

      if (profileErr) {
        console.error('[auth] profile fetch:', profileErr)
        setInitialising(false)
        return
      }

      if (isDbRole(profile?.role)) {
        router.replace(DASHBOARD[profile.role])
        return
      }

      if (profile?.role) setTrappedRole(true)
      setInitialising(false)
    }
    check()
    return () => { alive = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Early returns ──────────────────────────────────────────────────────────
  if (initialising) {
    return (
      <div style={S.loader} className={jetbrainsMono.className}>
        <style>{`@keyframes pulse{0%,100%{opacity:.25}50%{opacity:.9}}`}</style>
        <span style={{ ...S.loaderText, animation: 'pulse 1.6s ease-in-out infinite' }}>
          LOADING…
        </span>
      </div>
    )
  }

  if (trappedRole) {
    return (
      <div style={S.loader} className={jetbrainsMono.className}>
        <p style={S.trapped}>
          Your account role is not recognised.<br />
          Please contact support.
        </p>
      </div>
    )
  }

  // ── Style helpers (depend on isBusy) ───────────────────────────────────────
  function tabStyle(active: boolean): React.CSSProperties {
    return {
      flex: 1,
      padding: '10px 0',
      borderRadius: 8,
      border: 'none',
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: '0.12em',
      cursor: 'pointer',
      background: active ? '#C8A84B' : 'transparent',
      color: active ? '#0d0d1f' : 'rgba(255,255,255,0.4)',
      transition: 'all 0.18s ease',
    }
  }

  function pillStyle(active: boolean): React.CSSProperties {
    return {
      padding: '8px 16px',
      borderRadius: 20,
      border: '1px solid',
      borderColor: active ? '#C8A84B' : 'rgba(255,255,255,0.15)',
      background: active ? 'rgba(200,168,75,0.12)' : 'transparent',
      color: active ? '#C8A84B' : 'rgba(255,255,255,0.5)',
      fontSize: 13,
      fontWeight: 600,
      cursor: isBusy ? 'not-allowed' : 'pointer',
      transition: 'all 0.15s ease',
      opacity: isBusy ? 0.5 : 1,
    }
  }

  // ── Keyboard navigation ────────────────────────────────────────────────────
  function handleTabKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowRight') { e.preventDefault(); switchMode('signup') }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); switchMode('signin') }
  }

  function handleRoleKey(e: React.KeyboardEvent, idx: number) {
    if (isBusy) return
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      setRole(ROLES[(idx + 1) % ROLES.length])
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      setRole(ROLES[(idx - 1 + ROLES.length) % ROLES.length])
    }
  }

  // ── Handlers ───────────────────────────────────────────────────────────────
  function switchMode(m: 'signin' | 'signup') {
    setAuthMode(m)
    setError('')
  }

  async function handleSignIn() {
    if (inflightRef.current) return
    setError('')
    if (!email.trim()) { setError('Email is required.');    return }
    if (!password)     { setError('Password is required.'); return }

    // Grab and clear password immediately — never hold it in state
    const pw = password
    setPassword('')

    inflightRef.current = true
    setLoading(true)
    let navigated = false

    try {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pw,
      })
      if (authErr || !data.user) {
        setError(friendlyAuthError(authErr?.message ?? ''))
        return
      }

      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single()

      if (profileErr || !profile) {
        console.error('[auth] profile fetch:', profileErr)
        setError('Could not load your profile. Please try again.')
        return
      }

      if (!isDbRole(profile.role)) {
        setError('Unknown account role. Please contact support.')
        return
      }

      navigated = true
      router.replace(DASHBOARD[profile.role])
    } finally {
      inflightRef.current = false
      if (!navigated) setLoading(false)
    }
  }

  async function handleGoogle() {
    if (gInflightRef.current) return
    setError('')

    const safeRole = ROLE_DB[role]

    gInflightRef.current = true
    setGLoading(true)

    // IMPORTANT: /academy/complete-profile MUST validate role server-side.
    // This URL param is a hint only — never trust it to write DB roles directly.
    const redirectTo =
      window.location.origin +
      '/academy/complete-profile' +
      '?intent=' + authMode +
      '&role='   + encodeURIComponent(safeRole)

    const { error: oauthErr } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })

    if (oauthErr) {
      setError(oauthErr.message || 'Google sign in failed.')
      setGLoading(false)
      gInflightRef.current = false
      return
    }

    // Reset if popup blocked or user cancels — auth state change fires on success
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        setGLoading(false)
        gInflightRef.current = false
        subscription.unsubscribe()
      }
    })

    // Hard fallback in case listener never fires
    setTimeout(() => {
      if (gInflightRef.current) {
        setGLoading(false)
        gInflightRef.current = false
        subscription.unsubscribe()
      }
    }, 10000)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={S.root} className={jetbrainsMono.className}>
      <div style={S.wordmark}>
        Vibe<span style={S.gold}>School</span>
      </div>
      <p style={S.tagline}>FREEDOM · LEARN · EXPLORE</p>

      <div style={S.card}>

        {/* ── Tabs ── */}
        <div
          style={S.tabs}
          role="tablist"
          aria-label="Authentication mode"
          onKeyDown={handleTabKey}
        >
          <button
            id="tab-signin"
            role="tab"
            aria-selected={authMode === 'signin'}
            aria-controls="panel-signin"
            tabIndex={authMode === 'signin' ? 0 : -1}
            style={tabStyle(authMode === 'signin')}
            onClick={() => switchMode('signin')}
          >
            SIGN IN
          </button>
          <button
            id="tab-signup"
            role="tab"
            aria-selected={authMode === 'signup'}
            aria-controls="panel-signup"
            tabIndex={authMode === 'signup' ? 0 : -1}
            style={tabStyle(authMode === 'signup')}
            onClick={() => switchMode('signup')}
          >
            SIGN UP
          </button>
        </div>

        {authMode === 'signin' && (
          <p style={S.tabNote}>
            Role selector applies to sign-up. Sign in works across all roles.
          </p>
        )}

        {/* ── Role pills ── */}
        <div role="radiogroup" aria-label="Select your role" style={S.roleRow}>
          {ROLES.map((r, idx) => (
            <button
              key={r}
              role="radio"
              aria-checked={role === r}
              tabIndex={role === r ? 0 : -1}
              style={pillStyle(role === r)}
              onClick={() => !isBusy && setRole(r)}
              onKeyDown={e => handleRoleKey(e, idx)}
            >
              {r}
            </button>
          ))}
        </div>

        {/* ── Error ── */}
        {error && (
          <p style={S.error} role="alert" aria-live="polite">
            {error}
          </p>
        )}

        {/* ── Sign in panel ── */}
        <div
          id="panel-signin"
          role="tabpanel"
          aria-labelledby="tab-signin"
          hidden={authMode !== 'signin'}
        >
          <label htmlFor="signin-email" style={S.label}>EMAIL</label>
          <input
            id="signin-email"
            name="email"
            style={S.inputBase}
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); passwordRef.current?.focus() }
            }}
            disabled={isBusy}
          />

          <label htmlFor="signin-password" style={S.label}>PASSWORD</label>
          <div style={S.pwWrap}>
            <input
              id="signin-password"
              name="password"
              ref={passwordRef}
              style={{ ...S.inputBase, paddingRight: 44 }}
              type={showPw ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); handleSignIn() }
              }}
              disabled={isBusy}
            />
            <button
              style={S.eye}
              type="button"
              aria-label={showPw ? 'Hide password' : 'Show password'}
              onClick={() => setShowPw(v => !v)}
            >
              {showPw ? <EyeOffIcon /> : <EyeOpenIcon />}
            </button>
          </div>

          <div style={S.forgotRow}>
            <a
              href={`/academy/forgot-password${email.trim() ? `?email=${encodeURIComponent(email.trim())}` : ''}`}
              style={S.forgot}
            >
              FORGOT PASSWORD?
            </a>
          </div>

          <button
            style={isBusy ? busyStyle(S.primaryBtn) : S.primaryBtn}
            type="button"
            aria-busy={loading}
            disabled={isBusy}
            onClick={handleSignIn}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>

          <div style={S.divider}>
            <div style={S.divLine} />
            <span style={S.divText}>OR</span>
            <div style={S.divLine} />
          </div>

          <button
            style={isBusy ? busyStyle(S.googleBtn) : S.googleBtn}
            type="button"
            aria-busy={gLoading}
            disabled={isBusy}
            onClick={handleGoogle}
          >
            <GoogleIcon />
            {gLoading ? 'CONNECTING…' : 'CONTINUE WITH GOOGLE'}
          </button>
        </div>

        {/* ── Sign up panel ── */}
        <div
          id="panel-signup"
          role="tabpanel"
          aria-labelledby="tab-signup"
          hidden={authMode !== 'signup'}
        >
          <p style={S.signupNote}>
            You'll be taken to the {role} sign-up page to complete your account.
          </p>

          <button
            style={isBusy ? busyStyle(S.primaryBtn) : S.primaryBtn}
            type="button"
            disabled={isBusy}
            onClick={() => router.push(`/academy/signup?role=${ROLE_DB[role]}`)}
          >
            Create {role} Account →
          </button>

          <div style={S.divider}>
            <div style={S.divLine} />
            <span style={S.divText}>OR</span>
            <div style={S.divLine} />
          </div>

          <button
            style={isBusy ? busyStyle(S.googleBtn) : S.googleBtn}
            type="button"
            aria-busy={gLoading}
            disabled={isBusy}
            onClick={handleGoogle}
          >
            <GoogleIcon />
            {gLoading ? 'CONNECTING…' : 'CONTINUE WITH GOOGLE'}
          </button>
        </div>

      </div>
    </div>
  )
}
