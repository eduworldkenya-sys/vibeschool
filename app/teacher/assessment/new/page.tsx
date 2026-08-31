'use client'

export const dynamic = 'force-dynamic'

import { Suspense, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
type DraftQuestion = {
  prompt: string
  answer: string
  marks: number
  questionType: QuestionType
  autoMarkingMode: AutoMarkingMode
  difficulty: 'easy' | 'medium' | 'hard'
  bloomLevel: string
}

const TYPE_LABEL: Record<StudioType, string> = {
  exercise: 'Class Exercise',
  quiz: 'Quick Quiz',
  homework: 'Homework',
  test: 'CAT',
}

const BLUEPRINT: Record<StudioType, { minutes: number; instructions: string }> = {
  exercise: { minutes: 25, instructions: 'Answer all questions. Show your working where required.' },
  quiz: { minutes: 15, instructions: 'Answer all questions within the suggested time.' },
  homework: { minutes: 35, instructions: 'Complete all questions and submit by the due date set by your teacher.' },
  test: { minutes: 40, instructions: 'Answer all questions. Read each question carefully and manage your time.' },
}

function cleanPreparedCheck(line: string): string {
  return line.replace(/^\s*\d+[.)]\s*/, '').trim()
}

function preparedQuestionsFromHook(hook: string): DraftQuestion[] {
  const prepared = hook.match(/Prepared checks:\s*([\s\S]*?)(?:\n\s*Scheme assessment method|\n\s*Record each learner|$)/i)?.[1] ?? ''
  if (!prepared.trim()) return []

  const lines = prepared.split('\n').map(line => line.trim()).filter(Boolean)
  const questions: DraftQuestion[] = []

  for (let index = 0; index < lines.length; index += 1) {
    if (/^Expected answer:/i.test(lines[index])) continue
    if (!/^\d+[.)]\s/.test(lines[index])) continue

    const prompt = cleanPreparedCheck(lines[index])
    const nextLine = lines[index + 1] ?? ''
    const answer = /^Expected answer:/i.test(nextLine)
      ? nextLine.replace(/^Expected answer:\s*/i, '').trim()
      : ''

    if (!prompt) continue
    questions.push({
      prompt,
      answer,
      marks: answer ? 2 : 3,
      questionType: 'short_answer',
      autoMarkingMode: answer ? 'case_insensitive' : 'none',
      difficulty: questions.length === 0 ? 'easy' : questions.length < 3 ? 'medium' : 'hard',
      bloomLevel: questions.length === 0 ? 'remember' : questions.length < 3 ? 'understand' : 'apply',
    })
  }

  return questions
}

function fallbackQuestions(type: StudioType, topic: string): DraftQuestion[] {
  const focus = topic.trim() || 'this lesson'
  const base: DraftQuestion[] = [
    { prompt: `State one key idea you learned about ${focus}.`, answer: '', marks: 2, questionType: 'short_answer', autoMarkingMode: 'none', difficulty: 'easy', bloomLevel: 'remember' },
    { prompt: `Explain ${focus} in your own words.`, answer: '', marks: 3, questionType: 'structured', autoMarkingMode: 'none', difficulty: 'medium', bloomLevel: 'understand' },
    { prompt: `Apply what you learned about ${focus} to one correct example.`, answer: '', marks: 4, questionType: 'structured', autoMarkingMode: 'none', difficulty: 'medium', bloomLevel: 'apply' },
  ]

  if (type === 'homework') {
    return [...base, { prompt: `Create and solve one new example about ${focus}.`, answer: '', marks: 4, questionType: 'structured', autoMarkingMode: 'none', difficulty: 'hard', bloomLevel: 'create' }]
  }
  if (type === 'test') {
    return [...base, { prompt: `Compare two ideas or methods related to ${focus} and justify your answer.`, answer: '', marks: 5, questionType: 'structured', autoMarkingMode: 'none', difficulty: 'hard', bloomLevel: 'evaluate' }]
  }
  return base
}

function buildQuestions(type: StudioType, topic: string, hook: string): DraftQuestion[] {
  const prepared = preparedQuestionsFromHook(hook)
  if (prepared.length > 0) {
    if (type === 'quiz') return prepared.slice(0, 5)
    if (type === 'exercise') return prepared
    if (type === 'homework') return prepared.slice(0, Math.max(1, Math.min(6, prepared.length)))
    return prepared
  }
  return fallbackQuestions(type, topic)
}

function Studio() {
  const router = useRouter()
  const params = useSearchParams()
  const lessonPlanId = params.get('lessonPlanId') ?? ''
  const topic = params.get('topic') ?? ''
  const assessmentHook = params.get('assessmentHook') ?? ''
  const requestedType = params.get('type')
  const initialType: StudioType = requestedType === 'exercise' || requestedType === 'homework' || requestedType === 'test' ? requestedType : 'quiz'

  const [assessmentType, setAssessmentType] = useState<StudioType>(initialType)
  const questions = useMemo(() => buildQuestions(assessmentType, topic, assessmentHook), [assessmentType, topic, assessmentHook])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function createDraft() {
    if (!lessonPlanId || saving) return
    setSaving(true)
    setError('')

    let assessmentId: string | null = null
    try {
      const label = TYPE_LABEL[assessmentType]
      const request = await requestLessonAssessment({
        lessonPlanId,
        assessmentType: assessmentType as LessonAssessmentType,
        requestKey: `lesson:${lessonPlanId}:${assessmentType}:v2`,
        title: `${label} — ${topic || 'Lesson'}`,
        generationMetadata: {
          generator_version: 'deterministic-lesson-materials-v2',
          ai_used: false,
          source: 'lesson_plan_prepared_checks',
          blueprint: {
            question_count: questions.length,
            estimated_minutes: BLUEPRINT[assessmentType].minutes,
            difficulty_progression: questions.map(question => question.difficulty),
            bloom_distribution: questions.map(question => question.bloomLevel),
          },
        },
      })

      assessmentId = request.assessmentId
      if (!request.created) {
        router.push(`/teacher/assessment/builder/${assessmentId}`)
        return
      }

      let totalMarks = 0
      for (let index = 0; index < questions.length; index += 1) {
        const question = questions[index]
        totalMarks += question.marks
        await addDraftItem({
          assessmentId,
          questionType: question.questionType,
          prompt: question.prompt,
          marks: question.marks,
          orderNum: index + 1,
          acceptedAnswers: question.answer ? [question.answer] : [],
          correctAnswer: question.answer || null,
          autoMarkingMode: question.answer ? question.autoMarkingMode : 'none',
          difficulty: question.difficulty,
          bloomLevel: question.bloomLevel,
          generatedBy: 'deterministic_lesson_material',
        })
      }

      await completeLessonAssessmentGeneration({
        assessmentId,
        itemCount: questions.length,
        totalMarks,
        estimatedMinutes: BLUEPRINT[assessmentType].minutes,
        generationMetadata: { generated_from: 'lesson_plan', ai_used: false, teacher_review_required: true },
      })

      router.push(`/teacher/assessment/builder/${assessmentId}`)
    } catch (generationError) {
      console.error('[LessonAssessmentStudio] material creation failed', generationError)
      if (assessmentId) {
        try {
          await failLessonAssessmentGeneration({
            assessmentId,
            errorCode: 'draft_generation_failed',
            errorMessage: generationError instanceof Error ? generationError.message : null,
          })
        } catch (recordError) {
          console.error('[LessonAssessmentStudio] failure recording failed', recordError)
        }
      }
      setError(generationError instanceof Error ? generationError.message : 'Lesson material could not be opened.')
    } finally {
      setSaving(false)
    }
  }

  if (!lessonPlanId) {
    return <main style={page}><section style={card}><h1 style={{ marginTop: 0 }}>Lesson Materials</h1><p style={{ color: '#b91c1c' }}>Open lesson materials from a saved lesson plan.</p><button type="button" onClick={() => router.back()} style={secondaryButton}>Go back</button></section></main>
  }

  return (
    <main style={page}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <button type="button" onClick={() => router.back()} style={{ ...secondaryButton, marginBottom: 12 }}>← Back to lesson</button>
        <section style={card}>
          <div style={eyebrow}>Lesson Materials · No AI</div>
          <h1 style={{ margin: '6px 0 8px' }}>Prepared from your lesson</h1>
          <p style={{ margin: 0, color: '#6b7280', lineHeight: 1.55 }}>VibeSchool uses the lesson’s Scheme objectives and prepared checks. Review or edit before assigning or sharing.</p>
        </section>

        <section style={card}>
          <div style={eyebrow}>Material</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10, marginTop: 12 }}>
            {(Object.keys(TYPE_LABEL) as StudioType[]).map(type => (
              <button key={type} type="button" onClick={() => setAssessmentType(type)} style={{ padding: 14, borderRadius: 12, border: assessmentType === type ? '2px solid #4338ca' : '1px solid #d1d5db', background: assessmentType === type ? '#eef2ff' : '#fff', color: assessmentType === type ? '#4338ca' : '#374151', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                {TYPE_LABEL[type]}
              </button>
            ))}
          </div>
        </section>

        <section style={card}>
          <div style={eyebrow}>Preloaded preview</div>
          <h2 style={{ fontSize: 17, margin: '8px 0' }}>{TYPE_LABEL[assessmentType]} — {topic || 'Lesson'}</h2>
          <div style={{ color: '#4b5563', lineHeight: 1.7, fontSize: 13 }}>{questions.length} questions · {questions.reduce((sum, question) => sum + question.marks, 0)} marks · about {BLUEPRINT[assessmentType].minutes} minutes</div>
          <ol style={{ paddingLeft: 22, color: '#374151', lineHeight: 1.6 }}>
            {questions.map((question, index) => <li key={`${question.prompt}-${index}`} style={{ marginBottom: 8 }}>{question.prompt} <strong>({question.marks})</strong>{question.answer && <div style={{ fontSize: 12, color: '#047857', marginTop: 3 }}>Expected answer: {question.answer}</div>}</li>)}
          </ol>
        </section>

        {error && <div style={errorBox}>{error}</div>}
        <button type="button" onClick={createDraft} disabled={saving} style={{ ...primaryButton, width: '100%', opacity: saving ? 0.65 : 1 }}>
          {saving ? 'Opening material…' : `Open ${TYPE_LABEL[assessmentType]} in Builder`}
        </button>
      </div>
    </main>
  )
}

const page: React.CSSProperties = { minHeight: '100vh', background: '#f8fafc', padding: '18px 14px 80px', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#111827' }
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: '#4338ca', textTransform: 'uppercase', letterSpacing: 1 }
const primaryButton: React.CSSProperties = { border: 'none', borderRadius: 12, padding: '14px 16px', background: '#4338ca', color: '#fff', fontWeight: 800, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' }
const secondaryButton: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 10, padding: '10px 14px', background: '#fff', color: '#374151', fontWeight: 700, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' }
const errorBox: React.CSSProperties = { padding: 12, borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', marginBottom: 12 }

export default function NewAssessmentPage() {
  return <Suspense fallback={<main style={{ padding: 20 }}>Loading lesson materials…</main>}><Studio /></Suspense>
}
