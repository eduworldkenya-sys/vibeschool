"use client"
export const dynamic = "force-dynamic"

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ensureCourseLearnerProfile } from '@/lib/learn/ensure-course-learner-profile'

const BLUE = '#1A1AFF'
const INK = '#0A0A0F'
const MUTED = '#5A5A6A'
const CANVAS = '#F7F7FB'
const HEALTH = '#00a878'
const HEALTH_BG = '#e6fff5'

interface ContentBlock {
  title: string
  text: string
}

interface TopicRow {
  id: string
  module_id: string
  slug: string
  title: string
  subtitle: string | null
  concept_tab: ContentBlock[] | null
  kenya_context_tab: ContentBlock[] | null
  common_errors_tab: ContentBlock[] | null
  clinical_tip_tab: ContentBlock[] | null
}

interface QuizOption {
  id: string
  label: string
  text: string
}

function isQuizOption(value: unknown): value is QuizOption {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const option = value as Record<string, unknown>

  return (
    typeof option.id === 'string' &&
    typeof option.label === 'string' &&
    typeof option.text === 'string'
  )
}

interface QuizQuestionRow {
  id: string
  question_text: string
  options: QuizOption[]
  explanation: string | null
}

interface ModuleRow {
  id: string
  title: string
}

interface CourseRow {
  id: string
  title: string
  domain: string
}

type TabKey = 'concept' | 'kenya' | 'practice' | 'errors' | 'tip'

const TIP_LABEL_BY_DOMAIN: Record<string, string> = {
  health: '🏥 Clinical Tip',
  trade: '🔧 Field Tip',
  tech: '💻 Pro Tip',
  education: '🎓 Teaching Tip',
}

function ConceptBlocks({ blocks }: { blocks: ContentBlock[] | null }) {
  if (!blocks || blocks.length === 0) {
    return <div style={{ fontSize: 13, color: MUTED }}>Content coming soon.</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {blocks.map((block, i) => (
        <div key={i} style={{
          background: '#fff', borderRadius: 14, border: '1px solid #ecebf3',
          borderLeft: `4px solid ${BLUE}`, padding: 14,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 6 }}>{block.title}</div>
          <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.6 }}>{block.text}</div>
        </div>
      ))}
    </div>
  )
}

type QuizFeedback = { is_correct: boolean; explanation: string | null }

function QuizPanel({ topicId }: { topicId: string }) {
  const [questions, setQuestions] = useState<QuizQuestionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [selectedByQuestion, setSelectedByQuestion] = useState<Record<string, string>>({})
  const [feedbackByQuestion, setFeedbackByQuestion] = useState<Record<string, QuizFeedback>>({})
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      const { data, error } = await supabase.rpc('get_public_quiz_questions', {
        p_topic_id: topicId,
      })
      if (!active) return
      if (error) {
        setFetchError('Practice could not be opened. Please return and try again.')
      } else {
        const parsedQuestions: QuizQuestionRow[] = (Array.isArray(data) ? data : []).map(row => {
          const options: QuizOption[] = Array.isArray(row.options)
            ? row.options.filter(isQuizOption)
            : []
          return {
            id: row.id,
            question_text: row.question_text,
            options,
            explanation: null,
          }
        })
        setQuestions(parsedQuestions)
      }
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [topicId])

  async function selectOption(questionId: string, optionId: string) {
    if (feedbackByQuestion[questionId] || pendingQuestion) return
    setPendingQuestion(questionId)
    setFetchError('')
    const { data, error } = await supabase.rpc('submit_quiz_answer', {
      p_question_id: questionId,
      p_option_id: optionId,
    })
    setPendingQuestion(null)
    const result = Array.isArray(data) ? data[0] : null
    if (error || !result || typeof result.is_correct !== 'boolean') {
      setFetchError('Your answer was not checked. Please try again.')
      return
    }
    setSelectedByQuestion(prev => ({ ...prev, [questionId]: optionId }))
    setFeedbackByQuestion(prev => ({ ...prev, [questionId]: {
      is_correct: result.is_correct,
      explanation: typeof result.explanation === 'string' ? result.explanation : null,
    } }))
  }

  if (loading) return <div role="status" style={{ fontSize: 13, color: MUTED }}>Loading practice questions...</div>
  if (questions.length === 0 && !fetchError)
    return <div style={{ fontSize: 13, color: MUTED }}>Practice questions coming soon.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {fetchError && <p role="alert" style={{ color: '#c0392b', fontSize: 13 }}>{fetchError}</p>}
      {questions.map(q => {
        const selectedId = selectedByQuestion[q.id]
        const result = feedbackByQuestion[q.id]
        return (
          <section key={q.id} aria-label="Practice question">
            <p style={{ fontSize: 14, fontWeight: 600, color: INK, marginBottom: 12, lineHeight: 1.5 }}>
              {q.question_text}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {q.options.map(opt => {
                const chosen = selectedId === opt.id
                const wrong = chosen && result && !result.is_correct
                return (
                  <button
                    type="button"
                    key={opt.id}
                    disabled={!!result || !!pendingQuestion}
                    onClick={() => void selectOption(q.id, opt.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                      padding: '12px 14px', borderRadius: 12,
                      border: '1.5px solid ' + (wrong ? '#ef4444' : chosen ? HEALTH : '#ecebf3'),
                      background: chosen && result?.is_correct ? HEALTH_BG : wrong ? '#fef2f2' : '#fff',
                      cursor: result ? 'default' : 'pointer', opacity: pendingQuestion && pendingQuestion !== q.id ? .7 : 1,
                    }}
                  >
                    <span style={{ fontWeight: 700, color: INK }}>{opt.label}</span>
                    <span style={{ color: INK, fontSize: 13 }}>{opt.text}</span>
                  </button>
                )
              })}
            </div>
            {pendingQuestion === q.id && <p role="status" style={{ fontSize: 12 }}>Checking your answer…</p>}
            {result && <div role="status" style={{
              marginTop: 12, padding: 14, borderRadius: 12,
              background: result.is_correct ? HEALTH_BG : '#fef2f2',
            }}>
              <strong>{result.is_correct ? 'Correct.' : 'Not quite.'}</strong>
              {result.explanation && <p style={{ marginTop: 6, lineHeight: 1.6, fontSize: 13 }}>{result.explanation}</p>}
            </div>}
          </section>
        )
      })}
    </div>
  )
}

export default function TopicDetailPage() {
  const router = useRouter()
  const params = useParams()
  const courseSlug = params.courseSlug as string
  const moduleSlug = params.moduleSlug as string
  const topicSlug = params.topicSlug as string

  const [course, setCourse] = useState<CourseRow | null>(null)
  const [module, setModule] = useState<ModuleRow | null>(null)
  const [topic, setTopic] = useState<TopicRow | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('concept')
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [markingDone, setMarkingDone] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const [completionError, setCompletionError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: courseData, error: courseErr } = await supabase
        .from('courses')
        .select('id, title, domain')
        .eq('slug', courseSlug)
        .single()

      if (courseErr || !courseData) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setCourse(courseData as CourseRow)

      const { data: moduleData, error: moduleErr } = await supabase
        .from('modules')
        .select('id, title')
        .eq('course_id', courseData.id)
        .eq('slug', moduleSlug)
        .single()

      if (moduleErr || !moduleData) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setModule(moduleData as ModuleRow)

      const { data: topicData, error: topicErr } = await supabase
        .from('topics')
        .select('id, module_id, slug, title, subtitle, concept_tab, kenya_context_tab, common_errors_tab, clinical_tip_tab')
        .eq('module_id', moduleData.id)
        .eq('slug', topicSlug)
        .eq('content_status', 'published')
        .single()

      if (topicErr || !topicData) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setTopic(topicData as TopicRow)

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: progressData } = await supabase
          .from('learner_progress')
          .select('completed_at')
          .eq('learner_id', user.id)
          .eq('topic_id', topicData.id)
          .maybeSingle()
        setIsDone(Boolean(progressData?.completed_at))
      }

      setLoading(false)
    }
    load()
  }, [courseSlug, moduleSlug, topicSlug])

  async function markComplete() {
    if (!topic || markingDone || isDone) return
    setMarkingDone(true)
    setCompletionError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      await ensureCourseLearnerProfile(user.id)
      const { error } = await supabase
        .from('learner_progress')
        .upsert(
          { learner_id: user.id, topic_id: topic.id, completed_at: new Date().toISOString() },
          { onConflict: 'learner_id,topic_id' }
        )
      if (error) throw new Error('Your progress could not be saved. Please retry.')
      setIsDone(true)
    } catch (cause) {
      setCompletionError(cause instanceof Error ? cause.message : 'Could not save your progress.')
    } finally {
      setMarkingDone(false)
    }
  }

  const tipLabel = TIP_LABEL_BY_DOMAIN[course?.domain ?? ''] ?? '💡 Practical Tip'

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'concept',  label: '💡 Concept' },
    { key: 'kenya',    label: '🇰🇪 Kenya Context' },
    { key: 'practice', label: '📝 Practice' },
    { key: 'errors',   label: '⚠️ Common Errors' },
    { key: 'tip',      label: tipLabel },
  ]

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: CANVAS, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: MUTED }}>Loading topic...</div>
      </div>
    )
  }

  if (notFound || !course || !module || !topic) {
    return (
      <div style={{ minHeight: '100vh', background: CANVAS, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: INK, marginBottom: 8 }}>Topic not found</div>
          <div onClick={() => router.push(`/learn/${courseSlug}`)} style={{ fontSize: 13, color: BLUE, cursor: 'pointer' }}>
            ← Back to roadmap
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: CANVAS, paddingBottom: 32 }}>
      {/* TOPBAR */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50, background: CANVAS,
        padding: '16px 16px 12px', borderBottom: '1px solid #ecebf3',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: MUTED, marginBottom: 8 }}>
          <span onClick={() => router.push(`/learn/${courseSlug}`)} style={{ cursor: 'pointer' }}>{course.title}</span>
          <span>›</span>
          <span>{module.title}</span>
        </div>
        <div style={{ fontSize: 17, fontWeight: 800, color: INK }}>{topic.title}</div>
        {topic.subtitle && (
          <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{topic.subtitle}</div>
        )}
      </div>

      {/* TABS */}
      <div style={{
        display: 'flex', gap: 6, padding: '12px 16px', overflowX: 'auto',
        borderBottom: '1px solid #ecebf3',
      }}>
        {tabs.map((tab) => (
          <div
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flexShrink: 0, padding: '8px 14px', borderRadius: 999, fontSize: 12,
              fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
              background: activeTab === tab.key ? BLUE : '#fff',
              color: activeTab === tab.key ? '#fff' : INK,
              border: activeTab === tab.key ? 'none' : '1px solid #ecebf3',
            }}
          >
            {tab.label}
          </div>
        ))}
      </div>

      {/* TAB CONTENT */}
      <div style={{ padding: 16 }}>
        {activeTab === 'concept' && <ConceptBlocks blocks={topic.concept_tab} />}
        {activeTab === 'kenya' && <ConceptBlocks blocks={topic.kenya_context_tab} />}
        {activeTab === 'practice' && <QuizPanel topicId={topic.id} />}
        {activeTab === 'errors' && <ConceptBlocks blocks={topic.common_errors_tab} />}
        {activeTab === 'tip' && <ConceptBlocks blocks={topic.clinical_tip_tab} />}
      </div>

      {/* MARK COMPLETE */}
      <div style={{ padding: '0 16px 16px' }}>
        {completionError && <p role="alert" style={{ color: '#c0392b', fontSize: 12 }}>{completionError}</p>}
        <button type="button" disabled={markingDone || isDone}
          onClick={() => void markComplete()}
          style={{
            textAlign: 'center', padding: '14px', borderRadius: 14,
            background: isDone ? HEALTH_BG : BLUE,
            color: isDone ? HEALTH : '#fff',
            fontSize: 14, fontWeight: 700, cursor: isDone ? 'default' : 'pointer',
          }}
        >
          {isDone ? '✓ Topic completed' : markingDone ? 'Saving...' : 'Mark as complete'}
        </button>
      </div>
    </div>
  )
}
