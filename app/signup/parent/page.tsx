"use client"

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type OnboardingState = { destination?: unknown }

export default function ParentSignupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function submit() {
    if (busy) return
    setMessage('')
    if (!name.trim()) { setMessage('Enter your full name.'); return }
    if (!email.trim()) { setMessage('Enter your email address.'); return }
    if (password.length < 8) { setMessage('Use at least 8 characters for your password.'); return }
    setBusy(true)
    try {
      const callback = `${window.location.origin}/auth/callback?intent=signup&role=parent`
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: callback, data: { full_name: name.trim() } } })
      if (error || !data.user) { setMessage('We could not create your account. If you already registered, sign in instead.'); return }
      if (!data.session) { setMessage('Check your email to confirm your account. After confirmation, VibeSchool will continue parent setup.'); return }
      const claim = await supabase.rpc('claim_my_initial_role', { p_role: 'parent' })
      if (claim.error || claim.data !== 'parent') { router.replace('/auth/error?reason=role_claim_failed'); return }
      const { error: profileError } = await supabase.from('profiles').update({ full_name: name.trim(), country_code: 'KE' }).eq('id', data.user.id)
      if (profileError) { router.replace('/auth/error?reason=profile_resolution_failed'); return }
      const { data: onboarding, error: onboardingError } = await supabase.rpc('get_my_onboarding_state')
      let destination: string | null = null
      if (onboarding && typeof onboarding === 'object' && !Array.isArray(onboarding)) {
        const rawDestination = (onboarding as OnboardingState).destination
        destination = typeof rawDestination === 'string' ? rawDestination : null
      }
      if (onboardingError || !destination) { router.replace('/auth/error?reason=onboarding_resolution_failed'); return }
      router.replace(destination)
    } finally { setBusy(false) }
  }

  async function google() {
    if (busy) return
    setBusy(true)
    const flow = crypto.randomUUID()
    const redirectTo = `${window.location.origin}/auth/callback?intent=signup&role=parent&flow=${encodeURIComponent(flow)}`
    console.info(JSON.stringify({ scope: 'auth_journey', stage: 'oauth_started', flow_id: flow, detail: 'parent_signup' }))
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
    if (error) { setMessage('Google signup could not start.'); setBusy(false) }
  }

  return <main className="shell"><section className="card">
    <Link href="/" className="brand">Vibe<span>School</span></Link><p className="eyebrow">PARENT SETUP</p><h1>Stay connected to learning.</h1><p className="lead">Create your account first. Then connect your learner.</p>
    {message && <div role="alert" className="message">{message}</div>}
    <label>Full name</label><input autoComplete="name" value={name} onChange={e=>setName(e.target.value)} /><label>Email</label><input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} /><label>Password</label><input type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>{if(e.key==='Enter') void submit()}} />
    <button className="primary" disabled={busy} onClick={()=>void submit()}>{busy ? 'Creating account…' : 'Create parent account'}</button><div className="or"><span/>or<span/></div><button className="secondary" disabled={busy} onClick={()=>void google()}>Continue with Google</button><p className="switch">Already have an account? <Link href="/login/parent">Sign in</Link></p><p className="legal"><a href="/legal/terms">Terms</a> · <a href="/legal/privacy">Privacy</a></p>
  </section><style jsx>{styles}</style></main>
}

const styles = `
.shell{min-height:100dvh;background:#05050f;color:#fff;display:grid;place-items:center;padding:28px 16px;font-family:var(--font-jakarta),Arial,sans-serif}.card{width:100%;max-width:420px}.brand{display:block;color:#fff;text-decoration:none;font-family:var(--font-display),Arial,sans-serif;font-size:30px;font-weight:800}.brand span{color:#c8a84b}.eyebrow{color:#c8a84b;font:700 10px var(--font-mono),monospace;letter-spacing:.18em;margin:28px 0 8px}h1{font-family:var(--font-display),Arial,sans-serif;font-size:36px;line-height:1.05;margin:0}.lead{color:rgba(255,255,255,.56);margin:12px 0 22px}.message{background:rgba(255,80,80,.1);color:#ffc7c7;padding:11px;border-radius:9px;margin-bottom:14px;font-size:13px}label{display:block;font-size:12px;color:rgba(255,255,255,.65);margin:14px 0 6px}input{width:100%;box-sizing:border-box;background:#0c0c1d;color:#fff;border:1px solid rgba(255,255,255,.16);border-radius:9px;padding:13px 14px;font-size:16px}.primary,.secondary{width:100%;border-radius:9px;padding:13px 14px;font-weight:800;margin-top:18px;cursor:pointer}.primary{border:0;background:#c8a84b;color:#05050f}.secondary{margin-top:0;border:1px solid rgba(255,255,255,.18);background:transparent;color:#fff}.primary:disabled,.secondary:disabled{opacity:.55;cursor:not-allowed}.or{display:flex;align-items:center;gap:10px;color:rgba(255,255,255,.3);font-size:11px;margin:16px 0}.or span{height:1px;background:rgba(255,255,255,.12);flex:1}.switch,.legal{font-size:12px;color:rgba(255,255,255,.45);text-align:center;margin-top:18px}.switch a,.legal a{color:#c8a84b}.legal{font-size:11px;margin-top:24px}
`
