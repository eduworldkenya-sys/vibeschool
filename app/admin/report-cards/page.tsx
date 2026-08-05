'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import {
  getReportCardEvidence,
  listReportCards,
  listReportSubjects,
  lockReportCard,
  publishReportCard,
  reviewReportCard,
  type ReportCardSummary,
  type ReportEvidenceDetail,
  type ReportSubjectEvidence,
} from '@/lib/report-cards/service'

export default function AdminReportCardsPage() {
  const [items, setItems] = useState<ReportCardSummary[]>([])
  const [evidence, setEvidence] = useState<Record<string, ReportEvidenceDetail>>({})
  const [subjects, setSubjects] = useState<Record<string, ReportSubjectEvidence[]>>({})
  const [openId, setOpenId] = useState<string | null>(null)
  const [reason, setReason] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function load() {
    setLoading(true); setError('')
    try { setItems(await listReportCards()) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load report cards.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  async function openReview(item: ReportCardSummary) {
    setBusyId(item.id); setError('')
    try {
      const [detail, rows] = await Promise.all([getReportCardEvidence(item.id), listReportSubjects(item.id)])
      setEvidence(current => ({ ...current, [item.id]: detail }))
      setSubjects(current => ({ ...current, [item.id]: rows }))
      setOpenId(current => current === item.id ? null : item.id)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Report review data could not be loaded.') }
    finally { setBusyId(null) }
  }

  async function run(item: ReportCardSummary, action: 'approved' | 'returned' | 'published' | 'locked') {
    setBusyId(item.id); setError(''); setMessage('')
    try {
      if (action === 'approved' || action === 'returned') {
        await reviewReportCard({ reportCardId: item.id, decision: action, reason: reason[item.id] ?? null })
      } else if (action === 'published') await publishReportCard(item.id)
      else await lockReportCard(item.id)
      setMessage(`Report card ${action}.`)
      setOpenId(null)
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Report card action failed.') }
    finally { setBusyId(null) }
  }

  return <main style={shell}><div style={{ maxWidth: 980, margin: '0 auto' }}>
    <section style={card}><div style={eyebrow}>School Reporting Governance</div><h1 style={{ margin: '6px 0' }}>Report Card Review</h1><p style={{ margin: 0, color: '#6b7280' }}>Review the exact evidence snapshot, subject narratives, teacher wording, and parent guidance before approval and publication.</p></section>
    {error && <section style={{ ...card, color: '#b91c1c', borderColor: '#fecaca' }}>{error}</section>}
    {message && <section style={{ ...card, color: '#065f46', borderColor: '#a7f3d0' }}>{message}</section>}

    {loading ? <section style={card}>Loading report cards…</section> : items.length === 0 ? <section style={card}>No report cards available.</section> : items.map(item => {
      const detail = evidence[item.id]
      const rows = subjects[item.id] ?? []
      const snapshot = detail?.snapshot && typeof detail.snapshot === 'object' && !Array.isArray(detail.snapshot) ? detail.snapshot as Record<string, unknown> : null
      const summary = snapshot?.summary && typeof snapshot.summary === 'object' && !Array.isArray(snapshot.summary) ? snapshot.summary as Record<string, unknown> : null
      const attendance = snapshot?.attendance && typeof snapshot.attendance === 'object' && !Array.isArray(snapshot.attendance) ? snapshot.attendance as Record<string, unknown> : null
      return <section key={item.id} style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div><div style={eyebrow}>{item.termName} · {item.academicYear}</div><h2 style={{ fontSize: 18, margin: '5px 0' }}>{item.studentName}</h2><div style={muted}>{item.className} · Revision {item.revision}</div><div style={muted}>Evidence {item.completenessStatus.replaceAll('_', ' ')} · v{item.evidenceVersion}</div></div>
          <strong style={{ textTransform: 'capitalize', color: '#4338ca' }}>{item.status}</strong>
        </div>
        {item.completenessIssues.length > 0 && <div style={issueBox}>{item.completenessIssues.map(issue => <div key={`${issue.code}-${issue.message}`}>• {issue.message}</div>)}</div>}
        <button disabled={busyId === item.id} onClick={() => void openReview(item)} style={{ ...secondaryButton, marginTop: 12 }}>{openId === item.id ? 'Hide review' : 'Review evidence and narratives'}</button>

        {openId === item.id && detail && <div style={evidenceBox}>
          <div style={metricGrid}><Metric label="Subjects" value={String(summary?.subject_count ?? rows.length)} /><Metric label="Assessment" value={formatPercent(summary?.overall_assessment_average)} /><Metric label="Mastery" value={formatPercent(summary?.overall_mastery_average)} /><Metric label="Attendance" value={formatPercent(attendance?.attendance_rate)} /></div>
          <div style={{ ...muted, marginTop: 10 }}>Generated {detail.evidenceGeneratedAt ? new Date(detail.evidenceGeneratedAt).toLocaleString('en-KE') : '—'} · Snapshot v{detail.evidenceVersion}</div>
          <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
            {rows.map(row => <div key={row.reportCardSubjectId} style={subjectBox}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><strong>{row.subjectName}</strong><strong>{row.assessmentAverage === null ? '—' : `${row.assessmentAverage.toFixed(1)}%`}</strong></div>
              <ReviewLine label="Achievement" text={row.achievementSummary} />
              <ReviewLine label="Strengths" text={row.strengthsSummary} />
              <ReviewLine label="Support" text={row.supportSummary} />
              <ReviewLine label="Next steps" text={row.recommendedNextSteps} />
              <ReviewLine label="Teacher final comment" text={row.teacherComment} />
              <ReviewLine label="Parent guidance" text={row.parentGuidance} />
            </div>)}
          </div>
        </div>}

        {item.status === 'review' && <textarea value={reason[item.id] ?? ''} onChange={event => setReason(current => ({ ...current, [item.id]: event.target.value }))} rows={3} placeholder="Reason when returning the report" style={{ ...input, marginTop: 12, resize: 'vertical' }} />}
        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          {item.status === 'review' && <><button disabled={busyId === item.id} onClick={() => void run(item, 'returned')} style={secondaryButton}>Return</button><button disabled={busyId === item.id || item.completenessStatus !== 'complete'} onClick={() => void run(item, 'approved')} style={primaryButton}>Approve</button></>}
          {item.status === 'approved' && <button disabled={busyId === item.id || item.completenessStatus !== 'complete'} onClick={() => void run(item, 'published')} style={primaryButton}>Publish and freeze</button>}
          {item.status === 'published' && <button disabled={busyId === item.id} onClick={() => void run(item, 'locked')} style={primaryButton}>Lock report</button>}
          {item.status === 'locked' && <div style={lockedBox}>Locked and immutable</div>}
        </div>
      </section>
    })}
  </div></main>
}

function formatPercent(value: unknown): string { const number = typeof value === 'number' ? value : Number(value); return Number.isFinite(number) ? `${number.toFixed(1)}%` : '—' }
function Metric({ label, value }: { label: string; value: string }) { return <div style={metric}><div style={muted}>{label}</div><strong style={{ fontSize: 18 }}>{value}</strong></div> }
function ReviewLine({ label, text }: { label: string; text: string | null }) { if (!text) return null; return <div style={{ marginTop: 8 }}><div style={labelStyle}>{label}</div><div style={{ lineHeight: 1.5 }}>{text}</div></div> }

const shell: React.CSSProperties = { minHeight: '100vh', background: '#f8fafc', padding: '18px 14px 80px', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#111827' }
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, marginBottom: 12 }
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: '#4338ca', textTransform: 'uppercase', letterSpacing: 1 }
const muted: React.CSSProperties = { fontSize: 12, color: '#6b7280', marginTop: 3 }
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: 10, padding: '10px 12px', font: 'inherit' }
const issueBox: React.CSSProperties = { marginTop: 12, padding: 12, borderRadius: 10, background: '#fff7ed', color: '#9a3412', fontSize: 13, lineHeight: 1.5 }
const evidenceBox: React.CSSProperties = { marginTop: 12, padding: 12, borderRadius: 12, background: '#f8fafc', border: '1px solid #e5e7eb' }
const subjectBox: React.CSSProperties = { padding: 12, borderRadius: 10, background: '#fff', border: '1px solid #e5e7eb' }
const metricGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }
const metric: React.CSSProperties = { background: '#fff', borderRadius: 10, padding: 10 }
const labelStyle: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }
const primaryButton: React.CSSProperties = { border: 'none', borderRadius: 12, padding: '12px 16px', background: '#4338ca', color: '#fff', fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }
const secondaryButton: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 10, padding: '10px 14px', background: '#fff', color: '#374151', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }
const lockedBox: React.CSSProperties = { padding: '10px 12px', borderRadius: 10, background: '#ecfdf5', color: '#065f46', fontWeight: 800 }
