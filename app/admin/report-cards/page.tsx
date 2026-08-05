'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import {
  listReportCards,
  lockReportCard,
  publishReportCard,
  reviewReportCard,
  type ReportCardSummary,
} from '@/lib/report-cards/service'

export default function AdminReportCardsPage() {
  const [items, setItems] = useState<ReportCardSummary[]>([])
  const [reason, setReason] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try { setItems(await listReportCards()) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load report cards.') }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  async function run(item: ReportCardSummary, action: 'approved' | 'returned' | 'published' | 'locked') {
    setBusyId(item.id)
    setError('')
    setMessage('')
    try {
      if (action === 'approved' || action === 'returned') {
        await reviewReportCard({ reportCardId: item.id, decision: action, reason: reason[item.id] ?? null })
      } else if (action === 'published') {
        await publishReportCard(item.id)
      } else {
        await lockReportCard(item.id)
      }
      setMessage(`Report card ${action}.`)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Report card action failed.')
    } finally { setBusyId(null) }
  }

  return (
    <main style={shell}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <section style={card}>
          <div style={eyebrow}>School Reporting Governance</div>
          <h1 style={{ margin: '6px 0' }}>Report Card Review</h1>
          <p style={{ margin: 0, color: '#6b7280' }}>Review, return, approve, publish, and permanently lock learner reports.</p>
        </section>

        {error && <section style={{ ...card, color: '#b91c1c', borderColor: '#fecaca' }}>{error}</section>}
        {message && <section style={{ ...card, color: '#065f46', borderColor: '#a7f3d0' }}>{message}</section>}

        {loading ? <section style={card}>Loading report cards…</section>
          : items.length === 0 ? <section style={card}>No report cards available.</section>
          : items.map(item => (
            <section key={item.id} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div><div style={eyebrow}>{item.termName} · {item.academicYear}</div><h2 style={{ fontSize: 18, margin: '5px 0' }}>{item.studentName}</h2><div style={muted}>{item.className} · Revision {item.revision}</div></div>
                <strong style={{ textTransform: 'capitalize', color: '#4338ca' }}>{item.status}</strong>
              </div>

              {item.status === 'review' && <textarea value={reason[item.id] ?? ''} onChange={event => setReason(current => ({ ...current, [item.id]: event.target.value }))} rows={3} placeholder="Reason when returning the report" style={{ ...input, marginTop: 12, resize: 'vertical' }} />}

              <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                {item.status === 'review' && <><button type="button" disabled={busyId === item.id} onClick={() => void run(item, 'returned')} style={secondaryButton}>Return</button><button type="button" disabled={busyId === item.id} onClick={() => void run(item, 'approved')} style={primaryButton}>Approve</button></>}
                {item.status === 'approved' && <button type="button" disabled={busyId === item.id} onClick={() => void run(item, 'published')} style={primaryButton}>Publish</button>}
                {item.status === 'published' && <button type="button" disabled={busyId === item.id} onClick={() => void run(item, 'locked')} style={primaryButton}>Lock report</button>}
                {item.status === 'locked' && <div style={lockedBox}>Locked and immutable</div>}
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
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: 10, padding: '10px 12px', font: 'inherit' }
const primaryButton: React.CSSProperties = { border: 'none', borderRadius: 12, padding: '12px 16px', background: '#4338ca', color: '#fff', fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }
const secondaryButton: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 10, padding: '10px 14px', background: '#fff', color: '#374151', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }
const lockedBox: React.CSSProperties = { padding: '10px 12px', borderRadius: 10, background: '#ecfdf5', color: '#065f46', fontWeight: 800 }
