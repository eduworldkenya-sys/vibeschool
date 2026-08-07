'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { recordPracticeAnswer } from '@/lib/student/vibelearn'

type Question = {
  id: string
  subject: string
  topic: string | null
  difficulty: string | null
  question: string
  options: string[]
  correctIndex: number
  explanation: string | null
  hint: string | null
}

type SourceContext = {
  publicationId: string
  publicationTitle: string
  chapterId: string
  chapterTitle: string
  subject: string | null
  grade: string | null
  assessableBlockCount: number
  verifiedOutcomeCount: number
}

type ReaderSourceRpcClient = {
  rpc(fn: 'student_resolve_vibelearn_assessment_source', args: { p_publication_id: string; p_chapter_id: string }): Promise<{ data: unknown; error: { message: string } | null }>
}

function asQuestion(value: unknown): Question | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  if (typeof row.id !== 'string' || typeof row.question !== 'string' || typeof row.correct_index !== 'number') return null
  const options = Array.isArray(row.options) ? row.options.filter((item): item is string => typeof item === 'string') : []
  if (options.length < 2) return null
  return {
    id: row.id,
    subject: typeof row.subject === 'string' ? row.subject : 'General',
    topic: typeof row.topic === 'string' ? row.topic : null,
    difficulty: typeof row.difficulty === 'string' ? row.difficulty : null,
    question: row.question,
    options,
    correctIndex: row.correct_index,
    explanation: typeof row.explanation === 'string' ? row.explanation : null,
    hint: typeof row.hint === 'string' ? row.hint : null,
  }
}

function asSourceContext(value: unknown): SourceContext | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  if (row.ok !== true || typeof row.publication_id !== 'string' || typeof row.chapter_id !== 'string') return null
  return {
    publicationId: row.publication_id,
    publicationTitle: typeof row.publication_title === 'string' ? row.publication_title : 'VibeTextbook',
    chapterId: row.chapter_id,
    chapterTitle: typeof row.chapter_title === 'string' ? row.chapter_title : 'Current unit',
    subject: typeof row.subject === 'string' ? row.subject : null,
    grade: typeof row.grade === 'string' ? row.grade : null,
    assessableBlockCount: typeof row.assessable_block_count === 'number' ? row.assessable_block_count : 0,
    verifiedOutcomeCount: typeof row.verified_outcome_count === 'number' ? row.verified_outcome_count : 0,
  }
}

export default function VibeLearnPracticePage() {
  const router = useRouter()
  const params = useSearchParams()
  const requestedSubject = params.get('subject')?.replaceAll('-', ' ') ?? ''
  const requestedTopic = params.get('topic')?.replaceAll('-', ' ') ?? ''
  const requestedPublicationId = params.get('publication') ?? ''
  const requestedChapterId = params.get('chapter') ?? ''
  const hasReaderSource = Boolean(requestedPublicationId && requestedChapterId)
  const [sourceContext, setSourceContext] = useState<SourceContext | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [showHint, setShowHint] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [correct, setCorrect] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const startedAtRef = useRef(Date.now())
  const sessionIdRef = useRef(typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        let source: SourceContext | null = null
        if (hasReaderSource) {
          const rpcClient = supabase as unknown as ReaderSourceRpcClient
          const { data, error: sourceError } = await rpcClient.rpc('student_resolve_vibelearn_assessment_source', {
            p_publication_id: requestedPublicationId,
            p_chapter_id: requestedChapterId,
          })
          if (sourceError) throw sourceError
          source = asSourceContext(data)
          if (!source) throw new Error('This learning source is not available for practice.')
          if (!cancelled) setSourceContext(source)
        } else if (!cancelled) {
          setSourceContext(null)
        }

        const subjectFilter = source?.subject ?? requestedSubject
        const topicFilter = requestedTopic
        let query = supabase
          .from('exam_question_bank')
          .select('id,subject,topic,difficulty,question,options,correct_index,explanation,hint')
          .eq('status', 'published')
          .limit(20)
        if (subjectFilter) query = query.ilike('subject', subjectFilter)
        if (topicFilter) query = query.ilike('topic', topicFilter)
        const { data, error: loadError } = await query
        if (loadError) throw loadError
        if (!cancelled) setQuestions((data ?? []).flatMap(value => {
          const parsed = asQuestion(value)
          return parsed ? [parsed] : []
        }))
      } catch (reason) {
        if (!cancelled) {
          setQuestions([])
          setSourceContext(null)
          setError(reason instanceof Error ? reason.message : 'Could not load practice questions.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [hasReaderSource, requestedPublicationId, requestedChapterId, requestedSubject, requestedTopic])

  const question = questions[index] ?? null
  const finished = questions.length > 0 && index >= questions.length
  const progress = questions.length === 0 ? 0 : Math.round((Math.min(index, questions.length) / questions.length) * 100)
  const answerCorrect = submitted && selected === question?.correctIndex
  const scoreLabel = useMemo(() => questions.length ? `${correct}/${questions.length}` : '0/0', [correct, questions.length])
  const practiceTitle = sourceContext?.chapterTitle || requestedTopic || requestedSubject || 'Mixed subject'
  const backUrl = sourceContext ? `/read/textbook/${sourceContext.publicationId}?chapter=${sourceContext.chapterId}` : '/student/vibelearn'

  async function checkAnswer() {
    if (selected === null || !question || submitted || saving) return
    setSaving(true)
    setError('')
    try {
      const result = await recordPracticeAnswer({
        questionId: question.id,
        selectedIndex: selected,
        responseMs: Math.max(0, Date.now() - startedAtRef.current),
        sessionId: sessionIdRef.current,
      })
      setSubmitted(true)
      if (result.correct) setCorrect(value => value + 1)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Your answer could not be saved. Try again.')
    } finally {
      setSaving(false)
    }
  }

  function nextQuestion() {
    setIndex(value => value + 1)
    setSelected(null)
    setSubmitted(false)
    setShowHint(false)
    startedAtRef.current = Date.now()
  }

  return (
    <main style={shell}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <button style={backButton} onClick={() => router.push(backUrl)}>← {sourceContext ? 'Back to unit' : 'VibeLearn'}</button>
        <section style={hero}>
          <div style={eyebrow}>Practice mode</div>
          <h1 style={{ margin: '7px 0 4px' }}>{practiceTitle} practice</h1>
          <p style={{ margin: 0, color: '#cbd5e1' }}>Every checked answer strengthens your personal revision plan and mistake notebook. No AI tutor is active during scoring.</p>
        </section>

        {sourceContext && <section style={{ ...card, borderColor: '#c7d2fe', background: '#f5f3ff' }}>
          <div style={eyebrowDark}>Grounded learning source</div>
          <strong style={{ display: 'block', margin: '6px 0 3px' }}>{sourceContext.publicationTitle} · {sourceContext.chapterTitle}</strong>
          <p style={muted}>{[sourceContext.grade, sourceContext.subject].filter(Boolean).join(' · ') || 'VibeTextbook'} · {sourceContext.assessableBlockCount} assessable blocks · {sourceContext.verifiedOutcomeCount} verified outcomes</p>
          <p style={{ ...muted, marginTop: 8 }}>This session is attached to this exact reader source. Question generation from these blocks is the next assessment milestone; current scoring continues to use approved stored questions.</p>
        </section>}

        {error && <section style={{ ...card, color: '#b91c1c' }}>{error}</section>}

        {loading ? <section style={card}>Loading questions…</section>
          : questions.length === 0 ? <section style={card}><strong>No questions available</strong><p style={muted}>{sourceContext ? 'This unit is grounded successfully, but no approved stored questions currently match its subject. The source is ready for the generation milestone.' : 'Choose another subject or topic from VibeLearn.'}</p></section>
          : finished ? <section style={card}>
              <div style={eyebrowDark}>Session complete</div>
              <h2 style={{ fontSize: 28, margin: '8px 0' }}>{scoreLabel}</h2>
              <p style={muted}>Your correct answers and mistakes are now part of your learning journey and recovery plan.</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <button style={primaryButton} onClick={() => { setIndex(0); setCorrect(0); setSelected(null); setSubmitted(false); setShowHint(false); startedAtRef.current = Date.now(); sessionIdRef.current = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : null }}>Try again</button>
                {sourceContext && <button style={secondaryButton} onClick={() => router.push(backUrl)}>Review this unit</button>}
                <button style={secondaryButton} onClick={() => router.push('/student/vibelearn/revision')}>Open revision plan</button>
                <button style={secondaryButton} onClick={() => router.push('/student/assessment')}>Assessment hub</button>
              </div>
            </section>
          : question && <>
              <section style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                  <div style={eyebrowDark}>Question {index + 1} of {questions.length}</div>
                  <div style={pill}>{question.topic ?? question.subject}</div>
                </div>
                <div style={progressTrack}><div style={{ ...progressFill, width: `${progress}%` }} /></div>
                <h2 style={{ fontSize: 20, lineHeight: 1.5 }}>{question.question}</h2>
                <div style={{ display: 'grid', gap: 10 }}>
                  {question.options.map((option, optionIndex) => {
                    const isSelected = selected === optionIndex
                    const isCorrect = submitted && optionIndex === question.correctIndex
                    const isWrongSelected = submitted && isSelected && optionIndex !== question.correctIndex
                    return <button key={`${question.id}-${optionIndex}`} disabled={submitted || saving} onClick={() => setSelected(optionIndex)} style={{ ...optionButton, borderColor: isCorrect ? '#10b981' : isWrongSelected ? '#ef4444' : isSelected ? '#4f46e5' : '#e2e8f0', background: isCorrect ? '#ecfdf5' : isWrongSelected ? '#fef2f2' : isSelected ? '#eef2ff' : '#fff' }}>
                      <span style={optionLetter}>{String.fromCharCode(65 + optionIndex)}</span><span>{option}</span>
                    </button>
                  })}
                </div>

                {!submitted && <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                  <button style={secondaryButton} onClick={() => setShowHint(value => !value)}>{showHint ? 'Hide hint' : 'Need a hint?'}</button>
                  <button style={{ ...primaryButton, opacity: selected === null || saving ? 0.5 : 1 }} disabled={selected === null || saving} onClick={() => void checkAnswer()}>{saving ? 'Saving…' : 'Check answer'}</button>
                </div>}

                {showHint && !submitted && <div style={hintBox}><strong>Hint</strong><div style={{ marginTop: 5 }}>{question.hint ?? 'Eliminate options that clearly conflict with the topic, then compare the remaining choices carefully.'}</div></div>}

                {submitted && <div style={answerCorrect ? correctBox : incorrectBox}>
                  <strong>{answerCorrect ? 'Correct' : 'Not yet'}</strong>
                  <div style={{ marginTop: 6 }}>{question.explanation ?? 'Review the correct option and compare it with your choice before continuing.'}</div>
                  <button style={{ ...primaryButton, marginTop: 12 }} onClick={nextQuestion}>{index + 1 === questions.length ? 'Finish session' : 'Next question'}</button>
                </div>}
              </section>

              <section style={{ ...card, background: '#faf5ff', borderColor: '#ddd6fe' }}>
                <div style={eyebrowDark}>Tutor boundary</div>
                <p style={{ ...muted, lineHeight: 1.6 }}>This session uses stored hints and explanations only. VibeTwin does not answer questions or reveal solutions while scoring is active.</p>
              </section>
            </>}
      </div>
    </main>
  )
}

const shell: React.CSSProperties = { minHeight: '100vh', background: '#f8fafc', padding: '18px 14px 90px', color: '#0f172a', fontFamily: "'Plus Jakarta Sans', sans-serif" }
const hero: React.CSSProperties = { background: 'linear-gradient(135deg,#0f172a,#1e1b4b)', color: '#fff', borderRadius: 20, padding: 20, marginBottom: 12 }
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 16, marginBottom: 12 }
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.1, color: '#a5b4fc' }
const eyebrowDark: React.CSSProperties = { fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.1, color: '#4f46e5' }
const muted: React.CSSProperties = { fontSize: 12, color: '#64748b', margin: 0 }
const backButton: React.CSSProperties = { border: 'none', background: 'transparent', color: '#4338ca', fontWeight: 800, marginBottom: 10, cursor: 'pointer', fontFamily: 'inherit' }
const progressTrack: React.CSSProperties = { height: 7, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden', margin: '12px 0' }
const progressFill: React.CSSProperties = { height: '100%', background: '#4f46e5' }
const optionButton: React.CSSProperties = { width: '100%', border: '1px solid #e2e8f0', borderRadius: 12, padding: 13, display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: '#0f172a' }
const optionLetter: React.CSSProperties = { width: 28, height: 28, borderRadius: 999, background: '#f1f5f9', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }
const primaryButton: React.CSSProperties = { border: 'none', background: '#4f46e5', color: '#fff', borderRadius: 11, padding: '10px 14px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }
const secondaryButton: React.CSSProperties = { border: '1px solid #c7d2fe', background: '#eef2ff', color: '#4338ca', borderRadius: 11, padding: '10px 14px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }
const hintBox: React.CSSProperties = { marginTop: 14, padding: 13, borderRadius: 12, background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontSize: 13 }
const correctBox: React.CSSProperties = { marginTop: 14, padding: 14, borderRadius: 12, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', fontSize: 13 }
const incorrectBox: React.CSSProperties = { marginTop: 14, padding: 14, borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 13 }
const pill: React.CSSProperties = { fontSize: 10, fontWeight: 800, background: '#eef2ff', color: '#4338ca', padding: '5px 8px', borderRadius: 999 }
