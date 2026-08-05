'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import {
  generateReportCardEvidence,
  generateSubjectReportIntelligence,
  listReportCards,
  listReportSubjects,
  submitReportCard,
  updateSubjectReport,
  type ReportCardSummary,
  type ReportSubjectEvidence,
} from '@/lib/report-cards/service'

export default function TeacherReportCardsPage() {
  const [items, setItems] = useState<ReportCardSummary[]>([])
  const [subjects, setSubjects] = useState<Record<string, ReportSubjectEvidence[]>>({})
  const [comments, setComments] = useState<Record<string, string>>({})
  const [guidance, setGuidance] = useState<Record<string, string>>({})
  const [openId, setOpenId] = useState<string | null>(null)
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

  function hydrate(reportId: string, rows: ReportSubjectEvidence[]) {
    setSubjects(current => ({ ...current, [reportId]: rows }))
    setComments(current => ({ ...current, ...Object.fromEntries(rows.map(row => [row.reportCardSubjectId, row.teacherComment ?? row.generatedComment ?? ''])) }))
    setGuidance(current => ({ ...current, ...Object.fromEntries(rows.map(row => [row.reportCardSubjectId, row.parentGuidance ?? ''])) }))
  }

  async function open(item: ReportCardSummary) {
    setBusyId(item.id)
    setError('')
    try {
      hydrate(item.id, await listReportSubjects(item.id))
      setOpenId(current => current === item.id ? null : item.id)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Report evidence could not be opened.') }
    finally { setBusyId(null) }
  }

  async function generateEvidence(item: ReportCardSummary) {
    setBusyId(item.id); setError(''); setMessage('')
    try {
      const detail = await generateReportCardEvidence(item.id)
      hydrate(item.id, await listReportSubjects(item.id))
      setOpenId(item.id)
      setMessage(detail.completenessStatus === 'complete'
        ? `Evidence snapshot v${detail.evidenceVersion} generated and complete.`
        : `Evidence snapshot generated with ${detail.completenessIssues.length} issue(s).`)
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Evidence snapshot could not be generated.') }
    finally { setBusyId(null) }
  }

  async function generateNarratives(item: ReportCardSummary) {
    setBusyId(item.id); setError(''); setMessage('')
    try {
      const count = await generateSubjectReportIntelligence(item.id)
      hydrate(item.id, await listReportSubjects(item.id))
      setOpenId(item.id)
      setMessage(`${count} subject narrative${count === 1 ? '' : 's'} generated from the current evidence snapshot.`)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Subject narratives could not be generated.') }
    finally { setBusyId(null) }
  }

  async function save(row: ReportSubjectEvidence) {
    setBusyId(row.reportCardSubjectId); setError(''); setMessage('')
    try {
      await updateSubjectReport({
        reportCardSubjectId: row.reportCardSubjectId,
        teacherComment: comments[row.reportCardSubjectId] ?? '',
        parentGuidance: guidance[row.reportCardSubjectId] ?? null,
      })
      setMessage(`${row.subjectName} report saved.`)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Subject report could not be saved.') }
    finally { setBusyId(null) }
  }

  async function submit(item: ReportCardSummary) {
    setBusyId(item.id); setError(''); setMessage('')
    try {
      await submitReportCard(item.id)
      setMessage('Report card submitted for school review.')
      setOpenId(null)
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Report card could not be submitted.') }
    finally { setBusyId(null) }
  }

  return <main style={shell}><div style={{ maxWidth: 980, margin: '0 auto' }}>
    <section style={card}><div style={eyebrow}>Report Card Engine</div><h1 style={{ margin: '6px 0' }}>Teacher Report Cards</h1><p style={{ margin: 0, color: '#6b7280' }}>Generate evidence, create traceable subject narratives, apply teacher judgment, and submit only complete reports.</p></section>
    {error && <section style={{ ...card, color: '#b91c1c', borderColor: '#fecaca' }}>{error}</section>}
    {message && <section style={{ ...card, color: '#065f46', borderColor: '#a7f3d0' }}>{message}</section>}

    {loading ? <section style={card}>Loading report cards…</section> : items.length === 0 ? <section style={card}>No report cards yet.</section> : items.map(item => {
      const rows = subjects[item.id] ?? []
      const editable = item.status === 'draft' || item.status === 'returned'
      return <section key={item.id} style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div><div style={eyebrow}>{item.termName} · {item.academicYear}</div><h2 style={{ fontSize: 18, margin: '5px 0' }}>{item.studentName}</h2><div style={muted}>{item.className} · Revision {item.revision}</div><div style={muted}>Evidence: {item.completenessStatus.replaceAll('_', ' ')} · v{item.evidenceVersion}</div></div>
          <strong style={{ textTransform: 'capitalize', color: item.status === 'returned' ? '#b45309' : '#4338ca' }}>{item.status}</strong>
        </div>
        {item.completenessIssues.length > 0 && <div style={issueBox}>{item.completenessIssues.map(issue => <div key={`${issue.code}-${issue.message}`}>• {issue.message}</div>)}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          {editable && <button disabled={busyId === item.id} onClick={() => void generateEvidence(item)} style={secondaryButton}>Generate evidence</button>}
          {editable && item.completenessStatus !== 'not_generated' && <button disabled={busyId === item.id} onClick={() => void generateNarratives(item)} style={secondaryButton}>Generate subject narratives</button>}
          <button disabled={busyId === item.id} onClick={() => void open(item)} style={secondaryButton}>{openId === item.id ? 'Close report' : 'Open report'}</button>
          {editable && <button disabled={busyId === item.id || item.completenessStatus !== 'complete'} onClick={() => void submit(item)} style={primaryButton}>Submit for review</button>}
        </div>

        {openId === item.id && <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
          {rows.length === 0 ? <div style={emptyBox}>Generate evidence to create subject summaries.</div> : rows.map(row => <div key={row.reportCardSubjectId} style={subjectBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><strong>{row.subjectName}</strong><div style={{ textAlign: 'right' }}><strong>{row.assessmentAverage === null ? '—' : `${row.assessmentAverage.toFixed(1)}%`}</strong> assessment<div style={muted}>{row.masteryAverage === null ? '—' : `${row.masteryAverage.toFixed(1)}%`} mastery · {row.growthPercentage === null ? '—' : `${row.growthPercentage >= 0 ? '+' : ''}${row.growthPercentage.toFixed(1)}%`} growth</div></div></div>
            <Narrative label="Achievement" text={row.achievementSummary} />
            <Narrative label="Strengths" text={row.strengthsSummary} />
            <Narrative label="Support" text={row.supportSummary} />
            <Narrative label="Recommended next steps" text={row.recommendedNextSteps} />
            <label style={label}>Teacher final comment</label>
            <textarea rows={5} value={comments[row.reportCardSubjectId] ?? ''} onChange={event => setComments(current => ({ ...current, [row.reportCardSubjectId]: event.target.value }))} placeholder="Generate a draft, then edit it using your professional judgment." style={{ ...input, resize: 'vertical' }} />
            <label style={{ ...label, marginTop: 10 }}>Parent guidance</label>
            <textarea rows={3} value={guidance[row.reportCardSubjectId] ?? ''} onChange={event => setGuidance(current => ({ ...current, [row.reportCardSubjectId]: event.target.value }))} placeholder="Practical support for home" style={{ ...input, resize: 'vertical' }} />
            {row.generatedAt && <div style={muted}>Narrative generated {new Date(row.generatedAt).toLocaleString('en-KE')} from stored evidence.</div>}
            <button disabled={busyId === row.reportCardSubjectId || !editable} onClick={() => void save(row)} style={{ ...secondaryButton, marginTop: 8 }}>Save subject report</button>
          </div>)}
        </div>}
      </section>
    })}
  </div></main>
}

function Narrative({ label: title, text }: { label: string; text: string | null }) {
  if (!text) return null
  return <div style={narrativeBox}><div style={label}>{title}</div><div style={{ lineHeight: 1.5 }}>{text}</div></div>
}

const shell: React.CSSProperties = { minHeight: '100vh', background: '#f8fafc', padding: '18px 14px 80px', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#111827' }
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, marginBottom: 12 }
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: '#4338ca', textTransform: 'uppercase', letterSpacing: 1 }
const muted: React.CSSProperties = { fontSize: 12, color: '#6b7280', marginTop: 3 }
const subjectBox: React.CSSProperties = { border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, background: '#f8fafc' }
const narrativeBox: React.CSSProperties = { marginTop: 10, padding: 10, borderRadius: 10, background: '#fff', border: '1px solid #e5e7eb' }
const label: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 }
const issueBox: React.CSSProperties = { marginTop: 12, padding: 12, borderRadius: 10, background: '#fff7ed', color: '#9a3412', fontSize: 13, lineHeight: 1.5 }
const emptyBox: React.CSSProperties = { padding: 12, borderRadius: 10, background: '#f8fafc', color: '#6b7280' }
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: 10, padding: '10px 12px', font: 'inherit' }
const primaryButton: React.CSSProperties = { border: 'none', borderRadius: 12, padding: '12px 16px', background: '#4338ca', color: '#fff', fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }
const secondaryButton: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 10, padding: '10px 14px', background: '#fff', color: '#374151', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }
