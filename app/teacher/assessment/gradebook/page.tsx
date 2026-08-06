'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { getTeacherGradebook, type TeacherGradebook } from '@/lib/assessment/integration'

export default function AssessmentGradebookPage() {
  const [gradebook, setGradebook] = useState<TeacherGradebook | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await getTeacherGradebook()
        if (!cancelled) setGradebook(data)
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load gradebook.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  return (
    <main style={shell}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <section style={card}>
          <div style={eyebrow}>Assessment Engine</div>
          <h1 style={{ margin: '6px 0' }}>Unified Gradebook</h1>
          <p style={{ margin: 0, color: '#6b7280' }}>Released assessment results synchronized with competency evidence, learner progress, and report cards.</p>
        </section>

        {error && <section style={{ ...card, color: '#b91c1c', borderColor: '#fecaca' }}>{error}</section>}

        {gradebook && <section style={card}>
          <div style={metricGrid}>
            <Metric label="Released results" value={String(gradebook.summary.entryCount)} />
            <Metric label="Average" value={formatPercent(gradebook.summary.averagePercentage)} />
            <Metric label="Highest" value={formatPercent(gradebook.summary.highestPercentage)} />
            <Metric label="Lowest" value={formatPercent(gradebook.summary.lowestPercentage)} />
          </div>
        </section>}

        <section style={card}>
          {loading ? 'Loading gradebook…' : !gradebook || gradebook.entries.length === 0 ? (
            <div><strong>No released assessment results yet</strong><p style={{ color: '#6b7280', marginBottom: 0 }}>Results appear here after marking and release.</p></div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {gradebook.entries.map(entry => (
                <div key={entry.attemptId} style={row}>
                  <div>
                    <strong>{entry.studentName}</strong>
                    <div style={muted}>{entry.assessmentTitle} · {entry.assessmentType.replaceAll('_', ' ')}</div>
                    <div style={muted}>{entry.releasedAt ? new Date(entry.releasedAt).toLocaleString('en-KE') : ''}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <strong>{formatPercent(entry.percentage)}</strong>
                    <div style={muted}>{entry.score ?? '—'} / {entry.maxScore ?? '—'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function formatPercent(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(1)}%`
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div style={metric}><div style={muted}>{label}</div><strong style={{ fontSize: 20 }}>{value}</strong></div>
}

const shell: React.CSSProperties = { minHeight: '100vh', background: '#f8fafc', padding: '18px 14px 80px', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#111827' }
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, marginBottom: 12 }
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: '#4338ca', textTransform: 'uppercase', letterSpacing: 1 }
const muted: React.CSSProperties = { fontSize: 12, color: '#6b7280', marginTop: 3 }
const metricGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }
const metric: React.CSSProperties = { background: '#f8fafc', borderRadius: 12, padding: 12 }
const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: 12, border: '1px solid #e5e7eb', borderRadius: 10 }
