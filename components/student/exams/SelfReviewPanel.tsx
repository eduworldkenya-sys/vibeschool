'use client'

import { useState } from 'react'
import { saveMySelfReview, type SelfReviewItem } from '@/lib/assessment/self-review'

type Props = {
  attemptId: string
  review: SelfReviewItem
  onSaved: (updated: SelfReviewItem) => void
}

export default function SelfReviewPanel({ attemptId, review, onSaved }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>(review.selectedIds)
  const [unsure, setUnsure] = useState(review.unsure)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const points = review.criteria
    .filter(criterion => selectedIds.includes(criterion.id))
    .reduce((total, criterion) => total + criterion.marks, 0)

  function toggle(id: string, checked: boolean) {
    setSaved(false)
    setError('')
    setUnsure(false)
    setSelectedIds(current => checked ? [...current.filter(item => item !== id), id] : current.filter(item => item !== id))
  }

  async function persist() {
    if (saving) return
    setSaving(true)
    setError('')
    try {
      const receipt = await saveMySelfReview({
        attemptId,
        assessmentItemId: review.assessmentItemId,
        selectedIds: unsure ? [] : selectedIds,
        unsure,
      })
      setSelectedIds(receipt.selectedIds)
      onSaved({
        ...review,
        selfReviewScore: receipt.selfReviewScore,
        selectedIds: receipt.selectedIds,
        unsure: receipt.unsure,
        reviewedAt: new Date().toISOString(),
      })
      setSaved(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your self-mark could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return <section aria-label="Self-mark this written answer" style={{ marginTop: 14, padding: 14, border: '1px solid var(--vs-border)', borderRadius: 12, background: 'var(--vs-soft)', color: 'var(--vs-text)' }}>
    <h3 style={{ fontSize: 16, margin: '0 0 6px' }}>Check your written answer</h3>
    <p style={{ margin: '0 0 12px', color: 'var(--vs-muted)', fontSize: 13, lineHeight: 1.5 }}>
      Compare the answer you submitted with these expected points. Tick a point only if you included its meaning in your answer. Your answer is already locked.
    </p>
    <div style={{ display: 'grid', gap: 9 }}>
      {review.criteria.map(criterion => (
        <label key={criterion.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, lineHeight: 1.5, cursor: saving ? 'wait' : 'pointer' }}>
          <input type="checkbox" checked={!unsure && selectedIds.includes(criterion.id)}
            disabled={saving} onChange={event => toggle(criterion.id, event.target.checked)}
            style={{ width: 18, height: 18, flexShrink: 0, marginTop: 2 }} />
          <span style={{ flex: 1 }}>{criterion.label}</span>
          <strong style={{ whiteSpace: 'nowrap' }}>{criterion.marks} {criterion.marks === 1 ? 'mark' : 'marks'}</strong>
        </label>
      ))}
    </div>
    <label style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, fontSize: 14 }}>
      <input type="checkbox" checked={unsure} disabled={saving}
        onChange={event => {
          setUnsure(event.target.checked)
          if (event.target.checked) setSelectedIds([])
          setSaved(false)
          setError('')
        }} />
      I'm not sure how to mark this answer
    </label>
    <p style={{ fontWeight: 750, fontSize: 14, margin: '12px 0' }}>
      {unsure ? 'Not sure — no mark awarded' : `Your selected points: ${points} / ${review.maxScore}`}
    </p>
    {review.reviewedAt && <p style={{ margin: '0 0 8px', color: 'var(--vs-muted)', fontSize: 12 }}>
      Saved self-assessment: {review.unsure ? 'Not sure' : `${review.selfReviewScore ?? 0} / ${review.maxScore}`}.
    </p>}
    <button type="button" onClick={() => void persist()} disabled={saving}
      style={{ minHeight: 44, width: '100%', padding: '10px 14px', border: 'none', borderRadius: 10, background: 'var(--vs-accent)', color: 'var(--vs-on-accent)', cursor: saving ? 'wait' : 'pointer', font: 'inherit', fontWeight: 750 }}>
      {saving ? 'Saving…' : 'Save my self-mark'}
    </button>
    {saved && <p role="status" style={{ fontSize: 13, marginBottom: 0 }}>Self-mark saved. This is not an independently verified exam score.</p>}
    {error && <p role="alert" style={{ color: 'var(--vs-error)', fontSize: 13, marginBottom: 0 }}>{error}</p>}
    <p style={{ margin: '10px 0 0', color: 'var(--vs-muted)', fontSize: 12 }}>
      Self-awarded marks are kept separate from the official exam result and gradebook.
    </p>
  </section>
}
