'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { getMyResult, type LearnerResultDetail } from '@/lib/assessment/results'
import styles from './result-feedback.module.css'

function isSkipped(responseValue: unknown, responseText: string | null): boolean {
  return (responseValue === null || responseValue === undefined) && !responseText?.trim()
}

function answerWithOption(value: unknown, options: { value: string; label: string }[]): string {
  if (value === null || value === undefined) return 'Not answered'
  const code = typeof value === 'string' ? value : JSON.stringify(value)
  const match = options.find(option => option.value === code)
  return match ? `${match.value}. ${match.label}` : code
}

export default function StudentResultDetailPage() {
  const params = useParams<{ attemptId: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get('from')
  const returnPath = `/student/vibelearn/exams?view=${from === 'progress' || from === 'history' ? from : 'for-you'}`
  const [reviewFilter, setReviewFilter] = useState<'all' | 'mistakes' | 'skipped'>('all')
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

  const skipped = result?.items.filter(item => isSkipped(item.responseValue, item.responseText)) ?? []
  const incorrect = result?.items.filter(item => !isSkipped(item.responseValue, item.responseText) && item.finalScore < item.maxScore) ?? []
  const correct = result?.items.filter(item => !isSkipped(item.responseValue, item.responseText) && item.finalScore === item.maxScore) ?? []
  const reviewItems = result?.items.filter(item => reviewFilter === 'all' || (reviewFilter === 'skipped'
    ? isSkipped(item.responseValue, item.responseText)
    : isSkipped(item.responseValue, item.responseText) || item.finalScore < item.maxScore)) ?? []

  if (loading) return <main style={shell}>Loading result…</main>
  if (!result) return <main style={shell}><section style={{ ...card, color: '#b91c1c' }}>{error || 'Result unavailable.'}</section></main>

  return (
    <main style={shell}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <button type="button" onClick={() => router.push(returnPath)} style={{ ...secondaryButton, marginBottom: 12 }}>← Back to results</button>

        <section style={card}>
          <div style={eyebrow}>{result.assessmentType.replaceAll('_', ' ')}</div>
          <h1 style={{ margin: '6px 0' }}>{result.title}</h1>
          <div className={styles.scoreBlock} aria-label={`Your score is ${result.percentage.toFixed(1)} percent`}>
            <div className={styles.scoreTop}>
              <strong className={styles.scoreNumber}>{result.percentage.toFixed(1)}%</strong>
              <span className={styles.scoreFraction}>{result.score}/{result.maxScore} marks</span>
            </div>
            <div className={styles.scoreProgress} aria-hidden="true">
              <div className={styles.scoreFill} style={{ width: `${Math.max(0, Math.min(100, result.percentage))}%` }} />
            </div>
          </div>
          <div style={muted}>Attempt {result.attemptNumber} of {result.maxAttempts}</div>
          <div style={{ ...muted, color: '#92400e', fontWeight: 700 }}>{skipped.length} skipped / unanswered · 0 marks for each skipped question</div>
          {result.releasedAt && <div style={muted}>Released {new Date(result.releasedAt).toLocaleString('en-KE')}</div>}
          {(skipped.length + incorrect.length) > 0 && (
            <button type="button" style={{ ...secondaryButton, marginTop: 12 }}
              onClick={() => router.push(`/student/vibelearn/recovery?attempt=${encodeURIComponent(params.attemptId)}`)}>
              Recover missed and skipped learning outcomes
            </button>
          )}
          {result.feedback && (
            <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: '#ecfdf5', color: '#065f46', lineHeight: 1.5 }}>
              <strong>Teacher feedback</strong>
              <div style={{ marginTop: 4 }}>{result.feedback}</div>
            </div>
          )}
        </section>

        {!result.answersRevealed && (
          <section style={{ ...card, borderColor: '#fde68a', background: '#fffbeb' }}>
            <strong style={{ color: '#92400e' }}>Answer review is not available yet</strong>
            <p style={{ color: '#78350f', marginBottom: 0 }}>
              Your score and teacher feedback are available, but correct answers and solutions remain hidden under this assessment’s review policy.
            </p>
          </section>
        )}

        <section style={card} aria-label="Question review filters">
          <p style={{ marginTop: 0, fontWeight: 700 }}>Review: {correct.length} correct · {incorrect.length} incorrect · {skipped.length} skipped</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(['all', 'mistakes', 'skipped'] as const).map(filter => (
              <button key={filter} type="button" aria-pressed={reviewFilter === filter}
                onClick={() => setReviewFilter(filter)}
                style={{ ...secondaryButton, background: reviewFilter === filter ? 'var(--vs-accent-soft)' : 'var(--vs-card)', borderColor: reviewFilter === filter ? 'var(--vs-accent)' : 'var(--vs-border)' }}>
                {filter === 'all' ? 'All questions' : filter === 'mistakes' ? 'Mistakes and skips' : 'Skipped only'}
              </button>
            ))}
          </div>
        </section>
        {reviewItems.length === 0 && <section style={card}>No questions match this filter.</section>}
        {reviewItems.map(item => (
          <section key={item.assessmentItemId} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <strong>Question {item.orderNum} {isSkipped(item.responseValue, item.responseText) ? '· Skipped' : ''}</strong>
              <span>{item.finalScore}/{item.maxScore}</span>
            </div>
            <p style={{ lineHeight: 1.6 }}>{item.prompt}</p>
            <div style={answerBox}>
              <div style={label}>{isSkipped(item.responseValue, item.responseText) ? 'Skipped — 0 marks' : 'Your answer'}</div>
              {item.options.length ? answerWithOption(item.responseValue ?? item.responseText, item.options) : item.responseText || answerWithOption(item.responseValue, [])}
            </div>
            {item.teacherFeedback && (
              <div style={{ ...answerBox, marginTop: 10, borderColor: '#bfdbfe', background: '#eff6ff' }}>
                <div style={label}>Teacher feedback</div>
                {item.teacherFeedback}
              </div>
            )}
            {item.answerRevealed && item.correctAnswer !== null && (
              <div style={{ ...answerBox, marginTop: 10, borderColor: '#a7f3d0', background: '#ecfdf5' }}>
                <div style={label}>Correct answer</div>
                {answerWithOption(item.correctAnswer, item.options)}
              </div>
            )}
            {item.explanation && <p style={{ color: '#374151', lineHeight: 1.5 }}><strong>Explanation:</strong> {item.explanation}</p>}
            {item.workedSolution && <p style={{ color: '#374151', lineHeight: 1.5 }}><strong>Worked solution:</strong> {item.workedSolution}</p>}
            {(isSkipped(item.responseValue, item.responseText) || item.finalScore < item.maxScore) &&
              <button type="button" style={{...secondaryButton,marginTop:10}}
                onClick={() => router.push(`/student/vibelearn/recovery?attempt=${encodeURIComponent(params.attemptId)}&item=${encodeURIComponent(item.assessmentItemId)}`)}>
                Recover this exact question
              </button>}
          </section>
        ))}

        {result.canRetry && (
          <section style={{ ...card, borderColor: '#c7d2fe', background: '#eef2ff' }}>
            <strong>Another attempt is available</strong>
            <p style={{ color: '#4b5563' }}>You have used {result.attemptsUsed} of {result.maxAttempts} attempts.</p>
            <button type="button" onClick={() => router.push(`/student/assessment/${encodeURIComponent(result.assignmentId)}`)} style={primaryButton}>Try this exam again</button>
          </section>
        )}
        <button type="button" onClick={() => router.push(returnPath)} style={{ ...secondaryButton, marginTop: 8, width: '100%' }}>Back to Exams</button>
      </div>
    </main>
  )
}

const shell: React.CSSProperties = { minHeight: '60vh', background: 'transparent', padding: '0 0 24px', color: 'var(--vs-text)' }
const card: React.CSSProperties = { background: 'var(--vs-card)', color: 'var(--vs-text)', border: '1px solid var(--vs-border)', borderRadius: 16, padding: 16, marginBottom: 12 }
const eyebrow: React.CSSProperties = { fontSize: 11, fontWeight: 800, color: 'var(--vs-accent)', textTransform: 'uppercase', letterSpacing: 1 }
const muted: React.CSSProperties = { fontSize: 13, color: 'var(--vs-muted)', marginTop: 4 }
const answerBox: React.CSSProperties = { background: 'var(--vs-soft)', color: 'var(--vs-text)', border: '1px solid var(--vs-border)', borderRadius: 10, padding: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap' }
const label: React.CSSProperties = { fontSize: 11, fontWeight: 800, color: 'var(--vs-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 }
const primaryButton: React.CSSProperties = { width: '100%', minHeight: 48, border: 'none', borderRadius: 12, padding: '12px 16px', background: 'var(--vs-accent)', color: 'var(--vs-on-accent)', fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }
const secondaryButton: React.CSSProperties = { minHeight: 44, border: '1px solid var(--vs-border)', borderRadius: 10, padding: '10px 14px', background: 'var(--vs-card)', color: 'var(--vs-text)', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }
