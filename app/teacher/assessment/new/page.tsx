'use client'

export const dynamic = 'force-dynamic'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  addDraftItem,
  completeLessonAssessmentGeneration,
  failLessonAssessmentGeneration,
  requestLessonAssessment,
} from '@/lib/assessment'
import type {
  AutoMarkingMode,
  LessonAssessmentType,
  QuestionType,
} from '@/lib/assessment'

type StudioType = 'exercise' | 'quiz' | 'homework' | 'test'
type LessonTruth = { body: string; classId: string; subjectId: string }
type OutcomeRef = { id: string; text: string }
type DraftQuestion = {
  prompt: string
  marks: number
  questionType: QuestionType
  autoMarkingMode: AutoMarkingMode
  difficulty: 'easy' | 'medium' | 'hard'
  bloomLevel: string
  outcomeTexts: string[]
}
type RpcResult<T> = { data: T | null; error: { message?: string } | null }
type GenericRpc = <T>(name: string, args: Record<string, unknown>) => PromiseLike<RpcResult<T>>
const rpc = supabase.rpc.bind(supabase) as unknown as GenericRpc

const LABEL: Record<StudioType, string> = {
  exercise: 'Class Exercise',
  quiz: 'Quick Quiz',
  homework: 'Homework',
  test: 'CAT',
}

const SPEC: Record<StudioType, { minutes: number; purpose: string }> = {
  exercise: { minutes: 25, purpose: 'Guided practice on today’s taught outcomes.' },
  quiz: { minutes: 15, purpose: 'A short independent mastery check.' },
  homework: { minutes: 35, purpose: 'Independent reinforcement using a certified homework task.' },
  test: { minutes: 40, purpose: 'Formal cumulative assessment across taught outcomes.' },
}

function section(body: string, name: string): string {
  return body.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1]?.trim() ?? ''
}

function objectiveTexts(body: string): string[] {
  return section(body, 'objectives')
    .split('\n')
    .map(value => value.replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter(Boolean)
}

function makeQuestion(
  prompt: string,
  marks: number,
  bloomLevel: string,
  difficulty: 'easy' | 'medium' | 'hard',
  outcomes: string[],
): DraftQuestion {
  return {
    prompt,
    marks,
    questionType: 'structured',
    autoMarkingMode: 'none',
    difficulty,
    bloomLevel,
    outcomeTexts: outcomes,
  }
}

function questionsFor(type: StudioType, body: string): DraftQuestion[] {
  const outcomes = objectiveTexts(body)
  if (!outcomes.length) return []

  if (type === 'exercise') {
    return outcomes.map((outcome, index) => makeQuestion(
      `${outcome} Give a clear answer using evidence or an example from the lesson.`,
      index === 0 ? 2 : 4,
      index === 0 ? 'understand' : 'apply',
      index === 0 ? 'easy' : 'medium',
      [outcome],
    ))
  }

  if (type === 'quiz') {
    return outcomes.slice(0, 3).map((outcome, index) => makeQuestion(
      `Show independently that you can: ${outcome}`,
      index === 0 ? 2 : 3,
      index === 0 ? 'remember' : 'understand',
      index === 0 ? 'easy' : 'medium',
      [outcome],
    ))
  }

  if (type === 'homework') {
    const homework = section(body, 'homework')
    if (!homework || /no certified homework task|do not invent/i.test(homework)) return []
    return [
      makeQuestion(homework, 10, 'apply', 'medium', outcomes),
      makeQuestion(
        `Apply this taught outcome in a new context: ${outcomes[0]}`,
        5,
        'create',
        'hard',
        [outcomes[0]],
      ),
    ]
  }

  // A formal CAT must not silently pretend one lesson is cumulative.
  return []
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Curriculum outcome authority returned an invalid payload.')
  }
  return value as Record<string, unknown>
}

async function resolveOutcomeRefs(lessonPlanId: string, texts: string[]): Promise<OutcomeRef[]> {
  const uniqueTexts = [...new Set(texts)]
  if (!uniqueTexts.length) return []

  const { data, error } = await rpc<unknown>('exq_resolve_lesson_assessment_outcomes', {
    p_lesson_plan_id: lessonPlanId,
  })
  if (error) throw new Error(`Curriculum outcome resolution failed: ${error.message ?? 'unknown error'}`)

  const payload = asRecord(data)
  const outcomes = Array.isArray(payload.outcomes) ? payload.outcomes : []
  const refs = outcomes.flatMap(value => {
    const row = asRecord(value)
    return typeof row.id === 'string' && typeof row.outcome_text === 'string'
      ? [{ id: row.id, text: row.outcome_text }]
      : []
  })

  const resolved = new Set(refs.map(ref => ref.text))
  const missing = uniqueTexts.filter(text => !resolved.has(text))
  if (missing.length) {
    throw new Error(`Assessment blocked: ${missing.length} lesson outcome${missing.length === 1 ? '' : 's'} could not be resolved through the linked Scheme curriculum authority.`)
  }
  return refs
}

async function linkItemOutcomes(
  assessmentItemId: string,
  outcomeTextsForItem: string[],
  outcomeRefs: OutcomeRef[],
): Promise<void> {
  const byText = new Map(outcomeRefs.map(ref => [ref.text, ref.id]))
  for (const text of [...new Set(outcomeTextsForItem)]) {
    const outcomeId = byText.get(text)
    if (!outcomeId) throw new Error('Assessment item outcome lineage could not be resolved.')
    const { error } = await rpc<unknown>('exq_link_item_outcome', {
      p_assessment_item_id: assessmentItemId,
      p_outcome_id: outcomeId,
      p_weight: 1,
    })
    if (error) throw new Error(`Assessment outcome lineage failed: ${error.message ?? 'unknown error'}`)
  }
}

function Studio() {
  const router = useRouter()
  const params = useSearchParams()
  const lessonPlanId = params.get('lessonPlanId') ?? ''
  const requested = params.get('type')
  const initial: StudioType = requested === 'exercise' || requested === 'homework' || requested === 'test'
    ? requested
    : 'quiz'

  const [type, setType] = useState<StudioType>(initial)
  const [lesson, setLesson] = useState<LessonTruth | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      if (!lessonPlanId) {
        setLoading(false)
        return
      }
      const { data, error: loadError } = await supabase
        .from('lesson_plans')
        .select('body,class_id,subject_id')
        .eq('id', lessonPlanId)
        .maybeSingle()

      if (!active) return
      if (loadError) {
        setError(loadError.message)
      } else if (!data?.body || !data.class_id || !data.subject_id) {
        setError('Assessment preparation is blocked because the saved lesson is missing authoritative lesson context.')
      } else {
        setLesson({ body: data.body, classId: data.class_id, subjectId: data.subject_id })
      }
      setLoading(false)
    })()
    return () => { active = false }
  }, [lessonPlanId])

  const questions = useMemo(() => lesson ? questionsFor(type, lesson.body) : [], [type, lesson])
  const marks = questions.reduce((sum, question) => sum + question.marks, 0)

  async function prepare(advanced: boolean) {
    if (!lessonPlanId || !lesson || saving || !questions.length) return
    setSaving(true)
    setError('')
    let assessmentId: string | null = null

    try {
      const allOutcomeTexts = questions.flatMap(question => question.outcomeTexts)
      const outcomeRefs = await resolveOutcomeRefs(lessonPlanId, allOutcomeTexts)
      const request = await requestLessonAssessment({
        lessonPlanId,
        assessmentType: type as LessonAssessmentType,
        requestKey: `lesson:${lessonPlanId}:${type}:v4`,
        title: `${LABEL[type]} — lesson outcomes`,
        generationMetadata: {
          generator_version: 'curriculum-outcome-assessment-v4',
          ai_used: false,
          source: 'authoritative_lesson_body',
          authority: 'linked_scheme_curriculum_learning_outcomes',
          blueprint: {
            question_count: questions.length,
            estimated_minutes: SPEC[type].minutes,
            outcome_count: outcomeRefs.length,
            difficulty_progression: questions.map(question => question.difficulty),
            bloom_distribution: questions.map(question => question.bloomLevel),
          },
        },
      })

      assessmentId = request.assessmentId
      if (request.created) {
        for (let index = 0; index < questions.length; index += 1) {
          const question = questions[index]
          const itemId = await addDraftItem({
            assessmentId,
            questionType: question.questionType,
            prompt: question.prompt,
            marks: question.marks,
            orderNum: index + 1,
            acceptedAnswers: [],
            correctAnswer: null,
            autoMarkingMode: question.autoMarkingMode,
            difficulty: question.difficulty,
            bloomLevel: question.bloomLevel,
            generatedBy: 'curriculum_outcome_material',
          })
          await linkItemOutcomes(itemId, question.outcomeTexts, outcomeRefs)
        }

        await completeLessonAssessmentGeneration({
          assessmentId,
          itemCount: questions.length,
          totalMarks: marks,
          estimatedMinutes: SPEC[type].minutes,
          generationMetadata: {
            generated_from: 'authoritative_lesson_body',
            authority: 'linked_scheme_curriculum_learning_outcomes',
            ai_used: false,
            teacher_review_required: true,
          },
        })
      }

      router.push(
        advanced
          ? `/teacher/assessment/builder/${assessmentId}`
          : `/teacher/assessment/review/${assessmentId}`,
      )
    } catch (cause) {
      if (assessmentId) {
        try {
          await failLessonAssessmentGeneration({
            assessmentId,
            errorCode: 'curriculum_grounded_generation_failed',
            errorMessage: cause instanceof Error ? cause.message : null,
          })
        } catch (recordError) {
          console.error('[LessonAssessmentStudio] failure recording failed', recordError)
        }
      }
      setError(cause instanceof Error ? cause.message : 'Material could not be prepared.')
    } finally {
      setSaving(false)
    }
  }

  if (!lessonPlanId) {
    return <main style={page}><section style={card}><h1>Lesson Materials</h1><p>Open materials from a saved lesson plan.</p></section></main>
  }

  const blockedMessage = type === 'homework'
    ? 'No certified homework is attached. VibeSchool will not invent one. Use Advanced Edit only when the teacher intentionally authors a task.'
    : type === 'test'
      ? 'CAT is cumulative. VibeSchool will not disguise one lesson as a formal CAT. Build CAT from the cumulative assessment workspace using taught outcomes across completed lessons.'
      : 'Automatic generation is blocked because authoritative lesson outcomes are unavailable.'

  return (
    <main style={page}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <button type="button" onClick={() => router.back()} style={secondary}>← Back to lesson</button>
        <section style={card}>
          <div style={eyebrow}>Prepared assessment pack · No AI</div>
          <h1>Ready from authoritative lesson outcomes</h1>
          <p style={{ color: '#6b7280' }}>Curriculum outcomes—not activity labels—drive every generated question. Advanced authoring remains optional.</p>
        </section>

        <section style={card}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
            {(Object.keys(LABEL) as StudioType[]).map(materialType => (
              <button
                key={materialType}
                type="button"
                onClick={() => setType(materialType)}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  border: type === materialType ? '2px solid #4338ca' : '1px solid #d1d5db',
                  background: type === materialType ? '#eef2ff' : '#fff',
                  fontWeight: 800,
                }}
              >
                {LABEL[materialType]}
              </button>
            ))}
          </div>
        </section>

        <section style={card}>
          <div style={eyebrow}>{LABEL[type]}</div>
          <h2>{SPEC[type].purpose}</h2>
          {loading ? (
            <p>Loading authoritative lesson…</p>
          ) : questions.length === 0 ? (
            <div style={notice}>{blockedMessage}</div>
          ) : (
            <>
              <div>{questions.length} questions · {marks} marks · about {SPEC[type].minutes} minutes</div>
              <ol>
                {questions.map((question, index) => (
                  <li key={`${question.prompt}-${index}`} style={{ marginBottom: 10 }}>
                    {question.prompt} <strong>({question.marks})</strong>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>

        {error && <div style={errorBox}>{error}</div>}
        {questions.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button type="button" disabled={saving} onClick={() => void prepare(false)} style={primary}>
              {saving ? 'Preparing…' : 'Review & assign'}
            </button>
            <button type="button" disabled={saving} onClick={() => void prepare(true)} style={secondary}>Advanced Edit</button>
          </div>
        )}
      </div>
    </main>
  )
}

const page: React.CSSProperties = { minHeight: '100vh', background: '#f8fafc', padding: '18px 14px 80px', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#111827' }
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, marginBottom: 12 }
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: '#4338ca', textTransform: 'uppercase', letterSpacing: 1 }
const primary: React.CSSProperties = { border: 'none', borderRadius: 12, padding: '14px 16px', background: '#4338ca', color: '#fff', fontWeight: 800, cursor: 'pointer' }
const secondary: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 10, padding: '10px 14px', background: '#fff', color: '#374151', fontWeight: 700, cursor: 'pointer' }
const notice: React.CSSProperties = { padding: 12, borderRadius: 10, background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', lineHeight: 1.5 }
const errorBox: React.CSSProperties = { padding: 12, borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', marginBottom: 12 }

export default function NewAssessmentPage() {
  return <Suspense fallback={<main style={{ padding: 20 }}>Loading lesson materials…</main>}><Studio /></Suspense>
}
