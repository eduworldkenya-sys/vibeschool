'use client'

export const dynamic = 'force-dynamic'

import { Suspense, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  addDraftItem,
  approveAssessment,
  assignAssessment,
  createDraftAssessment,
} from '@/lib/assessment'
import type {
  AutoMarkingMode,
  QuestionType,
} from '@/lib/assessment'

type DraftQuestion = {
  prompt: string
  answer: string
  marks: number
  questionType: QuestionType
  autoMarkingMode: AutoMarkingMode
}

function buildStarterQuestions(
  topic: string,
  assessmentHook: string,
): DraftQuestion[] {
  const focus = topic.trim() || 'this lesson'
  const hook = assessmentHook.trim()

  return [
    {
      prompt: `State one key idea you learned about ${focus}.`,
      answer: '',
      marks: 2,
      questionType: 'short_answer',
      autoMarkingMode: 'none',
    },
    {
      prompt: `Give one correct example that demonstrates ${focus}.`,
      answer: '',
      marks: 2,
      questionType: 'short_answer',
      autoMarkingMode: 'none',
    },
    {
      prompt: hook || `Explain how you would solve a problem about ${focus}.`,
      answer: '',
      marks: 3,
      questionType: 'structured',
      autoMarkingMode: 'none',
    },
    {
      prompt: `True or false: I can apply what I learned about ${focus} independently.`,
      answer: 'true',
      marks: 1,
      questionType: 'true_false',
      autoMarkingMode: 'case_insensitive',
    },
    {
      prompt: `What should you check before finalising an answer about ${focus}?`,
      answer: '',
      marks: 2,
      questionType: 'short_answer',
      autoMarkingMode: 'none',
    },
  ]
}

function Studio() {
  const router = useRouter()
  const params = useSearchParams()

  const classId = params.get('classId') ?? ''
  const subjectId = params.get('subjectId') ?? ''
  const lessonPlanId = params.get('lessonPlanId')
  const occurrenceId = params.get('occurrenceId')
  const topic = params.get('topic') ?? ''
  const assessmentHook = params.get('assessmentHook') ?? ''

  const initialQuestions = useMemo(
    () => buildStarterQuestions(topic, assessmentHook),
    [topic, assessmentHook],
  )

  const [title, setTitle] = useState(
    `${topic || 'Lesson'} Quick Quiz`,
  )
  const [instructions, setInstructions] = useState(
    'Answer all questions. Show your working where required.',
  )
  const [questions, setQuestions] = useState(initialQuestions)
  const [timeLimit, setTimeLimit] = useState(15)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<{
    assessmentId: string
    assignmentId: string
  } | null>(null)

  const ready =
    classId.length > 0 &&
    subjectId.length > 0 &&
    title.trim().length > 0 &&
    questions.length > 0 &&
    questions.every(question => question.prompt.trim().length > 0)

  function updateQuestion(
    index: number,
    patch: Partial<DraftQuestion>,
  ) {
    setQuestions(current =>
      current.map((question, questionIndex) =>
        questionIndex === index
          ? { ...question, ...patch }
          : question,
      ),
    )
  }

  async function publishQuiz() {
    if (!ready || saving) return

    setSaving(true)
    setError('')

    try {
      const assessmentId = await createDraftAssessment({
        classId,
        subjectId,
        assessmentType: 'quiz',
        title: title.trim(),
        instructions: instructions.trim() || null,
        lessonPlanId,
        teachingOccurrenceId: occurrenceId,
        generationSource: 'lesson_plan_quick_quiz',
        generationMetadata: {
          topic,
          assessment_hook: assessmentHook,
        },
      })

      for (let index = 0; index < questions.length; index += 1) {
        const question = questions[index]
        await addDraftItem({
          assessmentId,
          questionType: question.questionType,
          prompt: question.prompt.trim(),
          marks: question.marks,
          orderNum: index + 1,
          correctAnswer:
            question.answer.trim().length > 0
              ? question.answer.trim()
              : null,
          acceptedAnswers:
            question.answer.trim().length > 0
              ? [question.answer.trim()]
              : [],
          autoMarkingMode:
            question.answer.trim().length > 0
              ? question.autoMarkingMode
              : 'none',
          generatedBy: 'lesson_plan_studio',
        })
      }

      await approveAssessment(assessmentId)

      const assignmentId = await assignAssessment({
        assessmentId,
        classId,
        timeLimitMinutes: timeLimit,
        maxAttempts: 1,
        randomizeItems: false,
        randomizeOptions: false,
        showScorePolicy: 'after_review',
      })

      setSuccess({ assessmentId, assignmentId })
    } catch (publishError) {
      console.error('[AssessmentStudio] publish quiz', publishError)
      setError(
        publishError instanceof Error
          ? publishError.message
          : 'Quiz could not be created.',
      )
    } finally {
      setSaving(false)
    }
  }

  if (!classId || !subjectId) {
    return (
      <main style={{ padding: 20, fontFamily: 'sans-serif' }}>
        <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>
          Assessment Studio
        </h1>
        <p style={{ color: '#b91c1c', lineHeight: 1.5 }}>
          Open this studio from a lesson so the class and subject are known.
        </p>
        <button
          type="button"
          onClick={() => router.back()}
          style={secondaryButton}
        >
          Go back
        </button>
      </main>
    )
  }

  return (
    <main style={{
      minHeight: '100vh',
      background: '#f8fafc',
      padding: '18px 14px 80px',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      color: '#111827',
    }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <button
          type="button"
          onClick={() => router.back()}
          style={{ ...secondaryButton, marginBottom: 12 }}
        >
          ← Back to lesson
        </button>

        <section style={card}>
          <div style={{
            fontSize: 11,
            fontWeight: 800,
            color: '#4338ca',
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}>
            Assessment Studio
          </div>
          <h1 style={{ fontSize: 22, margin: '6px 0' }}>
            Generate Quiz from Lesson
          </h1>
          <p style={{ margin: 0, color: '#6b7280', lineHeight: 1.5 }}>
            Review every question before approval. Correct answers stay hidden from learners during attempts.
          </p>
        </section>

        {success ? (
          <section style={{ ...card, border: '1px solid #6ee7b7', background: '#ecfdf5' }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 18, color: '#065f46' }}>
              Quiz approved and assigned ✓
            </h2>
            <p style={{ margin: 0, color: '#047857', lineHeight: 1.5 }}>
              The assessment is open for the class. Objective answers will be marked server-side; written answers will enter teacher review.
            </p>
            <button
              type="button"
              onClick={() => router.back()}
              style={{ ...primaryButton, marginTop: 16 }}
            >
              Return to lesson
            </button>
          </section>
        ) : (
          <>
            <section style={card}>
              <label style={label}>Quiz title</label>
              <input
                value={title}
                onChange={event => setTitle(event.target.value)}
                style={input}
              />

              <label style={{ ...label, marginTop: 14 }}>Instructions</label>
              <textarea
                value={instructions}
                onChange={event => setInstructions(event.target.value)}
                rows={3}
                style={{ ...input, resize: 'vertical' }}
              />

              <label style={{ ...label, marginTop: 14 }}>Time limit</label>
              <input
                type="number"
                min={1}
                value={timeLimit}
                onChange={event => setTimeLimit(Math.max(1, Number(event.target.value) || 1))}
                style={input}
              />
            </section>

            {questions.map((question, index) => (
              <section key={index} style={card}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 10,
                  marginBottom: 10,
                }}>
                  <strong>Question {index + 1}</strong>
                  <button
                    type="button"
                    onClick={() => setQuestions(current => current.filter((_, itemIndex) => itemIndex !== index))}
                    style={{ border: 'none', background: 'none', color: '#b91c1c', fontWeight: 700 }}
                  >
                    Remove
                  </button>
                </div>

                <label style={label}>Prompt</label>
                <textarea
                  value={question.prompt}
                  onChange={event => updateQuestion(index, { prompt: event.target.value })}
                  rows={3}
                  style={{ ...input, resize: 'vertical' }}
                />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 10, marginTop: 12 }}>
                  <div>
                    <label style={label}>Question type</label>
                    <select
                      value={question.questionType}
                      onChange={event => updateQuestion(index, {
                        questionType: event.target.value as QuestionType,
                        autoMarkingMode: event.target.value === 'true_false'
                          ? 'case_insensitive'
                          : 'none',
                      })}
                      style={input}
                    >
                      <option value="short_answer">Short answer</option>
                      <option value="structured">Structured</option>
                      <option value="true_false">True / false</option>
                      <option value="numeric">Numeric</option>
                    </select>
                  </div>
                  <div>
                    <label style={label}>Marks</label>
                    <input
                      type="number"
                      min={1}
                      value={question.marks}
                      onChange={event => updateQuestion(index, {
                        marks: Math.max(1, Number(event.target.value) || 1),
                      })}
                      style={input}
                    />
                  </div>
                </div>

                <label style={{ ...label, marginTop: 12 }}>
                  Correct answer (optional)
                </label>
                <input
                  value={question.answer}
                  onChange={event => updateQuestion(index, {
                    answer: event.target.value,
                    autoMarkingMode:
                      question.questionType === 'numeric'
                        ? 'numeric_tolerance'
                        : question.questionType === 'true_false'
                          ? 'case_insensitive'
                          : 'case_insensitive',
                  })}
                  placeholder="Leave blank for teacher marking"
                  style={input}
                />
              </section>
            ))}

            <button
              type="button"
              onClick={() => setQuestions(current => [
                ...current,
                {
                  prompt: '',
                  answer: '',
                  marks: 1,
                  questionType: 'short_answer',
                  autoMarkingMode: 'none',
                },
              ])}
              style={{ ...secondaryButton, width: '100%', marginBottom: 12 }}
            >
              + Add question
            </button>

            {error && (
              <div style={{
                padding: 12,
                borderRadius: 10,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                marginBottom: 12,
              }}>
                {error}
              </div>
            )}

            <button
              type="button"
              disabled={!ready || saving}
              onClick={publishQuiz}
              style={{
                ...primaryButton,
                width: '100%',
                opacity: !ready || saving ? 0.6 : 1,
                cursor: !ready || saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Creating and assigning…' : 'Approve and Assign Quiz'}
            </button>
          </>
        )}
      </div>
    </main>
  )
}

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 16,
  padding: 16,
  marginBottom: 12,
  boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
}

const label: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  fontWeight: 800,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: 0.8,
  marginBottom: 6,
}

const input: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid #d1d5db',
  borderRadius: 10,
  padding: '10px 12px',
  font: 'inherit',
  color: '#111827',
  background: '#fff',
}

const primaryButton: React.CSSProperties = {
  border: 'none',
  borderRadius: 12,
  padding: '13px 16px',
  background: '#4338ca',
  color: '#fff',
  fontWeight: 800,
  fontSize: 13,
  fontFamily: 'inherit',
}

const secondaryButton: React.CSSProperties = {
  border: '1px solid #d1d5db',
  borderRadius: 10,
  padding: '10px 14px',
  background: '#fff',
  color: '#374151',
  fontWeight: 700,
  fontSize: 12,
  fontFamily: 'inherit',
  cursor: 'pointer',
}

export default function NewAssessmentPage() {
  return (
    <Suspense fallback={<main style={{ padding: 20 }}>Loading Assessment Studio…</main>}>
      <Studio />
    </Suspense>
  )
}
