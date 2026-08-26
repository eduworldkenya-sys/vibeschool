"use client"

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function StudentSignupPage() {
  const router = useRouter()
  const [claimCode, setClaimCode] = useState('')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [issueCode, setIssueCode] = useState('')

  async function submit() {
    if (busy) return
    setMessage('')
    setIssueCode('')
    const normalizedCode = claimCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (normalizedCode.length < 4 || normalizedCode.length > 12) { setMessage('Enter the full learner code from your school.'); return }
    if (!/^\d{4,6}$/.test(pin)) { setMessage('Choose a PIN with 4–6 digits.'); return }

    setBusy(true)
    try {
      const createResponse = await fetch('/api/create-student-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claim_code: normalizedCode, password: pin }),
      })
      const created = await createResponse.json()

      if (!createResponse.ok || created.error || !created.user_id || !created.email) {
        setIssueCode(typeof created.code === 'string' ? created.code : '')
        setMessage(created.error || 'We could not create your learner account. Please try again.')
        return
      }

      const { data: signedIn, error: signInError } = await supabase.auth.signInWithPassword({ email: created.email, password: pin })
      if (signInError || !signedIn.session) {
        setMessage('Account created. Sign in with your admission number and PIN.')
        router.replace('/login/student')
        return
      }
      router.replace('/student')
    } finally {
      setBusy(false)
    }
  }

  return <main className="shell"><section className="card">
    <Link href="/" className="brand">Vibe<span>School</span></Link>
    <p className="eyebrow">LEARNER SETUP</p>
    <h1>Join your learning space.</h1>
    <p className="lead">Use the learner code your school gave you. VibeSchool uses it to find your existing learner record, so you do not need to recreate your name or class.</p>

    <div className="steps" aria-label="Learner setup steps">
      <div><strong>1</strong><span>Enter your learner code</span></div>
      <div><strong>2</strong><span>Choose a private 4–6 digit PIN</span></div>
      <div><strong>3</strong><span>Start learning</span></div>
    </div>

    <div className="family">A parent or guardian can connect separately for family access. Their connection is not required before you activate a valid school learner account.</div>
    {message && <div role="alert" className="message">{message}{issueCode === 'school_required' && <p><a href="/global/signup">I am not enrolled in a school — create an independent learner account</a></p>}{issueCode === 'class_required' && <p>Ask your school to place you in your current class, then use the learner code again.</p>}</div>}

    <label>Learner code</label>
    <input autoCapitalize="characters" maxLength={12} value={claimCode} onChange={e=>setClaimCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="e.g. 9FFA0680" />
    <label>Choose PIN</label>
    <input type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g, ''))} onKeyDown={e=>{if(e.key==='Enter') void submit()}} />
    <button className="primary" disabled={busy} onClick={()=>void submit()}>{busy ? 'Creating account…' : 'Create learner account'}</button>
    <p className="switch">Already registered? <Link href="/login/student">Sign in</Link></p>
    <p className="help">No school? <a href="/global/signup">Create an independent learner account.</a> If you belong to a school but have no current class, ask the school to complete your enrollment first so your school identity is preserved.</p>
    <p className="legal"><a href="/legal/terms">Terms</a> · <a href="/legal/privacy">Privacy</a></p>
  </section><style jsx>{styles}</style></main>
}

const styles = `
.shell{min-height:100dvh;background:#05050f;color:#fff;display:grid;place-items:center;padding:28px 16px;font-family:var(--font-jakarta),Arial,sans-serif}.card{width:100%;max-width:440px}.brand{display:block;color:#fff;text-decoration:none;font-family:var(--font-display),Arial,sans-serif;font-size:30px;font-weight:800}.brand span{color:#c8a84b}.eyebrow{color:#c8a84b;font:700 10px var(--font-mono),monospace;letter-spacing:.18em;margin:28px 0 8px}h1{font-family:var(--font-display),Arial,sans-serif;font-size:36px;line-height:1.05;margin:0}.lead{color:rgba(255,255,255,.62);margin:12px 0 18px;line-height:1.65}.steps{display:grid;gap:7px;margin:0 0 14px}.steps div{display:flex;align-items:center;gap:10px;color:rgba(255,255,255,.62);font-size:12px}.steps strong{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:rgba(200,168,75,.12);border:1px solid rgba(200,168,75,.35);color:#c8a84b}.family{background:rgba(200,168,75,.08);border:1px solid rgba(200,168,75,.22);color:#e8ddb8;padding:11px 12px;border-radius:9px;margin-bottom:16px;font-size:12px;line-height:1.55}.message{background:rgba(255,80,80,.1);color:#ffc7c7;padding:12px;border-radius:9px;margin-bottom:14px;font-size:13px;line-height:1.55}.message p{margin:8px 0 0}.message a,.help a{color:#e9cc76}label{display:block;font-size:12px;color:rgba(255,255,255,.65);margin:14px 0 6px}input{width:100%;box-sizing:border-box;background:#0c0c1d;color:#fff;border:1px solid rgba(255,255,255,.16);border-radius:9px;padding:13px 14px;font-size:16px}.primary{width:100%;border:0;border-radius:9px;padding:13px 14px;font-weight:800;margin-top:18px;background:#c8a84b;color:#05050f;cursor:pointer}.primary:disabled{opacity:.55;cursor:not-allowed}.switch,.legal,.help{font-size:12px;color:rgba(255,255,255,.45);text-align:center;margin-top:18px;line-height:1.55}.switch a,.legal a{color:#c8a84b}.help{font-size:11px;margin-top:20px}.legal{font-size:11px;margin-top:18px}
`
