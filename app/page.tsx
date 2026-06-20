
"use client";
import type { CSSProperties } from 'react'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ── Constants ────────────────────────────────────────────────────────────────

const ROLES = ['Teacher', 'Parent', 'Student', 'Admin', 'Global'] as const
type Role = typeof ROLES[number]

const DASHBOARDS: Record<string, string> = {
  teacher:     '/teacher',
  parent:      '/parent',
  student:     '/student',
  admin:       '/admin',
  global_user: '/global',
}

const ROLE_DB: Record<Role, string> = {
  Teacher: 'teacher',
  Parent:  'parent',
  Student: 'student',
  Admin:   'admin',
  Global:  'global_user',
}

const SIGNUP_DESTINATIONS: Record<Role, string> = {
  Teacher: '/teacher/onboarding/school',
  Parent:  '/parent',
  Student: '/student',
  Admin:   '/admin',
  Global:  '/global',
}

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

const AUTH_ERRORS: Record<string, string> = {
  'Invalid login credentials': 'Incorrect email or password.',
  'Email not confirmed':       'Please confirm your email first.',
  'User not found':            'No account found with that email.',
  'Too many requests':         'Too many attempts. Wait and try again.',
}

function friendlyError(msg: string): string {
  if (typeof navigator !== 'undefined' && !navigator.onLine)
    return 'No internet connection.'
  for (const [k, v] of Object.entries(AUTH_ERRORS))
    if (msg.includes(k)) return v
  return 'Something went wrong. Please try again.'
}

// ── Styles ───────────────────────────────────────────────────────────────────

const S: Record<string, CSSProperties> = {
  root: {
    position: 'relative',
    isolation: 'isolate',
    minHeight: '100dvh',
    width: '100%',
    background: '#05050F',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 20px',
    overflowX: 'hidden',
  },
  glow: {
    position: 'fixed',
    inset: 0,
    zIndex: 1,
    pointerEvents: 'none',
    background: 'radial-gradient(ellipse 70% 40% at 50% 0%, rgba(196,149,48,0.08) 0%, transparent 70%)',
  },
  wrap: {
    position: 'relative',
    zIndex: 3,
    width: '100%',
    maxWidth: 400,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    animation: 'fadeUp 260ms ease-out both',
  },
  wordmark: {
    fontFamily: 'var(--font-display), sans-serif',
    fontWeight: 800,
    fontSize: 30,
    color: '#fff',
    letterSpacing: '-0.5px',
    marginBottom: 4,
  },
  gold: { color: '#C8A84B' },
  tagline: {
    fontFamily: 'var(--font-mono), monospace',
    fontSize: 9,
    letterSpacing: '0.35em',
    color: 'rgba(255,255,255,0.22)',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  exploreLink: {
    fontFamily: 'var(--font-mono), monospace',
    fontSize: 9,
    letterSpacing: '0.18em',
    color: 'rgba(200,168,75,0.55)',
    textDecoration: 'none',
    marginBottom: 28,
    textTransform: 'uppercase',
    display: 'block',
  },
  box: {
    width: '100%',
    background: 'rgba(255,255,255,0.025)',
    border: '1px solid rgba(196,149,48,0.18)',
    borderRadius: 12,
    padding: '28px 22px',
  },
  tabs: {
    display: 'flex',
    border: '1px solid rgba(196,149,48,0.22)',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 24,
  },
  roleLabel: {
    fontFamily: 'var(--font-mono), monospace',
    fontSize: 8,
    letterSpacing: '0.35em',
    color: 'rgba(255,255,255,0.28)',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  roles: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 7,
    marginBottom: 22,
  },
  fieldLabel: {
    fontFamily: 'var(--font-mono), monospace',
    fontSize: 8,
    letterSpacing: '0.35em',
    color: 'rgba(255,255,255,0.32)',
    textTransform: 'uppercase',
    marginBottom: 6,
    display: 'block',
  },
  input: {
    width: '100%',
    background: '#0A0A1E',
    border: '1px solid rgba(196,149,48,0.25)',
    borderRadius: 6,
    padding: '12px 14px',
    fontFamily: 'var(--font-display), sans-serif',
    fontSize: 14,
    color: '#fff',
    outline: 'none',
    boxSizing: 'border-box' as const,
    marginBottom: 14,
    transition: 'border-color 180ms ease',
    WebkitAppearance: 'none',
    appearance: 'none' as const,
  },
  inputWrap: { position: 'relative' as const, marginBottom: 14 },
  eyeBtn: {
    position: 'absolute' as const,
    right: 12, top: '50%',
    transform: 'translateY(-50%)',
    background: 'none', border: 'none',
    color: 'rgba(200,168,75,0.7)',
    cursor: 'pointer', padding: 4,
    fontSize: 14, lineHeight: 1,
  },
  forgotRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginBottom: 16,
    marginTop: -6,
  },
  forgot: {
    fontFamily: 'var(--font-mono), monospace',
    fontSize: 9,
    color: 'rgba(200,168,75,0.6)',
    letterSpacing: '0.1em',
    background: 'none', border: 'none',
    cursor: 'pointer', textDecoration: 'underline',
  },
  submit: {
    width: '100%',
    background: 'transparent',
    border: '1px solid rgba(196,149,48,0.55)',
    borderRadius: 6,
    padding: '13px 0',
    fontFamily: 'var(--font-display), sans-serif',
    fontWeight: 600,
    fontSize: 11,
    color: 'rgba(196,149,48,0.9)',
    letterSpacing: '0.35em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    marginBottom: 16,
    transition: 'border-color 180ms ease, color 180ms ease',
  },
  divider: {
    display: 'flex', alignItems: 'center',
    gap: 10, marginBottom: 14,
  },
  divLine: { flex: 1, height: 1, background: 'rgba(196,149,48,0.15)' },
  divText: {
    fontFamily: 'var(--font-mono), monospace',
    fontSize: 8, color: 'rgba(255,255,255,0.2)',
    letterSpacing: '0.25em',
  },
  googleBtn: {
    width: '100%',
    background: 'transparent',
    border: '1px solid rgba(196,149,48,0.28)',
    borderRadius: 6,
    padding: '12px 0',
    display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 10,
    fontFamily: 'var(--font-display), sans-serif',
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: '0.08em',
    cursor: 'pointer',
    transition: 'border-color 180ms ease, color 180ms ease',
  },
  error: {
    fontFamily: 'var(--font-mono), monospace',
    fontSize: 10,
    color: 'rgba(220,80,80,0.9)',
    letterSpacing: '0.04em',
    marginBottom: 14,
    padding: '10px 12px',
    background: 'rgba(220,80,80,0.07)',
    border: '1px solid rgba(220,80,80,0.2)',
    borderRadius: 6,
  },
  signupNote: {
    fontFamily: 'var(--font-serif), serif',
    fontStyle: 'italic',
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center' as const,
    marginBottom: 18,
    lineHeight: 1.6,
  },
  legal: {
    fontFamily: 'var(--font-mono), monospace',
    fontSize: 9,
    color: 'rgba(255,255,255,0.18)',
    textAlign: 'center' as const,
    marginTop: 20,
    letterSpacing: '0.04em',
    lineHeight: 1.8,
  },
  loader: {
    minHeight: '100dvh',
    background: '#05050F',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    fontFamily: 'var(--font-mono), monospace',
    fontSize: 10,
    letterSpacing: '0.35em',
    color: 'rgba(255,255,255,0.2)',
    textTransform: 'uppercase' as const,
    animation: 'pulse 1.6s ease-in-out infinite',
  },
}

function tabStyle(active: boolean): CSSProperties {
  return {
    flex: 1, padding: '10px 0', border: 'none',
    fontFamily: 'var(--font-mono), monospace',
    fontSize: 9, fontWeight: 400,
    letterSpacing: '0.3em', textTransform: 'uppercase',
    cursor: 'pointer', transition: 'all 180ms ease',
    background: active ? 'rgba(196,149,48,0.1)' : 'transparent',
    color: active ? 'rgba(196,149,48,0.9)' : 'rgba(255,255,255,0.25)',
    borderRight: '1px solid rgba(196,149,48,0.22)',
  }
}

function pillStyle(active: boolean, busy: boolean): CSSProperties {
  return {
    padding: '7px 14px',
    borderRadius: 20,
    border: '1px solid',
    borderColor: active ? '#C8A84B' : 'rgba(255,255,255,0.12)',
    background: active ? 'rgba(200,168,75,0.1)' : 'transparent',
    color: active ? '#C8A84B' : 'rgba(255,255,255,0.4)',
    fontFamily: 'var(--font-display), sans-serif',
    fontSize: 13, fontWeight: 500,
    cursor: busy ? 'not-allowed' : 'pointer',
    opacity: busy ? 0.5 : 1,
    transition: 'all 150ms ease',
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function RootPage() {
  const router = useRouter()

  const [initialising, setInitialising] = useState(true)
  const [tab,          setTab]          = useState<'signin' | 'signup'>('signin')
  const [role,         setRole]         = useState<Role>('Teacher')
  const [error,        setError]        = useState('')
  const [loading,      setLoading]      = useState(false)
  const [gLoading,     setGLoading]     = useState(false)
  const [showPw,       setShowPw]       = useState(false)
  const [showConfirm,  setShowConfirm]  = useState(false)

  // fields
  const [email,           setEmail]           = useState('')
  const [password,        setPassword]        = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName,        setFullName]        = useState('')
  const [country,         setCountry]         = useState('')
  const [dob,             setDob]             = useState('')
  const [claimCode,       setClaimCode]       = useState('')
  const [joinCode,        setJoinCode]        = useState('')

  const inflightRef  = useRef(false)
  const passwordRef   = useRef<HTMLInputElement>(null)
  const gInflightRef = useRef(false)
  const isBusy = loading || gLoading

  // ── Session check ──────────────────────────────────────────────
  useEffect(() => {
    let alive = true
    async function check() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!alive) return
        if (!user) { setInitialising(false); return }

        const { data: rpcRole } = await supabase.rpc('get_my_role')
        if (!alive) return

        if (rpcRole) {
          const dest = DASHBOARDS[rpcRole]
          if (dest) { router.replace(dest); return }
        }
      } catch {
        // RPC or network failed — show login anyway
      } finally {
        if (alive) setInitialising(false)
      }
    }
    check()
    return () => { alive = false }
  }, []) // eslint-disable-line

  if (initialising) {
    return (
      <div style={S.loader}>
        <style>{`
          @keyframes pulse { 0%,100%{opacity:.2} 50%{opacity:.8} }
          @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        `}</style>
        <span style={S.loaderText}>Loading…</span>
      </div>
    )
  }

  // ── Handlers ───────────────────────────────────────────────────

  async function handleForgotPassword() {
    if (!email.trim()) { setError('Enter your email address first, then click Forgot password.'); return }
    setError('')
    setLoading(true)
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${origin}/reset-password?role=${role.toLowerCase()}`,
      })
      if (error) { setError('Could not send reset email. Check the address and try again.'); return }
      setError('✅ Reset link sent — check your inbox.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignIn() {
    if (inflightRef.current) return
    setError('')
    if (!email.trim()) { setError('Email is required.'); return }
    if (!password)     { setError('Password is required.'); return }

    const pw = passwordRef.current?.value || password
    setPassword('')
    inflightRef.current = true
    setLoading(true)
    let navigated = false

    try {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email: email.trim(), password: pw,
      })
      if (authErr || !data.user) {
        setError(friendlyError(authErr?.message ?? ''))
        return
      }

      let userRole: string | null = null

      // Try get_my_role RPC first — fast path
      const { data: rpcRole } = await supabase.rpc('get_my_role')
      if (rpcRole) {
        userRole = rpcRole
      } else {
        // Fallback — read profiles directly
        const { data: p } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single()
        userRole = p?.role ?? null
      }

      const dest = DASHBOARDS[userRole ?? '']
      if (!dest) { setError('Unknown role. Contact support.'); return }

      navigated = true
      router.replace(dest)
    } finally {
      inflightRef.current = false
      if (!navigated) setLoading(false)
    }
  }

  async function handleSignUp() {
    if (inflightRef.current) return
    setError('')

    // Validation
    if (!fullName.trim())  { setError('Full name is required.'); return }
    if (!email.trim())     { setError('Email is required.'); return }
    if (!password)         { setError('Password is required.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    if ((role === 'Teacher' || role === 'Parent' || role === 'Global') && !country) {
      setError('Country is required.'); return
    }
    if (role === 'Global' && !dob) { setError('Date of birth is required.'); return }
    if (role === 'Student' && !claimCode.trim()) { setError('Claim code is required.'); return }
    if (role === 'Admin' && !joinCode.trim()) { setError('School join code is required.'); return }

    inflightRef.current = true
    setLoading(true)
    let navigated = false

    try {
      // Admin — validate join code first
      let schoolId: string | null = null
      let schoolName = ''

      if (role === 'Admin') {
        const { data: school, error: schoolErr } = await supabase
          .from('schools')
          .select('id, name')
          .eq('subdomain', joinCode.trim().toLowerCase())
          .single()

        if (schoolErr || !school) {
          setError('Invalid school join code.')
          return
        }
        schoolId = school.id
        schoolName = school.name
      }

      // Create auth user
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      })

      if (authErr || !authData.user) {
        setError(friendlyError(authErr?.message ?? ''))
        return
      }
      // Supabase returns fake success for duplicate emails — detect it
      if (!authData.session && !authErr) {
        setError('An account with this email already exists. Please sign in instead.')
        return
      }

      const userId = authData.user.id
      const dbRole = ROLE_DB[role]

      // Insert profile — never use pending_admin, use real role
      const profilePayload: Record<string, unknown> = {
        id:        userId,
        full_name: fullName.trim(),
        role:      dbRole,
        ...(country && { country_code: country }),
        ...(dob     && { date_of_birth: dob }),
        ...(schoolId && { school_id: schoolId }),
      }

      const { error: profileErr } = await supabase
        .from('profiles')
        .insert(profilePayload)

      if (profileErr) {
        await supabase.auth.signOut()
        setError('Account setup failed. Please try again.')
        return
      }

      // Teacher — add to school_members after profile created
      // (school link happens in onboarding, self-heal via resolveSchoolId)

      // Parent — add to school_members if school known
      if (role === 'Parent' && schoolId) {
        await supabase.from('school_members').upsert(
          { school_id: schoolId, profile_id: userId, role: 'parent' },
          { onConflict: 'school_id,profile_id', ignoreDuplicates: true }
        )
      }

      // Admin joining existing school — use RPC for atomicity
      if (role === 'Admin' && schoolId) {
        await supabase.rpc('join_school_as_admin', {
          p_user_id:   userId,
          p_full_name: fullName.trim(),
          p_school_id: schoolId,
        })
      }

      // Student — use atomic RPC instead of 4 separate writes
      if (role === 'Student') {
        const code = claimCode.trim().toUpperCase()
        const { data: claimResult, error: claimErr } = await supabase
          .rpc('redeem_student_claim', {
            p_code:    code,
            p_user_id: userId,
          })

        if (claimErr || !claimResult) {
          await supabase.auth.signOut()
          setError('Failed to link your student account. Please try again.')
          return
        }

        switch (claimResult) {
          case 'not_found':
            await supabase.auth.signOut()
            setError('Claim code not found. Check with your teacher.')
            return
          case 'already_claimed':
            await supabase.auth.signOut()
            setError('This claim code has already been used.')
            return
          case 'expired':
            await supabase.auth.signOut()
            setError('Claim code expired. Ask your teacher for a new one.')
            return
          case 'student_not_found':
            await supabase.auth.signOut()
            setError('Student record not found. Contact your teacher.')
            return
        }
      }

      // Admin pending — show WhatsApp/email prompt
      if (role === 'Admin') {
        const waText = encodeURIComponent(
          `Hello, I just registered as a VibeSchool admin and need approval.\nName: ${fullName}\nEmail: ${email}\nSchool: ${schoolName}`
        )
        router.replace(`/admin/pending?name=${encodeURIComponent(fullName)}&email=${encodeURIComponent(email)}&school=${encodeURIComponent(schoolName)}&wa=${waText}`)
        navigated = true
        return
      }

      navigated = true
      router.replace(SIGNUP_DESTINATIONS[role])
    } finally {
      inflightRef.current = false
      if (!navigated) setLoading(false)
    }
  }

  async function handleGoogle() {
    if (gInflightRef.current) return
    setError('')
    gInflightRef.current = true
    setGLoading(true)

    const redirectTo =
      window.location.origin +
      '/auth/callback' +
      '?intent=' + tab +
      '&role='   + encodeURIComponent(ROLE_DB[role])

    const { error: oauthErr } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })

    if (oauthErr) {
      setError(oauthErr.message || 'Google sign in failed.')
      setGLoading(false)
      gInflightRef.current = false
    }
  }

  // ── Render ─────────────────────────────────────────────────────

  const ROLE_NOTES: Record<Role, string> = {
    Teacher: 'Manage your classes, lessons and students.',
    Parent:  "Track your child's progress and communications.",
    Student: 'View your timetable, marks and homework.',
    Admin:   'Manage your school operations.',
    Global:  'Join the global learning community.',
  }

  return (
    <>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse  { 0%,100%{opacity:.2} 50%{opacity:.8} }
        input::placeholder { color: rgba(255,255,255,0.18); }
        select option { background: #0A0A1E; color: #fff; }
        a:hover { color: rgba(200,168,75,0.8) !important; }
      `}</style>

      <div style={S.root}>
        <div style={S.glow} />

        <div style={S.wrap}>

          {/* Wordmark */}
          <div style={S.wordmark}>
            Vibe<span style={S.gold}>School</span>
          </div>
          <p style={S.tagline}>Freedom · Learn · Explore</p>
          <a href="/global" style={S.exploreLink}>
            Explore free — no account needed →
          </a>

          <div style={S.box}>

            {/* Tabs */}
            <div style={S.tabs}>
              <button style={tabStyle(tab === 'signin')} onClick={() => { setTab('signin'); setError('') }}>
                Sign In
              </button>
              <button style={{ ...tabStyle(tab === 'signup'), borderRight: 'none' }} onClick={() => { setTab('signup'); setError('') }}>
                Sign Up
              </button>
            </div>

            {/* Role pills */}
            <p style={S.roleLabel}>{tab === 'signin' ? 'I am a' : 'Sign up as'}</p>
            <div style={S.roles}>
              {ROLES.map(r => (
                <button
                  key={r}
                  style={pillStyle(role === r, isBusy)}
                  onClick={() => { if (!isBusy) { setRole(r); setError('') } }}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* Error */}
            {error && <div style={S.error}>{error}</div>}

            {/* ── SIGN IN ── */}
            {tab === 'signin' && (
              <>
                <label style={S.fieldLabel}>Email</label>
                <input
                  style={S.input}
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={isBusy}
                />

                <label style={S.fieldLabel}>Password</label>
                <div style={S.inputWrap}>
                  <input
                    style={{ ...S.input, marginBottom: 0, paddingRight: 42 }}
                    ref={passwordRef}
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    name="password"
                    placeholder="••••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSignIn() }}
                    disabled={isBusy}
                  />
                  <button style={S.eyeBtn} type="button" onClick={() => setShowPw(v => !v)}>
                    {showPw ? '🙈' : '👁'}
                  </button>
                </div>

                <div style={S.forgotRow}>
                  <button style={S.forgot} onClick={handleForgotPassword}>
                    Forgot password?
                  </button>
                </div>

                <button
                  style={{ ...S.submit, opacity: isBusy ? 0.45 : 1, cursor: isBusy ? 'not-allowed' : 'pointer' }}
                  onClick={handleSignIn}
                  disabled={isBusy}
                >
                  {loading ? 'Signing in…' : 'Sign In'}
                </button>

                <div style={S.divider}>
                  <div style={S.divLine} />
                  <span style={S.divText}>or</span>
                  <div style={S.divLine} />
                </div>

                <button
                  style={{ ...S.googleBtn, opacity: isBusy ? 0.45 : 1, cursor: isBusy ? 'not-allowed' : 'pointer' }}
                  onClick={handleGoogle}
                  disabled={isBusy}
                >
                  <GoogleIcon />
                  {gLoading ? 'Connecting…' : 'Continue with Google'}
                </button>
              </>
            )}

            {/* ── SIGN UP ── */}
            {tab === 'signup' && (
              <>
                <p style={S.signupNote}>{ROLE_NOTES[role]}</p>

                <label style={S.fieldLabel}>Full Name</label>
                <input style={S.input} type="text" autoComplete="name"
                  placeholder="Your full name"
                  value={fullName} onChange={e => setFullName(e.target.value)} disabled={isBusy} />

                <label style={S.fieldLabel}>Email</label>
                <input style={S.input} type="email" autoComplete="email"
                  placeholder="you@example.com"
                  value={email} onChange={e => setEmail(e.target.value)} disabled={isBusy} />

                <label style={S.fieldLabel}>Password</label>
                <div style={S.inputWrap}>
                  <input
                    style={{ ...S.input, marginBottom: 0, paddingRight: 42 }}
                    type={showPw ? 'text' : 'password'}
                    autoComplete="new-password" placeholder="Min 8 characters"
                    value={password} onChange={e => setPassword(e.target.value)} disabled={isBusy}
                  />
                  <button style={S.eyeBtn} type="button" onClick={() => setShowPw(v => !v)}>
                    {showPw ? '🙈' : '👁'}
                  </button>
                </div>

                <label style={{ ...S.fieldLabel, marginTop: 14 }}>Confirm Password</label>
                <div style={S.inputWrap}>
                  <input
                    style={{ ...S.input, marginBottom: 0, paddingRight: 42 }}
                    type={showConfirm ? 'text' : 'password'}
                    autoComplete="new-password" placeholder="Repeat password"
                    value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} disabled={isBusy}
                    onKeyDown={e => { if (e.key === 'Enter') handleSignUp() }}
                  />
                  <button style={S.eyeBtn} type="button" onClick={() => setShowConfirm(v => !v)}>
                    {showConfirm ? '🙈' : '👁'}
                  </button>
                </div>

                {/* Country — Teacher, Parent, Global */}
                {(role === 'Teacher' || role === 'Parent' || role === 'Global') && (
                  <>
                    <label style={{ ...S.fieldLabel, marginTop: 14 }}>Country</label>
                    <select style={S.input} value={country} onChange={e => setCountry(e.target.value)} disabled={isBusy}>
                      <option value="" disabled>Select country</option>
                      {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                    </select>
                  </>
                )}

                {/* DOB — Global only */}
                {role === 'Global' && (
                  <>
                    <label style={{ ...S.fieldLabel, marginTop: 0 }}>Date of Birth</label>
                    <input style={S.input} type="date"
                      value={dob} onChange={e => setDob(e.target.value)} disabled={isBusy} />
                  </>
                )}

                {/* Claim code — Student */}
                {role === 'Student' && (
                  <>
                    <label style={{ ...S.fieldLabel, marginTop: 14 }}>Claim Code</label>
                    <input style={S.input} type="text"
                      placeholder="Code from your teacher"
                      value={claimCode}
                      onChange={e => setClaimCode(e.target.value.toUpperCase())}
                      disabled={isBusy} />
                  </>
                )}

                {/* Join code — Admin */}
                {role === 'Admin' && (
                  <>
                    <label style={{ ...S.fieldLabel, marginTop: 14 }}>School Join Code</label>
                    <input style={S.input} type="text"
                      placeholder="e.g. kwi-4821"
                      value={joinCode}
                      onChange={e => setJoinCode(e.target.value)}
                      disabled={isBusy} />
                  </>
                )}

                <button
                  style={{ ...S.submit, marginTop: 8, opacity: isBusy ? 0.45 : 1, cursor: isBusy ? 'not-allowed' : 'pointer' }}
                  onClick={handleSignUp}
                  disabled={isBusy}
                >
                  {loading ? 'Creating account…' : 'Create Account'}
                </button>

                <div style={S.divider}>
                  <div style={S.divLine} />
                  <span style={S.divText}>or</span>
                  <div style={S.divLine} />
                </div>

                <button
                  style={{ ...S.googleBtn, opacity: isBusy ? 0.45 : 1, cursor: isBusy ? 'not-allowed' : 'pointer' }}
                  onClick={handleGoogle}
                  disabled={isBusy}
                >
                  <GoogleIcon />
                  {gLoading ? 'Connecting…' : 'Continue with Google'}
                </button>
              </>
            )}

          </div>

          {/* Legal */}
          <p style={S.legal}>
            By continuing you agree to our{' '}
            <a href="/legal/terms" style={{ color: 'rgba(200,168,75,0.4)', textDecoration: 'none' }}>Terms</a>
            {' '}and{' '}
            <a href="/legal/privacy" style={{ color: 'rgba(200,168,75,0.4)', textDecoration: 'none' }}>Privacy Policy</a>
          </p>

        </div>
      </div>
    </>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}
