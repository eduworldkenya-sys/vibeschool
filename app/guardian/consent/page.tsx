'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

async function send(path: string, method: string, value?: object) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sign in with your verified parent account.')
  const response = await fetch('/api/learner/consent/' + path, {
    method, cache: 'no-store',
    headers: { Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json' },
    ...(value ? { body: JSON.stringify(value) } : {}),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Unable to process request.')
  return result
}
type Consent = { id: string; status: string }
export default function GuardianConsent() {
  const [token, setToken] = useState('')
  const [signedIn, setSignedIn] = useState(false)
  const [review, setReview] = useState(false)
  const [history, setHistory] = useState<Consent[]>([])
  const [guardian, setGuardian] = useState(false)
  const [approved, setApproved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function reload() {
    const result = await send('withdraw', 'GET')
    setHistory(result.requests || [])
  }
  useEffect(() => {
    let active = true
    async function init() {
      const code = new URLSearchParams(window.location.hash.slice(1)).get('token') || new URLSearchParams(window.location.search).get('token')
      if (code) sessionStorage.setItem('vibeschool_guardian_link', code)
      const saved = code || sessionStorage.getItem('vibeschool_guardian_link') || ''
      window.history.replaceState(null, '', '/guardian/consent')
      setToken(saved)
      const { data: { user } } = await supabase.auth.getUser()
      if (!active) return
      setSignedIn(Boolean(user))
      if (!user) return
      try {
        await reload()
        if (saved) {
          await send('approve', 'POST', { token: saved, preview: true })
          if (active) setReview(true)
        }
      } catch (err) { if (active) setMessage(err instanceof Error ? err.message : 'Could not open invitation.') }
    }
    void init()
    return () => { active = false }
  }, [])

  async function act(action: 'approve' | 'withdraw' | 'decline', id?: string) {
    setBusy(true); setMessage('')
    try {
      const data = action === 'approve'
        ? await send('approve', 'POST', { token, declare_guardianship: guardian, allow_personal_learning: approved })
        : action === 'decline'
          ? await send('approve', 'POST', { token, decline: true })
          : await send('withdraw', 'POST', { request_id: id })
      setMessage(data.message); setReview(false)
      if (action !== 'withdraw') sessionStorage.removeItem('vibeschool_guardian_link')
      await reload()
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Please try again.') }
    finally { setBusy(false) }
  }

  const button: React.CSSProperties = { width: '100%', minHeight: 46, border: 0,
    borderRadius: 10, background: '#c8a84b', color: '#111', fontWeight: 800, marginTop: 14 }
  return <main style={{ minHeight: '100dvh', background: '#090912', color: '#fff', padding: '30px 16px' }}>
    <section style={{ maxWidth: 440, margin: '0 auto', padding: 22, borderRadius: 18, background: '#1b1b2a' }}>
      <a href="/" style={{ color: '#d7bc6a' }}>VibeSchool</a>
      <h1>Guardian approval</h1>
      <p>Review consent for personal learning only. This does not approve tutoring, messaging or private school access.</p>
      {message && <p role="status">{message}</p>}
      {!signedIn && <p>
        <a style={{ color: '#d7bc6a' }} href={'/login/parent?redirect=' +
          encodeURIComponent('/guardian/consent')}>Sign in with your invited email</a>.
        New parent? <a style={{ color: '#d7bc6a' }} href="/signup/parent">Create an account</a>.
      </p>}
      {signedIn && review && <>
        <label style={{ display: 'block', marginTop: 14 }}>
          <input type="checkbox" checked={guardian} onChange={e => setGuardian(e.target.checked)} />
          I confirm I am this learner's parent or authorized guardian.
        </label>
        <label style={{ display: 'block', marginTop: 14 }}>
          <input type="checkbox" checked={approved} onChange={e => setApproved(e.target.checked)} />
          I consent to necessary personal learning data processing and understand I can withdraw.
        </label>
        <button style={button} disabled={busy || !guardian || !approved} onClick={() => void act('approve')}>
          Approve personal learning
        </button>
        <button style={{ ...button, background: '#38384a', color: '#fff' }} disabled={busy}
          onClick={() => void act('decline')}>Not my learner — decline</button>
      </>}
      {signedIn && <section style={{ marginTop: 22 }}>
        <h2>Your consent records</h2>
        {history.length === 0 && <p>No approvals recorded.</p>}
        {history.map(item => <div key={item.id} style={{ borderTop: '1px solid #444', padding: 12 }}>
          <strong>{item.status}</strong>
          {item.status === 'approved' && <button style={button} disabled={busy}
            onClick={() => void act('withdraw', item.id)}>Withdraw consent</button>}
        </div>)}
      </section>}
      <p><a style={{ color: '#d7bc6a' }} href="/legal/privacy">Privacy policy</a></p>
    </section>
  </main>
}
