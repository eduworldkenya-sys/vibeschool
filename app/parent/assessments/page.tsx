'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getParentAssessmentSummary, type ParentAssessmentSummary } from '@/lib/assessment/integration'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export default function ParentAssessmentsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedStudentId = searchParams.get('studentId')
  const [studentId, setStudentId] = useState<string | null>(null)
  const [studentName, setStudentName] = useState('Learner')
  const [summary, setSummary] = useState<ParentAssessmentSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    // Fail closed before resolving a new child. A previous sibling's assessment
    // summary must never remain visible while the next relationship is checked.
    setStudentId(null)
    setStudentName('Learner')
    setSummary(null)
    setError('')
    setLoading(true)

    async function load() {
      try {
        let targetId = requestedStudentId
        if (!targetId) {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) throw new Error('Sign in again to view assessment progress.')
          const { data, error: linkError } = await supabase
            .from('parent_student_links')
            .select('student_id, students(name)')
            .eq('parent_id', user.id)
            .order('is_primary', { ascending: false })
            .limit(1)
            .maybeSingle()
          if (linkError) throw linkError
          targetId = data?.student_id ?? null
          const student = Array.isArray(data?.students) ? data?.students[0] : data?.students
          if (!cancelled && student && typeof student === 'object' && 'name' in student && typeof student.name === 'string') {
            setStudentName(student.name)
          }
        } else {
          // RLS on students is the explicit deep-link authorization gate before
          // requesting any assessment summary for a browser-supplied studentId.
          const { data, error: studentError } = await supabase
            .from('students')
            .select('id, name')
            .eq('id', targetId)
            .maybeSingle()
          if (studentError) throw studentError
          if (!data) throw new Error('This learner is not linked to your active parent account.')
          if (!cancelled) setStudentName(data.name)
        }
        if (!targetId) throw new Error('No linked learner was found for this parent account.')

        const payload = await getParentAssessmentSummary(targetId)
        if (!cancelled) {
          setStudentId(targetId)
          setSummary(payload)
        }
      } catch (cause) {
        if (!cancelled) {
          setSummary(null)
          setStudentId(null)
          setError(cause instanceof Error ? cause.message : 'Could not load assessment progress.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [requestedStudentId])

  return (
    <div>
      <section style={card}>
        <div style={eyebrow}>Assessment Progress</div>
        <h1 style={{ margin: '6px 0' }}>{studentName}</h1>
        <p style={muted}>Released marks, teacher feedback, subject progress, and intervention support.</p>
      </section>

      {loading ? <section style={card}>Loading assessment progress…</section>
        : error ? <section style={{ ...card, color: '#b91c1c' }}>{error}</section>
        : <>
          <section style={card}>
            <h2 style={sectionTitle}>Released results</h2>
            {!summary || summary.results.length === 0 ? <p style={muted}>No released assessment results yet.</p>
              : <div style={{ display: 'grid', gap: 10 }}>
                {summary.results.map(result => <div key={result.attemptId} style={dataRow}>
                  <div>
                    <strong>{result.assessmentTitle}</strong>
                    <div style={muted}>{result.assessmentType.replaceAll('_', ' ')} · {new Date(result.releasedAt).toLocaleDateString('en-KE')}</div>
                    {result.feedback && <div style={{ marginTop: 6, fontSize: 13 }}>{result.feedback}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <strong style={{ color: result.percentage !== null && result.percentage < 50 ? '#b91c1c' : '#065f46' }}>{result.percentage === null ? '—' : `${result.percentage.toFixed(1)}%`}</strong>
                    <div style={muted}>{result.score ?? '—'}/{result.maxScore ?? '—'}</div>
                  </div>
                </div>)}
              </div>}
          </section>

          <section style={card}>
            <h2 style={sectionTitle}>Subject progress</h2>
            {!summary || summary.progress.length === 0 ? <p style={muted}>Subject progress will appear after released assessment evidence is available.</p>
              : <div style={{ display: 'grid', gap: 8 }}>
                {summary.progress.map((value, index) => {
                  const item = asRecord(value)
                  const average = typeof item.average_score === 'number' ? item.average_score : Number(item.average_score)
                  const mastery = typeof item.mastery_percentage === 'number' ? item.mastery_percentage : Number(item.mastery_percentage)
                  return <div key={index} style={dataRow}>
                    <div><strong>Subject progress</strong><div style={muted}>{Number.isFinite(average) ? `${average.toFixed(1)}% average` : 'Average pending'}</div></div>
                    <strong style={{ color: Number.isFinite(mastery) && mastery < 50 ? '#b91c1c' : '#065f46' }}>{Number.isFinite(mastery) ? `${mastery.toFixed(1)}% mastery` : '—'}</strong>
                  </div>
                })}
              </div>}
          </section>

          <section style={card}>
            <h2 style={sectionTitle}>Support actions</h2>
            {!summary || summary.interventions.length === 0 ? <p style={muted}>No active assessment intervention has been recorded.</p>
              : <div style={{ display: 'grid', gap: 8 }}>
                {summary.interventions.map((value, index) => {
                  const item = asRecord(value)
                  const recommendation = typeof item.recommendation === 'string' ? item.recommendation : 'Teacher support action'
                  const priority = typeof item.priority === 'string' ? item.priority.replaceAll('_', ' ') : 'active'
                  return <div key={index} style={supportBox}><strong>{recommendation}</strong><div style={muted}>{priority}</div></div>
                })}
              </div>}
          </section>

          {studentId && <button type="button" onClick={() => router.push(`/parent/child/${studentId}`)} style={primaryButton}>Back to learner overview</button>}
        </>}
    </div>
  )
}

const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, marginBottom: 12 }
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: 1 }
const sectionTitle: React.CSSProperties = { margin: '0 0 12px', fontSize: 18 }
const muted: React.CSSProperties = { fontSize: 12, color: '#6b7280', margin: 0 }
const dataRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }
const supportBox: React.CSSProperties = { border: '1px solid #fcd34d', background: '#fffbeb', borderRadius: 12, padding: 12 }
const primaryButton: React.CSSProperties = { width: '100%', border: 'none', borderRadius: 12, padding: '13px 16px', background: '#059669', color: '#fff', fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }
