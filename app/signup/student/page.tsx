"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export default function StudentSignupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [claimCode, setClaimCode] = useState('')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function submit() {
    if (busy) return
    setMessage('')
    if (!name.trim()) { setMessage('Enter your full name.'); return }
    if (claimCode.trim().length < 4) { setMessage('Enter the claim code from your teacher.'); return }
    if (pin.length < 4) { setMessage('Choose a PIN with at least 4 digits.'); return }
    setBusy(true)
    try {
      const code = claimCode.trim().toUpperCase()
      const { data: validation, error: validationError } = await supabase.rpc('redeem_student_claim', { p_code: code })
      if (validationError || !isObject(validation)) { setMessage('We could not validate that claim code. Please try again.'); return }
      const status = typeof validation.status === 'string' ? validation.status : 'invalid'
      if (status === 'not_found') { setMessage('Claim code not found. Check it with your teacher.'); return }
      if (status === 'already_claimed') { setMessage('This claim code has already been used. Sign in instead.'); return }
      if (status === 'expired') { setMessage('This claim code has expired. Ask your teacher for a new one.'); return }
      if (status === 'student_not_found') { setMessage('Your learner record could not be found. Ask your teacher for help.'); return }
      if (typeof validation.admission_number !== 'string' || typeof validation.school_code !== 'string') { setMessage('The claim code returned incomplete learner details.'); return }

      const admissionNumber = validation.admission_number
      const internalEmail = `${validation.school_code}_${admissionNumber.toLowerCase().replace(/\s/g, '')}@vs.internal`
      const createResponse = await fetch('/api/create-student-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: internalEmail, password: pin, full_name: name.trim() }),
      })
      const created = await createResponse.json()
      if (!createResponse.ok || created.error || !created.user_id) {
        setMessage(created.error?.includes('already been registered') ? 'An account already exists for this learner. Sign in instead.' : 'We could not create your learner account. Please try again.')
        return
      }

      const { data: linked, error: linkError } = await supabase.rpc('redeem_student_claim', { p_code: code, p_user_id: created.user_id })
      if (linkError || !isObject(linked) || linked.status !== 'success') { setMessage('Your account was created, but linking needs another try. Sign in with your admission number and PIN.'); return }

      const { data: signedIn, error: signInError } = await supabase.auth.signInWithPassword({ email: internalEmail, password: pin })
      if (signInError || !signedIn.session) { setMessage('Account created. Sign in with your admission number and PIN.'); router.replace('/login/student'); return }
      localStorage.setItem('vs_role', 'student')
      document.cookie = `vibe_role=student; path=/; max-age=${signedIn.session.expires_in ?? 3600}; samesite=lax${location.protocol === 'https:' ? '; secure' : ''}`
      router.replace('/student')
    } finally {
      setBusy(false)
    }
  }

  return <main className="shell"><section className="card">
    <a href="/" className="brand">Vibe<span>School</span></a>
    <p className="eyebrow">LEARNER SETUP</p>
    <h1>Join your learning space.</h1>
    <p className="lead">Use the claim code from your teacher, choose a PIN, and you are in.</p>
    {message && <div role="alert" className="message">{message}</div>}
    <label>Full name</label><input autoComplete="name" value={name} onChange={e=>setName(e.target.value)} />
    <label>Claim code</label><input autoCapitalize="characters" value={claimCode} onChange={e=>setClaimCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
    <label>Choose PIN</label><input type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g, ''))} onKeyDown={e=>{if(e.key==='Enter') void submit()}} />
    <button className="primary" disabled={busy} onClick={()=>void submit()}>{busy ? 'Creating account…' : 'Create learner account'}</button>
    <p className="switch">Already registered? <a href="/login/student">Sign in</a></p>
    <p className="legal"><a href="/legal/terms">Terms</a> · <a href="/legal/privacy">Privacy</a></p>
  </section><style jsx>{styles}</style></main>
}

const styles = `
.shell{min-height:100dvh;background:#05050f;color:#fff;display:grid;place-items:center;padding:28px 16px;font-family:var(--font-jakarta),Arial,sans-serif}.card{width:100%;max-width:420px}.brand{display:block;color:#fff;text-decoration:none;font-family:var(--font-display),Arial,sans-serif;font-size:30px;font-weight:800}.brand span{color:#c8a84b}.eyebrow{color:#c8a84b;font:700 10px var(--font-mono),monospace;letter-spacing:.18em;margin:28px 0 8px}h1{font-family:var(--font-display),Arial,sans-serif;font-size:36px;line-height:1.05;margin:0}.lead{color:rgba(255,255,255,.56);margin:12px 0 22px}.message{background:rgba(255,80,80,.1);color:#ffc7c7;padding:11px;border-radius:9px;margin-bottom:14px;font-size:13px}label{display:block;font-size:12px;color:rgba(255,255,255,.65);margin:14px 0 6px}input{width:100%;box-sizing:border-box;background:#0c0c1d;color:#fff;border:1px solid rgba(255,255,255,.16);border-radius:9px;padding:13px 14px;font-size:16px}.primary{width:100%;border:0;border-radius:9px;padding:13px 14px;font-weight:800;margin-top:18px;background:#c8a84b;color:#05050f;cursor:pointer}.primary:disabled{opacity:.55;cursor:not-allowed}.switch,.legal{font-size:12px;color:rgba(255,255,255,.45);text-align:center;margin-top:18px}.switch a,.legal a{color:#c8a84b}.legal{font-size:11px;margin-top:24px}
`
