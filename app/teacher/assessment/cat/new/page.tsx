'use client'

export const dynamic = 'force-dynamic'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { addDraftItem, completeLessonAssessmentGeneration, failLessonAssessmentGeneration } from '@/lib/assessment'

type OutcomeRef = { id: string; text: string; code: string | null }
type CatContext = { classId: string; subjectId: string; term: number | null; completedLessonCount: number; outcomes: OutcomeRef[] }
type CatQuestion = { prompt: string; marks: number; bloom: string; difficulty: 'medium' | 'hard'; outcome: OutcomeRef }
type RpcResult<T> = { data: T | null; error: { message?: string } | null }

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<RpcResult<T>> {
  const result = await supabase.rpc(name as never, args as never)
  return { data: result.data as T | null, error: result.error }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} returned an invalid payload.`)
  return value as Record<string, unknown>
}

function catPrompt(outcome: string, mode: 'explain' | 'apply' | 'analyse' | 'evaluate'): string {
  switch (mode) {
    case 'explain':
      return `Explain the knowledge or skill demonstrated by this taught outcome. Support your response with one accurate example: ${outcome}`
    case 'apply':
      return `Apply this taught outcome to a different example, situation or problem. Show your working, evidence or reasoning: ${outcome}`
    case 'analyse':
      return `Analyse this taught outcome by breaking the response into its important parts and explaining how they connect: ${outcome}`
    case 'evaluate':
      return `Give a reasoned response for this taught outcome and justify your conclusion using evidence or criteria learned in class: ${outcome}`
  }
}

function buildQuestions(outcomes: OutcomeRef[]): CatQuestion[] {
  const modes: Array<'explain' | 'apply' | 'analyse' | 'evaluate'> = ['explain', 'apply', 'analyse', 'evaluate']
  return outcomes.slice(0, 10).map((outcome, index) => {
    const mode = modes[index % modes.length]
    return {
      prompt: catPrompt(outcome.text, mode),
      marks: mode === 'explain' ? 4 : 6,
      bloom: mode === 'explain' ? 'understand' : mode,
      difficulty: mode === 'explain' || mode === 'apply' ? 'medium' : 'hard',
      outcome,
    }
  })
}

function CatWorkspace() {
  const router = useRouter(), params = useSearchParams()
  const seedLessonPlanId = params.get('lessonPlanId') ?? ''
  const [context, setContext] = useState<CatContext | null>(null), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      if (!seedLessonPlanId) { setLoading(false); setError('Open CAT preparation from a saved lesson plan.'); return }
      const { data, error: resolveError } = await rpc<unknown>('exq_resolve_cumulative_cat_outcomes', { p_seed_lesson_plan_id: seedLessonPlanId })
      if (!active) return
      if (resolveError) { setError(resolveError.message ?? 'CAT outcome authority could not be resolved.'); setLoading(false); return }
      try {
        const payload = record(data, 'CAT outcome authority')
        const outcomes = (Array.isArray(payload.outcomes) ? payload.outcomes : []).flatMap(value => {
          const row = record(value, 'CAT outcome')
          return typeof row.id === 'string' && typeof row.outcome_text === 'string' ? [{ id: row.id, text: row.outcome_text, code: typeof row.outcome_code === 'string' ? row.outcome_code : null }] : []
        })
        setContext({ classId: typeof payload.class_id === 'string' ? payload.class_id : '', subjectId: typeof payload.subject_id === 'string' ? payload.subject_id : '', term: typeof payload.term === 'number' ? payload.term : null, completedLessonCount: Number(payload.completed_lesson_count ?? 0), outcomes })
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'CAT outcome authority returned invalid data.') }
      finally { setLoading(false) }
    })()
    return () => { active = false }
  }, [seedLessonPlanId])

  const questions = useMemo(() => buildQuestions(context?.outcomes ?? []), [context])
  const totalMarks = questions.reduce((sum, item) => sum + item.marks, 0)
  const cumulativeReady = Boolean(context && context.completedLessonCount >= 2 && questions.length >= 2)

  async function prepare(advanced: boolean) {
    if (!context || !cumulativeReady || saving) return
    setSaving(true); setError(''); let assessmentId: string | null = null
    try {
      const title = `CAT${context.term ? ` · Term ${context.term}` : ''} · ${context.completedLessonCount} completed lessons`
      const metadata = { generator_version: 'curriculum-outcome-cat-v1', question_blueprint_version: 'cat-quality-v2', ai_used: false, source: 'completed_teaching_occurrences', authority: 'linked_scheme_curriculum_learning_outcomes', completed_lesson_count: context.completedLessonCount, outcome_count: context.outcomes.length, selected_outcome_count: questions.length, bloom_distribution: questions.map(item => item.bloom), difficulty_progression: questions.map(item => item.difficulty) }
      const { data, error: prepareError } = await rpc<unknown>('exq_prepare_certified_cat_assessment', { p_seed_lesson_plan_id: seedLessonPlanId, p_request_key: `cat:${context.classId}:${context.subjectId}:term:${context.term ?? 'none'}:v1:quality2`, p_title: title, p_generation_metadata: metadata })
      if (prepareError) throw new Error(prepareError.message ?? 'CAT preparation failed.')
      const prepared = record(data, 'CAT preparation')
      if (typeof prepared.assessment_id !== 'string') throw new Error('CAT preparation did not return an assessment ID.')
      assessmentId = prepared.assessment_id
      if (prepared.needs_generation === true) {
        for (let index = 0; index < questions.length; index += 1) {
          const item = questions[index]
          const itemId = await addDraftItem({ assessmentId, questionType: 'structured', prompt: item.prompt, marks: item.marks, orderNum: index + 1, acceptedAnswers: [], correctAnswer: null, autoMarkingMode: 'none', difficulty: item.difficulty, bloomLevel: item.bloom, generatedBy: 'cumulative_curriculum_outcome_material' })
          const { error: lineageError } = await rpc<unknown>('exq_link_item_outcome', { p_assessment_item_id: itemId, p_outcome_id: item.outcome.id, p_weight: 1 })
          if (lineageError) throw new Error(lineageError.message ?? 'CAT outcome lineage failed.')
        }
        await completeLessonAssessmentGeneration({ assessmentId, itemCount: questions.length, totalMarks, estimatedMinutes: 40, generationMetadata: { ...metadata, generated_from: 'completed_teaching_occurrences', teacher_review_required: true } })
      }
      router.push(advanced ? `/teacher/assessment/builder/${assessmentId}` : `/teacher/assessment/review/${assessmentId}`)
    } catch (cause) {
      if (assessmentId) { try { await failLessonAssessmentGeneration({ assessmentId, errorCode: 'cumulative_cat_generation_failed', errorMessage: cause instanceof Error ? cause.message : null }) } catch (recordError) { console.error('[CATWorkspace] failure recording failed', recordError) } }
      setError(cause instanceof Error ? cause.message : 'CAT could not be prepared.')
    } finally { setSaving(false) }
  }

  return <main style={page}><div style={{ maxWidth: 760, margin: '0 auto' }}>
    <button type="button" onClick={() => router.back()} style={secondary}>← Back</button>
    <section style={card}><div style={eyebrow}>Cumulative CAT · No AI</div><h1 style={{ margin: '6px 0' }}>Built only from completed teaching</h1><p style={{ margin: 0, color: '#6b7280', lineHeight: 1.55 }}>CAT does not copy one lesson. It uses outcomes from multiple lessons with authoritative completed teaching occurrences for this class, subject and term.</p></section>
    {error && <section style={errorBox}>{error}</section>}
    {loading ? <section style={card}>Loading completed teaching…</section> : !context ? null : <><section style={card}><strong>{context.completedLessonCount} completed lessons · {context.outcomes.length} taught outcomes</strong>{!cumulativeReady ? <div style={notice}>CAT preparation requires at least two completed lessons and two taught outcomes. VibeSchool will not create a false cumulative assessment.</div> : <><div style={{ marginTop: 6, color: '#6b7280' }}>{questions.length} CAT questions · {totalMarks} marks · about 40 minutes</div><ol style={{ paddingLeft: 22, lineHeight: 1.55 }}>{questions.map(item => <li key={item.outcome.id} style={{ marginBottom: 10 }}>{item.prompt} <strong>({item.marks})</strong></li>)}</ol></>}</section>{cumulativeReady && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><button type="button" disabled={saving} onClick={() => void prepare(false)} style={primary}>{saving ? 'Preparing…' : 'Review & assign CAT'}</button><button type="button" disabled={saving} onClick={() => void prepare(true)} style={secondary}>Advanced Edit</button></div>}</>}
  </div></main>
}

const page: React.CSSProperties = { minHeight: '100vh', background: '#f8fafc', padding: '18px 14px 80px', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#111827' }
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, marginBottom: 12 }
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: '#4338ca', textTransform: 'uppercase', letterSpacing: 1 }
const primary: React.CSSProperties = { border: 'none', borderRadius: 12, padding: '14px 16px', background: '#4338ca', color: '#fff', fontWeight: 800, cursor: 'pointer' }
const secondary: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 10, padding: '10px 14px', background: '#fff', color: '#374151', fontWeight: 700, cursor: 'pointer' }
const errorBox: React.CSSProperties = { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: 12, color: '#b91c1c', marginBottom: 12 }
const notice: React.CSSProperties = { marginTop: 12, padding: 12, borderRadius: 10, background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }
export default function CatNewPage() { return <Suspense fallback={<main style={{ padding: 20 }}>Loading CAT workspace…</main>}><CatWorkspace /></Suspense> }
