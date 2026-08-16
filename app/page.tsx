"use client";
import type { CSSProperties } from 'react'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"]

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

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
  'User already registered': 'An account with this email already exists. Sign in instead.',
  'user_already_exists':       'An account with this email already exists. Sign in instead.',
  'Too many requests':         'Too many attempts. Wait and try again.',
  'Password should contain':   'Password must include uppercase and lowercase letters, a number and a special character.',
  'weak_password':             'Password must include uppercase and lowercase letters, a number and a special character.',
}

function validatePassword(value: string): string | null {
  if (value.length < 8) return 'Password must be at least 8 characters.'
  if (!/[a-z]/.test(value)) return 'Password must include a lowercase letter.'
  if (!/[A-Z]/.test(value)) return 'Password must include an uppercase letter.'
  if (!/[0-9]/.test(value)) return 'Password must include a number.'
  if (!/[^A-Za-z0-9]/.test(value)) return 'Password must include a special character.'
  return null
}

function friendlyError(msg: string): string {
  if (typeof navigator !== 'undefined' && !navigator.onLine)
    return 'No internet connection.'
  for (const [k, v] of Object.entries(AUTH_ERRORS))
    if (msg.includes(k)) return v
  return 'Something went wrong. Please try again.'
}

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
    padding: '110px 20px 48px',
    overflowX: 'hidden',
  },
  glow: {
    position: 'fixed',
    inset: 0,
    zIndex: 1,
    pointerEvents: 'none',
    background: 'radial-gradient(ellipse 70% 40% at 50% 0%, rgba(196,149,48,0.08) 0%, transparent 70%)',
  },
  publicNav: {
    position: 'absolute',
    top: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 4,
    width: 'min(92vw, 560px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    flexWrap: 'wrap',
  },
  publicNavLink: {
    color: 'rgba(255,255,255,0.58)',
    fontFamily: 'var(--font-display), sans-serif',
    fontSize: 12,
    fontWeight: 600,
    textDecoration: 'none',
    letterSpacing: '0.03em',
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
  brandLink: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 'min(230px, 72vw)',
    minHeight: 54,
    marginBottom: 8,
    textDecoration: 'none',
  },
  brandImage: {
    display: 'block',
    width: '100%',
    maxHeight: 72,
    height: 'auto',
    objectFit: 'contain',
  },
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

  const [email,           setEmail]           = useState('')
  const [password,        setPassword]        = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName,        setFullName]        = useState('')
  const [country,         setCountry]         = useState('')
  const [dob,             setDob]             = useState('')
  const [claimCode,       setClaimCode]       = useState('')
  const [joinCode,        setJoinCode]        = useState('')
  const [admissionNo,     setAdmissionNo]     = useState('')
  const [studentPin,      setStudentPin]      = useState('')

  const inflightRef  = useRef(false)
  const passwordRef  = useRef<HTMLInputElement>(null)
  const gInflightRef = useRef(false)
  const isBusy = loading || gLoading

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
          if (dest) {
            document.cookie = `vibe_role=${rpcRole}; path=/; max-age=3600; samesite=lax${location.protocol === 'https:' ? '; secure' : ''}`
            localStorage.setItem('vs_role', rpcRole)
            window.location.href = dest; return
          }
        }
      } catch {}
      finally { if (alive) setInitialising(false) }
    }
    check()
    return () => { alive = false }
  }, [])

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
    } finally { setLoading(false) }
  }

  async function handleSignIn() {
    if (inflightRef.current) return
    setError('')
    if (role === 'Student') {
      if (!admissionNo.trim()) { setError('Enter your admission number.'); return }
      if (!studentPin)          { setError('Enter your PIN.'); return }
    } else {
      if (!email.trim()) { setError('Email is required.'); return }
      if (!password)     { setError('Password is required.'); return }
    }
    const loginEmail = role === 'Student'
      ? `${admissionNo.trim().toLowerCase().replace(/\s/g, '')}@vs.internal`
      : email.trim()
    const loginPassword = role === 'Student' ? studentPin : (passwordRef.current?.value || password)
    if (role !== 'Student') setPassword('')
    inflightRef.current = true
    setLoading(true)
    let navigated = false
    try {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email: loginEmail, password: loginPassword,
      })
      if (authErr || !data.user) {
        setError(role === 'Student'
          ? 'Wrong admission number or PIN. Ask your teacher if you need help.'
          : friendlyError(authErr?.message ?? ''))
        return
      }
      let userRole: string | null = null
      const { data: rpcRole, error: rpcErr } = await supabase.rpc('get_my_role')
      if (!rpcErr && rpcRole) {
        userRole = rpcRole
      } else {
        const { data: p } = await supabase.from('profiles').select('role').eq('id', data.user.id).single()
        userRole = p?.role ?? null
      }
      if (!userRole) { setError('No role found. Contact support.'); return }
      const dest = DASHBOARDS[userRole]
      if (!dest) { setError('Unknown role: ' + userRole); return }
      document.cookie = `vibe_role=${userRole}; path=/; max-age=3600; samesite=lax${location.protocol === 'https:' ? '; secure' : ''}`
      localStorage.setItem('vs_role', userRole)
      navigated = true
      window.location.href = dest
    } catch (e: any) {
      setError('Unexpected error: ' + (e?.message ?? 'Please try again.'))
    } finally {
      inflightRef.current = false
      if (!navigated) setLoading(false)
    }
  }

  async function handleSignUp() {
    if (inflightRef.current) return
    setError('')
    if (!fullName.trim()) { setError('Full name is required.'); return }
    if (role === 'Student') {
      if (!claimCode.trim())     { setError('Claim code is required.'); return }
      if (!studentPin)            { setError('PIN is required.'); return }
      if (studentPin.length < 4) { setError('PIN must be at least 4 digits.'); return }
    } else {
      if (!email.trim())    { setError('Email is required.'); return }
      if (!password)        { setError('Password is required.'); return }
      const passwordError = validatePassword(password)
      if (passwordError) { setError(passwordError); return }
      if (role !== 'Admin' && password !== confirmPassword) { setError('Passwords do not match.'); return }
    }
    if ((role === 'Teacher' || role === 'Parent' || role === 'Global') && !country) { setError('Country is required.'); return }
    if (role === 'Global' && !dob) { setError('Date of birth is required.'); return }
    if (role === 'Admin' && !joinCode.trim()) { setError('School join code is required.'); return }
    inflightRef.current = true
    setLoading(true)
    let navigated = false
    try {
      let schoolId: string | null = null
      let schoolName = ''
      if (role === 'Admin') {
        const { data: school, error: schoolErr } = await supabase
          .from('schools').select('id, name').eq('subdomain', joinCode.trim().toLowerCase()).single()
        if (schoolErr || !school) { setError('Invalid school join code.'); return }
        schoolId = school.id
        schoolName = school.name
      }
      if (role === 'Student') {
        const code = claimCode.trim().toUpperCase()
        const { data: validateResult, error: validateErr } = await supabase
          .rpc('redeem_student_claim', { p_code: code })
        if (validateErr || !isJsonObject(validateResult)) {
          setError('Could not validate claim code. Please try again.')
          return
        }

        const vStatus =
          typeof validateResult.status === 'string'
            ? validateResult.status
            : 'invalid'

        if (vStatus === 'not_found')         { setError('Claim code not found. Check with your teacher.'); return }
        if (vStatus === 'already_claimed')   { setError('This claim code has already been used.'); return }
        if (vStatus === 'expired')           { setError('Claim code expired. Ask your teacher for a new one.'); return }
        if (vStatus === 'student_not_found') { setError('Student record not found. Contact your teacher.'); return }

        if (
          typeof validateResult.admission_number !== 'string' ||
          typeof validateResult.school_code !== 'string'
        ) {
          setError('Claim code returned incomplete student details.')
          return
        }

        const admissionNumber = validateResult.admission_number
        const schoolCode = validateResult.school_code
        const internalEmail = `${schoolCode}_${admissionNumber.toLowerCase().replace(/\s/g, '')}@vs.internal`

        const createRes = await fetch('/api/create-student-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: internalEmail, password: studentPin, full_name: fullName.trim() }),
        })
        const createJson = await createRes.json()
        if (!createRes.ok || createJson.error || !createJson.user_id) {
          setError(createJson.error?.includes('already been registered')
            ? 'An account already exists for this student. Sign in instead.'
            : 'Account creation failed. Please try again.')
          return
        }
        const userId = createJson.user_id
        const { data: linkResult, error: linkErr } = await supabase
          .rpc('redeem_student_claim', { p_code: code, p_user_id: userId })
        if (
          linkErr ||
          !isJsonObject(linkResult) ||
          linkResult.status !== 'success'
        ) {
          setError('Account created but linking failed. Please try signing in with your admission number and PIN.')
          return
        }
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
          email: internalEmail, password: studentPin,
        })
        if (signInErr || !signInData.session) {
          setError('Account created — please sign in with your admission number and PIN.')
          return
        }
        const maxAge = signInData.session.expires_in ?? 3600
        document.cookie = `vibe_role=student; path=/; max-age=${maxAge}; samesite=lax${location.protocol === 'https:' ? '; secure' : ''}`
        localStorage.setItem('vs_role', 'student')
        navigated = true
        router.replace('/student')
        return
      }
      const dbRole = ROLE_DB[role]
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: email.trim(), password,
        options: { data: { role: dbRole, full_name: fullName.trim() } },
      })
      if (authErr || !authData.user) { setError(friendlyError(authErr?.message ?? '')); return }
      if (authData.user.identities && authData.user.identities.length === 0) {
        setError('An account with this email already exists. Please sign in instead.'); return
      }
      const userId = authData.user.id
      const profilePayload: ProfileUpdate = {
        full_name: fullName.trim(),
        ...(country  && { country_code: country }),
        ...(dob      && { date_of_birth: dob }),
        ...(schoolId && { school_id: schoolId }),
      }
      const { error: profileErr } = await supabase.from('profiles').update(profilePayload).eq('id', userId).select('id')
      if (profileErr) {
        await supabase.auth.signOut()
        document.cookie = 'vibe_role=; path=/; max-age=0'
        setError('Account setup failed. Please try again.'); return
      }
      if (role === 'Parent' && schoolId) {
        await supabase.from('school_members').upsert(
          { school_id: schoolId, profile_id: userId, role: 'parent' },
          { onConflict: 'school_id,profile_id', ignoreDuplicates: true }
        )
      }
      if (role === 'Admin' && schoolId) {
        await supabase.rpc('join_school_as_admin', {
          p_user_id: userId, p_full_name: fullName.trim(), p_school_id: schoolId,
        })
      }
      if (role === 'Admin') {
        const waText = encodeURIComponent(
          `Hello, I just registered as a VibeSchool admin and need approval.\
Name: ${fullName}\
Email: ${email}\
School: ${schoolName}`
        )
        router.replace(`/admin/pending?name=${encodeURIComponent(fullName)}&email=${encodeURIComponent(email)}&school=${encodeURIComponent(schoolName)}&wa=${waText}`)
        navigated = true
        return
      }
      if (authData.session) {
        const maxAge = authData.session.expires_in ?? 3600
        document.cookie = `vibe_role=${dbRole}; path=/; max-age=${maxAge}; samesite=lax${location.protocol === 'https:' ? '; secure' : ''}`
        localStorage.setItem('vs_role', dbRole)
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
    const redirectTo = window.location.origin + '/auth/callback' + '?intent=' + tab + '&role=' + encodeURIComponent(ROLE_DB[role])
    const { error: oauthErr } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
    if (oauthErr) {
      setError(oauthErr.message || 'Google sign in failed.')
      setGLoading(false)
      gInflightRef.current = false
    }
  }

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
        <nav style={S.publicNav} aria-label="Public navigation">
          <a href="/" style={S.publicNavLink}>Home</a>
          <a href="/global" style={S.publicNavLink}>Explore</a>
          <a href="/about" style={S.publicNavLink}>About</a>
          <a href="/contact" style={S.publicNavLink}>Contact</a>
        </nav>
        <div style={S.wrap}>
          <a href="/" style={S.brandLink} aria-label="VibeSchool home">
            <img src="/icons/vibeschool-logo.png" alt="VibeSchool" style={S.brandImage} />
          </a>
          <p style={S.tagline}>Freedom · Learn · Explore</p>
          <a href="/global" style={S.exploreLink}>Explore free — no account needed →</a>
          <div style={S.box}>
            <div style={S.tabs}>
              <button style={tabStyle(tab === 'signin')} onClick={() => { setTab('signin'); setError('') }}>Sign In</button>
              <button style={{ ...tabStyle(tab === 'signup'), borderRight: 'none' }} onClick={() => { setTab('signup'); setError('') }}>Sign Up</button>
            </div>
            <p style={S.roleLabel}>{tab === 'signin' ? 'I am a' : 'Sign up as'}</p>
            <div style={S.roles}>
              {ROLES.map(r => (
                <button key={r} style={pillStyle(role === r, isBusy)}
                  onClick={() => { if (!isBusy) { if (r === 'Admin') { router.push(tab === 'signin' ? '/admin/login' : '/admin/signup'); return } setRole(r); setError('') } }}>
                  {r}
                </button>
              ))}
            </div>
            {error && <div style={S.error}>{error}</div>}
            {tab === 'signin' && (
              <>
                {role === 'Student' ? (
                  <>
                    <label style={S.fieldLabel}>Admission Number</label>
                    <input style={S.input} type="text" autoComplete="username" placeholder="e.g. ADM001"
                      value={admissionNo} onChange={e => setAdmissionNo(e.target.value.toUpperCase())} disabled={isBusy} />
                    <label style={S.fieldLabel}>PIN</label>
                    <div style={S.inputWrap}>
                      <input style={{ ...S.input, marginBottom: 0, paddingRight: 42 }}
                        type={showPw ? 'text' : 'password'} autoComplete="current-password" inputMode="numeric"
                        placeholder="Your 4–6 digit PIN" value={studentPin}
                        onChange={e => setStudentPin(e.target.value.replace(/\D/g, ''))}
                        onKeyDown={e => { if (e.key === 'Enter') handleSignIn() }} disabled={isBusy} />
                      <button style={S.eyeBtn} type="button" onClick={() => setShowPw(v => !v)}>{showPw ? '🙈' : '👁'}</button>
                    </div>
                    <div style={{ ...S.forgotRow, justifyContent: 'flex-start' }}>
                      <span style={{ ...S.forgot, cursor: 'default', color: 'rgba(255,255,255,0.25)' }}>
                        Forgot PIN? Ask your class teacher to reset it.
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <label style={S.fieldLabel}>Email</label>
                    <input style={S.input} type="email" autoComplete="email" placeholder="you@example.com"
                      value={email} onChange={e => setEmail(e.target.value)} disabled={isBusy} />
                    <label style={S.fieldLabel}>Password</label>
                    <div style={S.inputWrap}>
                      <input style={{ ...S.input, marginBottom: 0, paddingRight: 42 }}
                        ref={passwordRef} type={showPw ? 'text' : 'password'} autoComplete="current-password"
                        name="password" placeholder="••••••••••" value={password}
                        onChange={e => setPassword(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSignIn() }} disabled={isBusy} />
                      <button style={S.eyeBtn} type="button" onClick={() => setShowPw(v => !v)}>{showPw ? '🙈' : '👁'}</button>
                    </div>
                    <div style={S.forgotRow}>
                      <button style={S.forgot} onClick={handleForgotPassword}>Forgot password?</button>
                    </div>
                  </>
                )}
                <button style={{ ...S.submit, opacity: isBusy ? 0.45 : 1, cursor: isBusy ? 'not-allowed' : 'pointer' }}
                  onClick={handleSignIn} disabled={isBusy}>
                  {loading ? 'Signing in…' : 'Sign In'}
                </button>
                <div style={S.divider}><div style={S.divLine} /><span style={S.divText}>or</span><div style={S.divLine} /></div>
                <button style={{ ...S.googleBtn, opacity: isBusy ? 0.45 : 1, cursor: isBusy ? 'not-allowed' : 'pointer' }}
                  onClick={handleGoogle} disabled={isBusy}>
                  <GoogleIcon />{gLoading ? 'Connecting…' : 'Continue with Google'}
                </button>
              </>
            )}
            {tab === 'signup' && (
              <>
                <p style={S.signupNote}>{ROLE_NOTES[role]}</p>
                <label style={S.fieldLabel}>Full Name</label>
                <input style={S.input} type="text" autoComplete="name" placeholder="Your full name"
                  value={fullName} onChange={e => setFullName(e.target.value)} disabled={isBusy} />
                {role !== 'Student' && (
                  <>
                    <label style={S.fieldLabel}>Email</label>
                    <input style={S.input} type="email" autoComplete="email" placeholder="you@example.com"
                      value={email} onChange={e => setEmail(e.target.value)} disabled={isBusy} />
                  </>
                )}
                {role !== 'Student' && (
                  <>
                    <label style={S.fieldLabel}>Password</label>
                    <div style={S.inputWrap}>
                      <input style={{ ...S.input, marginBottom: 0, paddingRight: 42 }}
                        type={showPw ? 'text' : 'password'} autoComplete="new-password" placeholder="8+ chars, upper/lower, number & symbol"
                        value={password} onChange={e => setPassword(e.target.value)} disabled={isBusy} />
                      <button style={S.eyeBtn} type="button" onClick={() => setShowPw(v => !v)}>{showPw ? '🙈' : '👁'}</button>
                    </div>
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.32)', marginTop: -8, marginBottom: 14, lineHeight: 1.5 }}>
                      Use 8+ characters with uppercase, lowercase, a number and a special character.
                    </p>
                    <label style={{ ...S.fieldLabel, marginTop: 14 }}>Confirm Password</label>
                    <div style={S.inputWrap}>
                      <input style={{ ...S.input, marginBottom: 0, paddingRight: 42 }}
                        type={showConfirm ? 'text' : 'password'} autoComplete="new-password" placeholder="Repeat password"
                        value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} disabled={isBusy}
                        onKeyDown={e => { if (e.key === 'Enter') handleSignUp() }} />
                      <button style={S.eyeBtn} type="button" onClick={() => setShowConfirm(v => !v)}>{showConfirm ? '🙈' : '👁'}</button>
                    </div>
                  </>
                )}
                {role === 'Student' && (
                  <>
                    <label style={S.fieldLabel}>PIN</label>
                    <div style={S.inputWrap}>
                      <input style={{ ...S.input, marginBottom: 0, paddingRight: 42 }}
                        type={showPw ? 'text' : 'password'} autoComplete="new-password" inputMode="numeric"
                        placeholder="4–6 digit PIN (you choose)" maxLength={6} value={studentPin}
                        onChange={e => setStudentPin(e.target.value.replace(/\D/g, ''))} disabled={isBusy} />
                      <button style={S.eyeBtn} type="button" onClick={() => setShowPw(v => !v)}>{showPw ? '🙈' : '👁'}</button>
                    </div>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 6, marginBottom: 0 }}>
                      Remember this PIN — your teacher can reset it if you forget.
                    </p>
                  </>
                )}
                {(role === 'Teacher' || role === 'Parent' || role === 'Global') && (
                  <>
                    <label style={{ ...S.fieldLabel, marginTop: 14 }}>Country</label>
                    <select style={S.input} value={country} onChange={e => setCountry(e.target.value)} disabled={isBusy}>
                      <option value="" disabled>Select country</option>
                      {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                    </select>
                  </>
                )}
                {role === 'Global' && (
                  <>
                    <label style={{ ...S.fieldLabel, marginTop: 0 }}>Date of Birth</label>
                    <input style={S.input} type="date" value={dob} onChange={e => setDob(e.target.value)} disabled={isBusy} />
                  </>
                )}
                {role === 'Student' && (
                  <>
                    <label style={{ ...S.fieldLabel, marginTop: 14 }}>Claim Code</label>
                    <input style={{ ...S.input, letterSpacing: 4, fontFamily: 'monospace', textAlign: 'center' }}
                      type="text" placeholder="From your teacher" maxLength={6} value={claimCode}
                      onChange={e => setClaimCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} disabled={isBusy} />
                  </>
                )}
                {role === 'Admin' && (
                  <>
                    <label style={{ ...S.fieldLabel, marginTop: 14 }}>School Join Code</label>
                    <input style={S.input} type="text" placeholder="e.g. kwi-4821"
                      value={joinCode} onChange={e => setJoinCode(e.target.value)} disabled={isBusy} />
                  </>
                )}
                <button style={{ ...S.submit, marginTop: 8, opacity: isBusy ? 0.45 : 1, cursor: isBusy ? 'not-allowed' : 'pointer' }}
                  onClick={handleSignUp} disabled={isBusy}>
                  {loading ? 'Creating account…' : 'Create Account'}
                </button>
                <div style={S.divider}><div style={S.divLine} /><span style={S.divText}>or</span><div style={S.divLine} /></div>
                <button style={{ ...S.googleBtn, opacity: isBusy ? 0.45 : 1, cursor: isBusy ? 'not-allowed' : 'pointer' }}
                  onClick={handleGoogle} disabled={isBusy}>
                  <GoogleIcon />{gLoading ? 'Connecting…' : 'Continue with Google'}
                </button>
              </>
            )}
          </div>
          <p style={S.legal}>
            <a href="/about" style={{ color: 'rgba(200,168,75,0.4)', textDecoration: 'none' }}>About</a>
            {' · '}
            <a href="/contact" style={{ color: 'rgba(200,168,75,0.4)', textDecoration: 'none' }}>Contact</a>
            <br />
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
