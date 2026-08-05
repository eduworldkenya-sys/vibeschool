'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { listReportCards, submitReportCard, type ReportCardSummary } from '@/lib/report-cards/service'

export default function TeacherReportCardsPage() {
  const [items, setItems] = useState<ReportCardSummary[]>([])
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

  async function submit(item: ReportCardSummary) {
    setBusyId(item.id)
    setError('')
    setMessage('')
    try {
      await submitReportCard(item.id)
      setMessage('Report card submitted for school review.')
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Report card could not be submitted.')
    } finally { setBusyId(null) }
  }

  return (
    <main style={shell}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <section style={card}>
          <div style={eyebrow}>Report Card Engine</div>
          <h1 style={{ margin: '6px 0' }}>Teacher Report Cards</h1>
          <p style={{ margin: 0, color: '#6b7280' }}>Prepare evidence-backed reports, complete subject comments, and submit them for school approval.</p>
        </section>

        {error && <section style={{ ...card, color: '#b91c1c', borderColor: '#fecaca' }}>{error}</section>}
        {message && <section style={{ ...card, color: '#065f46', borderColor: '#a7f3d0' }}>{message}</section>}

        {loading ? <section style={card}>Loading report cards…</section>
          : items.length === 0 ? <section style={card}><strong>No report cards yet</strong><p style={{ color: '#6b7280', marginBottom: 0 }}>Report generation actions will appear after EXQ-008B evidence snapshot wiring.</p></section>
          : items.map(item => (
            <section key={item.id} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={eyebrow}>{item.termName} · {item.academicYear}</div>
                  <h2 style={{ fontSize: 18, margin: '5px 0' }}>{item.studentName}</h2>
                  <div style={muted}>{item.className} · Revision {item.revision}</div>
                </div>
                <strong style={{ textTransform: 'capitalize', color: item.status === 'returned' ? '#b45309' : '#4338ca' }}>{item.status}</strong>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button type="button" style={{ ...secondaryButton, flex: 1 }}>Open report</button>
                {(item.status === 'draft' || item.status === 'returned') && <button type="button" disabled={busyId === item.id} onClick={() => void submit(item)} style={{ ...primaryButton, flex: 1 }}>{busyId === item.id ? 'Submitting…' : 'Submit for review'}</button>}
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
const primaryButton: React.CSSProperties = { border: 'none', borderRadius: 12, padding: '12px 16px', background: '#4338ca', color: '#fff', fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }
const secondaryButton: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 10, padding: '10px 14px', background: '#fff', color: '#374151', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }
