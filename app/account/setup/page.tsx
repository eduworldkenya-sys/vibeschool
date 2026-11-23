'use client'
import { useEffect, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { normalizeUsername, safeReturnPath, validateUsername } from '@/lib/identity/username'

type IdentityResponse = { self: { username?: string | null } | null }
export default function IdentitySetupPage() {
  const router = useRouter()
  const params = useSearchParams()
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const destination = safeReturnPath(params.get('next')) || '/'

  useEffect(() => {
    let active = true
    fetch('/api/identity/me', { cache: 'no-store' }).then(async response => {
      if (response.status === 401) {
        router.replace(`/login?redirect=${encodeURIComponent('/account/setup?next=' + encodeURIComponent(destination))}`)
        return
      }
      if (!response.ok) throw new Error('Unavailable')
      const data = await response.json() as IdentityResponse
      if (active && data.self?.username) router.replace(destination)
    }).catch(() => { if (active) setMessage('Could not check your account. Try again.') })
    return () => { active = false }
  }, [router, destination])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const valid = validateUsername(username)
    if (!valid) { setMessage('Start with a letter; use 3–24 letters, digits or underscores.'); return }
    setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/identity/me', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: valid }),
      })
      const result = await response.json()
      if (!response.ok) { setMessage(result.error || 'Could not save username'); return }
      router.replace(destination)
    } catch { setMessage('Connection failed. Try again.') }
    finally { setBusy(false) }
  }

  return <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 20 }}>
    <form onSubmit={submit} style={{ width: '100%', maxWidth: 390, display: 'grid', gap: 14 }}>
      <h1>Choose your VibeSchool username</h1>
      <p>One identity across VibeSchool. School membership is optional.</p>
      <label htmlFor="username">Username</label>
      <input id="username" required minLength={3} maxLength={25} autoComplete="nickname"
        value={username} onChange={e => setUsername(normalizeUsername(e.target.value))}
        placeholder="brian254" style={{ minHeight: 48, fontSize: 16, padding: 12 }} />
      <p>@{username || 'yourname'}</p>
      {message && <p role="alert">{message}</p>}
      <button type="submit" disabled={busy} style={{ minHeight: 48 }}>{busy ? 'Saving…' : 'Continue'}</button>
    </form>
  </main>
}
