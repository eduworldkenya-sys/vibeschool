'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { getLongitudinalReportRecord, getPublishedReportCard, listMyPublishedReportCards, type PublishedReportDetail, type PublishedReportSummary } from '@/lib/report-cards/service'

export default function ParentReportCardsPage() {
  const [reports, setReports] = useState<PublishedReportSummary[]>([])
  const [detail, setDetail] = useState<PublishedReportDetail | null>(null)
  const [trend, setTrend] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    void (async () => {
      try { setReports(await listMyPublishedReportCards()) }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Published reports could not be loaded.') }
      finally { setLoading(false) }
    })()
  }, [])

  async function open(report: PublishedReportSummary) {
    setError('')
    try {
      const [published, history] = await Promise.all([
        getPublishedReportCard(report.reportCardId),
        getLongitudinalReportRecord(report.studentId),
      ])
      setDetail(published)
      setTrend(history.trends && typeof history.trends === 'object' && !Array.isArray(history.trends) ? history.trends as Record<string, unknown> : null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Report could not be opened.') }
  }

  return <main style={shell}><div style={{ maxWidth: 920, margin: '0 auto' }}>
    <section style={card}><div style={eyebrow}>Family Learning Record</div><h1 style={{ margin: '6px 0' }}>Published Report Cards</h1><p style={muted}>Only school-published reports for your linked learners appear here.</p></section>
    {error && <section style={{ ...card, color: '#b91c1c' }}>{error}</section>}
    {loading ? <section style={card}>Loading reports…</section> : reports.length === 0 ? <section style={card}>No published report cards are available.</section> : reports.map(report => <section key={report.reportCardId} style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><div><div style={eyebrow}>{report.termName} · {report.academicYear}</div><h2 style={{ margin: '5px 0', fontSize: 18 }}>{report.studentName}</h2><div style={muted}>{report.className} · Revision {report.revision}</div></div><strong style={{ textTransform: 'capitalize' }}>{report.status}</strong></div>
      <button onClick={() => void open(report)} style={{ ...button, marginTop: 12 }}>Open report and progress</button>
    </section>)}

    {detail && <section style={card}>
      <div style={eyebrow}>Authoritative Published Snapshot</div>
      <h2 style={{ margin: '6px 0' }}>Report details</h2>
      <div style={grid}><Metric label="Academic year" value={String(detail.academicYear)} /><Metric label="Revision" value={String(detail.revision)} /><Metric label="Status" value={detail.status} /><Metric label="Published" value={detail.publishedAt ? new Date(detail.publishedAt).toLocaleDateString('en-KE') : '—'} /></div>
      {trend && <div style={{ marginTop: 14 }}><div style={label}>Longitudinal progress</div><div style={grid}><Metric label="Reports" value={String(trend.report_count ?? '—')} /><Metric label="Latest assessment" value={percent(trend.latest_assessment_average)} /><Metric label="Latest mastery" value={percent(trend.latest_mastery_average)} /><Metric label="First mastery" value={percent(trend.first_mastery_average)} /></div></div>}
      <pre style={snapshot}>{JSON.stringify(detail.snapshot, null, 2)}</pre>
    </section>}
  </div></main>
}

function percent(value: unknown) { const number = Number(value); return Number.isFinite(number) ? `${number.toFixed(1)}%` : '—' }
function Metric({ label: title, value }: { label: string; value: string }) { return <div style={metric}><div style={label}>{title}</div><strong>{value}</strong></div> }
const shell: React.CSSProperties = { minHeight: '100vh', background: '#f8fafc', padding: '18px 14px 80px', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#111827' }
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, marginBottom: 12 }
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: '#4338ca', textTransform: 'uppercase', letterSpacing: 1 }
const muted: React.CSSProperties = { color: '#6b7280', margin: 0, fontSize: 13 }
const button: React.CSSProperties = { border: 'none', borderRadius: 10, padding: '11px 14px', background: '#4338ca', color: '#fff', fontWeight: 800, cursor: 'pointer' }
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }
const metric: React.CSSProperties = { background: '#f8fafc', borderRadius: 10, padding: 10 }
const label: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 }
const snapshot: React.CSSProperties = { marginTop: 14, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', background: '#111827', color: '#f9fafb', padding: 12, borderRadius: 10, fontSize: 11 }
