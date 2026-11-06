'use client'
import { useEffect, useState } from 'react'
import { hqSupabase } from '@/lib/hq/supabase'

type Count = { status: string; count: number }

export default function HQLearnerConsentPage() {
  const [counts, setCounts] = useState<Count[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    async function load() {
      try {
        const { data: { session } } = await hqSupabase.auth.getSession()
        if (!session) throw new Error('Sign in to HQ to view consent totals.')
        const response = await fetch('/api/hq/learner-consent', {
          cache: 'no-store', headers: { Authorization: 'Bearer ' + session.access_token },
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Unable to load totals.')
        if (active) setCounts(result.counts)
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load totals.')
      } finally { if (active) setLoading(false) }
    }
    void load()
    return () => { active = false }
  }, [])
  return <main style={{ padding: 24, maxWidth: 900, margin: 'auto' }}>
    <h1>Learner consent register</h1>
    <p>Aggregated status only. Learner and guardian contact details are not displayed here.</p>
    {loading && <p>Loading…</p>}
    {error && <p role="alert">{error}</p>}
    {!loading && !error && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
      {counts.map(row => <section key={row.status} style={{ border: '1px solid #7775', borderRadius: 12, padding: 18 }}>
        <div style={{ textTransform: 'capitalize', fontSize: 13 }}>{row.status.replace(/_/g, ' ')}</div>
        <strong style={{ fontSize: 30 }}>{row.count}</strong>
      </section>)}
    </div>}
  </main>
}
