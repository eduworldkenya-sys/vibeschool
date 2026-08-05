'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getMyResult, type LearnerResultDetail } from '@/lib/assessment/results'

export default function StudentResultDetailPage() {
  const params = useParams<{ attemptId: string }>()
  const router = useRouter()
  const [result, setResult] = useState<LearnerResultDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await getMyResult(params.attemptId)
        if (!cancelled) setResult(data)
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load result.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [params.attemptId])

  if (loading) return <main style={shell}>Loading result…</main>
  if (!result) return <main style={shell}><section style={{ ...card, color: '#b91c1c' }}>{error || 'Result unavailable.'}</section></main>

  return (
    <main style={shell}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <button type="button" onClick={() => router.back()} style={{ ...secondaryButton, marginBottom: 12 }}>← Back to results</button>

        <section style={card}>
          <div style={eyebrow}>{result.assessmentType.replaceAll('_', ' ')}</div>
          <h1 style={{ margin: '6px 0' }}>{result.title}</h1>
          <div style={{ display: 'flex', gap: 16, alignItems: 'baseline', marginTop: 12 }}>
            <strong style={{ fontSize: 32, color: '#065f46' }}>{result.percentage.toFixed(1)}%</strong>
            <span style={{ color: '#6b7280' }}>{result.score}/{result.maxScore}</span>
          </div>
          {result.feedback && (
            <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: '#ecfdf5', color: '#065f46', lineHeight: 1.5 }}>
              <strong>Teacher feedback</strong>
              <div style={{ marginTop: 4 }}>{result.feedback}</div>
            </div>
          )}
        </section>

        {result.items.map(item => (
          <section key={item.assessmentItemId} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <strong>Question {item.orderNum}</strong>
              <span>{item.finalScore}/{item.maxScore}</span>
            </div>
            <p style={{ lineHeight: 1.6 }}>{item.prompt}</p>
            <div style={answerBox}>
              <div style={label}>Your answer</div>
              {item.responseText || JSON.stringify(item.responseValue)}
            </div>
            {item.teacherFeedback && (
              <div style={{ ...answerBox, marginTop: 10, borderColor: '#bfdbfe', background: '#eff6ff' }}>
                <div style={label}>Teacher feedback</div>
                {item.teacherFeedback}
              </div>
            )}
            {item.correctAnswer !== null && (
              <div style={{ ...answerBox, marginTop: 10, borderColor: '#a7f3d0', background: '#ecfdf5' }}>
                <div style={label}>Correct answer</div>
                {typeof item.correctAnswer === 'string' ? item.correctAnswer : JSON.stringify(item.correctAnswer)}
              </div>
            )}
            {item.explanation && <p style={{ color: '#374151', lineHeight: 1.5 }}><strong>Explanation:</strong> {item.explanation}</p>}
            {item.workedSolution && <p style={{ color: '#374151', lineHeight: 1.5 }}><strong>Worked solution:</strong> {item.workedSolution}</p>}
          </section>
        ))}

        {result.canRetry && (
          <section style={{ ...card, borderColor: '#c7d2fe', background: '#eef2ff' }}>
            <strong>Another attempt is available</strong>
            <p style={{ color: '#4b5563' }}>Return to My Assessments to retry when your teacher allows it.</p>
            <button type="button" onClick={() => router.push('/student/assessment')} style={primaryButton}>Open My Assessments</button>
          </section>
        )}
      </div>
    </main>
  )
}

const shell: React.CSSProperties = { minHeight: '100vh', background: '#f8fafc', padding: '18px 14px 80px', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#111827' }
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, marginBottom: 12 }
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: '#4338ca', textTransform: 'uppercase', letterSpacing: 1 }
const answerBox: React.CSSProperties = { background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap' }
const label: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 }
const primaryButton: React.CSSProperties = { width: '100%', border: 'none', borderRadius: 12, padding: '12px 16px', background: '#4338ca', color: '#fff', fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }
const secondaryButton: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 10, padding: '10px 14px', background: '#fff', color: '#374151', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }
