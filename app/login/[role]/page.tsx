"use client"

import { useState } from 'react'
import Link from 'next/link'
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
type AccessState = { role?: unknown; account_status?: unknown; is_anonymized?: unknown }
type OnboardingState = { state?: unknown; destination?: unknown }

const SIGNUP_LINKS: Partial<Record<RoleKey, string>> = {
  teacher: '/signup/teacher', parent: '/signup/parent', student: '/signup/student',
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

  if (!config) return <main className="shell"><section className="card"><h1>Choose a valid VibeSchool sign-in.</h1><Link href="/">Go home</Link><style jsx>{styles}</style></section></main>

  async function submit() {
    if (busy) return
    setMessage('')
    if (!identifier.trim() || !password) { setMessage(config.email ? 'Enter your email and password.' : 'Enter your admission number and PIN.'); return }
    setBusy(true)
    try {
      const email = config.email ? identifier.trim().toLowerCase() : `${identifier.trim().toLowerCase().replace(/\s/g, '')}@vs.internal`
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error || !data.user) { setMessage(config.email ? 'Incorrect email or password.' : 'Wrong admission number or PIN. Ask your teacher if you need help.'); return }

      const { data: accessState, error: accessError } = await supabase.rpc('get_my_auth_access_state')
      if (accessError || !accessState || typeof accessState !== 'object' || Array.isArray(accessState)) {
        router.replace('/auth/error?reason=authority_resolution_failed')
        return
      }
      const access = accessState as AccessState
      const actualRole = typeof access.role === 'string' ? access.role : null
      const status = typeof access.account_status === 'string' ? access.account_status : null
      const anonymized = access.is_anonymized === true
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

      const onboardingState = onboarding as OnboardingState
      const state = onboardingState.state
      const rawDestination = onboardingState.destination
      const destination = typeof rawDestination === 'string' ? safeInternalPath(rawDestination) : null
      if (typeof state !== 'string' || !destination || !roleCanVisit(actualRole, destination)) {
        router.replace('/auth/error?reason=onboarding_invalid')
        return
      }

      const requested = safeInternalPath(searchParams.get('redirect'))
      const target = state === 'ready' && requested && roleCanVisit(actualRole, requested) ? requested : destination
      router.replace(target)
    } finally { setBusy(false) }
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
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callback.toString() } })
    if (error) { setMessage('Google sign in could not start. Check your connection and try again.'); setBusy(false) }
  }

  const signupLink = SIGNUP_LINKS[role]
  return <main className="shell">
    <div className="ambient" aria-hidden="true" />
    <header className="header">
      <Link className="header-brand" href="/" aria-label="VibeSchool home"><img src="/icons/vibeschool-logo-dark.svg" alt="VibeSchool" /></Link>
      <nav className="topnav" aria-label="Public navigation"><Link href="/">Home</Link><a href="/global">Explore</a><a href="/about">About</a><a href="/contact">Contact</a></nav>
    </header>
    <section className="card" aria-labelledby="login-title">
      <p className="eyebrow">{config.label.toUpperCase()} ACCESS</p>
      <h1 id="login-title">Welcome back</h1>
      <p className="lead">Sign in to continue. Your account automatically opens the workspace you are authorized to use.</p>
      {message && <div className="message" role="alert" aria-live="polite">{message}</div>}
      <div className="field"><label htmlFor="identifier">{config.email ? 'Email address' : 'Admission number'}</label><input id="identifier" type={config.email ? 'email' : 'text'} autoComplete="username" placeholder={config.email ? 'you@example.com' : 'e.g. ADM001'} value={identifier} onChange={e=>setIdentifier(e.target.value)} disabled={busy} /></div>
      <div className="field"><div className="password-label"><label htmlFor="password">{config.email ? 'Password' : 'PIN'}</label>{config.email && <a href="/auth/forgot-password">Forgot password?</a>}</div><input id="password" type="password" inputMode={config.email ? undefined : 'numeric'} autoComplete="current-password" placeholder={config.email ? 'Enter your password' : 'Enter your PIN'} value={password} onChange={e=>setPassword(config.email ? e.target.value : e.target.value.replace(/\D/g, ''))} onKeyDown={e=>{if(e.key==='Enter') void submit()}} disabled={busy} /></div>
      <button className="primary" disabled={busy} onClick={()=>void submit()}>{busy ? 'Signing in…' : 'Sign in'}</button>
      {config.email && <><div className="or"><span/>or continue with<span/></div><button className="secondary" disabled={busy} onClick={()=>void google()}><b className="g">G</b> Google</button></>}
      {signupLink ? <p className="switch">New to VibeSchool? <a href={signupLink}>Create your {role === 'student' ? 'learner' : role} account</a></p> : <p className="switch">New to VibeSchool? <a href="/global/signup">Create an account</a></p>}
      <p className="direct-signups"><a href="/signup/student">Learner sign up</a><span>·</span><a href="/signup/parent">Parent sign up</a></p>
    </section>
    <footer className="legal"><a href="/legal/terms">Terms</a><span>·</span><a href="/legal/privacy">Privacy</a><span>·</span><a href="/contact">Contact</a></footer>
    <style jsx>{styles}</style>
  </main>
}

const styles = `
.shell{min-height:100dvh;background:#070711;color:#f8fafc;display:flex;flex-direction:column;align-items:center;padding:0 20px 30px;font-family:var(--font-jakarta),Arial,sans-serif;position:relative;overflow:hidden}.ambient{position:fixed;inset:0;pointer-events:none;background:radial-gradient(900px 440px at 50% -120px,rgba(124,58,237,.18),transparent 72%),radial-gradient(620px 360px at 80% 85%,rgba(200,168,75,.06),transparent 72%)}.header{width:min(1120px,100%);height:84px;display:flex;align-items:center;justify-content:space-between;gap:28px;position:relative;z-index:1}.header-brand{display:block;width:174px;height:45px}.header-brand img{width:100%;height:100%;object-fit:contain;object-position:left center}.topnav{display:flex;gap:28px;align-items:center}.topnav a,.legal a{color:#aeb4c2;text-decoration:none;font-size:13px;font-weight:650;transition:color .15s ease}.topnav a:hover,.topnav a:focus-visible,.legal a:hover,.legal a:focus-visible{color:#fff}.card{width:100%;max-width:440px;margin:auto 0;background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.028));border:1px solid rgba(255,255,255,.11);box-shadow:0 28px 80px rgba(0,0,0,.34);border-radius:22px;padding:34px;box-sizing:border-box;position:relative;z-index:1}.eyebrow{color:#c8a84b;font:800 11px var(--font-mono),monospace;letter-spacing:.16em;margin:0 0 12px}h1{font-family:var(--font-display),Arial,sans-serif;font-size:36px;letter-spacing:-.035em;line-height:1.05;margin:0}.lead{color:#aeb4c2;font-size:14px;line-height:1.6;margin:12px 0 26px}.message{background:rgba(248,113,113,.09);border:1px solid rgba(248,113,113,.25);color:#fecaca;padding:12px 13px;border-radius:10px;margin-bottom:18px;font-size:13px;line-height:1.45}.field{margin-top:17px}.field>label,.password-label label{display:block;font-size:13px;color:#e5e7eb;margin:0 0 8px;font-weight:700}.password-label{display:flex;align-items:center;justify-content:space-between;gap:12px}.password-label a{color:#d7bc6a;font-size:12px;margin-bottom:8px;text-decoration:none}.password-label a:hover{text-decoration:underline}input{width:100%;box-sizing:border-box;background:#0d0d1c;color:#fff;border:1px solid #303044;border-radius:11px;padding:14px 15px;font-size:16px;outline:none;transition:border-color .15s,box-shadow .15s}input::placeholder{color:#6f7481}input:focus-visible{border-color:#9b7cf6;box-shadow:0 0 0 3px rgba(124,58,237,.18)}.primary,.secondary{width:100%;border-radius:11px;padding:14px;font-weight:800;cursor:pointer;font-size:14px;transition:transform .12s,filter .12s,border-color .12s}.primary{border:1px solid #c8a84b;background:#c8a84b;color:#111018;margin-top:24px}.primary:hover{filter:brightness(1.08)}.secondary{border:1px solid #343448;background:#11111f;color:#f8fafc;display:flex;align-items:center;justify-content:center;gap:10px}.secondary:hover{border-color:#56566e}.g{font-size:16px}.primary:active,.secondary:active{transform:translateY(1px)}.primary:focus-visible,.secondary:focus-visible,a:focus-visible{outline:3px solid rgba(155,124,246,.5);outline-offset:3px}.primary:disabled,.secondary:disabled,input:disabled{opacity:.55;cursor:not-allowed}.or{display:flex;align-items:center;gap:11px;color:#777d8b;font-size:11px;margin:19px 0}.or span{height:1px;background:#29293a;flex:1}.switch{font-size:13px;color:#9da3b1;text-align:center;margin:22px 0 0}.switch a,.direct-signups a{color:#d7bc6a;font-weight:700}.direct-signups{font-size:12px;text-align:center;margin:14px 0 0;display:flex;justify-content:center;gap:9px;color:#555b68}.legal{position:relative;z-index:1;display:flex;gap:10px;justify-content:center;margin-top:26px;color:#555b68}.legal a{font-size:12px}.legal span{color:#414653}@media(max-width:640px){.shell{padding:0 16px 24px;overflow:auto}.header{height:auto;padding:18px 0 22px;flex-direction:column;gap:14px}.header-brand{width:166px;height:42px}.topnav{gap:19px}.topnav a{font-size:12px}.card{padding:28px 21px;border-radius:18px;margin:0}h1{font-size:32px}.legal{margin-top:22px}}@media(max-width:360px){.topnav{gap:13px}.card{padding:24px 17px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}
`
