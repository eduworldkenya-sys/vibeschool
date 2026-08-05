'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { listMyResults, type LearnerResultSummary } from '@/lib/assessment/results'

export default function StudentResultsPage() {
  const router = useRouter()
  const [results, setResults] = useState<LearnerResultSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await listMyResults()
        if (!cancelled) setResults(data)
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load results.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const average = useMemo(() => results.length === 0 ? null : results.reduce((sum, item) => sum + item.percentage, 0) / results.length, [results])

  return (
    <main style={shell}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <section style={card}>
          <div style={eyebrow}>Assessment Engine</div>
          <h1 style={{ margin: '6px 0' }}>My Results</h1>
          <p style={{ margin: 0, color: '#6b7280' }}>Released scores, teacher feedback, and your complete assessment history.</p>
        </section>

        {!loading && results.length > 0 && <section style={card}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
            <div style={stat}><strong>{results.length}</strong><span>Released results</span></div>
            <div style={stat}><strong>{average?.toFixed(1)}%</strong><span>Average</span></div>
          </div>
        </section>}

        {loading ? (
          <section style={card}>Loading results…</section>
        ) : error ? (
          <section style={{ ...card, color: '#b91c1c' }}>{error}</section>
        ) : results.length === 0 ? (
          <section style={card}>
            <strong>No released results yet</strong>
            <p style={{ color: '#6b7280', marginBottom: 0 }}>Results appear here after your teacher releases them.</p>
          </section>
        ) : results.map(result => (
          <section key={result.attemptId} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={eyebrow}>{result.assessmentType.replaceAll('_', ' ')}</div>
                <h2 style={{ fontSize: 17, margin: '5px 0' }}>{result.title}</h2>
                <div style={muted}>Attempt {result.attemptNumber} of {result.maxAttempts}</div>
                {result.releasedAt && <div style={muted}>Released {new Date(result.releasedAt).toLocaleString('en-KE')}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong style={{ fontSize: 22, color: '#065f46' }}>{result.percentage.toFixed(1)}%</strong>
                <div style={{ color: '#6b7280', fontSize: 12 }}>{result.score}/{result.maxScore}</div>
              </div>
            </div>
            {result.feedback && <p style={{ color: '#374151', lineHeight: 1.5 }}>{result.feedback}</p>}
            <button type="button" onClick={() => router.push(`/student/results/${result.attemptId}`)} style={primaryButton}>
              Review Result
            </button>
          </section>
        ))}
      </div>
    </main>
  )
}

const shell: React.CSSProperties = { minHeight: '100vh', background: '#f8fafc', padding: '18px 14px 80px', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#111827' }
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, marginBottom: 12 }
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: '#4338ca', textTransform: 'uppercase', letterSpacing: 1 }
const muted: React.CSSProperties = { fontSize: 12, color: '#6b7280', marginTop: 3 }
const stat: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, padding: 12, borderRadius: 12, background: '#f8fafc', textAlign: 'center', fontSize: 12 }
const primaryButton: React.CSSProperties = { width: '100%', border: 'none', borderRadius: 12, padding: '12px 16px', background: '#4338ca', color: '#fff', fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }
