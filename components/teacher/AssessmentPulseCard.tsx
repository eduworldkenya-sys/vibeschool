'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getTeacherAssessmentPulse, type TeacherAssessmentPulse } from '@/lib/assessment/integration'

export default function AssessmentPulseCard({ schoolId }: { schoolId?: string }) {
  const router = useRouter()
  const [summary, setSummary] = useState<TeacherAssessmentPulse | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setSummary(null)
    setError('')
    getTeacherAssessmentPulse()
      .then(data => { if (!cancelled) setSummary(data) })
      .catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load assessment workload.') })
    return () => { cancelled = true }
  }, [schoolId])

  if (error) return null

  const total = summary
    ? summary.awaitingMarking + summary.partiallyMarked + summary.readyToRelease + summary.pendingModeration + summary.highPriorityInterventions
    : 0

  if (summary && total === 0) {
    return (
      <section style={card} aria-label="Assessment workload">
        <div style={headerRow}>
          <div>
            <div style={eyebrow}>Assessment</div>
            <h2 style={{ margin: '5px 0 3px', fontSize: 16, color: '#111827' }}>Nothing awaiting review</h2>
            <div style={muted}>Your marking workload is clear.</div>
          </div>
          <div aria-hidden="true" style={clearBadge}>✓</div>
        </div>
        <button type="button" onClick={() => router.push('/teacher/assessment/gradebook')} style={quietButton}>Open gradebook</button>
      </section>
    )
  }

  return (
    <section style={card} aria-label="Assessment workload">
      <div style={headerRow}>
        <div>
          <div style={eyebrow}>Assessment workload</div>
          <h2 style={{ margin: '5px 0 0', fontSize: 17, color: '#111827' }}>Needs your attention</h2>
        </div>
        <strong style={{ fontSize: 22, color: total > 0 ? '#b45309' : '#065f46' }}>{summary ? total : '—'}</strong>
      </div>

      {!summary ? <div style={{ ...muted, marginTop: 12 }}>Loading assessment workload…</div> : <div style={grid}>
        {summary.awaitingMarking > 0 && <Metric label="Awaiting marking" value={summary.awaitingMarking} />}
        {summary.partiallyMarked > 0 && <Metric label="Partially marked" value={summary.partiallyMarked} />}
        {summary.readyToRelease > 0 && <Metric label="Ready to release" value={summary.readyToRelease} />}
        {summary.pendingModeration > 0 && <Metric label="Moderation" value={summary.pendingModeration} />}
        {summary.highPriorityInterventions > 0 && <Metric label="High-priority support" value={summary.highPriorityInterventions} />}
      </div>}

      <div style={buttonGrid}>
        <button type="button" onClick={() => router.push('/teacher/assessment/marking')} style={primaryButton}>Open marking centre</button>
        <button type="button" onClick={() => router.push('/teacher/assessment/gradebook')} style={secondaryButton}>Gradebook</button>
      </div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div style={metric}><strong style={{ fontSize: 18, color: '#92400e' }}>{value}</strong><span style={muted}>{label}</span></div>
}

const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 18, padding: 16, marginBottom: 12, boxShadow: '0 1px 3px rgba(15,23,42,0.05)' }
const headerRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#047857', textTransform: 'uppercase', letterSpacing: 1 }
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 8, marginTop: 12 }
const metric: React.CSSProperties = { border: '1px solid #fde68a', background: '#fffbeb', borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 3, minHeight: 58 }
const muted: React.CSSProperties = { fontSize: 12, color: '#6b7280', lineHeight: 1.4 }
const clearBadge: React.CSSProperties = { width: 34, height: 34, borderRadius: 12, background: '#ecfdf5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, flexShrink: 0 }
const buttonGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 8, marginTop: 12 }
const primaryButton: React.CSSProperties = { minHeight: 44, border: 'none', borderRadius: 12, padding: '11px 12px', background: '#10b981', color: '#fff', fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }
const secondaryButton: React.CSSProperties = { minHeight: 44, border: '1px solid #d1d5db', borderRadius: 12, padding: '11px 12px', background: '#fff', color: '#374151', fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }
const quietButton: React.CSSProperties = { marginTop: 12, minHeight: 44, width: '100%', border: '1px solid #d1fae5', borderRadius: 12, padding: '10px 12px', background: '#f0fdf4', color: '#047857', fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }
