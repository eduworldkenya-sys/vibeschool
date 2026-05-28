'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const ROLES = ['Teacher', 'Parent', 'Student', 'Admin'] as const
type Role = typeof ROLES[number]

const ROLE_DB: Record<Role, string> = {
  Teacher: 'teacher', Parent: 'parent', Student: 'student', Admin: 'admin',
}

const DASHBOARD: Record<string, string> = {
  teacher: '/teacher', parent: '/parent', student: '/student', admin: '/admin',
}

const S = {
  root: { minHeight: '100dvh', background: '#0d0d1f', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', padding: '24px 20px', fontFamily: "'JetBrains Mono', monospace" },
  wordmark: { fontSize: 32, fontWeight: 800, color: '#fff', letterSpacing: -1, marginBottom: 4, fontFamily: 'sans-serif' },
  gold: { color: '#C8A84B' },
  tagline: { fontSize: 10, letterSpacing: '0.3em', color: 'rgba(255,255,255,0.3)', marginBottom: 32 },
  card: { width: '100%', maxWidth: 420, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(200,168,75,0.15)', borderRadius: 16, padding: '28px 24px' },
  tabs: { display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: 4, marginBottom: 24, gap: 4 },
  label: { fontSize: 9, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.35)', marginBottom: 10, display: 'block' },
  roleRow: { display: 'flex', flexWrap: 'wrap' as const, gap: 8, marginBottom: 20 },
  inputBase: { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(200,168,75,0.2)', borderRadius: 8, padding: '13px 14px', color: '#fff', fontSize: 14, fontFamily: "'JetBrains Mono', monospace", outline: 'none', boxSizing: 'border-box' as const, marginBottom: 14 },
  pwWrap: { position: 'relative' as const },
  eye: { position: 'absolute' as const, right: 14, top: '50%', transform: 'translateY(-60%)', background: 'none', border: 'none', color: '#C8A84B', cursor: 'pointer', fontSize: 15, padding: 4 },
  forgotRow: { display: 'flex', justifyContent: 'flex-end', marginBottom: 16 },
  forgot: { fontSize: 10, color: '#C8A84B', letterSpacing: '0.1em', cursor: 'pointer', background: 'none', border: 'none', fontFamily: "'JetBrains Mono', monospace" },
  primaryBtn: { width: '100%', padding: '14px 0', borderRadius: 8, border: 'none', background: '#C8A84B', color: '#0d0d1f', fontSize: 14, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", cursor: 'pointer', letterSpacing: '0.08em', marginBottom: 16 },
  divider: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 },
  divLine: { flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' },
  divText: { fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.2em' },
  googleBtn: { width: '100%', padding: '13px 0', borderRadius: 8, border: '1px solid rgba(200,168,75,0.25)', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, letterSpacing: '0.1em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 },
  error: { color: '#f87171', fontSize: 12, marginBottom: 12, textAlign: 'center' as const },
  loader: { minHeight: '100dvh', background: '#0d0d1f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: '0.2em' },
  signupNote: { fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'center' as const, marginBottom: 20, lineHeight: 1.6 },
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

export default function RootPage() {
  const router = useRouter()
  const [initialising, setInitialising] = useState(true)
  const [tab,          setTab]          = useState<'signin' | 'signup'>('signin')
  const [role,         setRole]         = useState<Role>('Teacher')
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [showPw,       setShowPw]       = useState(false)
  const [error,        setError]        = useState('')
  const [loading,      setLoading]      = useState(false)
  const passwordRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setInitialising(false); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role && DASHBOARD[profile.role]) {
        router.replace(DASHBOARD[profile.role])
      } else {
        setInitialising(false)
      }
    }
    check()
  }, [router])

  if (initialising) return <div style={S.loader}>LOADING…</div>

  function switchTab(t: 'signin' | 'signup') { setTab(t); setError(''); setEmail(''); setPassword('') }

  function tabStyle(active: boolean): React.CSSProperties {
    return { flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', cursor: 'pointer', background: active ? '#C8A84B' : 'transparent', color: active ? '#0d0d1f' : 'rgba(255,255,255,0.4)', transition: 'all 0.18s ease' }
  }

  function pillStyle(active: boolean): React.CSSProperties {
    return { padding: '8px 16px', borderRadius: 20, border: '1px solid', borderColor: active ? '#C8A84B' : 'rgba(255,255,255,0.15)', background: active ? 'rgba(200,168,75,0.12)' : 'transparent', color: active ? '#C8A84B' : 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: "'JetBrains Mono', monospace", transition: 'all 0.15s ease', opacity: loading ? 0.5 : 1 }
  }

  function dis(base: React.CSSProperties): React.CSSProperties {
    return loading ? { ...base, opacity: 0.5, cursor: 'not-allowed' } : base
  }

  async function handleSignIn() {
    setError('')
    if (!email.trim()) { setError('Email is required.'); return }
    if (!password)     { setError('Password is required.'); return }
    setLoading(true)
    try {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (authErr || !data.user) { setError(authErr?.message || 'Sign in failed. Please try again.'); return }
      const { data: profile, error: profileErr } = await supabase.from('profiles').select('role').eq('id', data.user.id).single()
      if (profileErr || !profile) { setError('Could not load your profile. Please try again.'); return }
      const dest = DASHBOARD[profile.role]
      if (!dest) { setError('Unknown account role. Please contact support.'); return }
      router.push(dest)
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setError('')
    setLoading(true)
    const { error: oauthErr } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/academy/complete-profile?intent=${tab}&role=${ROLE_DB[role]}`,
      },
    })
    if (oauthErr) { setError(oauthErr.message || 'Google sign in failed.'); setLoading(false) }
  }

  return (
    <div style={S.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0d0d1f; }
        input::placeholder { color: rgba(255,255,255,0.2); }
      `}</style>

      <div style={S.wordmark}>Vibe<span style={S.gold}>School</span></div>
      <p style={S.tagline}>FREEDOM · LEARN · EXPLORE</p>

      <div style={S.card}>
        <div style={S.tabs}>
          <button style={tabStyle(tab === 'signin')} onClick={() => switchTab('signin')}>SIGN IN</button>
          <button style={tabStyle(tab === 'signup')} onClick={() => switchTab('signup')}>SIGN UP</button>
        </div>

        <span style={S.label}>I AM A</span>
        <div style={S.roleRow}>
          {ROLES.map(r => (
            <button key={r} style={pillStyle(role === r)} onClick={() => !loading && setRole(r)}>{r}</button>
          ))}
        </div>

        {error && <p style={S.error}>{error}</p>}

        {tab === 'signin' && (
          <>
            <span style={S.label}>EMAIL</span>
            <input style={dis(S.inputBase)} type="email" autoComplete="email" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); passwordRef.current?.focus() } }}
              disabled={loading} />

            <span style={S.label}>PASSWORD</span>
            <div style={S.pwWrap}>
              <input ref={passwordRef} style={dis({ ...S.inputBase, paddingRight: 44 })}
                type={showPw ? 'text' : 'password'} autoComplete="current-password" placeholder="••••••••••"
                value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSignIn() } }}
                disabled={loading} />
              <button style={S.eye} onClick={() => setShowPw(v => !v)} tabIndex={-1} type="button">
                {showPw ? '🙈' : '👁'}
              </button>
            </div>

            <div style={S.forgotRow}>
              <button style={S.forgot} onClick={() => router.push('/academy/forgot-password')} type="button">
                FORGOT PASSWORD?
              </button>
            </div>

            <button style={dis(S.primaryBtn)} onClick={handleSignIn} disabled={loading} type="button">
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
            <div style={S.divider}><div style={S.divLine}/><span style={S.divText}>OR</span><div style={S.divLine}/></div>
            <button style={dis(S.googleBtn)} onClick={handleGoogle} disabled={loading} type="button">
              <GoogleIcon /> CONTINUE WITH GOOGLE
            </button>
          </>
        )}

        {tab === 'signup' && (
          <>
            <p style={S.signupNote}>You'll be taken to the {role} sign-up page to complete your account.</p>
            <button style={dis(S.primaryBtn)} onClick={() => router.push(`/academy/signup?role=${ROLE_DB[role]}`)} disabled={loading} type="button">
              Create {role} Account →
            </button>
            <div style={S.divider}><div style={S.divLine}/><span style={S.divText}>OR</span><div style={S.divLine}/></div>
            <button style={dis(S.googleBtn)} onClick={handleGoogle} disabled={loading} type="button">
              <GoogleIcon /> CONTINUE WITH GOOGLE
            </button>
          </>
        )}
      </div>
    </div>
  )
}
