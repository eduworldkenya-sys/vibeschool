'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
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

  return (
    <main style={shell}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <section style={card}>
          <div style={eyebrow}>Assessment Engine</div>
          <h1 style={{ margin: '6px 0' }}>My Results</h1>
          <p style={{ margin: 0, color: '#6b7280' }}>Released scores, teacher feedback, and question-by-question review.</p>
        </section>

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
const primaryButton: React.CSSProperties = { width: '100%', border: 'none', borderRadius: 12, padding: '12px 16px', background: '#4338ca', color: '#fff', fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }
