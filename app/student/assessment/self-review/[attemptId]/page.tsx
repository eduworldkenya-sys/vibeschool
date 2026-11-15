'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import SelfReviewPanel from '@/components/student/exams/SelfReviewPanel'
import { getMySelfReview, type SelfReviewItem } from '@/lib/assessment/self-review'

export default function PracticeWrittenSelfReviewPage() {
  const { attemptId } = useParams<{ attemptId: string }>()
  const router = useRouter()
  const [items, setItems] = useState<SelfReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void getMySelfReview(attemptId)
      .then(data => { if (!cancelled) setItems(data) })
      .catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Written review unavailable.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [attemptId])

  const reviewed = items.filter(item => item.reviewedAt !== null)
  const total = reviewed.reduce((sum, item) => sum + (item.selfReviewScore ?? 0), 0)
  const possible = reviewed.reduce((sum, item) => sum + item.maxScore, 0)

  return <main style={{ padding: '20px 14px 70px', maxWidth: 740, margin: '0 auto', color: 'var(--vs-text)' }}>
    <button type="button" onClick={() => router.push('/student/vibelearn/exams')}
      style={{ padding: '10px 12px', minHeight: 44, background: 'transparent', color: 'inherit', border: '1px solid var(--vs-border)', borderRadius: 10 }}>
      Back to exams
    </button>
    <h1 style={{ fontSize: 24, margin: '20px 0 8px' }}>Review your written answers</h1>
    <p style={{ color: 'var(--vs-muted)', lineHeight: 1.6 }}>
      Your answers are submitted and locked. Compare each with the expected points and tick only those you included.
      Your self-awarded marks are for practice, not independently verified exam results.
    </p>
    {loading && <p role="status">Loading your marking guide…</p>}
    {error && <p role="alert">{error}</p>}
    {!loading && !error && items.length === 0 && <p>No point-form written marking guides are available for this attempt.</p>}
    {reviewed.length > 0 && <p aria-live="polite" style={{ fontWeight: 700 }}>
      Self-awarded: {total} / {possible} marks across {reviewed.length} reviewed {reviewed.length === 1 ? 'answer' : 'answers'} — not verified.
    </p>}
    <div style={{ display: 'grid', gap: 20 }}>
      {items.map((item, index) => <section key={item.assessmentItemId}
        style={{ border: '1px solid var(--vs-border)', borderRadius: 14, padding: 16 }}>
        <h2 style={{ fontSize: 17, margin: '0 0 12px' }}>Question {index + 1}</h2>
        <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{item.prompt}</p>
        <h3 style={{ fontSize: 14 }}>Your submitted answer</h3>
        <p style={{ whiteSpace: 'pre-wrap', padding: 12, borderRadius: 8, background: 'var(--vs-soft)', minHeight: 44 }}>
          {item.responseText?.trim() || 'Not answered'}
        </p>
        <SelfReviewPanel key={item.assessmentItemId + ':' + (item.reviewedAt ?? 'new')}
          attemptId={attemptId} review={item}
          onSaved={updated => setItems(current => current.map(entry =>
            entry.assessmentItemId === updated.assessmentItemId ? updated : entry
          ))} />
      </section>)}
    </div>
  </main>
}
