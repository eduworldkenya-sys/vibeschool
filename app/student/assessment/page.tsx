'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { listMyAssessmentAssignments, type LearnerAssessmentAssignment } from '@/lib/assessment/discovery'

function actionLabel(item: LearnerAssessmentAssignment): string {
  if (item.attemptStatus === 'in_progress') return 'Resume'
  if (item.percentage !== null) return 'View result'
  if (item.availability === 'upcoming') return 'Not open yet'
  if (item.availability === 'closed') return 'Closed'
  if (item.availability === 'attempts_exhausted') return 'Attempts used'
  return 'Start'
}

export default function StudentAssessmentsPage() {
  const router = useRouter()
  const [items, setItems] = useState<LearnerAssessmentAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const assignments = await listMyAssessmentAssignments()
        if (!cancelled) setItems(assignments)
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Could not load assessments.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  return (
    <main style={shell}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <section style={card}>
          <div style={eyebrow}>My Assessments</div>
          <h1 style={{ margin: '6px 0' }}>Quizzes and Practice</h1>
          <p style={{ margin: 0, color: '#6b7280' }}>Open assigned work, resume active attempts, and view released results.</p>
        </section>

        {loading ? <section style={card}>Loading assessments…</section>
          : error ? <section style={{ ...card, color: '#b91c1c' }}>{error}</section>
          : items.length === 0 ? <section style={card}><strong>No assessments assigned yet</strong><p style={{ color: '#6b7280', marginBottom: 0 }}>New quizzes and practice activities will appear here.</p></section>
          : items.map(item => {
            const enabled = item.canStart || item.percentage !== null
            return (
              <section key={item.assignmentId} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div><div style={eyebrow}>{item.assessmentType.replaceAll('_', ' ')}</div><h2 style={{ fontSize: 17, margin: '5px 0' }}>{item.title}</h2></div>
                  {item.percentage !== null && <strong style={{ color: '#065f46' }}>{item.percentage.toFixed(1)}%</strong>}
                </div>
                {item.instructions && <p style={{ color: '#6b7280', lineHeight: 1.5 }}>{item.instructions}</p>}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  {item.timeLimitMinutes && <span style={pill}>{item.timeLimitMinutes} minutes</span>}
                  {item.closesAt && <span style={pill}>Due {new Date(item.closesAt).toLocaleString('en-KE')}</span>}
                  <span style={pill}>{item.availability.replaceAll('_', ' ')}</span>
                  {item.attemptNumber && <span style={pill}>Attempt {item.attemptNumber}/{item.maxAttempts}</span>}
                </div>
                <button type="button" disabled={!enabled} onClick={() => enabled && router.push(`/student/assessment/${item.assignmentId}`)} style={{ ...primaryButton, opacity: enabled ? 1 : 0.55, cursor: enabled ? 'pointer' : 'not-allowed' }}>
                  {actionLabel(item)}
                </button>
              </section>
            )
          })}
      </div>
    </main>
  )
}

const shell: React.CSSProperties = { minHeight: '100vh', background: '#f8fafc', padding: '18px 14px 80px', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#111827' }
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, marginBottom: 12 }
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: '#4338ca', textTransform: 'uppercase', letterSpacing: 1 }
const pill: React.CSSProperties = { fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 20, background: '#f3f4f6', color: '#4b5563' }
const primaryButton: React.CSSProperties = { width: '100%', border: 'none', borderRadius: 12, padding: '12px 16px', background: '#4338ca', color: '#fff', fontWeight: 800, fontSize: 13, fontFamily: 'inherit' }
