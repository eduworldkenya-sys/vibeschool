'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getParentAssessmentSummary, type ParentAssessmentSummary } from '@/lib/assessment/integration'

type Child = { id: string; name: string; className: string }

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function friendlyAssessmentType(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase())
}

export default function ParentAssessmentsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedStudentId = searchParams.get('studentId')
  const requestVersion = useRef(0)
  const [children, setChildren] = useState<Child[]>([])
  const [studentId, setStudentId] = useState<string | null>(null)
  const [summary, setSummary] = useState<ParentAssessmentSummary | null>(null)
  const [loadingChildren, setLoadingChildren] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const activeChild = useMemo(() => children.find(child => child.id === studentId) ?? null, [children, studentId])

  useEffect(() => {
    let cancelled = false
    async function loadChildren() {
      setLoadingChildren(true)
      setError('')
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) { router.replace('/login'); return }

      const { data: links, error: linkError } = await supabase
        .from('parent_student_links')
        .select('student_id, is_primary, students(id, name, class_id, classes(name, stream))')
        .eq('parent_id', user.id)
        .order('is_primary', { ascending: false })
      if (cancelled) return
      if (linkError) {
        setError('We could not load your verified children. Check your connection and try again.')
        setLoadingChildren(false)
        return
      }

      const nextChildren: Child[] = (links ?? []).flatMap((link: any) => {
        const student = link.students
        if (!student) return []
        const cls = student.classes
        return [{
          id: student.id ?? link.student_id,
          name: student.name ?? 'Learner',
          className: cls ? `${cls.name}${cls.stream ? ` ${cls.stream}` : ''}` : 'Class not confirmed',
        }]
      })
      setChildren(nextChildren)

      if (requestedStudentId) {
        // The linked-child collection is an immediate UX check; RLS remains the
        // actual authorization gate and the summary function must also authorize.
        const requested = nextChildren.find(child => child.id === requestedStudentId)
        setStudentId(requested?.id ?? requestedStudentId)
      } else {
        setStudentId(nextChildren[0]?.id ?? null)
      }
      setLoadingChildren(false)
    }
    void loadChildren()
    return () => { cancelled = true }
  }, [requestedStudentId, router])

  useEffect(() => {
    if (!studentId || loadingChildren) {
      setSummary(null)
      return
    }

    let cancelled = false
    const version = ++requestVersion.current
    setSummary(null)
    setError('')
    setLoading(true)

    async function loadSummary() {
      try {
        // RLS on students is the explicit deep-link authorization gate before
        // requesting any assessment summary for a browser-supplied studentId.
        const { data: student, error: studentError } = await supabase
          .from('students')
          .select('id')
          .eq('id', studentId)
          .maybeSingle()
        if (studentError) throw studentError
        if (!student) throw new Error('This learner is not linked to your active parent account.')

        const payload = await getParentAssessmentSummary(studentId)
        if (!cancelled && version === requestVersion.current) setSummary(payload)
      } catch (cause) {
        if (!cancelled && version === requestVersion.current) {
          setSummary(null)
          setError(cause instanceof Error ? cause.message : 'Could not load released results.')
        }
      } finally {
        if (!cancelled && version === requestVersion.current) setLoading(false)
      }
    }
    void loadSummary()
    return () => { cancelled = true }
  }, [studentId, loadingChildren])

  const switchChild = (id: string) => {
    if (id === studentId) return
    requestVersion.current += 1
    setSummary(null)
    setError('')
    setLoading(true)
    setStudentId(id)
    router.replace(`/parent/assessments?studentId=${encodeURIComponent(id)}`)
  }

  if (!loadingChildren && children.length === 0) {
    return (
      <section style={card}>
        <div style={eyebrow}>Progress</div>
        <h1 style={{ margin: '6px 0', fontSize: 22 }}>No verified child is linked yet</h1>
        <p style={muted}>Results become available only after a school-authorized child relationship exists and a teacher releases an assessment result.</p>
        <button type="button" onClick={() => router.push('/parent/link-child')} style={{ ...primaryButton, marginTop: 14 }}>Link or request access</button>
      </section>
    )
  }

  return (
    <div>
      <section style={{ ...card, background: '#0f172a', color: '#fff' }}>
        <div style={{ ...eyebrow, color: '#6ee7b7' }}>Progress · Released results</div>
        <h1 style={{ margin: '6px 0', fontSize: 24 }}>{activeChild?.name ?? (loadingChildren ? 'Loading learner…' : 'Learner')}</h1>
        <p style={{ ...muted, color: '#cbd5e1' }}>{activeChild?.className ?? 'Verified family view'} · Draft or unreleased marks are not shown.</p>
      </section>

      {children.length > 1 && (
        <section style={{ marginBottom: 12 }} aria-label="Choose child for results">
          <div style={{ ...eyebrow, color: '#64748b', marginBottom: 7 }}>Viewing child</div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
            {children.map(child => (
              <button
                type="button"
                key={child.id}
                onClick={() => switchChild(child.id)}
                aria-pressed={child.id === studentId}
                style={{
                  minWidth: 132, minHeight: 48, borderRadius: 12, padding: '8px 11px', textAlign: 'left',
                  border: child.id === studentId ? '2px solid #059669' : '1px solid #cbd5e1',
                  background: child.id === studentId ? '#ecfdf5' : '#fff', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <strong style={{ display: 'block', fontSize: 13, color: '#0f172a' }}>{child.name.split(' ')[0]}</strong>
                <span style={{ display: 'block', marginTop: 2, fontSize: 10, color: '#64748b' }}>{child.className}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {loadingChildren || loading ? <section style={card} role="status">Loading released results…</section>
        : error ? <section role="alert" style={{ ...card, color: '#991b1b', background: '#fff7ed' }}>
            <strong>Results are temporarily unavailable</strong>
            <p style={{ ...muted, marginTop: 6 }}>{error}</p>
          </section>
        : <>
          <section style={card}>
            <h2 style={sectionTitle}>Released results</h2>
            {!summary || summary.results.length === 0 ? <p style={muted}>No published results are available for {activeChild?.name ?? 'this learner'} yet. Missing results do not mean low performance.</p>
              : <div style={{ display: 'grid', gap: 10 }}>
                {summary.results.map(result => <article key={result.attemptId} style={dataRow}>
                  <div style={{ minWidth: 0 }}>
                    <strong>{result.assessmentTitle}</strong>
                    <div style={muted}>{friendlyAssessmentType(result.assessmentType)} · Released {new Date(result.releasedAt).toLocaleDateString('en-KE')}</div>
                    {result.feedback && <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.5 }}>{result.feedback}</div>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <strong style={{ color: '#0f172a' }}>{result.percentage === null ? 'Score available' : `${Math.round(result.percentage)}%`}</strong>
                    <div style={muted}>{result.score !== null && result.maxScore !== null ? `${result.score} / ${result.maxScore}` : 'See assessment detail'}</div>
                  </div>
                </article>)}
              </div>}
          </section>

          <section style={card}>
            <h2 style={sectionTitle}>Evidence across assessments</h2>
            <p style={{ ...muted, marginBottom: 10 }}>These indicators summarize released assessment evidence. They are not a complete judgment of the learner.</p>
            {!summary || summary.progress.length === 0 ? <p style={muted}>No evidence summary is available yet.</p>
              : <div style={{ display: 'grid', gap: 8 }}>
                {summary.progress.map((value, index) => {
                  const item = asRecord(value)
                  const average = typeof item.average_score === 'number' ? item.average_score : Number(item.average_score)
                  const mastery = typeof item.mastery_percentage === 'number' ? item.mastery_percentage : Number(item.mastery_percentage)
                  return <div key={index} style={dataRow}>
                    <div><strong>Released evidence</strong><div style={muted}>{Number.isFinite(average) ? `${Math.round(average)}% average across available evidence` : 'Average not available'}</div></div>
                    <strong style={{ color: '#334155' }}>{Number.isFinite(mastery) ? `${Math.round(mastery)}% evidence indicator` : '—'}</strong>
                  </div>
                })}
              </div>}
          </section>

          <section style={card}>
            <h2 style={sectionTitle}>Teacher support</h2>
            {!summary || summary.interventions.length === 0 ? <p style={muted}>No published assessment support action is currently shown.</p>
              : <div style={{ display: 'grid', gap: 8 }}>
                {summary.interventions.map((value, index) => {
                  const item = asRecord(value)
                  const recommendation = typeof item.recommendation === 'string' ? item.recommendation : 'Teacher support action'
                  const priority = typeof item.priority === 'string' ? item.priority.replaceAll('_', ' ') : 'active'
                  return <div key={index} style={supportBox}><strong>{recommendation}</strong><div style={muted}>School support · {priority}</div></div>
                })}
              </div>}
          </section>

          {studentId && <button type="button" onClick={() => router.push(`/parent/child/${studentId}`)} style={primaryButton}>Back to {activeChild?.name.split(' ')[0] ?? 'learner'} overview</button>}
        </>}
    </div>
  )
}

const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 16, marginBottom: 12 }
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: 1 }
const sectionTitle: React.CSSProperties = { margin: '0 0 10px', fontSize: 18 }
const muted: React.CSSProperties = { fontSize: 12, lineHeight: 1.5, color: '#64748b', margin: 0 }
const dataRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', border: '1px solid #e2e8f0', borderRadius: 12, padding: 12 }
const supportBox: React.CSSProperties = { border: '1px solid #fde68a', background: '#fffbeb', borderRadius: 12, padding: 12 }
const primaryButton: React.CSSProperties = { width: '100%', minHeight: 46, border: 'none', borderRadius: 12, padding: '13px 16px', background: '#059669', color: '#fff', fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }