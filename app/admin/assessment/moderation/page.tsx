'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import {
  getScoreAudit,
  listModerationQueue,
  reviewModeration,
  type ModerationQueueItem,
  type ScoreAuditEvent,
} from '@/lib/assessment/moderation'

export default function AssessmentModerationPage() {
  const [queue, setQueue] = useState<ModerationQueueItem[]>([])
  const [audit, setAudit] = useState<Record<string, ScoreAuditEvent[]>>({})
  const [reviewReason, setReviewReason] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function loadQueue() {
    setLoading(true)
    setError('')
    try {
      setQueue(await listModerationQueue())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load moderation queue.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadQueue() }, [])

  async function toggleAudit(item: ModerationQueueItem) {
    if (audit[item.responseId]) {
      setAudit(current => {
        const next = { ...current }
        delete next[item.responseId]
        return next
      })
      return
    }
    setBusyId(item.requestId)
    try {
      setAudit(current => ({ ...current, [item.responseId]: await getScoreAudit(item.responseId) }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load score history.')
    } finally {
      setBusyId(null)
    }
  }

  async function decide(item: ModerationQueueItem, decision: 'approved' | 'rejected') {
    const reason = reviewReason[item.requestId]?.trim() ?? ''
    if (reason.length < 5) {
      setError('Enter a moderation reason of at least 5 characters.')
      return
    }
    setBusyId(item.requestId)
    setError('')
    try {
      await reviewModeration({ requestId: item.requestId, decision, reason })
      setQueue(current => current.filter(request => request.requestId !== item.requestId))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Moderation decision could not be saved.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <main style={shell}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <section style={card}>
          <div style={eyebrow}>Assessment Governance</div>
          <h1 style={{ margin: '6px 0' }}>Marking Moderation</h1>
          <p style={{ margin: 0, color: '#6b7280' }}>Review score-change requests before results are released.</p>
        </section>

        {error && <section style={{ ...card, color: '#b91c1c', borderColor: '#fecaca' }}>{error}</section>}

        {loading ? <section style={card}>Loading moderation requests…</section>
          : queue.length === 0 ? <section style={card}><strong>No pending moderation requests</strong><p style={{ color: '#6b7280', marginBottom: 0 }}>Teacher requests will appear here.</p></section>
          : queue.map(item => (
            <section key={item.requestId} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={eyebrow}>{item.assessmentTitle}</div>
                  <h2 style={{ fontSize: 18, margin: '5px 0' }}>{item.studentName}</h2>
                  <div style={muted}>Requested by {item.teacherName}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <strong style={{ fontSize: 20, color: '#4338ca' }}>{item.requestedScore}/{item.maxScore}</strong>
                  <div style={muted}>Current: {item.currentScore ?? '—'}</div>
                </div>
              </div>

              <div style={questionBox}>{item.prompt}</div>
              <div style={reasonBox}><strong>Teacher reason</strong><div style={{ marginTop: 5 }}>{item.requestReason}</div></div>

              <button type="button" disabled={busyId === item.requestId} onClick={() => void toggleAudit(item)} style={secondaryButton}>
                {audit[item.responseId] ? 'Hide score history' : 'View score history'}
              </button>

              {audit[item.responseId] && <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                {audit[item.responseId].length === 0 ? <div style={muted}>No prior score events.</div> : audit[item.responseId].map(event => (
                  <div key={event.eventId} style={auditRow}>
                    <strong>{event.eventType.replaceAll('_', ' ')}</strong>
                    <div style={muted}>{event.previousScore ?? '—'} → {event.newScore ?? '—'} · {new Date(event.createdAt).toLocaleString('en-KE')}</div>
                    {event.reason && <div style={{ marginTop: 4 }}>{event.reason}</div>}
                  </div>
                ))}
              </div>}

              <textarea
                value={reviewReason[item.requestId] ?? ''}
                onChange={event => setReviewReason(current => ({ ...current, [item.requestId]: event.target.value }))}
                rows={3}
                placeholder="Required moderation reason"
                style={{ ...input, marginTop: 12, resize: 'vertical' }}
              />

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button type="button" disabled={busyId === item.requestId} onClick={() => void decide(item, 'rejected')} style={{ ...secondaryButton, flex: 1 }}>Reject</button>
                <button type="button" disabled={busyId === item.requestId} onClick={() => void decide(item, 'approved')} style={{ ...primaryButton, flex: 1 }}>{busyId === item.requestId ? 'Saving…' : 'Approve change'}</button>
              </div>
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
const questionBox: React.CSSProperties = { marginTop: 14, padding: 12, borderRadius: 10, background: '#f8fafc', lineHeight: 1.5 }
const reasonBox: React.CSSProperties = { marginTop: 10, padding: 12, borderRadius: 10, background: '#fffbeb', color: '#78350f' }
const auditRow: React.CSSProperties = { padding: 10, borderRadius: 10, border: '1px solid #e5e7eb', background: '#f8fafc' }
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: 10, padding: '10px 12px', font: 'inherit' }
const primaryButton: React.CSSProperties = { border: 'none', borderRadius: 12, padding: '12px 16px', background: '#4338ca', color: '#fff', fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }
const secondaryButton: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 10, padding: '10px 14px', background: '#fff', color: '#374151', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }
