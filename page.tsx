'use client'
import { useState, useRef, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ─── constants ───────────────────────────────────────────────────────────────

const ROLES = [
  { key: 'teacher', label: 'Teacher', existingDest: '/teacher' },
  { key: 'parent',  label: 'Parent',  existingDest: '/parent'  },
  { key: 'student', label: 'Student', existingDest: '/student' },
  { key: 'admin',   label: 'Admin',   existingDest: '/admin'   },
] as const
type Role = typeof ROLES[number]['key']

// CSS is defined outside the component so it is not re-injected on every render
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #060612;
    font-family: 'Sora', sans-serif;
    min-height: 100dvh;
    overflow-x: hidden;
  }

  .orb {
    position: fixed;
    border-radius: 50%;
    filter: blur(60px);
    pointer-events: none;
  }
  .orb-1 {
    width: 520px; height: 520px;
    background: radial-gradient(circle, rgba(120,60,220,0.18) 0%, transparent 70%);
    top: -160px; left: -160px;
    animation: drift1 18s ease-in-out infinite alternate;
  }
  .orb-2 {
    width: 400px; height: 400px;
    background: radial-gradient(circle, rgba(200,148,48,0.12) 0%, transparent 70%);
    bottom: -100px; right: -100px;
    animation: drift2 22s ease-in-out infinite alternate;
  }
  .orb-3 {
    width: 280px; height: 280px;
    background: radial-gradient(circle, rgba(30,180,140,0.10) 0%, transparent 70%);
    top: 40%; left: 60%;
    animation: drift3 26s ease-in-out infinite alternate;
  }
  @keyframes drift1 { from { transform: translate(0,0) } to { transform: translate(60px,40px) } }
  @keyframes drift2 { from { transform: translate(0,0) } to { transform: translate(-40px,-50px) } }
  @keyframes drift3 { from { transform: translate(0,0) } to { transform: translate(-30px,40px) } }

  .entry-root {
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px 16px;
    position: relative;
  }
  .entry-wrap {
    width: 100%;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    opacity: 0;
    transform: translateY(16px);
    animation: appear 480ms cubic-bezier(0.22,1,0.36,1) forwards;
    animation-delay: 80ms;
  }
  @keyframes appear { to { opacity: 1; transform: translateY(0); } }

  .wordmark { text-align: center; margin-bottom: 36px; }
  .wordmark-logo {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  .wordmark-name {
    font-family: 'Sora', sans-serif;
    font-size: 26px; font-weight: 600;
    letter-spacing: -0.02em; color: #fff;
  }
  .wordmark-name span {
    background: linear-gradient(135deg, #C8941E 0%, #F0C040 50%, #C8941E 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .wordmark-tag {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px; letter-spacing: 0.32em;
    color: rgba(255,255,255,0.28); text-transform: uppercase;
  }

  .card {
    background: rgba(255,255,255,0.030);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 20px;
    padding: 32px 28px 28px;
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    box-shadow:
      0 0 0 1px rgba(200,148,48,0.06),
      0 24px 64px rgba(0,0,0,0.5),
      inset 0 1px 0 rgba(255,255,255,0.05);
  }

  .tabs {
    display: flex;
    background: rgba(255,255,255,0.04);
    border-radius: 10px; padding: 3px;
    margin-bottom: 28px; position: relative;
  }
  .tab {
    flex: 1; padding: 9px; text-align: center;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px; font-weight: 500;
    letter-spacing: 0.12em; text-transform: uppercase;
    color: rgba(255,255,255,0.35);
    cursor: pointer; border-radius: 8px;
    border: none; background: none;
    transition: color 180ms ease;
    position: relative; z-index: 1;
  }
  .tab.active { color: #fff; }
  .tab-slider {
    position: absolute;
    top: 3px; bottom: 3px;
    width: calc(50% - 3px);
    background: rgba(255,255,255,0.08);
    border-radius: 7px;
    transition: left 220ms cubic-bezier(0.4,0,0.2,1);
    pointer-events: none;
  }
  .tab-slider.right { left: calc(50%); }
  .tab-slider.left  { left: 3px; }

  .role-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px; letter-spacing: 0.22em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.28); margin-bottom: 10px;
  }
  .pills {
    display: flex; gap: 6px;
    margin-bottom: 24px; flex-wrap: wrap;
  }
  .pill {
    padding: 6px 14px; border-radius: 99px;
    font-family: 'Sora', sans-serif;
    font-size: 12px; font-weight: 500;
    cursor: pointer;
    border: 1px solid rgba(255,255,255,0.10);
    background: transparent;
    color: rgba(255,255,255,0.40);
    transition: all 180ms ease; white-space: nowrap;
  }
  .pill:hover {
    border-color: rgba(200,148,48,0.35);
    color: rgba(255,255,255,0.70);
  }
  .pill[aria-checked="true"] {
    background: rgba(200,148,48,0.15);
    border-color: rgba(200,148,48,0.55);
    color: #F0C040;
  }
  .pill:focus-visible {
    outline: 2px solid rgba(200,148,48,0.7);
    outline-offset: 2px;
  }

  .fields {
    display: flex; flex-direction: column;
    gap: 14px; margin-bottom: 20px;
  }
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px; letter-spacing: 0.22em;
    text-transform: uppercase; color: rgba(255,255,255,0.28);
  }
  .field-input {
    width: 100%;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px; padding: 12px 14px;
    font-family: 'Sora', sans-serif;
    font-size: 14px; color: #fff; outline: none;
    transition: border-color 160ms ease, background 160ms ease;
    -webkit-appearance: none;
  }
  .field-input::placeholder { color: rgba(255,255,255,0.18); }
  .field-input:focus {
    border-color: rgba(200,148,48,0.45);
    background: rgba(255,255,255,0.06);
  }
  .field-input.is-busy {
    opacity: 0.45;
    pointer-events: none;
  }
  .pw-wrap { position: relative; }
  .pw-wrap .field-input { padding-right: 42px; }
  .pw-eye {
    position: absolute; right: 12px; top: 50%;
    transform: translateY(-50%);
    background: none; border: none;
    cursor: pointer;
    color: rgba(200,148,48,0.6);
    padding: 4px; line-height: 1;
    transition: color 140ms;
    display: flex; align-items: center;
  }
  .pw-eye:hover { color: #F0C040; }

  .msg-error, .msg-info {
    font-family: 'Sora', sans-serif;
    font-size: 12px; margin-bottom: 14px;
    padding: 10px 12px; border-radius: 8px;
    line-height: 1.5; min-height: 0;
    transition: opacity 160ms ease;
  }
  .msg-error {
    color: #FF6B6B;
    background: rgba(255,107,107,0.08);
    border: 1px solid rgba(255,107,107,0.18);
  }
  .msg-info {
    color: #5EE8A0;
    background: rgba(94,232,160,0.07);
    border: 1px solid rgba(94,232,160,0.18);
  }
  .msg-error:empty, .msg-info:empty {
    padding: 0; border: none; background: none; margin-bottom: 0;
  }

  .btn-primary {
    width: 100%; padding: 14px; border-radius: 12px;
    border: none;
    background: linear-gradient(135deg, #C8941E 0%, #F0C040 100%);
    color: #0A0A0A;
    font-family: 'Sora', sans-serif;
    font-size: 13px; font-weight: 600;
    letter-spacing: 0.04em; cursor: pointer;
    transition: opacity 160ms ease, transform 120ms ease;
    margin-bottom: 14px;
  }
  .btn-primary:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
  .btn-primary:active:not(:disabled) { transform: translateY(0); }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

  .forgot-link {
    display: block; text-align: right;
    margin-top: -8px; margin-bottom: 20px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px; letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(200,148,48,0.55);
    background: none; border: none;
    cursor: pointer; padding: 0;
    transition: color 140ms;
  }
  .forgot-link:hover { color: #F0C040; }
  .forgot-link:disabled { opacity: 0.35; cursor: not-allowed; }

  .divider {
    display: flex; align-items: center;
    gap: 10px; margin-bottom: 14px;
  }
  .divider-line { flex: 1; height: 1px; background: rgba(255,255,255,0.07); }
  .divider-text {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px; color: rgba(255,255,255,0.20);
    letter-spacing: 0.18em; text-transform: uppercase;
  }

  .btn-google {
    width: 100%; padding: 12px; border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.09);
    background: rgba(255,255,255,0.03);
    display: flex; align-items: center;
    justify-content: center; gap: 10px;
    cursor: pointer;
    transition: border-color 160ms ease, background 160ms ease;
  }
  .btn-google:hover:not(:disabled) {
    border-color: rgba(200,148,48,0.35);
    background: rgba(255,255,255,0.05);
  }
  .btn-google:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-google-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px; letter-spacing: 0.12em;
    text-transform: uppercase; color: rgba(255,255,255,0.60);
  }

  .spinner {
    width: 12px; height: 12px;
    border: 2px solid rgba(255,255,255,0.15);
    border-top-color: rgba(200,148,48,0.8);
    border-radius: 50%;
    animation: spin 600ms linear infinite;
    flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .tagline {
    text-align: center; margin-top: 28px;
    display: flex; justify-content: center; gap: 18px;
  }
  .tagline span {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px; letter-spacing: 0.24em;
    text-transform: uppercase; color: rgba(255,255,255,0.16);
  }
  .tagline span:nth-child(2) { color: rgba(200,148,48,0.28); }

  .field-enter {
    animation: fieldIn 220ms cubic-bezier(0.22,1,0.36,1) forwards;
  }
  @keyframes fieldIn {
    from { opacity: 0; transform: translateY(-8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`

// ─── helpers ─────────────────────────────────────────────────────────────────

function EyeOpen() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}
function EyeClosed() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

// Map raw Supabase/network error messages to user-friendly strings.
// Never surface internal constraint names or DB messages directly.
function friendlyError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e)
  const lower = raw.toLowerCase()
  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials'))
    return 'Incorrect email or password.'
  if (lower.includes('email not confirmed'))
    return 'Please confirm your email before signing in.'
  if (lower.includes('user already registered') || lower.includes('already been registered'))
    return 'An account with this email already exists. Try signing in.'
  if (lower.includes('password') && lower.includes('characters'))
    return 'Password must be at least 8 characters.'
  if (lower.includes('network') || lower.includes('fetch'))
    return 'Network error. Check your connection and try again.'
  if (lower.includes('rate limit') || lower.includes('too many'))
    return 'Too many attempts. Please wait a moment and try again.'
  // fallback — do not expose raw DB messages
  return 'Something went wrong. Please try again.'
}

// ─── component ───────────────────────────────────────────────────────────────

function EntryInner() {
  const router     = useRouter()
  const wrapRef    = useRef<HTMLDivElement>(null)
  const navTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navigating = useRef(false)
  const mounted    = useRef(true)          // unmount guard
  const emailRef   = useRef<HTMLInputElement>(null)
  // refs array for pill focus management
  const pillRefs   = useRef<(HTMLButtonElement | null)[]>([])

  const [mode,       setMode]       = useState<'in' | 'up'>('in')
  const [role,       setRole]       = useState<Role>('teacher')
  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [fullName,   setFullName]   = useState('')
  const [claimCode,  setClaimCode]  = useState('')
  const [showPw,     setShowPw]     = useState(false)
  const [error,      setError]      = useState('')
  const [info,       setInfo]       = useState('')
  const [busy,       setBusy]       = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)

  const anyBusy = busy || googleBusy

  useEffect(() => {
    mounted.current = true
    // Only auto-focus on non-touch devices to avoid triggering mobile keyboard
    if (typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches) {
      emailRef.current?.focus()
    }
    return () => {
      mounted.current = false
      if (navTimer.current) clearTimeout(navTimer.current)
    }
  }, [])

  // Clear error on mode/role change.
  // Clear info only on mode change (not role — info is about email confirmation, unrelated to role).
  useEffect(() => { setError('') }, [mode, role])
  useEffect(() => { setInfo('') }, [mode])

  // ── navigation ────────────────────────────────────────────────────────────
  function fadeOut(dest: string) {
    if (navigating.current) return
    navigating.current = true
    if (!wrapRef.current) { router.push(dest); return }
    wrapRef.current.style.transition = 'opacity 260ms ease'
    wrapRef.current.style.opacity    = '0'
    navTimer.current = setTimeout(() => router.push(dest), 260)
  }

  // ── Google OAuth ──────────────────────────────────────────────────────────
  // Redirect to /auth/callback which checks profile existence server-side and
  // routes accordingly — never trust the role param as authorization.
  async function handleGoogle() {
    if (anyBusy) return
    setError('')
    setGoogleBusy(true)
    try {
      const { error: e } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // /auth/callback fetches the profile and decides the destination.
          // role is a hint only — the callback must validate it server-side.
          redirectTo: `${window.location.origin}/auth/callback?role_hint=${role}`,
        },
      })
      if (e) throw e
      // OAuth redirects away; no further state updates needed
    } catch (e: unknown) {
      if (!mounted.current) return
      setGoogleBusy(false)
      setError(friendlyError(e))
    }
  }

  // ── Email sign-in ─────────────────────────────────────────────────────────
  async function handleSignIn() {
    if (anyBusy) return
    setError('')
    if (!email.trim() || !password) { setError('Email and password are required.'); return }
    setBusy(true)
    try {
      const { data, error: e } = await supabase.auth.signInWithPassword({
        email: email.trim(), password,
      })
      if (e || !data.user) throw e ?? new Error('Sign in failed.')

      // Use maybeSingle — profile may not exist yet for OAuth users who
      // haven't completed onboarding
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', data.user.id).maybeSingle()

      if (!mounted.current) return
      setPassword('')

      if (!profile?.role) {
        // Profile missing — send to onboarding regardless of role pill selection
        fadeOut('/academy/complete-profile')
        return
      }

      const match = ROLES.find(r => r.key === profile.role)
      fadeOut(match ? match.existingDest : '/academy/complete-profile')
    } catch (e: unknown) {
      if (!mounted.current) return
      setError(friendlyError(e))
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  // ── Email sign-up ─────────────────────────────────────────────────────────
  async function handleSignUp() {
    if (anyBusy) return
    setError('')
    if (!fullName.trim())    { setError('Full name is required.');                   return }
    if (!email.trim())       { setError('Email is required.');                       return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (role === 'student' && !claimCode.trim()) {
      setError('Claim code is required for student accounts.'); return
    }
    setBusy(true)

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(), password,
      })
      if (authError || !authData.user) throw authError ?? new Error('Sign up failed.')

      const userId = authData.user.id

      // Profile is created server-side via Edge Function to prevent client-side
      // role manipulation. The server validates and assigns the correct role.
      const { error: profileError } = await supabase.functions.invoke('create-profile', {
        body: { userId, fullName: fullName.trim(), intendedRole: role },
      })
      if (profileError) {
        await supabase.auth.signOut().catch(() => {})
        if (!mounted.current) return
        setError('Account setup failed. Please try again.')
        return
      }

      // Student claim-code redemption — server-side to prevent bypass
      if (role === 'student') {
        const { error: claimError } = await supabase.functions.invoke('redeem-claim-code', {
          body: { userId, code: claimCode.trim().toUpperCase() },
        })
        if (claimError) {
          await supabase.auth.signOut().catch(() => {})
          if (!mounted.current) return
          const msg = (claimError as { message?: string }).message ?? 'Claim code invalid or already used.'
          setError(msg)
          return
        }
      }

      if (!mounted.current) return
      setPassword('')

      if (authData.session) {
        // Email confirmation disabled — session is live, navigate immediately
        const match = ROLES.find(r => r.key === role)
        fadeOut(match ? `/academy/onboarding?role=${role}` : '/academy/complete-profile')
        return
      }

      // Email confirmation required — switch to sign-in and show info
      setFullName('')
      setClaimCode('')
      setPassword('')
      setInfo(`Check ${email.trim()} to confirm your account, then sign in.`)
      setMode('in')
    } catch (e: unknown) {
      if (!mounted.current) return
      setError(friendlyError(e))
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  // ── Forgot password ───────────────────────────────────────────────────────
  async function handleForgotPassword() {
    if (anyBusy) return
    if (!email.trim()) { setError('Enter your email above, then click Forgot password.'); return }
    setError('')
    setBusy(true)
    try {
      const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/academy/reset-password`,
      })
      if (e) throw e
      if (!mounted.current) return
      setInfo(`Password reset link sent to ${email.trim()}.`)
    } catch (e: unknown) {
      if (!mounted.current) return
      setError(friendlyError(e))
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      mode === 'in' ? handleSignIn() : handleSignUp()
    }
  }

  // Clear error when user starts correcting a field
  function onFieldChange<T>(setter: (v: T) => void) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setError('')
      setter(e.target.value as unknown as T)
    }
  }

  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <>
      <style>{STYLES}</style>

      <div className="orb orb-1" aria-hidden />
      <div className="orb orb-2" aria-hidden />
      <div className="orb orb-3" aria-hidden />

      <div className="entry-root">
        <div className="entry-wrap" ref={wrapRef}>

          {/* wordmark */}
          <div className="wordmark">
            <div className="wordmark-logo">
              <div className="wordmark-name">Vibe<span>School</span></div>
              <div className="wordmark-tag">Freedom · Learn · Explore</div>
            </div>
          </div>

          {/* card */}
          <div className="card">

            {/* sign in / sign up tabs */}
            <div className="tabs" role="tablist" aria-label="Authentication mode">
              <div className={`tab-slider ${mode === 'up' ? 'right' : 'left'}`} aria-hidden />
              <button
                id="signin-tab"
                className={`tab ${mode === 'in' ? 'active' : ''}`}
                role="tab"
                aria-selected={mode === 'in'}
                aria-controls="auth-panel"
                onClick={() => setMode('in')}
              >Sign In</button>
              <button
                id="signup-tab"
                className={`tab ${mode === 'up' ? 'active' : ''}`}
                role="tab"
                aria-selected={mode === 'up'}
                aria-controls="auth-panel"
                onClick={() => setMode('up')}
              >Sign Up</button>
            </div>

            <div id="auth-panel" role="tabpanel" aria-labelledby={mode === 'in' ? 'signin-tab' : 'signup-tab'}>

              {/* role pills */}
              <div className="role-label" id="role-group-label">I am a</div>
              <div
                className="pills"
                role="radiogroup"
                aria-labelledby="role-group-label"
              >
                {ROLES.map((r, i) => (
                  <button
                    key={r.key}
                    ref={el => { pillRefs.current[i] = el }}
                    className="pill"
                    role="radio"
                    aria-checked={role === r.key}
                    tabIndex={role === r.key ? 0 : -1}
                    onClick={() => setRole(r.key)}
                    onKeyDown={e => {
                      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                        e.preventDefault()
                        const next = (i + 1) % ROLES.length
                        setRole(ROLES[next].key)
                        pillRefs.current[next]?.focus()
                      }
                      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                        e.preventDefault()
                        const prev = (i - 1 + ROLES.length) % ROLES.length
                        setRole(ROLES[prev].key)
                        pillRefs.current[prev]?.focus()
                      }
                    }}
                  >{r.label}</button>
                ))}
              </div>

              {/* fields */}
              <div className="fields">
                {mode === 'up' && (
                  <div className="field field-enter">
                    <label className="field-label" htmlFor="fullName">Full Name</label>
                    <input
                      id="fullName"
                      className={`field-input${anyBusy ? ' is-busy' : ''}`}
                      type="text"
                      autoComplete="name"
                      placeholder="Your full name"
                      value={fullName}
                      onChange={onFieldChange(setFullName)}
                      onKeyDown={handleKey}
                      readOnly={anyBusy}
                    />
                  </div>
                )}

                <div className="field">
                  <label className="field-label" htmlFor="email">Email</label>
                  <input
                    id="email"
                    className={`field-input${anyBusy ? ' is-busy' : ''}`}
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={onFieldChange(setEmail)}
                    onKeyDown={handleKey}
                    readOnly={anyBusy}
                    ref={emailRef}
                  />
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="password">Password</label>
                  <div className="pw-wrap">
                    <input
                      id="password"
                      className={`field-input${anyBusy ? ' is-busy' : ''}`}
                      type={showPw ? 'text' : 'password'}
                      autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
                      placeholder={mode === 'up' ? 'At least 8 characters' : '••••••••'}
                      value={password}
                      onChange={onFieldChange(setPassword)}
                      onKeyDown={handleKey}
                      readOnly={anyBusy}
                    />
                    <button
                      type="button"
                      className="pw-eye"
                      tabIndex={-1}
                      onClick={() => setShowPw(v => !v)}
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                    >
                      {showPw ? <EyeClosed /> : <EyeOpen />}
                    </button>
                  </div>
                </div>

                {mode === 'up' && role === 'student' && (
                  <div className="field field-enter">
                    <label className="field-label" htmlFor="claimCode">Claim Code</label>
                    <input
                      id="claimCode"
                      className={`field-input${anyBusy ? ' is-busy' : ''}`}
                      type="text"
                      placeholder="Code from your teacher"
                      value={claimCode}
                      onChange={e => { setError(''); setClaimCode(e.target.value.toUpperCase()) }}
                      onKeyDown={handleKey}
                      readOnly={anyBusy}
                    />
                  </div>
                )}
              </div>

              {/* forgot password — sign-in mode only */}
              {mode === 'in' && (
                <button
                  className="forgot-link"
                  onClick={handleForgotPassword}
                  disabled={anyBusy}
                  type="button"
                >
                  Forgot password?
                </button>
              )}

              {/* live regions — always in DOM, empty:hidden via CSS */}
              <p className="msg-error" role="alert" aria-live="assertive">{error}</p>
              <p className="msg-info"  role="status" aria-live="polite">{info}</p>

              {/* primary CTA */}
              <button
                className="btn-primary"
                onClick={mode === 'in' ? handleSignIn : handleSignUp}
                disabled={anyBusy}
                type="button"
              >
                {busy
                  ? (mode === 'in' ? 'Signing in…' : 'Creating account…')
                  : (mode === 'in' ? 'Sign In' : 'Create Account')}
              </button>

              {/* divider */}
              <div className="divider" aria-hidden>
                <div className="divider-line" />
                <span className="divider-text">or</span>
                <div className="divider-line" />
              </div>

              {/* google */}
              <button
                className="btn-google"
                onClick={handleGoogle}
                disabled={anyBusy}
                type="button"
                aria-label={googleBusy ? 'Redirecting to Google…' : 'Continue with Google'}
              >
                {googleBusy ? (
                  <div className="spinner" aria-hidden />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                <span className="btn-google-label">
                  {googleBusy ? 'Redirecting…' : 'Continue with Google'}
                </span>
              </button>

            </div>{/* end tabpanel */}
          </div>

          <div className="tagline" aria-hidden>
            <span>Freedom</span>
            <span>·</span>
            <span>Learn</span>
            <span>·</span>
            <span>Explore</span>
          </div>

        </div>
      </div>
    </>
  )
}

export default function Entry() {
  return <Suspense><EntryInner /></Suspense>
}
