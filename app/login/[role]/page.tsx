"use client"

import { useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AUTH_DASHBOARDS, roleCanVisit, safeInternalPath } from '@/lib/auth-routing'
import { learnerLoginEmail } from '@/lib/learner/school-login'

const ROLE_CONFIG = {
  teacher: { label: 'Teacher', destination: '/teacher/pulse', email: true },
  parent: { label: 'Parent', destination: '/parent', email: true },
  student: { label: 'Learner', destination: '/student', email: false },
} as const

type RoleKey = keyof typeof ROLE_CONFIG
type AccessState = { role?: unknown; account_status?: unknown; is_anonymized?: unknown }
type OnboardingState = { state?: unknown; destination?: unknown }

const SIGNUP_LINKS: Partial<Record<RoleKey, string>> = {
  teacher: '/join?role=teacher', parent: '/join?role=parent', student: '/signup/student',
}

export default function RoleLoginPage() {
  const params = useParams<{ role: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const role = (params.role || '').toLowerCase() as RoleKey
  const config = ROLE_CONFIG[role]
  const [identifier, setIdentifier] = useState('')
  const [schoolCode, setSchoolCode] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [schoolExpanded, setSchoolExpanded] = useState(false)
  const [emailExpanded, setEmailExpanded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  if (!config) return <main className="shell"><section className="card"><h1>Choose a valid VibeSchool sign-in.</h1><a href="/">Go home</a><style jsx>{styles}</style></section></main>

  async function submit() {
    if (busy) return
    setMessage('')
    if (!identifier.trim() || !password) { setMessage(config.email ? 'Enter your email and password.' : 'Enter your admission number and PIN.'); return }
    setBusy(true)
    try {
      const email = config.email ? identifier.trim().toLowerCase() : learnerLoginEmail(identifier, schoolCode)
      if (!email) { setMessage('Enter your learner sign-in ID or admission number.'); return }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error || !data.user) { setMessage(config.email ? 'Incorrect email or password.' : 'Check your school code, admission number and PIN, or use your full sign-in ID.'); return }

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
    } catch { setMessage('Could not sign in. Check your connection and try again.') }
    finally { setBusy(false) }
  }

  async function google() {
    if (busy) return
    setBusy(true)
    const requestedRole = role
    const next = safeInternalPath(searchParams.get('redirect'))
    const flow = crypto.randomUUID()
    console.info(JSON.stringify({ scope: 'auth_journey', stage: 'oauth_started', flow_id: flow, detail: `${requestedRole}_signin` }))
    const callback = new URL('/auth/callback', window.location.origin)
    callback.searchParams.set('intent', role === 'student' ? 'signup' : 'signin')
    callback.searchParams.set('role', requestedRole)
    callback.searchParams.set('flow', flow)
    if (next) callback.searchParams.set('next', next)
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callback.toString(), queryParams: { prompt: 'select_account' } } })
    if (error) { setMessage('Google sign in could not start. Check your connection and try again.'); setBusy(false) }
  }

  const signupLink = SIGNUP_LINKS[role]
  const requestedRedirect = safeInternalPath(searchParams.get('redirect'))
  const roleHref = (target: RoleKey) => requestedRedirect && roleCanVisit(target, requestedRedirect)
    ? `/login/${target}?redirect=${encodeURIComponent(requestedRedirect)}`
    : `/login/${target}`
  return <main className="shell">
    <div className="ambient" aria-hidden="true" />
    <header className="header">
      <a className="header-brand" href="/" aria-label="VibeSchool home"><img src="/icons/vibeschool-logo-dark.svg" alt="VibeSchool" /></a>
      <nav className="topnav" aria-label="Public navigation"><a href="/">Home</a><a href="/global">Explore</a><a href="/about">About</a><a href="/contact">Contact</a></nav>
    </header>
    <section className="card" aria-labelledby="login-title">
      <p className="eyebrow">VIBESCHOOL ACCOUNT</p>
      <h1 id="login-title">Welcome back</h1>
      <p className="lead">{role === 'student' ? 'Access your learning space.' : 'Sign in securely to continue.'}</p>
      <nav className="role-tabs" aria-label="Account type">
        {(['teacher', 'parent', 'student'] as const).map(target => (
          <a key={target} className={role === target ? 'role-tab active' : 'role-tab'} href={roleHref(target)} aria-current={role === target ? 'page' : undefined}>
            {ROLE_CONFIG[target].label}
          </a>
        ))}
      </nav>
      {message && <div className="message" role="alert" aria-live="polite">{message}</div>}
      {config.email && <><button className="secondary google-first" disabled={busy} onClick={()=>void google()}><svg className="google-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="#4285F4" d="M21.35 12.23c0-.71-.06-1.23-.2-1.77H12v3.5h5.37a4.6 4.6 0 0 1-2 3.02v2.5h3.22c1.88-1.74 2.76-4.3 2.76-7.25Z"/><path fill="#34A853" d="M12 21.72c2.7 0 4.97-.89 6.63-2.44l-3.22-2.5c-.89.6-2.03.96-3.41.96-2.62 0-4.84-1.77-5.64-4.14H3.05v2.58A10 10 0 0 0 12 21.72Z"/><path fill="#FBBC05" d="M6.36 13.6a6 6 0 0 1 0-3.2V7.82H3.05a10 10 0 0 0 0 8.36l3.31-2.58Z"/><path fill="#EA4335" d="M12 6.28c1.43 0 2.71.49 3.72 1.45l2.79-2.79A9.5 9.5 0 0 0 12 2.28a10 10 0 0 0-8.95 5.54l3.31 2.58c.8-2.37 3.02-4.12 5.64-4.12Z"/></svg> Continue with Google</button><div className="or"><span/><button type="button" className="email-reveal" onClick={() => setEmailExpanded(value => !value)} aria-expanded={emailExpanded} aria-controls="email-signin-fields">{emailExpanded ? "Hide email sign in" : "or continue with email"}</button><span/></div></>}
      {role === 'student' && <>
        <button className="secondary google-first" disabled={busy} onClick={()=>void google()}><svg className="google-mark" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.35 12.23c0-.71-.06-1.23-.2-1.77H12v3.5h5.37a4.6 4.6 0 0 1-2 3.02v2.5h3.22c1.88-1.74 2.76-4.3 2.76-7.25Z"/><path fill="#34A853" d="M12 21.72c2.7 0 4.97-.89 6.63-2.44l-3.22-2.5c-.89.6-2.03.96-3.41.96-2.62 0-4.84-1.77-5.64-4.14H3.05v2.58A10 10 0 0 0 12 21.72Z"/><path fill="#FBBC05" d="M6.36 13.6a6 6 0 0 1 0-3.2V7.82H3.05a10 10 0 0 0 0 8.36l3.31-2.58Z"/><path fill="#EA4335" d="M12 6.28c1.43 0 2.71.49 3.72 1.45l2.79-2.79A9.5 9.5 0 0 0 12 2.28a10 10 0 0 0-8.95 5.54l3.31 2.58c.8-2.37 3.02-4.12 5.64-4.12Z"/></svg> Continue with Google</button>
        <a className="secondary" href="/signup/student/email" style={{marginTop:10,textDecoration:'none'}}>Continue with email</a>
        <div className="or"><span/>or<span/></div>
        <section className="school-panel" aria-label="School learner sign in">
          <h2>Signing in through your school?</h2>
          <p>Use your school code, admission number or sign-in ID, and PIN.</p>
          <button type="button" className="school-toggle" onClick={()=>setSchoolExpanded(v=>!v)} aria-expanded={schoolExpanded} aria-controls="school-signin-fields">{schoolExpanded ? 'Hide school sign in' : 'Use school ID and PIN'}</button>
        </section>
      </>}
      {((config.email && emailExpanded) || (role === 'student' && schoolExpanded)) && <div id={config.email ? 'email-signin-fields' : 'school-signin-fields'}>
      {!config.email && <div className="field"><label htmlFor="school-code">School code (leave blank for a full sign-in ID)</label><input id="school-code" type="text" autoCapitalize="none" placeholder="School code from your teacher" value={schoolCode} onChange={e=>setSchoolCode(e.target.value)} disabled={busy} /></div>}
      <div className="field"><label htmlFor="identifier">{config.email ? 'Email address' : 'Admission number or full sign-in ID'}</label><input id="identifier" type={config.email ? 'email' : 'text'} autoComplete="username" autoCapitalize="none" placeholder={config.email ? 'you@example.com' : 'e.g. ADM001 or school_adm001'} value={identifier} onChange={e=>setIdentifier(e.target.value)} disabled={busy} /></div>
      <div className="field"><div className="password-label"><label htmlFor="password">{config.email ? 'Password' : 'PIN'}</label>{config.email && <a href="/auth/forgot-password">Forgot password?</a>}</div><div className="password-field"><input id="password" type={showPassword ? 'text' : 'password'} inputMode={config.email ? undefined : 'numeric'} autoComplete="current-password" placeholder={config.email ? 'Enter your password' : 'Enter your PIN'} value={password} onChange={e=>setPassword(config.email ? e.target.value : e.target.value.replace(/\D/g, ''))} onKeyDown={e=>{if(e.key==='Enter') void submit()}} disabled={busy} /><button type="button" className="password-toggle" aria-label={showPassword ? (config.email ? 'Hide password' : 'Hide PIN') : (config.email ? 'Show password' : 'Show PIN')} aria-pressed={showPassword} onClick={()=>setShowPassword(v=>!v)} disabled={busy}>{showPassword ? 'Hide' : 'Show'}</button></div></div>
      <button className="primary" disabled={busy} onClick={()=>void submit()}>{busy ? 'Signing in…' : config.email ? 'Continue with email' : 'Sign in'}</button>
      </div>}
      {signupLink && <p className="switch">New to VibeSchool? <a href={signupLink}>Create your {role === 'student' ? 'learner' : role} account</a></p>}

    </section>
    <footer className="legal"><a href="/legal/terms">Terms</a><span>·</span><a href="/legal/privacy">Privacy</a><span>·</span><a href="/contact">Contact</a></footer>
    <style jsx>{styles}</style>
  </main>
}

const styles = `
.shell{min-height:100dvh;background:#070711;color:#f8fafc;display:flex;flex-direction:column;align-items:center;padding:0 20px 30px;font-family:var(--font-jakarta),Arial,sans-serif;position:relative;overflow:hidden}.ambient{position:fixed;inset:0;pointer-events:none;background:radial-gradient(900px 440px at 50% -120px,rgba(124,58,237,.18),transparent 72%),radial-gradient(620px 360px at 80% 85%,rgba(200,168,75,.06),transparent 72%)}.header{width:min(1120px,100%);height:84px;display:flex;align-items:center;justify-content:space-between;gap:28px;position:relative;z-index:1}.header-brand{display:block;width:174px;height:45px}.header-brand img{width:100%;height:100%;object-fit:contain;object-position:left center}.topnav{display:flex;gap:28px;align-items:center}.topnav a,.legal a{color:#aeb4c2;text-decoration:none;font-size:13px;font-weight:650;transition:color .15s ease}.topnav a:hover,.topnav a:focus-visible,.legal a:hover,.legal a:focus-visible{color:#fff}.card{width:100%;max-width:440px;margin:auto 0;background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.028));border:1px solid rgba(255,255,255,.11);box-shadow:0 28px 80px rgba(0,0,0,.34);border-radius:22px;padding:34px;box-sizing:border-box;position:relative;z-index:1}.eyebrow{color:#c8a84b;font:800 11px var(--font-mono),monospace;letter-spacing:.16em;margin:0 0 12px}h1{font-family:var(--font-display),Arial,sans-serif;font-size:36px;letter-spacing:-.035em;line-height:1.05;margin:0}.lead{color:#aeb4c2;font-size:14px;line-height:1.5;margin:10px 0 22px}.role-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;padding:5px;background:#11111d;border:1px solid #292939;border-radius:13px;margin:0 0 17px}.role-tab{display:flex;align-items:center;justify-content:center;min-height:42px;border-radius:9px;color:#b0b3c1;text-decoration:none;font-size:13px;font-weight:700;transition:background .15s,color .15s,box-shadow .15s}.role-tab:hover{color:#fff;background:#242435}.role-tab.active{background:#303044;color:#fff;box-shadow:0 1px 5px #0005}.role-tab:focus-visible{outline:2px solid #d7bc6a;outline-offset:2px}.google-mark{height:20px;width:20px;flex:none}.school-panel{background:#181824;border-radius:13px;padding:16px 13px}.school-panel h2{font-size:15px;margin:0 0 6px}.school-panel p{font-size:12px;line-height:1.5;color:#b4b4c4;margin:0 0 12px}.school-toggle{width:100%;min-height:46px;border:1px solid #47475a;background:transparent;color:#fff;border-radius:9px;font-size:14px;cursor:pointer}.school-toggle:focus-visible{outline:2px solid #c8a84b}.message{background:rgba(248,113,113,.09);border:1px solid rgba(248,113,113,.25);color:#fecaca;padding:12px 13px;border-radius:10px;margin-bottom:18px;font-size:13px;line-height:1.45}.field{margin-top:17px}.field>label,.password-label label{display:block;font-size:13px;color:#e5e7eb;margin:0 0 8px;font-weight:700}.password-label{display:flex;align-items:center;justify-content:space-between;gap:12px}.password-label a{color:#d7bc6a;font-size:12px;margin-bottom:8px;text-decoration:none}.password-label a:hover{text-decoration:underline}.password-field{position:relative}.password-field input{padding-right:68px}.password-toggle{position:absolute;right:7px;top:50%;transform:translateY(-50%);border:0;background:transparent;color:#d7bc6a;font-weight:800;padding:8px;cursor:pointer}.password-toggle:focus-visible{outline:2px solid #9b7cf6;outline-offset:1px}.password-toggle:disabled{opacity:.55;cursor:not-allowed}input{width:100%;box-sizing:border-box;background:#0d0d1c;color:#fff;border:1px solid #303044;border-radius:11px;padding:14px 15px;font-size:16px;outline:none;transition:border-color .15s,box-shadow .15s}input::placeholder{color:#6f7481}input:focus-visible{border-color:#9b7cf6;box-shadow:0 0 0 3px rgba(124,58,237,.18)}.primary,.secondary{width:100%;border-radius:11px;padding:14px;font-weight:800;cursor:pointer;font-size:14px;transition:transform .12s,filter .12s,border-color .12s}.primary{border:1px solid #c8a84b;background:#c8a84b;color:#111018;margin-top:24px}.primary:hover{filter:brightness(1.08)}.secondary{border:1px solid #343448;background:#11111f;color:#f8fafc;display:flex;align-items:center;justify-content:center;gap:10px}.secondary:hover{border-color:#56566e}.google-first{background:#fff;color:#1f2937;border-color:#fff;margin-top:12px;min-height:50px}.google-first:hover{filter:brightness(.96);border-color:#fff}.google-first .g{font-weight:900;font-size:19px;color:#4285f4}.g{font-size:16px}.primary:active,.secondary:active{transform:translateY(1px)}.primary:focus-visible,.secondary:focus-visible,a:focus-visible{outline:3px solid rgba(155,124,246,.5);outline-offset:3px}.primary:disabled,.secondary:disabled,input:disabled{opacity:.55;cursor:not-allowed}.or{display:flex;align-items:center;gap:11px;color:#aeb4c2;font-size:12px;margin:20px 0 8px}.or span{height:1px;background:#29293a;flex:1}.email-reveal{border:0;background:transparent;color:#aeb4c2;cursor:pointer;padding:8px 4px;font:inherit;border-radius:5px}.email-reveal:hover{color:#fff;text-decoration:underline}.email-reveal:focus-visible{outline:2px solid #d7bc6a;outline-offset:2px}.switch{font-size:13px;color:#9da3b1;text-align:center;margin:22px 0 0}.switch a{color:#d7bc6a;font-weight:700}.legal{position:relative;z-index:1;display:flex;gap:10px;justify-content:center;margin-top:26px;color:#555b68}.legal a{font-size:12px}.legal span{color:#414653}@media(max-width:640px){.shell{padding:0 16px 24px;overflow:auto}.header{height:auto;padding:18px 0 22px;flex-direction:column;gap:14px}.header-brand{width:166px;height:42px}.topnav{gap:19px}.topnav a{font-size:12px}.card{padding:28px 21px;border-radius:18px;margin:0}h1{font-size:32px}.legal{margin-top:22px}}@media(max-width:360px){.topnav{gap:13px}.card{padding:24px 17px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}
`
