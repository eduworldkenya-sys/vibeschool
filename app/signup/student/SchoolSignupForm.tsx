"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function SchoolSignupForm({ emailPilot }: { emailPilot: boolean }) {
  const router = useRouter()
  const [claimCode, setClaimCode] = useState('')
  const [googleBusy, setGoogleBusy] = useState(false)
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [schoolExpanded, setSchoolExpanded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [issueCode, setIssueCode] = useState('')
  const [createdAccount, setCreatedAccount] = useState<{ loginId: string; signedIn: boolean } | null>(null)

  async function startGoogle() {
    if (googleBusy) return
    setGoogleBusy(true)
    setMessage('')
    const callback = new URL('/auth/callback', window.location.origin)
    callback.searchParams.set('intent', 'signup')
    callback.searchParams.set('role', 'student')
    callback.searchParams.set('flow', crypto.randomUUID())
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callback.toString(), queryParams: { prompt: 'select_account' } } })
      if (error) throw error
    } catch {
      setMessage('Google signup could not start. Check your connection and try again.')
      setGoogleBusy(false)
    }
  }

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

      // Account creation already succeeded. Preserve its sign-in ID even if the
      // automatic sign-in loses connectivity, rather than offering setup again.
      setCreatedAccount({ loginId: created.email.replace(/@vs\.internal$/, ''), signedIn: false })
      const { data: signedIn, error: signInError } = await supabase.auth.signInWithPassword({ email: created.email, password: pin })
      setCreatedAccount({ loginId: created.email.replace(/@vs\.internal$/, ''), signedIn: !signInError && !!signedIn.session })
      setPin('')
    } catch {
      setMessage('Could not finish setup. Check your connection. If your account was created, sign in instead.')
    } finally {
      setBusy(false)
    }
  }

  if (createdAccount) return <main className="shell"><section className="card">
    <h1>Account created</h1>
    <p className="lead">Keep your sign-in ID. Use it with your PIN next time.</p>
    <label htmlFor="created-login-id">Your sign-in ID</label>
    <input id="created-login-id" value={createdAccount.loginId} readOnly onFocus={e=>e.target.select()} />
    <button className="primary" disabled={busy} onClick={()=>router.replace(createdAccount.signedIn ? '/student' : '/login/student')}>{busy ? 'Finishing…' : createdAccount.signedIn ? 'Start learning' : 'Sign in'}</button>
  </section><style jsx>{styles}</style></main>

  return <main className="shell"><section className="card">
    <a href="/" className="brand">Vibe<span>School</span></a>
    <h1>Start learning</h1>
    <p className="lead">Create your learner account.</p>
    <button type="button" className="email-entry google-entry" onClick={()=>void startGoogle()} disabled={googleBusy} aria-label="Continue with Google">{googleBusy ? 'Opening Google…' : <><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#4285F4" d="M21.35 12.23c0-.71-.06-1.23-.2-1.77H12v3.5h5.37a4.6 4.6 0 0 1-2 3.02v2.5h3.22c1.88-1.74 2.76-4.3 2.76-7.25Z"/><path fill="#34A853" d="M12 21.72c2.7 0 4.97-.89 6.63-2.44l-3.22-2.5c-.89.6-2.03.96-3.41.96-2.62 0-4.84-1.77-5.64-4.14H3.05v2.58A10 10 0 0 0 12 21.72Z"/><path fill="#FBBC05" d="M6.36 13.6a6 6 0 0 1 0-3.2V7.82H3.05a10 10 0 0 0 0 8.36l3.31-2.58Z"/><path fill="#EA4335" d="M12 6.28c1.43 0 2.71.49 3.72 1.45l2.79-2.79A9.5 9.5 0 0 0 12 2.28a10 10 0 0 0-8.95 5.54l3.31 2.58c.8-2.37 3.02-4.12 5.64-4.12Z"/></svg> Continue with Google</>}</button>
    {emailPilot && <a className="email-entry email-alt" href="/signup/student/email">Continue with email</a>}
    <div className="signup-or"><span/>OR<span/></div>
    <section className="school-panel" aria-label="School learner registration">
      <h2>Joining through your school?</h2>
      <p>Use the learner code provided by your school.</p>
      <button type="button" className="school-toggle" aria-expanded={schoolExpanded} aria-controls="school-registration-fields" onClick={()=>setSchoolExpanded(v=>!v)}>{schoolExpanded ? 'Hide school registration' : 'Use school learner code'}</button>
      {schoolExpanded && <div id="school-registration-fields">
    {message && <div role="alert" className="message">{message}{issueCode === 'school_required' && <p>This signup is for learners enrolled through a VibeSchool school. Ask your school for the correct learner code.</p>}{issueCode === 'class_required' && <p>Ask your school to place you in your current class, then use the learner code again.</p>}</div>}

    <label htmlFor="learner-code">Learner code</label>
    <input id="learner-code" autoCapitalize="characters" maxLength={12} value={claimCode} onChange={e=>setClaimCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="e.g. 9FFA0680" />
    <label htmlFor="learner-pin">Create PIN</label>
    <div className="password-field"><input id="learner-pin" type={showPin ? 'text' : 'password'} inputMode="numeric" autoComplete="new-password" maxLength={6} aria-describedby="pin-help" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g, ''))} onKeyDown={e=>{if(e.key==='Enter') void submit()}} /><button type="button" className="password-toggle" aria-label={showPin ? 'Hide PIN' : 'Show PIN'} aria-pressed={showPin} onClick={()=>setShowPin(v=>!v)}>{showPin ? 'Hide' : 'Show'}</button></div><p id="pin-help" className="password-help">4–6 digits. Keep your PIN private.</p>
    <button className="primary" disabled={busy} onClick={()=>void submit()}>{busy ? 'Creating account…' : 'Create learner account'}</button>
      </div>}
    </section>
    <p className="switch">Already registered? <a href="/login/student">Sign in</a></p>
    <p className="help">You can join independently without a school code.</p>
    <p className="legal"><a href="/legal/terms">Terms</a> · <a href="/legal/privacy">Privacy</a></p>
  </section><style jsx>{styles}</style></main>
}

const styles = `
.shell{min-height:100dvh;background:#05050f;color:#fff;display:grid;place-items:center;padding:28px 16px;font-family:var(--font-jakarta),Arial,sans-serif}.card{width:100%;max-width:440px}.brand{display:block;color:#fff;text-decoration:none;font-family:var(--font-display),Arial,sans-serif;font-size:30px;font-weight:800}.brand span{color:#c8a84b}.google-entry{background:#fff!important;color:#1f2937!important;display:flex;gap:10px}.signup-or{display:flex;align-items:center;gap:10px;margin:20px 0 14px;color:#9ca3af;font-size:11px}.signup-or span{flex:1;height:1px;background:#343447}.school-panel{padding:16px 13px;border-radius:13px;background:#181824}.school-panel h2{font-size:15px;margin:0 0 6px}.school-panel>p{font-size:12px;color:#b4b4c4;margin:0 0 12px;line-height:1.5}.school-toggle{width:100%;min-height:46px;background:transparent;border:1px solid #47475a;border-radius:9px;color:#fff;font-size:14px;cursor:pointer}.school-toggle:focus-visible{outline:2px solid #c8a84b}.email-alt{margin-top:10px;background:transparent!important;color:#c8a84b!important;border:1px solid #c8a84b}.email-entry{width:100%;font-size:14px;cursor:pointer;display:grid;place-items:center;min-height:48px;margin-top:20px;border-radius:9px;background:#c8a84b;color:#05050f;font-weight:800;text-decoration:none}.eyebrow{color:#c8a84b;font:700 10px var(--font-mono),monospace;letter-spacing:.18em;margin:22px 0 8px}h1{font-family:var(--font-display),Arial,sans-serif;font-size:32px;line-height:1.1;margin:0}.lead{color:rgba(255,255,255,.62);margin:12px 0 22px;line-height:1.65}.steps{display:grid;gap:7px;margin:0 0 14px}.steps div{display:flex;align-items:center;gap:10px;color:rgba(255,255,255,.62);font-size:12px}.steps strong{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:rgba(200,168,75,.12);border:1px solid rgba(200,168,75,.35);color:#c8a84b}.family{background:rgba(200,168,75,.08);border:1px solid rgba(200,168,75,.22);color:#e8ddb8;padding:11px 12px;border-radius:9px;margin-bottom:16px;font-size:12px;line-height:1.55}.message{background:rgba(255,80,80,.1);color:#ffc7c7;padding:12px;border-radius:9px;margin-bottom:14px;font-size:13px;line-height:1.55}.message p{margin:8px 0 0}.message a,.help a{color:#e9cc76}label{display:block;font-size:12px;color:rgba(255,255,255,.65);margin:14px 0 6px}.password-field{position:relative}.password-field input{padding-right:68px}.password-toggle{position:absolute;right:8px;top:50%;transform:translateY(-50%);border:0;background:transparent;color:#c8a84b;font-weight:800;padding:8px;cursor:pointer}.password-toggle:focus-visible{outline:2px solid #c8a84b;outline-offset:1px}.password-help{margin:6px 0 0;color:rgba(255,255,255,.48);font-size:11px}input{width:100%;box-sizing:border-box;background:#0c0c1d;color:#fff;border:1px solid rgba(255,255,255,.16);border-radius:9px;padding:13px 14px;font-size:16px}.primary{width:100%;border:0;border-radius:9px;padding:13px 14px;font-weight:800;margin-top:18px;background:#c8a84b;color:#05050f;cursor:pointer}.primary:disabled{opacity:.55;cursor:not-allowed}.switch,.legal,.help{font-size:12px;color:rgba(255,255,255,.45);text-align:center;margin-top:18px;line-height:1.55}.switch a,.legal a{color:#c8a84b}.help{font-size:11px;margin-top:20px}.legal{font-size:11px;margin-top:18px}
`
