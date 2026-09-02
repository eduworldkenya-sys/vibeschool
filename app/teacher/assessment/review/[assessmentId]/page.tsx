'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { approveAssessment } from '@/lib/assessment'
import { loadBuilderAssessment, type BuilderAssessment } from '@/lib/assessment/builder'
import { supabase } from '@/lib/supabase'

type DefinitionContext = { classId: string; status: string; estimatedMinutes: number | null }
type ExistingAssignment = { id: string; status: string }
type RpcResult<T> = { data: T | null; error: { message?: string } | null }
type GenericRpc = <T>(name: string, args: Record<string, unknown>) => PromiseLike<RpcResult<T>>
const rpc = supabase.rpc.bind(supabase) as unknown as GenericRpc

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Assignment authority returned an invalid payload.')
  return value as Record<string, unknown>
}

export default function AssessmentReviewPage() {
  const params = useParams<{ assessmentId: string }>()
  const router = useRouter()
  const assessmentId = params.assessmentId
  const [assessment, setAssessment] = useState<BuilderAssessment | null>(null)
  const [context, setContext] = useState<DefinitionContext | null>(null)
  const [assignment, setAssignment] = useState<ExistingAssignment | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const items = useMemo(() => assessment
    ? [...assessment.sections.flatMap(section => section.items), ...assessment.unsectionedItems]
      .sort((a, b) => a.orderNum - b.orderNum)
    : [], [assessment])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [builder, definitionResult, assignmentResult] = await Promise.all([
        loadBuilderAssessment(assessmentId),
        supabase.from('assessment_definitions').select('class_id,status,estimated_minutes').eq('id', assessmentId).maybeSingle(),
        supabase.from('assessment_assignments').select('id,status').eq('assessment_id', assessmentId).order('assigned_at', { ascending: false }).limit(1).maybeSingle(),
      ])
      if (definitionResult.error) throw definitionResult.error
      if (assignmentResult.error) throw assignmentResult.error
      if (!definitionResult.data?.class_id) throw new Error('Assessment assignment is blocked because class authority is missing.')

      setAssessment(builder)
      setContext({ classId: definitionResult.data.class_id, status: definitionResult.data.status, estimatedMinutes: definitionResult.data.estimated_minutes })
      setAssignment(assignmentResult.data ? { id: assignmentResult.data.id, status: assignmentResult.data.status } : null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Assessment review could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [assessmentId])

  async function assignNow() {
    if (!assessment || !context || busy || assignment) return
    setBusy(true)
    setError('')
    try {
      if (items.length === 0) throw new Error('Assessment has no questions and cannot be assigned.')

      let status = context.status
      if (status === 'draft' || status === 'review') {
        await approveAssessment(assessmentId)
        status = 'approved'
      }
      if (status !== 'approved') throw new Error(`Assessment cannot be assigned from status “${status}”.`)

      const { data, error: assignError } = await rpc<unknown>('exq_assign_lesson_assessment_once', {
        p_assessment_id: assessmentId,
        p_class_id: context.classId,
        p_time_limit_minutes: context.estimatedMinutes,
        p_show_score_policy: 'after_review',
      })
      if (assignError) throw new Error(assignError.message ?? 'Assessment assignment failed.')
      const payload = record(data)
      if (typeof payload.assignment_id !== 'string' || typeof payload.status !== 'string') {
        throw new Error('Assessment assignment authority did not return a valid assignment.')
      }

      setAssignment({ id: payload.assignment_id, status: payload.status })
      setContext(current => current ? { ...current, status: payload.status as string } : current)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Assessment could not be assigned.')
      await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <main style={page}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <button type="button" onClick={() => router.back()} style={secondary}>← Back</button>
        <section style={card}>
          <div style={eyebrow}>Ready to assign</div>
          <h1 style={{ margin: '6px 0' }}>{assessment?.title ?? 'Assessment'}</h1>
          <p style={{ margin: 0, color: '#6b7280', lineHeight: 1.5 }}>VibeSchool prepared this from authoritative curriculum outcomes. Check the questions, then assign in one tap. Full Builder controls are optional.</p>
        </section>

        {error && <section style={errorBox}>{error}</section>}

        {loading ? <section style={card}>Loading assessment…</section> : !assessment || !context ? null : <>
          <section style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <strong>{items.length} questions · {items.reduce((sum, item) => sum + item.marks, 0)} marks</strong>
              <span style={{ color: '#6b7280' }}>{context.estimatedMinutes ? `about ${context.estimatedMinutes} minutes` : 'Teacher-paced'}</span>
            </div>
            <ol style={{ paddingLeft: 22, lineHeight: 1.55, marginBottom: 0 }}>
              {items.map(item => <li key={item.id} style={{ marginBottom: 10 }}>{item.prompt} <strong>({item.marks})</strong><div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>{item.bloomLevel ?? 'outcome check'}{item.difficulty ? ` · ${item.difficulty}` : ''}</div></li>)}
            </ol>
          </section>

          {assignment ? <section style={successBox}><strong>✓ Assigned to the class</strong><div style={{ marginTop: 5 }}>Learners can now receive this assessment through the canonical assessment assignment flow.</div></section> : <button type="button" disabled={busy || items.length === 0} onClick={() => void assignNow()} style={{ ...primary, width: '100%' }}>{busy ? 'Assigning…' : 'Assign now'}</button>}

          <button type="button" onClick={() => router.push(`/teacher/assessment/builder/${assessmentId}`)} style={{ ...secondary, width: '100%', marginTop: 10 }}>Advanced Edit · Sections · Question Bank</button>
        </>}
      </div>
    </main>
  )
}

const page: React.CSSProperties = { minHeight: '100vh', background: '#f8fafc', padding: '18px 14px 80px', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#111827' }
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, marginBottom: 12 }
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: '#4338ca', textTransform: 'uppercase', letterSpacing: 1 }
const primary: React.CSSProperties = { border: 'none', borderRadius: 12, padding: '14px 16px', background: '#4338ca', color: '#fff', fontWeight: 800, cursor: 'pointer' }
const secondary: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 10, padding: '10px 14px', background: '#fff', color: '#374151', fontWeight: 700, cursor: 'pointer' }
const errorBox: React.CSSProperties = { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: 12, color: '#b91c1c', marginBottom: 12 }
const successBox: React.CSSProperties = { background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: 14, color: '#065f46' }
