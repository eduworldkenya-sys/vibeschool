'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  createInterventionAssessment,
  evaluateIntervention,
  listInterventionQueue,
  updateIntervention,
  type InterventionQueueItem,
  type InterventionStatus,
} from '@/lib/assessment/interventions'

export default function AssessmentInterventionsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const classId = searchParams.get('classId')?.trim() || null
  const studentId = searchParams.get('studentId')?.trim() || null
  const [items, setItems] = useState<InterventionQueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const queue = await listInterventionQueue(classId ?? undefined)
      setItems(studentId ? queue.filter(item => item.studentId === studentId) : queue)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load intervention queue.')
    } finally {
      setLoading(false)
    }
  }, [classId, studentId])

  useEffect(() => { void load() }, [load])

  async function openRemedialBuilder(item: InterventionQueueItem) {
    setBusyId(item.interventionId)
    setError('')
    setMessage('')
    try {
      const assessmentId = item.remedialAssessmentId ?? await createInterventionAssessment(item.interventionId)
      router.push(`/teacher/assessment/builder/${assessmentId}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Remedial assessment could not be opened.')
      setBusyId(null)
    }
  }

  async function evaluate(item: InterventionQueueItem) {
    setBusyId(item.interventionId)
    setError('')
    setMessage('')
    try {
      const result = await evaluateIntervention(item.interventionId)
      setMessage(`Follow-up evaluated: ${result.baselineMasteryScore.toFixed(1)}% → ${result.followupMasteryScore.toFixed(1)}% (${result.masteryChange >= 0 ? '+' : ''}${result.masteryChange.toFixed(1)}). ${result.recommendation}`)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Follow-up evidence could not be evaluated.')
    } finally { setBusyId(null) }
  }

  async function changeStatus(item: InterventionQueueItem, status: InterventionStatus) {
    const note = notes[item.interventionId]?.trim() ?? ''
    setBusyId(item.interventionId)
    setError('')
    setMessage('')
    try {
      await updateIntervention({ interventionId: item.interventionId, status, completionNote: note || null })
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Intervention could not be updated.')
    } finally { setBusyId(null) }
  }

  const stats = useMemo(() => ({
    urgent: items.filter(item => item.priority === 'urgent').length,
    high: items.filter(item => item.priority === 'high').length,
    followupReady: items.filter(item => item.remedialAssignmentId).length,
    escalated: items.filter(item => item.status === 'escalated').length,
  }), [items])

  const contextLabel = studentId ? 'Learner-scoped intervention queue' : classId ? 'Class-scoped intervention queue' : 'All assigned learner interventions'

  return (
    <main style={shell}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <section style={card}>
          <div style={eyebrow}>Assessment Intelligence</div>
          <h1 style={{ margin: '6px 0' }}>Learner Intervention Queue</h1>
          <p style={{ margin: 0, color: '#6b7280' }}>Turn mastery gaps into targeted practice, collect follow-up evidence, and close or escalate support.</p>
          <div style={{ ...muted, marginTop: 8 }}>{contextLabel}</div>
        </section>

        <section style={card}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 10 }}>
            <Metric label="Urgent" value={stats.urgent} />
            <Metric label="High" value={stats.high} />
            <Metric label="Assigned" value={stats.followupReady} />
            <Metric label="Escalated" value={stats.escalated} />
          </div>
        </section>

        {error && <section style={{ ...card, color: '#b91c1c', borderColor: '#fecaca' }}>{error}</section>}
        {message && <section style={{ ...card, color: '#065f46', borderColor: '#a7f3d0' }}>{message}</section>}

        {loading ? <section style={card}>Building intervention queue…</section>
          : items.length === 0 ? <section style={card}><strong>No open interventions</strong><p style={{ color: '#6b7280', marginBottom: 0 }}>No evidence-backed intervention matches this context.</p></section>
          : items.map(item => (
            <section key={item.interventionId} style={{ ...card, borderColor: priorityBorder[item.priority] }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={eyebrow}>{item.priority} priority · {item.status.replaceAll('_', ' ')}</div>
                  <h2 style={{ fontSize: 18, margin: '6px 0' }}>{item.studentName}</h2>
                  <div style={muted}>{item.className}{item.classStream ? ` ${item.classStream}` : ''} · {item.subjectName}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <strong style={{ fontSize: 22, color: item.masteryScore < 40 ? '#b91c1c' : item.masteryScore < 80 ? '#b45309' : '#065f46' }}>{item.masteryScore.toFixed(1)}%</strong>
                  <div style={muted}>{item.confidenceScore.toFixed(0)}% confidence</div>
                </div>
              </div>

              <div style={outcomeBox}>
                <strong>{item.outcomeCode ? `${item.outcomeCode} · ` : ''}{item.outcomeText}</strong>
                <div style={muted}>{item.evidenceCount} evidence records · {item.repeatedWeaknessCount} recent results below 50%</div>
              </div>

              <div style={recommendationBox}>{item.recommendation}</div>

              {(item.baselineMasteryScore !== null || item.followupMasteryScore !== null) && (
                <div style={progressBox}>
                  <strong>Intervention evidence</strong>
                  <div style={{ marginTop: 5 }}>
                    Baseline {item.baselineMasteryScore?.toFixed(1) ?? item.masteryScore.toFixed(1)}%
                    {item.followupMasteryScore !== null && ` → Follow-up ${item.followupMasteryScore.toFixed(1)}%`}
                    {item.masteryChange !== null && ` (${item.masteryChange >= 0 ? '+' : ''}${item.masteryChange.toFixed(1)})`}
                  </div>
                </div>
              )}

              {item.dueAt && <div style={{ ...muted, marginTop: 8 }}>Due {new Date(item.dueAt).toLocaleDateString('en-KE')}</div>}

              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <button disabled={busyId === item.interventionId} onClick={() => void openRemedialBuilder(item)} style={primaryButton}>
                  {item.remedialAssessmentId ? 'Open remedial assessment' : 'Create remedial assessment'}
                </button>
                {item.remedialAssignmentId && (
                  <button disabled={busyId === item.interventionId} onClick={() => void evaluate(item)} style={secondaryButton}>Evaluate follow-up</button>
                )}
              </div>

              <textarea
                rows={2}
                value={notes[item.interventionId] ?? ''}
                onChange={event => setNotes(current => ({ ...current, [item.interventionId]: event.target.value }))}
                placeholder="Follow-up observation"
                style={{ ...input, marginTop: 12, resize: 'vertical' }}
              />

              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <button disabled={busyId === item.interventionId} onClick={() => void changeStatus(item, 'in_progress')} style={secondaryButton}>Start</button>
                <button disabled={busyId === item.interventionId} onClick={() => void changeStatus(item, 'dismissed')} style={secondaryButton}>Dismiss</button>
              </div>
            </section>
          ))}
      </div>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div style={metric}><strong style={{ fontSize: 22 }}>{value}</strong><span style={muted}>{label}</span></div>
}

const priorityBorder: Record<InterventionQueueItem['priority'], string> = { urgent: '#fecaca', high: '#fed7aa', medium: '#fde68a', extension: '#a7f3d0' }
const shell: React.CSSProperties = { minHeight: '100vh', background: '#f8fafc', padding: '18px 14px 80px', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#111827' }
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, marginBottom: 12 }
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: '#4338ca', textTransform: 'uppercase', letterSpacing: 1 }
const muted: React.CSSProperties = { fontSize: 12, color: '#6b7280', marginTop: 3 }
const metric: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: 12, borderRadius: 12, background: '#f8fafc' }
const outcomeBox: React.CSSProperties = { marginTop: 14, padding: 12, borderRadius: 10, background: '#f8fafc', lineHeight: 1.5 }
const recommendationBox: React.CSSProperties = { marginTop: 10, padding: 12, borderRadius: 10, background: '#eef2ff', color: '#3730a3', lineHeight: 1.5, fontWeight: 700 }
const progressBox: React.CSSProperties = { marginTop: 10, padding: 12, borderRadius: 10, background: '#ecfdf5', color: '#065f46' }
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: 10, padding: '10px 12px', font: 'inherit' }
const primaryButton: React.CSSProperties = { border: 'none', borderRadius: 10, padding: '10px 14px', background: '#4338ca', color: '#fff', fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }
const secondaryButton: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 10, padding: '10px 14px', background: '#fff', color: '#374151', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }
