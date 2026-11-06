'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type RequestStatus = {
  id: string
  status: string
  learner_email: string | null
  learner_email_verified_at: string | null
  guardian_email: string
  guardian_invite_sent_at: string | null
}
const shell: React.CSSProperties = {
  maxWidth: 440, margin: '20px auto', background: '#151522', color: '#fafafa',
  border: '1px solid #383747', borderRadius: 18, padding: 22,
}
const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', border: '1px solid #4a4858', borderRadius: 10,
  background: '#0f0f1b', color: '#fff', padding: '13px 12px', fontSize: 16,
  marginTop: 6, boxSizing: 'border-box',
}
const buttonStyle: React.CSSProperties = {
  width: '100%', background: '#c8a84b', color: '#0c0c15', border: 0,
  borderRadius: 10, minHeight: 48, fontWeight: 800, cursor: 'pointer', marginTop: 16,
}

async function consentApi(path: string, body?: unknown) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sign in to your learner account.')
  const response = await fetch('/api/learner/consent' + path, {
    method: body ? 'POST' : 'GET', cache: 'no-store',
    headers: {
      Authorization: 'Bearer ' + session.access_token,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error ?? 'Verification is unavailable.')
  return result
}

export default function LearnerGuardianConsentPage() {
  const [learnerEmail, setLearnerEmail] = useState('')
  const [guardianName, setGuardianName] = useState('')
  const [guardianEmail, setGuardianEmail] = useState('')
  const [relationship, setRelationship] = useState('mother')
  const [agreed, setAgreed] = useState(false)
  const [current, setCurrent] = useState<RequestStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    const data = await consentApi('')
    setCurrent(data.request ?? null)
    setEnabled(true)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function initialize() {
      const verify = new URLSearchParams(window.location.search).get('verify')
      if (verify) window.history.replaceState(null, '', '/student/guardian-consent')
      try {
        if (verify) {
          const response = await consentApi('/verify', { token: verify })
          if (!cancelled) setMessage(response.message)
        }
        if (!cancelled) await refresh()
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Unable to load verification.')
          if (!verify) setEnabled(false)
        }
      } finally { if (!cancelled) setLoaded(true) }
    }
    void initialize()
    return () => { cancelled = true }
  }, [refresh])

  async function start(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError(''); setMessage('')
    try {
      const result = await consentApi('', {
        learner_email: learnerEmail, guardian_name: guardianName,
        guardian_email: guardianEmail, guardian_relationship: relationship,
        acknowledge_processing: agreed,
      })
      setMessage(result.message)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not request verification.')
    } finally { setBusy(false) }
  }

  async function resend() {
    if (busy) return
    setBusy(true); setError(''); setMessage('')
    try {
      const response = await consentApi('/verify', { resend: true })
      setMessage(response.message)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Cannot resend approval yet.')
    } finally { setBusy(false) }
  }

  return <section style={shell} aria-labelledby="verification-title">
    <p style={{ color: '#c8a84b', fontSize: 11, fontWeight: 800 }}>LEARNER SAFETY</p>
    <h1 id="verification-title" style={{ fontSize: 25, margin: '8px 0' }}>Email & guardian verification</h1>
    <p style={{ color: '#bab9c7', fontSize: 13, lineHeight: 1.5 }}>
      Verify a real learner email first. Your guardian will then receive a separate approval request.
      This does not change your school enrollment.
    </p>
    {error && <p role="alert" style={{ color: '#ffb4b4' }}>{error}</p>}
    {message && <p role="status" style={{ color: '#a7f3d0' }}>{message}</p>}
    {!loaded && <p>Checking your status…</p>}
    {loaded && !enabled && <p>Verification is not available yet. Your existing school account is unchanged.</p>}
    {loaded && enabled && current && <div style={{ padding: 14, background: '#252437', borderRadius: 10, marginTop: 15 }}>
      <strong>Status: {current.status.replace(/_/g, ' ')}</strong>
      <p style={{ fontSize: 13, lineHeight: 1.5 }}>
        Learner email: {current.learner_email_verified_at ? 'Verified' : 'Check your inbox'}
      </p>
      <p style={{ fontSize: 13, lineHeight: 1.5 }}>
        Guardian: {current.status === 'approved' ? 'Approved' : current.status === 'withdrawn' ? 'Consent withdrawn' : 'Awaiting authorization'}
      </p>
      {current.status === 'pending' && current.learner_email_verified_at && <button
        style={buttonStyle} disabled={busy} type="button" onClick={() => void resend()}>
        {busy ? 'Sending…' : 'Resend guardian approval'}
      </button>}
    </div>}
    {loaded && enabled && (!current || ['rejected', 'withdrawn', 'expired', 'review_required'].includes(current.status)) && <form onSubmit={event => void start(event)} style={{ marginTop: 18 }}>
      <label style={{ display: 'block', fontSize: 13 }}>Your email
        <input type="email" required autoComplete="email" style={inputStyle} value={learnerEmail}
          onChange={e => setLearnerEmail(e.target.value)} placeholder="learner@example.com" />
      </label>
      <label style={{ display: 'block', fontSize: 13, marginTop: 14 }}>Guardian name
        <input required maxLength={100} autoComplete="off" style={inputStyle} value={guardianName}
          onChange={e => setGuardianName(e.target.value)} />
      </label>
      <label style={{ display: 'block', fontSize: 13, marginTop: 14 }}>Guardian email
        <input type="email" required autoComplete="off" style={inputStyle} value={guardianEmail}
          onChange={e => setGuardianEmail(e.target.value)} placeholder="guardian@example.com" />
      </label>
      <label style={{ display: 'block', fontSize: 13, marginTop: 14 }}>Relationship
        <select style={inputStyle} value={relationship} onChange={e => setRelationship(e.target.value)}>
          <option value="mother">Mother</option>
          <option value="father">Father</option>
          <option value="legal_guardian">Legal guardian</option>
          <option value="other_guardian">Other guardian</option>
        </select>
      </label>
      <label style={{ display: 'flex', alignItems: 'start', gap: 9, marginTop: 18, fontSize: 12, lineHeight: 1.5 }}>
        <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} required />
        I understand these contact details are used to request and record guardian authorization for personal learning.
      </label>
      <button type="submit" style={buttonStyle} disabled={busy || !agreed}>
        {busy ? 'Sending…' : 'Verify my email'}
      </button>
      <p style={{ fontSize: 12, color: '#b2b0be' }}>
        The guardian will review the request on their own verified VibeSchool account.
      </p>
    </form>}
    <p style={{ fontSize: 12, marginTop: 18 }}><a href="/student/profile" style={{ color: '#e2c572' }}>Back to learner profile</a></p>
  </section>
}
