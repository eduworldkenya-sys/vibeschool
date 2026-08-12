"use client"
export const dynamic = "force-dynamic"

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const BLUE = '#1A1AFF'
const INK = '#0A0A0F'
const MUTED = '#5A5A6A'
const CANVAS = '#F7F7FB'
const HEALTH = '#00a878'
const HEALTH_BG = '#e6fff5'

interface ContentBlock { title: string; text: string }
interface TopicRow { id: string; module_id: string; slug: string; title: string; subtitle: string | null; concept_tab: ContentBlock[] | null; kenya_context_tab: ContentBlock[] | null; common_errors_tab: ContentBlock[] | null; clinical_tip_tab: ContentBlock[] | null }
interface QuizOption { id: string; label: string; text: string }
interface QuizQuestionRow { id: string; question_text: string; options: QuizOption[]; explanation: string | null }
interface ModuleRow { id: string; title: string }
interface CourseRow { id: string; title: string; domain: string }
type TabKey = 'concept' | 'kenya' | 'practice' | 'errors' | 'tip'

const TIP_LABEL_BY_DOMAIN: Record<string, string> = { health: '🏥 Clinical Tip', trade: '🔧 Field Tip', tech: '💻 Pro Tip', education: '🎓 Teaching Tip' }

function isQuizOption(value: unknown): value is QuizOption {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const option = value as Record<string, unknown>
  return typeof option.id === 'string' && typeof option.label === 'string' && typeof option.text === 'string'
}

function ConceptBlocks({ blocks }: { blocks: ContentBlock[] | null }) {
  if (!blocks?.length) return <div style={{ fontSize: 13, color: MUTED }}>Content coming soon.</div>
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{blocks.map((block, i) => <div key={i} style={{ background: '#fff', borderRadius: 14, border: '1px solid #ecebf3', borderLeft: `4px solid ${BLUE}`, padding: 14 }}><div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 6 }}>{block.title}</div><div style={{ fontSize: 13, color: MUTED, lineHeight: 1.6 }}>{block.text}</div></div>)}</div>
}

function QuizPanel({ topicId }: { topicId: string }) {
  const [questions, setQuestions] = useState<QuizQuestionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedByQuestion, setSelectedByQuestion] = useState<Record<string, string>>({})
  const [results, setResults] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({})

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.rpc('get_public_quiz_questions', { p_topic_id: topicId })
      if (error) console.error('QuizPanel fetch error:', error)
      else if (data) {
        setQuestions((data as unknown[]).map(row => {
          const r = row as Record<string, unknown>
          const options = Array.isArray(r.options) ? r.options.reduce<QuizOption[]>((out, option) => { if (isQuizOption(option)) out.push({ id: option.id, label: option.label, text: option.text }); return out }, []) : []
          return { id: String(r.id), question_text: String(r.question_text), options, explanation: typeof r.explanation === 'string' ? r.explanation : null }
        }))
      }
      setLoading(false)
    }
    load()
  }, [topicId])

  async function selectOption(questionId: string, optionId: string) {
    if (selectedByQuestion[questionId] || submitting[questionId]) return
    setSelectedByQuestion(prev => ({ ...prev, [questionId]: optionId }))
    setSubmitting(prev => ({ ...prev, [questionId]: true }))
    const { data, error } = await supabase.rpc('submit_quiz_answer', { p_question_id: questionId, p_option_id: optionId })
    if (error) {
      console.error('Quiz answer error:', error)
      setSelectedByQuestion(prev => { const next = { ...prev }; delete next[questionId]; return next })
    } else {
      const result = Array.isArray(data) ? data[0] : data
      setResults(prev => ({ ...prev, [questionId]: Boolean(result?.is_correct) }))
    }
    setSubmitting(prev => ({ ...prev, [questionId]: false }))
  }

  if (loading) return <div style={{ fontSize: 13, color: MUTED }}>Loading practice questions...</div>
  if (!questions.length) return <div style={{ fontSize: 13, color: MUTED }}>Practice questions coming soon.</div>
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>{questions.map(q => {
    const selectedId = selectedByQuestion[q.id]
    const hasAnswered = Boolean(selectedId) && q.id in results
    const isCorrect = results[q.id]
    return <div key={q.id}><div style={{ fontSize: 14, fontWeight: 600, color: INK, marginBottom: 12, lineHeight: 1.5 }}>{q.question_text}</div><div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{q.options.map(opt => {
      const isSelected = selectedId === opt.id
      return <div key={opt.id} onClick={() => selectOption(q.id, opt.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${isSelected ? BLUE : '#ecebf3'}`, background: isSelected ? '#eef0ff' : '#fff', cursor: hasAnswered ? 'default' : 'pointer' }}><div style={{ width: 24, height: 24, borderRadius: 8, background: CANVAS, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: INK, flexShrink: 0 }}>{opt.label}</div><span style={{ fontSize: 13, color: INK }}>{opt.text}</span></div>
    })}</div>{hasAnswered && <div style={{ marginTop: 12, padding: 14, borderRadius: 12, background: isCorrect ? HEALTH_BG : '#fef2f2', borderLeft: `4px solid ${isCorrect ? HEALTH : '#ef4444'}` }}><div style={{ fontSize: 13, fontWeight: 700, color: isCorrect ? '#007a5a' : '#c0392b' }}>{isCorrect ? '✓ Correct!' : '✗ Not quite.'}</div>{q.explanation && <div style={{ fontSize: 12, color: MUTED, marginTop: 6, lineHeight: 1.6 }}>{q.explanation}</div>}</div>}</div>
  })}</div>
}

export default function TopicDetailPage() {
  const router = useRouter(); const params = useParams(); const courseSlug = params.courseSlug as string; const moduleSlug = params.moduleSlug as string; const topicSlug = params.topicSlug as string
  const [course, setCourse] = useState<CourseRow | null>(null); const [module, setModule] = useState<ModuleRow | null>(null); const [topic, setTopic] = useState<TopicRow | null>(null); const [activeTab, setActiveTab] = useState<TabKey>('concept'); const [loading, setLoading] = useState(true); const [notFound, setNotFound] = useState(false); const [markingDone, setMarkingDone] = useState(false); const [isDone, setIsDone] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: courseData, error: courseErr } = await supabase.from('courses').select('id, title, domain').eq('slug', courseSlug).eq('status', 'live').single()
      if (courseErr || !courseData) { setNotFound(true); setLoading(false); return }
      setCourse(courseData as CourseRow)
      const { data: moduleData, error: moduleErr } = await supabase.from('modules').select('id, title').eq('course_id', courseData.id).eq('slug', moduleSlug).single()
      if (moduleErr || !moduleData) { setNotFound(true); setLoading(false); return }
      setModule(moduleData as ModuleRow)
      const { data: topicData, error: topicErr } = await supabase.from('topics').select('id, module_id, slug, title, subtitle, concept_tab, kenya_context_tab, common_errors_tab, clinical_tip_tab').eq('module_id', moduleData.id).eq('slug', topicSlug).eq('content_status', 'published').single()
      if (topicErr || !topicData) { setNotFound(true); setLoading(false); return }
      setTopic(topicData as TopicRow)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) { const { data: progressData } = await supabase.from('learner_progress').select('completed_at').eq('learner_id', user.id).eq('topic_id', topicData.id).maybeSingle(); setIsDone(Boolean(progressData?.completed_at)) }
      setLoading(false)
    }
    load()
  }, [courseSlug, moduleSlug, topicSlug])

  async function markComplete() {
    if (!topic || markingDone) return
    setMarkingDone(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setMarkingDone(false); router.push('/auth/callback'); return }
    const { error } = await supabase.from('learner_progress').upsert({ learner_id: user.id, topic_id: topic.id, completed_at: new Date().toISOString() }, { onConflict: 'learner_id,topic_id' })
    if (error) console.error('markComplete error:', error); else setIsDone(true)
    setMarkingDone(false)
  }

  const tipLabel = TIP_LABEL_BY_DOMAIN[course?.domain ?? ''] ?? '💡 Practical Tip'
  const tabs: { key: TabKey; label: string }[] = [{ key: 'concept', label: '💡 Concept' }, { key: 'kenya', label: '🇰🇪 Kenya Context' }, { key: 'practice', label: '📝 Practice' }, { key: 'errors', label: '⚠️ Common Errors' }, { key: 'tip', label: tipLabel }]
  if (loading) return <div style={{ minHeight: '100vh', background: CANVAS, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ fontSize: 13, color: MUTED }}>Loading topic...</div></div>
  if (notFound || !course || !module || !topic) return <div style={{ minHeight: '100vh', background: CANVAS, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}><div style={{ textAlign: 'center' }}><div style={{ fontSize: 16, fontWeight: 700, color: INK, marginBottom: 8 }}>Topic not found</div><div onClick={() => router.push(`/learn/${courseSlug}`)} style={{ fontSize: 13, color: BLUE, cursor: 'pointer' }}>← Back to roadmap</div></div></div>

  return <div style={{ minHeight: '100vh', background: CANVAS, paddingBottom: 32 }}>
    <div style={{ position: 'sticky', top: 0, zIndex: 50, background: CANVAS, padding: '16px 16px 12px', borderBottom: '1px solid #ecebf3' }}><div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: MUTED, marginBottom: 8 }}><span onClick={() => router.push(`/learn/${courseSlug}`)} style={{ cursor: 'pointer' }}>{course.title}</span><span>›</span><span>{module.title}</span></div><div style={{ fontSize: 17, fontWeight: 800, color: INK }}>{topic.title}</div>{topic.subtitle && <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{topic.subtitle}</div>}</div>
    <div style={{ display: 'flex', gap: 6, padding: '12px 16px', overflowX: 'auto', borderBottom: '1px solid #ecebf3' }}>{tabs.map(tab => <div key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ flexShrink: 0, padding: '8px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', background: activeTab === tab.key ? BLUE : '#fff', color: activeTab === tab.key ? '#fff' : INK, border: activeTab === tab.key ? 'none' : '1px solid #ecebf3' }}>{tab.label}</div>)}</div>
    <div style={{ padding: 16 }}>{activeTab === 'concept' && <ConceptBlocks blocks={topic.concept_tab} />}{activeTab === 'kenya' && <ConceptBlocks blocks={topic.kenya_context_tab} />}{activeTab === 'practice' && <QuizPanel topicId={topic.id} />}{activeTab === 'errors' && <ConceptBlocks blocks={topic.common_errors_tab} />}{activeTab === 'tip' && <ConceptBlocks blocks={topic.clinical_tip_tab} />}</div>
    <div style={{ padding: '0 16px 16px' }}><div onClick={markComplete} style={{ textAlign: 'center', padding: '14px', borderRadius: 14, background: isDone ? HEALTH_BG : BLUE, color: isDone ? HEALTH : '#fff', fontSize: 14, fontWeight: 700, cursor: isDone ? 'default' : 'pointer' }}>{isDone ? '✓ Topic completed' : markingDone ? 'Saving...' : 'Mark as complete'}</div></div>
  </div>
}
