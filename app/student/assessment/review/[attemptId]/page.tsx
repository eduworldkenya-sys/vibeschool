'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import SelfReviewPanel from '@/components/student/exams/SelfReviewPanel'
import {
  getMyPracticeReview,
  type ImmediatePracticeReview,
  type SelfReviewItem,
} from '@/lib/assessment/self-review'

export const dynamic = 'force-dynamic'

const surface = {
  background: 'var(--vs-card)',
  border: '1px solid var(--vs-border)',
  borderRadius: 16,
  padding: 18,
} as const

export default function ImmediatePracticeReviewPage() {
  const router = useRouter()
  const { attemptId } = useParams<{ attemptId: string }>()
  const [review, setReview] = useState<ImmediatePracticeReview | null>(null)
  const [reviews, setReviews] = useState<Record<string, SelfReviewItem>>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const data = await getMyPracticeReview(attemptId)
        if (!active) return
        setReview(data)
        setReviews(Object.fromEntries(data.reviews.map(item => [item.assessmentItemId, item])))
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'This result is not available.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [attemptId])

  const written = useMemo(() => Object.values(reviews), [reviews])
  const saved = written.filter(item => item.reviewedAt !== null)
  const selfMarks = saved.reduce((n, item) => n + (item.selfReviewScore ?? 0), 0)
  const reviewedMax = saved.reduce((n, item) => n + item.maxScore, 0)
  const allReviewed = review !== null && review.writtenMax > 0 &&
    review.items.filter(item => item.autoScore === null).every(item =>
      reviews[item.assessmentItemId]?.reviewedAt != null)
  const reported = review ? review.verifiedScore + selfMarks : 0
  const maxPossible = review ? review.verifiedMax + review.writtenMax : 0

  return <main style={{ maxWidth: 840, margin: '0 auto', padding: '14px 16px 36px', color: 'var(--vs-text)' }}>
    <button type="button" onClick={() => router.push('/student/vibelearn/exams')}
      style={{ marginBottom: 16, padding: '9px 12px', border: '1px solid var(--vs-border)', borderRadius: 10, background: 'var(--vs-card)', color: 'var(--vs-text)', cursor: 'pointer' }}>
      ← Back to Exams
    </button>
    {loading && <section role="status" style={surface}>Loading your written-answer review…</section>}
    {!loading && error && <section role="alert" style={surface}>
      <strong>Review not available</strong>
      <p>{error}</p>
      <p style={{ color: 'var(--vs-muted)' }}>Only your own submitted practice can be reviewed when its answer policy allows it. Formal exam answers remain protected.</p>
    </section>}
    {review && <>
      <header style={{ ...surface, marginBottom: 15 }}>
        <p style={{ margin: '0 0 7px', color: 'var(--vs-accent)', fontSize: 11, fontWeight: 800, letterSpacing: 1.1 }}>VIBESCHOOL · GUIDED PRACTICE REVIEW</p>
        <h1 style={{ fontSize: 26, lineHeight: 1.2, margin: '0 0 8px' }}>{review.title}</h1>
        <p style={{ color: 'var(--vs-muted)', lineHeight: 1.5 }}>Your original answers are saved and locked. Compare them with the expected marking points. This is learning feedback, not a verified formal exam result.</p>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(155px,1fr))', marginTop: 14 }}>
          <div style={{ background: 'var(--vs-soft)', padding: 13, borderRadius: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--vs-muted)' }}>Automatically verified</div>
            <strong style={{ fontSize: 23 }}>{review.verifiedScore} / {review.verifiedMax}</strong>
          </div>
          <div style={{ background: 'var(--vs-soft)', padding: 13, borderRadius: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--vs-muted)' }}>Self-awarded · unverified</div>
            <strong style={{ fontSize: 23 }}>{selfMarks} / {reviewedMax}</strong>
          </div>
        </div>
        {allReviewed && <p role="status" style={{ fontWeight: 700 }}>
          Total reported: {reported} / {maxPossible} marks, including learner self-assessment. Not an independently verified score.
        </p>}
        {!allReviewed && review.writtenMax > 0 &&
          <p role="status" style={{ color: 'var(--vs-muted)', fontSize: 13 }}>
            {saved.length} of {review.items.filter(item => item.autoScore === null).length} written answers reviewed. A combined score appears after all have been self-reviewed.
          </p>}
      </header>
      {review.items.map(item => {
        const rubric = reviews[item.assessmentItemId]
        const answer = item.responseText?.trim() || (item.responseValue == null
          ? 'Not answered' : typeof item.responseValue === 'string'
            ? item.responseValue : JSON.stringify(item.responseValue))
        return <section key={item.assessmentItemId} style={{ ...surface, marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <strong>Question {item.orderNum}</strong>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--vs-muted)' }}>
              {item.autoScore !== null ? `Automatically checked: ${item.autoScore}/${item.maxScore}` : 'Written answer'}
            </span>
          </div>
          <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{item.prompt}</p>
          <div style={{ background: 'var(--vs-soft)', borderRadius: 10, padding: 12, whiteSpace: 'pre-wrap' }}>
            <strong style={{ fontSize: 12 }}>Your submitted answer</strong>
            <div style={{ marginTop: 6, lineHeight: 1.6 }}>{answer}</div>
          </div>
          {item.autoScore !== null && item.correctAnswer !== null &&
            <p style={{ fontSize: 14, lineHeight: 1.5 }}><strong>Expected answer:</strong> {typeof item.correctAnswer === 'string' ? item.correctAnswer : JSON.stringify(item.correctAnswer)}</p>}
          {item.explanation && <p style={{ fontSize: 14, lineHeight: 1.5 }}><strong>Explanation:</strong> {item.explanation}</p>}
          {item.workedSolution && <p style={{ fontSize: 14, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}><strong>Worked solution:</strong> {item.workedSolution}</p>}
          {item.autoScore === null && rubric && (
            <SelfReviewPanel attemptId={attemptId} review={rubric}
              onSaved={updated => setReviews(current => ({ ...current, [updated.assessmentItemId]: updated }))} />
          )}
          {item.autoScore === null && !rubric &&
            <p style={{ color: 'var(--vs-muted)', fontSize: 13 }}>
              A verified point-form marking scheme is not available for this question. Your answer remains unverified and no marks have been invented.
            </p>}
        </section>
      })}
    </>}
  </main>
}
