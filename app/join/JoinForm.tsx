'use client'

import { useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { roleCanVisit, safeInternalPath } from '@/lib/auth-routing'

type AdultRole = 'teacher' | 'parent'
type AccessState = { role?: unknown; account_status?: unknown; is_anonymized?: unknown; reason_code?: unknown }
type OnboardingState = { state?: unknown; destination?: unknown }

export default function JoinForm({ initialRole }: { initialRole: AdultRole }) {
  const [role, setRole] = useState<AdultRole>(initialRole)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [existingRole, setExistingRole] = useState('')

  function callback() {
    const url = new URL('/auth/callback', window.location.origin)
    url.searchParams.set('intent', 'signup')
    url.searchParams.set('role', role)
    url.searchParams.set('flow', crypto.randomUUID())
    return url.toString()
  }

  async function withEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setMessage('')
    setExistingRole('')
    try {
      if (!sent) {
        const normalized = email.trim().toLowerCase()
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 254) {
          setMessage('Enter a valid email address.')
          return
        }
        const { error } = await supabase.auth.signInWithOtp({
          email: normalized,
          options: { shouldCreateUser: true, emailRedirectTo: callback() },
        })
        if (error) throw error
        setEmail(normalized)
        setSent(true)
        setMessage('Check your email. Open the sign-in link, or enter the six-digit code if one was sent.')
      } else {
        if (!/^\d{6}$/.test(code.trim())) {
          setMessage('Enter the six-digit email verification code.')
          return
        }
        const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'email' })
        if (error) throw error
        await finish()
      }
    } catch {
      setMessage('Could not complete email sign-in. Try again or continue with Google.')
    } finally {
      setBusy(false)
    }
  }

  async function finish() {
    const { data: userResult, error: userError } = await supabase.auth.getUser()
    if (userError || !userResult.user?.email_confirmed_at) throw new Error('Email not verified')

    const { data: initial, error: accessError } = await supabase.rpc('get_my_auth_access_state')
    if (accessError || !initial || typeof initial !== 'object' || Array.isArray(initial)) throw new Error('Authority unavailable')
    let access = initial as AccessState
    if (access.is_anonymized === true || access.account_status !== 'active') throw new Error('Account unavailable')

    // Claim once for a brand-new verified adult. Never mutate an existing role.
    if (!access.role && access.reason_code === 'ROLE_UNCLAIMED') {
      const claim = await supabase.rpc('claim_my_initial_role', { p_role: role })
      if (claim.error || claim.data !== role) throw new Error('Role claim failed')
      const fresh = await supabase.rpc('get_my_auth_access_state')
      if (fresh.error || !fresh.data || typeof fresh.data !== 'object' || Array.isArray(fresh.data)) {
        throw new Error('Role resolution failed')
      }
      access = fresh.data as AccessState
    }
    if (access.role !== role) {
      const knownRole = typeof access.role === 'string' ? access.role : ''
      setExistingRole(knownRole)
      setMessage('This email already has a VibeSchool account. Your existing access and records remain unchanged.')
      return
    }

    const { data: onboarding, error: onboardingError } = await supabase.rpc('get_my_onboarding_state')
    if (onboardingError || !onboarding || typeof onboarding !== 'object' || Array.isArray(onboarding)) {
      throw new Error('Onboarding unavailable')
    }
    const next = onboarding as OnboardingState
    const destination = typeof next.destination === 'string' ? safeInternalPath(next.destination) : null
    if (!destination || typeof next.state !== 'string' || !roleCanVisit(role, destination)) {
      throw new Error('Invalid destination')
    }
    window.location.assign(destination)
  }

  async function withGoogle() {
    if (busy) return
    setBusy(true)
    setMessage('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callback(), queryParams: { prompt: 'select_account' } },
    })
    if (error) {
      setMessage('Google sign-in could not start. Try again.')
      setBusy(false)
    }
  }

  return (
    <main className="shell">
      <section className="panel">
        <a href="/" className="brand">Vibe<span>School</span></a>
        <p className="eyebrow">JOIN VIBESCHOOL</p>
        <h1>One account. Start right away.</h1>
        <p className="muted">Use your email or Google account. You can connect a school later.</p>

        <fieldset disabled={busy || sent} className="roles">
          <legend>I am joining as</legend>
          <label className={role === 'teacher' ? 'selected' : ''}>
            <input type="radio" name="role" value="teacher" checked={role === 'teacher'}
              onChange={() => setRole('teacher')} /> Teacher
          </label>
          <label className={role === 'parent' ? 'selected' : ''}>
            <input type="radio" name="role" value="parent" checked={role === 'parent'}
              onChange={() => setRole('parent')} /> Parent
          </label>
        </fieldset>

        {!sent && <button className="google" type="button" disabled={busy} onClick={() => void withGoogle()}>
          Continue with Google
        </button>}
        <form onSubmit={event => void withEmail(event)}>
          <label htmlFor="email">{sent ? 'Email verification' : 'Or continue with email'}</label>
          {!sent ? <input id="email" type="email" autoComplete="email" required
            placeholder="name@example.com" value={email} onChange={event => setEmail(event.target.value)} />
            : <><p className="muted">{email}</p>
                <input aria-label="Six-digit email code" inputMode="numeric" pattern="[0-9]{6}"
                  autoComplete="one-time-code" maxLength={6} placeholder="6-digit code"
                  value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} />
              </>}
          <button className="primary" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : sent ? 'Verify code' : 'Continue with email'}
          </button>
        </form>
        {sent && <button className="reset" type="button" disabled={busy}
          onClick={() => { setSent(false); setCode(''); setMessage('') }}>Use another email or Google</button>}
        {message && <p role="status" className="message">{message}</p>}
        {existingRole && <a className="alternate" href={existingRole === 'teacher' ? '/teacher/pulse' :
          existingRole === 'parent' ? '/parent' : '/login'}>Open your existing account</a>}
        <div className="divider" />
        <a href="/signup/student" className="learner">Joining as a learner? Start learning</a>
        <p className="foot">Already registered? <a href="/login">Sign in</a></p>
        <p className="legal"><a href="/legal/terms">Terms</a> · <a href="/legal/privacy">Privacy</a></p>
      </section>
      <style jsx>{`
        .shell{min-height:100dvh;display:grid;place-items:center;background:#05050f;color:white;padding:24px 16px;font-family:var(--font-jakarta),Arial,sans-serif}
        .panel{width:100%;max-width:430px}.brand{font-size:29px;font-weight:800;text-decoration:none;color:white}.brand span{color:#c8a84b}
        .eyebrow{font-size:11px;color:#c8a84b;letter-spacing:.17em;font-weight:800;margin:26px 0 8px}
        h1{font-size:33px;line-height:1.12;margin:0;font-weight:850}
        .muted{color:#b9bbc8;font-size:14px;line-height:1.6}
        .roles{display:flex;gap:10px;border:0;padding:0;margin:26px 0 17px}
        legend{color:#bbb;font-size:12px;margin-bottom:10px;font-weight:600}
        .roles label{flex:1;border:1px solid #363644;border-radius:11px;padding:13px;cursor:pointer;font-weight:700}
        .roles label.selected{border-color:#c8a84b;background:rgba(200,168,75,.1)}
        input[type=radio]{accent-color:#c8a84b;margin-right:8px}
        .google,.primary{width:100%;padding:15px;border-radius:10px;min-height:48px;font-weight:800;font-size:14px;cursor:pointer}
        .google{border:0;background:#fff;color:#20212c}
        form{margin-top:20px}form label{font-size:12px;display:block;margin-bottom:8px;color:#d0d0d9}
        form input{font-size:16px;box-sizing:border-box;width:100%;padding:14px;border-radius:10px;background:#0d0d1e;color:#fff;border:1px solid #3a3a4d}
        .primary{background:#c8a84b;color:#090915;border:0;margin-top:12px}
        button:disabled{opacity:.55;cursor:wait}
        .message{background:#1c2030;border-radius:10px;padding:12px;font-size:13px;line-height:1.5;color:#f9e8c8}
        .reset{margin-top:10px;border:0;background:none;color:#c8a84b;cursor:pointer;padding:10px}
        .divider{border-top:1px solid #343446;margin-top:23px}
        .learner,.alternate{display:block;color:#e9d189;margin-top:19px;font-size:14px;font-weight:750}
        .foot,.legal{margin:17px 0 0;text-align:center;font-size:12px;color:#a3a3b4}
        .foot a,.legal a{color:#e9d189}
      `}</style>
    </main>
  )
}
