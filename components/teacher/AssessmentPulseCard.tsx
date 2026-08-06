'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getTeacherAssessmentPulse, type TeacherAssessmentPulse } from '@/lib/assessment/integration'

export default function AssessmentPulseCard() {
  const router = useRouter()
  const [summary, setSummary] = useState<TeacherAssessmentPulse | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getTeacherAssessmentPulse()
      .then(data => { if (!cancelled) setSummary(data) })
      .catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load assessment workload.') })
    return () => { cancelled = true }
  }, [])

  if (error) return null

  const total = summary
    ? summary.awaitingMarking + summary.partiallyMarked + summary.readyToRelease + summary.pendingModeration + summary.highPriorityInterventions
    : 0

  return (
    <section style={card}>
      <div style={headerRow}>
        <div>
          <div style={eyebrow}>Assessment workload</div>
          <h2 style={{ margin: '5px 0 0', fontSize: 17 }}>Mark, release and support</h2>
        </div>
        <strong style={{ fontSize: 22, color: total > 0 ? '#b45309' : '#065f46' }}>{summary ? total : '—'}</strong>
      </div>

      {!summary ? <div style={muted}>Loading assessment workload…</div> : <div style={grid}>
        <Metric label="Awaiting marking" value={summary.awaitingMarking} urgent={summary.awaitingMarking > 0} />
        <Metric label="Partially marked" value={summary.partiallyMarked} urgent={summary.partiallyMarked > 0} />
        <Metric label="Ready to release" value={summary.readyToRelease} urgent={summary.readyToRelease > 0} />
        <Metric label="Moderation" value={summary.pendingModeration} urgent={summary.pendingModeration > 0} />
        <Metric label="High-priority support" value={summary.highPriorityInterventions} urgent={summary.highPriorityInterventions > 0} />
      </div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8, marginTop: 12 }}>
        <button type="button" onClick={() => router.push('/teacher/assessment/marking')} style={primaryButton}>Open Marking Centre</button>
        <button type="button" onClick={() => router.push('/teacher/assessment/gradebook')} style={secondaryButton}>Open Gradebook</button>
      </div>
    </section>
  )
}

function Metric({ label, value, urgent }: { label: string; value: number; urgent: boolean }) {
  return <div style={{ ...metric, borderColor: urgent ? '#fcd34d' : '#e5e7eb', background: urgent ? '#fffbeb' : '#f8fafc' }}><strong style={{ fontSize: 18, color: urgent ? '#b45309' : '#111827' }}>{value}</strong><span style={muted}>{label}</span></div>
}

const card: React.CSSProperties = { background: '#fff', borderRadius: 20, padding: 16, marginBottom: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }
const headerRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#4338ca', textTransform: 'uppercase', letterSpacing: 1 }
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8, marginTop: 12 }
const metric: React.CSSProperties = { border: '1px solid #e5e7eb', borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 3 }
const muted: React.CSSProperties = { fontSize: 11, color: '#6b7280' }
const primaryButton: React.CSSProperties = { border: 'none', borderRadius: 10, padding: '11px 12px', background: '#4338ca', color: '#fff', fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }
const secondaryButton: React.CSSProperties = { border: '1px solid #c7d2fe', borderRadius: 10, padding: '11px 12px', background: '#eef2ff', color: '#3730a3', fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }
