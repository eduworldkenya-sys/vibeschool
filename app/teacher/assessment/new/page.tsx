'use client'

export const dynamic = 'force-dynamic'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { addDraftItem, completeLessonAssessmentGeneration, failLessonAssessmentGeneration } from '@/lib/assessment'
import type { AutoMarkingMode, QuestionType } from '@/lib/assessment'

type StudioType = 'exercise' | 'quiz' | 'homework' | 'test'
type LessonTruth = { body: string; classId: string; subjectId: string }
type OutcomeRef = { id: string; text: string }
type DraftQuestion = { prompt: string; marks: number; questionType: QuestionType; autoMarkingMode: AutoMarkingMode; difficulty: 'easy' | 'medium' | 'hard'; bloomLevel: string; outcomeTexts: string[] }
type RpcResult<T> = { data: T | null; error: { message?: string } | null }

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<RpcResult<T>> {
  const result = await supabase.rpc(name as never, args as never)
  return { data: result.data as T | null, error: result.error }
}

const LABEL: Record<StudioType, string> = { exercise: 'Class Exercise', quiz: 'Quick Quiz', homework: 'Homework', test: 'CAT' }
const SPEC: Record<StudioType, { minutes: number; purpose: string }> = {
  exercise: { minutes: 25, purpose: 'Guided practice on today’s taught outcomes.' },
  quiz: { minutes: 15, purpose: 'A short independent mastery check.' },
  homework: { minutes: 35, purpose: 'Independent reinforcement using a certified homework task.' },
  test: { minutes: 40, purpose: 'Formal cumulative assessment across completed teaching.' },
}

function section(body: string, name: string): string { return body.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1]?.trim() ?? '' }
function objectiveTexts(body: string): string[] { return section(body, 'objectives').split('\n').map(value => value.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean) }
function question(prompt: string, marks: number, bloomLevel: string, difficulty: 'easy' | 'medium' | 'hard', outcomes: string[]): DraftQuestion { return { prompt, marks, questionType: 'structured', autoMarkingMode: 'none', difficulty, bloomLevel, outcomeTexts: outcomes } }

function outcomePrompt(outcome: string, mode: 'explain' | 'apply' | 'evidence' | 'justify'): string {
  switch (mode) {
    case 'explain':
      return `Explain in your own words what you learned for this outcome, then give one accurate example: ${outcome}`
    case 'apply':
      return `Apply this taught outcome to a new example or situation. Show the steps, evidence or reasoning you used: ${outcome}`
    case 'evidence':
      return `Give one clear piece of evidence, example or worked response that demonstrates mastery of this taught outcome: ${outcome}`
    case 'justify':
      return `Respond to this taught outcome, then justify why your response is correct using lesson evidence or reasoning: ${outcome}`
  }
}

function questionsFor(type: StudioType, body: string): DraftQuestion[] {
  const outcomes = objectiveTexts(body)
  if (!outcomes.length || type === 'test') return []

  if (type === 'exercise') {
    return outcomes.map((outcome, index) => {
      const cycle: Array<'explain' | 'apply' | 'justify'> = ['explain', 'apply', 'justify']
      const mode = cycle[index % cycle.length]
      return question(
        outcomePrompt(outcome, mode),
        mode === 'explain' ? 2 : 4,
        mode === 'explain' ? 'understand' : mode === 'apply' ? 'apply' : 'analyse',
        mode === 'explain' ? 'easy' : 'medium',
        [outcome],
      )
    })
  }

  if (type === 'quiz') {
    const cycle: Array<'explain' | 'apply' | 'evidence'> = ['explain', 'apply', 'evidence']
    return outcomes.slice(0, 3).map((outcome, index) => {
      const mode = cycle[index]
      return question(
        outcomePrompt(outcome, mode),
        index === 0 ? 2 : 3,
        index === 0 ? 'understand' : 'apply',
        index === 0 ? 'easy' : 'medium',
        [outcome],
      )
    })
  }

  const homework = section(body, 'homework')
  // Keep this exact contract expression stable: it is the fail-closed release
  // guard for legacy lesson bodies. The second check covers the newer wording.
  if (!homework || /no certified homework task|do not invent/i.test(homework) || /no homework task is attached/i.test(homework)) return []
  return [
    question(homework, 10, 'apply', 'medium', outcomes),
    question(outcomePrompt(outcomes[0], 'justify'), 5, 'analyse', 'hard', [outcomes[0]]),
  ]
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} returned an invalid payload.`)
  return value as Record<string, unknown>
}

async function resolveOutcomeRefs(lessonPlanId: string, texts: string[]): Promise<OutcomeRef[]> {
  const uniqueTexts = Array.from(new Set(texts))
  const { data, error } = await rpc<unknown>('exq_resolve_lesson_assessment_outcomes', { p_lesson_plan_id: lessonPlanId })
  if (error) throw new Error(error.message ?? 'Curriculum outcome resolution failed.')
  const payload = record(data, 'Curriculum outcome authority')
  const refs = (Array.isArray(payload.outcomes) ? payload.outcomes : []).flatMap(value => {
    const row = record(value, 'Curriculum outcome')
    return typeof row.id === 'string' && typeof row.outcome_text === 'string' ? [{ id: row.id, text: row.outcome_text }] : []
  })
  const resolved = new Set(refs.map(ref => ref.text))
  const missing = uniqueTexts.filter(text => !resolved.has(text))
  if (missing.length) throw new Error(`Assessment blocked: ${missing.length} lesson outcome${missing.length === 1 ? '' : 's'} could not be resolved through linked Scheme curriculum authority.`)
  return refs
}

async function linkItemOutcomes(itemId: string, texts: string[], refs: OutcomeRef[]): Promise<void> {
  const byText = new Map(refs.map(ref => [ref.text, ref.id]))
  for (const text of Array.from(new Set(texts))) {
    const outcomeId = byText.get(text)
    if (!outcomeId) throw new Error('Assessment item outcome lineage could not be resolved.')
    const { error } = await rpc<unknown>('exq_link_item_outcome', { p_assessment_item_id: itemId, p_outcome_id: outcomeId, p_weight: 1 })
    if (error) throw new Error(error.message ?? 'Assessment outcome lineage failed.')
  }
}

function Studio() {
  const router = useRouter(), params = useSearchParams()
  const lessonPlanId = params.get('lessonPlanId') ?? '', requested = params.get('type')
  const initial: StudioType = requested === 'exercise' || requested === 'homework' || requested === 'test' ? requested : 'quiz'
  const [type, setType] = useState<StudioType>(initial), [lesson, setLesson] = useState<LessonTruth | null>(null), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      if (!lessonPlanId) { setLoading(false); return }
      const { data, error: loadError } = await supabase.from('lesson_plans').select('body,class_id,subject_id').eq('id', lessonPlanId).maybeSingle()
      if (!active) return
      if (loadError) setError(loadError.message)
      else if (!data?.body || !data.class_id || !data.subject_id) setError('Assessment preparation is blocked because the saved lesson is missing authoritative context.')
      else setLesson({ body: data.body, classId: data.class_id, subjectId: data.subject_id })
      setLoading(false)
    })()
    return () => { active = false }
  }, [lessonPlanId])

  const questions = useMemo(() => lesson ? questionsFor(type, lesson.body) : [], [lesson, type])
  const totalMarks = questions.reduce((sum, item) => sum + item.marks, 0)

  async function prepare(advanced: boolean) {
    if (!lesson || !lessonPlanId || saving || type === 'test' || !questions.length) return
    setSaving(true); setError(''); let assessmentId: string | null = null
    try {
      const outcomeRefs = await resolveOutcomeRefs(lessonPlanId, questions.flatMap(item => item.outcomeTexts))
      const metadata = { generator_version: 'curriculum-outcome-assessment-v5', ai_used: false, source: 'authoritative_lesson_body', authority: 'linked_scheme_curriculum_learning_outcomes', blueprint: { question_count: questions.length, estimated_minutes: SPEC[type].minutes, outcome_count: outcomeRefs.length, difficulty_progression: questions.map(item => item.difficulty), bloom_distribution: questions.map(item => item.bloomLevel) } }
      const { data, error: prepareError } = await rpc<unknown>('exq_prepare_grounded_lesson_assessment', { p_lesson_plan_id: lessonPlanId, p_assessment_type: type, p_request_key: `lesson:${lessonPlanId}:${type}:v5`, p_title: `${LABEL[type]} — lesson outcomes`, p_generation_metadata: metadata })
      if (prepareError) throw new Error(prepareError.message ?? 'Assessment preparation failed.')
      const prepared = record(data, 'Grounded assessment preparation')
      if (typeof prepared.assessment_id !== 'string') throw new Error('Grounded assessment preparation did not return an assessment ID.')
      assessmentId = prepared.assessment_id
      if (prepared.needs_generation === true) {
        for (let index = 0; index < questions.length; index += 1) {
          const item = questions[index]
          const itemId = await addDraftItem({ assessmentId, questionType: item.questionType, prompt: item.prompt, marks: item.marks, orderNum: index + 1, acceptedAnswers: [], correctAnswer: null, autoMarkingMode: item.autoMarkingMode, difficulty: item.difficulty, bloomLevel: item.bloomLevel, generatedBy: 'curriculum_outcome_material' })
          await linkItemOutcomes(itemId, item.outcomeTexts, outcomeRefs)
        }
        await completeLessonAssessmentGeneration({ assessmentId, itemCount: questions.length, totalMarks, estimatedMinutes: SPEC[type].minutes, generationMetadata: { ...metadata, generated_from: 'authoritative_lesson_body', teacher_review_required: true } })
      }
      router.push(advanced ? `/teacher/assessment/builder/${assessmentId}` : `/teacher/assessment/review/${assessmentId}`)
    } catch (cause) {
      if (assessmentId) { try { await failLessonAssessmentGeneration({ assessmentId, errorCode: 'curriculum_grounded_generation_failed', errorMessage: cause instanceof Error ? cause.message : null }) } catch (recordError) { console.error('[LessonAssessmentStudio] failure recording failed', recordError) } }
      setError(cause instanceof Error ? cause.message : 'Material could not be prepared.')
    } finally { setSaving(false) }
  }

  if (!lessonPlanId) return <main style={page}><section style={card}><h1>Lesson Materials</h1><p>Open materials from a saved lesson plan.</p></section></main>
  const blocked = type === 'homework' ? 'No certified homework is attached. VibeSchool will not invent one.' : type === 'test' ? 'CAT is cumulative. It is built from outcomes across completed teaching, not cloned from this one lesson.' : 'Automatic generation is blocked because authoritative lesson outcomes are unavailable.'
  return <main style={page}><div style={{ maxWidth: 760, margin: '0 auto' }}>
    <button type="button" onClick={() => router.back()} style={secondary}>← Back to lesson</button>
    <section style={card}><div style={eyebrow}>Prepared assessment pack · No AI</div><h1>Ready from authoritative lesson outcomes</h1><p style={{ color: '#6b7280' }}>Curriculum outcomes—not activity labels—drive generated work. Advanced authoring is optional.</p></section>
    <section style={card}><div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>{(Object.keys(LABEL) as StudioType[]).map(materialType => <button key={materialType} type="button" onClick={() => setType(materialType)} style={{ padding: 14, borderRadius: 12, border: type === materialType ? '2px solid #4338ca' : '1px solid #d1d5db', background: type === materialType ? '#eef2ff' : '#fff', fontWeight: 800 }}>{LABEL[materialType]}</button>)}</div></section>
    <section style={card}><div style={eyebrow}>{LABEL[type]}</div><h2>{SPEC[type].purpose}</h2>{loading ? <p>Loading authoritative lesson…</p> : questions.length === 0 ? <div style={notice}>{blocked}</div> : <><div>{questions.length} questions · {totalMarks} marks · about {SPEC[type].minutes} minutes</div><ol>{questions.map((item, index) => <li key={`${item.prompt}-${index}`} style={{ marginBottom: 10 }}>{item.prompt} <strong>({item.marks})</strong></li>)}</ol></>}</section>
    {error && <div style={errorBox}>{error}</div>}
    {type === 'test' ? <button type="button" onClick={() => router.push(`/teacher/assessment/cat/new?lessonPlanId=${encodeURIComponent(lessonPlanId)}`)} style={{ ...primary, width: '100%' }}>Open cumulative CAT workspace</button> : questions.length > 0 ? <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><button type="button" disabled={saving} onClick={() => void prepare(false)} style={primary}>{saving ? 'Preparing…' : 'Review & assign'}</button><button type="button" disabled={saving} onClick={() => void prepare(true)} style={secondary}>Advanced Edit</button></div> : null}
  </div></main>
}

const page: React.CSSProperties = { minHeight: '100vh', background: '#f8fafc', padding: '18px 14px 80px', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#111827' }
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, marginBottom: 12 }
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: '#4338ca', textTransform: 'uppercase', letterSpacing: 1 }
const primary: React.CSSProperties = { border: 'none', borderRadius: 12, padding: '14px 16px', background: '#4338ca', color: '#fff', fontWeight: 800, cursor: 'pointer' }
const secondary: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 10, padding: '10px 14px', background: '#fff', color: '#374151', fontWeight: 700, cursor: 'pointer' }
const notice: React.CSSProperties = { padding: 12, borderRadius: 10, background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', lineHeight: 1.5 }
const errorBox: React.CSSProperties = { padding: 12, borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', marginBottom: 12 }
export default function NewAssessmentPage() { return <Suspense fallback={<main style={{ padding: 20 }}>Loading lesson materials…</main>}><Studio /></Suspense> }
