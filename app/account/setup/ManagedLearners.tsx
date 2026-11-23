'use client'
import { useEffect, useState, type FormEvent } from 'react'

type Identity = { id: string; username: string; display_name: string }
type Identities = { self: Identity | null; managed_learners: Identity[] }
export default function ManagedLearners() {
  const [data, setData] = useState<Identities | null>(null)
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [grade, setGrade] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function load() {
    const response = await fetch('/api/identity/me', { cache: 'no-store' })
    if (!response.ok) throw new Error('Could not load your profiles')
    setData(await response.json() as Identities)
  }
  useEffect(() => { void load().catch(() => setError('Could not load profiles.')) }, [])
  async function create(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/identity/children', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, username, grade }),
      })
      const result = await response.json()
      if (!response.ok) { setError(result.error || 'Unable to add learner'); return }
      setName(''); setUsername(''); setGrade('')
      await load()
    } catch { setError('Could not connect. Try again.') }
    finally { setBusy(false) }
  }
  return <section style={{ maxWidth: 480, margin: 'auto', padding: 20 }}>
    <h1>My learners</h1>
    <p>Each child has a separate identity and learning history.</p>
    <ul>{(data?.managed_learners || []).map(child => <li key={child.id}>
      {child.display_name} · @{child.username}
    </li>)}</ul>
    <form onSubmit={create} style={{ display: 'grid', gap: 12 }}>
      <h2>Add a learner</h2>
      <label>Display name<input required maxLength={80} value={name} onChange={e => setName(e.target.value)} /></label>
      <label>Username<input required minLength={3} maxLength={24} value={username} onChange={e => setUsername(e.target.value)} placeholder="brian254" /></label>
      <label>Learning level (optional)<input maxLength={60} value={grade} onChange={e => setGrade(e.target.value)} placeholder="Grade 4" /></label>
      {error && <p role="alert">{error}</p>}
      <button disabled={busy} type="submit">{busy ? 'Saving…' : 'Add learner'}</button>
      <p>Creating a managed learner profile does not grant a child login or school access. Verified setup is required for these connections.</p>
    </form>
  </section>
}
