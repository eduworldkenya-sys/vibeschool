"use client"

import { useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AUTH_DASHBOARDS, roleCanVisit, safeInternalPath } from '@/lib/auth-routing'

const ROLE_CONFIG = {
  teacher: { label: 'Teacher', destination: '/teacher', email: true },
  parent: { label: 'Parent', destination: '/parent', email: true },
  student: { label: 'Learner', destination: '/student', email: false },
  global: { label: 'Global learner', destination: '/global', email: true },
} as const

type RoleKey = keyof typeof ROLE_CONFIG

type OnboardingState = { state?: unknown; destination?: unknown }

const SIGNUP_LINKS: Partial<Record<RoleKey, string>> = {
  teacher: '/signup/teacher',
  parent: '/signup/parent',
  student: '/signup/student',
}

export default function RoleLoginPage() {
  const params = useParams<{ role: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const role = (params.role || '').toLowerCase() as RoleKey
  const config = ROLE_CONFIG[role]
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  if (!config) {
    return <main className="shell"><section className="card"><h1>Choose a valid VibeSchool sign-in.</h1><a href="/">Go home</a><style jsx>{styles}</style></section></main>
  }

  async function submit() {
    if (busy) return
    setMessage('')
    if (!identifier.trim() || !password) {
      setMessage(config.email ? 'Enter your email and password.' : 'Enter your admission number and PIN.')
      return
    }
    setBusy(true)
    try {
      const email = config.email ? identifier.trim().toLowerCase() : `${identifier.trim().toLowerCase().replace(/\s/g, '')}@vs.internal`
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error || !data.user) {
        setMessage(config.email ? 'Incorrect email or password.' : 'Wrong admission number or PIN. Ask your teacher if you need help.')
        return
      }

      const { data: accessState, error: accessError } = await supabase.rpc('get_my_auth_access_state')
      if (accessError || !accessState || typeof accessState !== 'object' || Array.isArray(accessState)) {
        router.replace('/auth/error?reason=authority_resolution_failed')
        return
      }

      const actualRole = typeof accessState.role === 'string' ? accessState.role : null
      const status = typeof accessState.account_status === 'string' ? accessState.account_status : null
      const anonymized = accessState.is_anonymized === true

      if (status === 'restricted' || anonymized) {
        await supabase.auth.signOut()
        router.replace('/auth/error?reason=account_unavailable')
        return
      }
      if (!actualRole || !AUTH_DASHBOARDS[actualRole]) {
        await supabase.auth.signOut()
        router.replace('/auth/error?reason=account_unregistered')
        return
      }

      const { data: onboarding, error: onboardingError } = await supabase.rpc('get_my_onboarding_state')
      if (onboardingError || !onboarding || typeof onboarding !== 'object' || Array.isArray(onboarding)) {
        router.replace('/auth/error?reason=onboarding_resolution_failed')
        return
      }

      const state = (onboarding as OnboardingState).state
      const rawDestination = (onboarding as OnboardingState).destination
      const destination = typeof rawDestination === 'string' ? safeInternalPath(rawDestination) : null
      if (typeof state !== 'string' || !destination || !roleCanVisit(actualRole, destination)) {
        router.replace('/auth/error?reason=onboarding_invalid')
        return
      }

      const requested = safeInternalPath(searchParams.get('redirect'))
      const target = state === 'ready' && requested && roleCanVisit(actualRole, requested)
        ? requested
        : destination
      router.replace(target)
    } finally {
      setBusy(false)
    }
  }

  async function google() {
    if (!config.email || busy) return
    setBusy(true)
    const requestedRole = role === 'global' ? 'global_user' : role
    const next = safeInternalPath(searchParams.get('redirect'))
    const flow = crypto.randomUUID()
    console.info(JSON.stringify({ scope: 'auth_journey', stage: 'oauth_started', flow_id: flow, detail: `${requestedRole}_signin` }))
    const callback = new URL('/auth/callback', window.location.origin)
    callback.searchParams.set('intent', 'signin')
    callback.searchParams.set('role', requestedRole)
    callback.searchParams.set('flow', flow)
    if (next) callback.searchParams.set('next', next)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callback.toString() },
    })
    if (error) {
      setMessage('Google sign in could not start. Check your connection and try again.')
      setBusy(false)
    }
  }

  const signupLink = SIGNUP_LINKS[role]

  return <main className="shell">
    <nav className="topnav" aria-label="Public navigation">
      <a href="/">Home</a><a href="/global">Explore</a><a href="/about">About</a><a href="/contact">Contact</a>
    </nav>
    <section className="card" aria-labelledby="login-title">
      <a className="brand" href="/" aria-label="VibeSchool home"><img src="/icons/vibeschool-logo.png" alt="VibeSchool" /></a>
      <p className="eyebrow">{config.label.toUpperCase()} SIGN IN</p>
      <h1 id="login-title">Welcome back.</h1>
      <p className="lead">Sign in once. VibeSchool will open the workspace your account is authorized to use.</p>
      {message && <div className="message" role="alert" aria-live="polite">{message}</div>}
      <label htmlFor="identifier">{config.email ? 'Email' : 'Admission number'}</label>
      <input id="identifier" type={config.email ? 'email' : 'text'} autoComplete="username" value={identifier} onChange={e=>setIdentifier(e.target.value)} disabled={busy} />
      <div className="password-label"><label htmlFor="password">{config.email ? 'Password' : 'PIN'}</label>{config.email && <a href="/auth/forgot-password">Forgot password?</a>}</div>
      <input id="password" type="password" inputMode={config.email ? undefined : 'numeric'} autoComplete="current-password" value={password} onChange={e=>setPassword(config.email ? e.target.value : e.target.value.replace(/\D/g, ''))} onKeyDown={e=>{if(e.key==='Enter') void submit()}} disabled={busy} />
      <button className="primary" disabled={busy} onClick={()=>void submit()}>{busy ? 'Signing in…' : 'Sign in'}</button>
      {config.email && <><div className="or"><span/>or<span/></div><button className="secondary" disabled={busy} onClick={()=>void google()}>Continue with Google</button></>}
      {signupLink ? <p className="switch">New to VibeSchool? <a href={signupLink}>Create your {role === 'student' ? 'learner' : role} account</a></p> : <p className="switch">New to VibeSchool? <a href="/global/signup">Create an account</a></p>}
      <p className="direct-signups"><a href="/signup/student">Learner sign up</a> · <a href="/signup/parent">Parent sign up</a></p>
      <p className="legal"><a href="/legal/terms">Terms</a> · <a href="/legal/privacy">Privacy</a> · <a href="/contact">Contact</a></p>
    </section><style jsx>{styles}</style></main>
}

const styles = `
.shell{min-height:100dvh;background:#05050f;color:#fff;display:grid;place-items:center;padding:92px 16px 32px;font-family:var(--font-jakarta),Arial,sans-serif;position:relative}.topnav{position:absolute;top:24px;left:50%;transform:translateX(-50%);display:flex;align-items:center;justify-content:center;gap:22px;flex-wrap:wrap;width:min(92vw,620px)}.topnav a{color:rgba(255,255,255,.78);text-decoration:none;font-size:13px;font-weight:700}.topnav a:hover,.topnav a:focus-visible{color:#c8a84b}.card{width:100%;max-width:460px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:30px;box-sizing:border-box}.brand{display:flex;justify-content:center;text-decoration:none;margin-bottom:20px}.brand img{display:block;width:min(220px,70%);height:auto;max-height:72px;object-fit:contain}.eyebrow{color:#d8ba62;font:800 11px var(--font-mono),monospace;letter-spacing:.15em;margin:0 0 10px}h1{font-family:var(--font-display),Arial,sans-serif;font-size:34px;line-height:1.1;margin:0}.lead{color:rgba(255,255,255,.74);font-size:14px;line-height:1.55;margin:10px 0 24px}.message{background:rgba(255,80,80,.1);border:1px solid rgba(255,130,130,.22);color:#ffd2d2;padding:12px;border-radius:9px;margin-bottom:14px;font-size:13px;line-height:1.45}label{display:block;font-size:13px;color:rgba(255,255,255,.84);margin:15px 0 7px;font-weight:700}.password-label{display:flex;align-items:flex-end;justify-content:space-between;gap:12px}.password-label label{margin-bottom:7px}.password-label a{color:#d8ba62;font-size:12px;margin-bottom:7px}input{width:100%;box-sizing:border-box;background:#0c0c1d;color:#fff;border:1px solid rgba(255,255,255,.26);border-radius:10px;padding:14px;font-size:16px;outline:none}input:focus-visible{border-color:#d8ba62;box-shadow:0 0 0 3px rgba(216,186,98,.16)}.primary,.secondary{width:100%;border-radius:10px;padding:14px;font-weight:800;margin-top:18px;cursor:pointer;font-size:14px}.primary{border:1px solid #d8ba62;background:#d8ba62;color:#05050f}.secondary{margin-top:0;border:1px solid rgba(255,255,255,.28);background:transparent;color:#fff}.primary:focus-visible,.secondary:focus-visible,a:focus-visible{outline:3px solid rgba(216,186,98,.45);outline-offset:2px}.primary:disabled,.secondary:disabled,input:disabled{opacity:.55;cursor:not-allowed}.or{display:flex;align-items:center;gap:10px;color:rgba(255,255,255,.58);font-size:12px;margin:17px 0}.or span{height:1px;background:rgba(255,255,255,.18);flex:1}.switch,.direct-signups,.legal{font-size:13px;color:rgba(255,255,255,.66);text-align:center;margin-top:19px}.switch a,.direct-signups a,.legal a{color:#d8ba62}.direct-signups{font-size:12px}.legal{font-size:12px;margin-top:24px}@media(max-width:520px){.shell{padding-top:104px;align-items:start}.topnav{top:20px;gap:15px}.card{padding:24px 18px;border-radius:14px}h1{font-size:30px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
`
