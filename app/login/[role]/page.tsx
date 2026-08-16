"use client"

import { useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const ROLE_CONFIG = {
  teacher: { label: 'Teacher', destination: '/teacher', email: true },
  parent: { label: 'Parent', destination: '/parent', email: true },
  student: { label: 'Learner', destination: '/student', email: false },
  global: { label: 'Global learner', destination: '/global', email: true },
} as const

type RoleKey = keyof typeof ROLE_CONFIG

function safeNext(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  return value
}

export default function RoleLoginPage() {
  const params = useParams<{ role: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = safeNext(searchParams.get('next'))
  const role = (params.role || '').toLowerCase() as RoleKey
  const config = ROLE_CONFIG[role]
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  if (!config) {
    return <main className="shell"><section className="card"><h1>Choose a valid VibeSchool sign-in.</h1><a href="/login">Go to sign in</a><style jsx>{styles}</style></section></main>
  }

  async function submit() {
    if (busy) return
    setMessage('')
    if (!identifier.trim() || !password) { setMessage(config.email ? 'Enter your email and password.' : 'Enter your admission number and PIN.'); return }
    setBusy(true)
    try {
      const email = config.email ? identifier.trim() : `${identifier.trim().toLowerCase().replace(/\s/g, '')}@vs.internal`
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error || !data.user) { setMessage(config.email ? 'Incorrect email or password.' : 'Wrong admission number or PIN. Ask your teacher if you need help.'); return }

      const { data: actualRole } = await supabase.rpc('get_my_role')
      const expectedRole = role === 'global' ? 'global_user' : role
      if (actualRole !== expectedRole) {
        await supabase.auth.signOut()
        setMessage(`This account is not registered as a ${config.label.toLowerCase()}. Choose the correct sign-in.`)
        return
      }

      const { data: onboarding, error: onboardingError } = await supabase.rpc('get_my_onboarding_state')
      if (onboardingError || !onboarding || typeof onboarding !== 'object' || Array.isArray(onboarding)) {
        await supabase.auth.signOut()
        setMessage('Your account setup could not be verified safely. Please try again.')
        return
      }

      const state = typeof onboarding.state === 'string' ? onboarding.state : null
      const destination = typeof onboarding.destination === 'string' ? onboarding.destination : config.destination
      if (!state || state === 'unknown_role') {
        await supabase.auth.signOut()
        setMessage('Your account setup is incomplete or ambiguous. Please contact support.')
        return
      }

      const maxAge = data.session?.expires_in ?? 3600
      localStorage.setItem('vs_role', expectedRole)
      document.cookie = `vibe_role=${expectedRole}; path=/; max-age=${maxAge}; samesite=lax${location.protocol === 'https:' ? '; secure' : ''}`

      // Canonical onboarding remains authoritative. A continuation may only win
      // after the database explicitly says the account is ready.
      router.replace(state === 'ready' && next ? next : destination)
    } finally {
      setBusy(false)
    }
  }

  async function google() {
    if (!config.email || busy) return
    setBusy(true)
    const requestedRole = role === 'global' ? 'global_user' : role
    const continuation = next ? `&next=${encodeURIComponent(next)}` : ''
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?intent=signin&role=${requestedRole}${continuation}` },
    })
    if (error) { setMessage('Google sign in could not start.'); setBusy(false) }
  }

  const nextQuery = next ? `?next=${encodeURIComponent(next)}` : ''

  return <main className="shell"><section className="card">
    <a className="brand" href="/">Vibe<span>School</span></a>
    <p className="eyebrow">{config.label.toUpperCase()} SIGN IN</p>
    <h1>Welcome back.</h1>
    <p className="lead">{next ? 'Sign in, then continue where you left off.' : 'Go straight to your VibeSchool workspace.'}</p>
    {message && <div className="message" role="alert">{message}</div>}
    <label>{config.email ? 'Email' : 'Admission number'}</label>
    <input type={config.email ? 'email' : 'text'} autoComplete="username" value={identifier} onChange={e=>setIdentifier(e.target.value)} />
    <label>{config.email ? 'Password' : 'PIN'}</label>
    <input type="password" inputMode={config.email ? undefined : 'numeric'} autoComplete="current-password" value={password} onChange={e=>setPassword(config.email ? e.target.value : e.target.value.replace(/\D/g, ''))} onKeyDown={e=>{if(e.key==='Enter') void submit()}} />
    <button className="primary" disabled={busy} onClick={()=>void submit()}>{busy ? 'Signing in…' : `Sign in as ${config.label}`}</button>
    {config.email && <><div className="or"><span/>or<span/></div><button className="secondary" disabled={busy} onClick={()=>void google()}>Continue with Google</button></>}
    <p className="switch">Wrong role? <a href="/login">Choose another sign-in</a></p>
    {role === 'teacher' && <p className="switch">New teacher? <a href={`/signup/teacher${nextQuery}`}>Create an account</a></p>}
    {role === 'parent' && <p className="switch">New parent? <a href={`/signup/parent${nextQuery}`}>Create an account</a></p>}
    {role === 'student' && <p className="switch">New learner with a claim code? <a href={`/signup/student${nextQuery}`}>Create learner account</a></p>}
    <p className="legal"><a href="/legal/terms">Terms</a> · <a href="/legal/privacy">Privacy</a></p>
  </section><style jsx>{styles}</style></main>
}

const styles = `
.shell{min-height:100dvh;background:#05050f;color:#fff;display:grid;place-items:center;padding:28px 16px;font-family:var(--font-jakarta),Arial,sans-serif}.card{width:100%;max-width:420px}.brand{display:block;color:#fff;text-decoration:none;font-family:var(--font-display),Arial,sans-serif;font-size:30px;font-weight:800}.brand span{color:#c8a84b}.eyebrow{color:#c8a84b;font:700 10px var(--font-mono),monospace;letter-spacing:.18em;margin:28px 0 8px}h1{font-family:var(--font-display),Arial,sans-serif;font-size:36px;line-height:1.05;margin:0}.lead{color:rgba(255,255,255,.56);margin:12px 0 22px}.message{background:rgba(255,80,80,.1);color:#ffc7c7;padding:11px;border-radius:9px;margin-bottom:14px;font-size:13px}label{display:block;font-size:12px;color:rgba(255,255,255,.65);margin:14px 0 6px}input{width:100%;box-sizing:border-box;background:#0c0c1d;color:#fff;border:1px solid rgba(255,255,255,.16);border-radius:9px;padding:13px 14px;font-size:16px}.primary,.secondary{width:100%;border-radius:9px;padding:13px 14px;font-weight:800;margin-top:18px;cursor:pointer}.primary{border:0;background:#c8a84b;color:#05050f}.secondary{margin-top:0;border:1px solid rgba(255,255,255,.18);background:transparent;color:#fff}.primary:disabled,.secondary:disabled{opacity:.55;cursor:not-allowed}.or{display:flex;align-items:center;gap:10px;color:rgba(255,255,255,.3);font-size:11px;margin:16px 0}.or span{height:1px;background:rgba(255,255,255,.12);flex:1}.switch,.legal{font-size:12px;color:rgba(255,255,255,.45);text-align:center;margin-top:18px}.switch a,.legal a{color:#c8a84b}.legal{font-size:11px;margin-top:24px}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
`