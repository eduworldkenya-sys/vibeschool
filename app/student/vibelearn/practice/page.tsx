'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import VibeLearnSubnav from '@/components/student/VibeLearnSubnav'
import { useStudent } from '@/lib/student-context'
import { getGroundedChapterPractice, recordGroundedPracticeAnswer, recordVibeLearnPracticeAnswer, type GroundedPracticeQuestion, type GroundedPracticeSource } from '@/lib/student/vibelearn'
import { listMyAssessmentAssignments, type LearnerAssessmentAssignment } from '@/lib/assessment/discovery'

type BankQuestion = {
  kind: 'bank'
  id: string
  subject: string
  topic: string | null
  difficulty: string | null
  question: string
  options: string[]
  hint: string | null
}

type GroundedQuestion = GroundedPracticeQuestion & { kind: 'grounded' }
type PracticeQuestion = BankQuestion | GroundedQuestion

function asBankQuestion(value: unknown): BankQuestion | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  if (typeof row.id !== 'string' || typeof row.question !== 'string') return null
  const options = Array.isArray(row.options) ? row.options.filter((item): item is string => typeof item === 'string') : []
  if (options.length < 2) return null
  return {
    kind: 'bank',
    id: row.id,
    subject: typeof row.subject === 'string' ? row.subject : 'General',
    topic: typeof row.topic === 'string' ? row.topic : null,
    difficulty: typeof row.difficulty === 'string' ? row.difficulty : null,
    question: row.question,
    options,
    hint: typeof row.hint === 'string' ? row.hint : null,
  }
}

function asResult(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export default function VibeLearnPracticePage() {
  const router = useRouter()
  const { identity, loading: identityLoading } = useStudent()
  const params = useSearchParams()
  const requestedSubject = params.get('subject')?.replaceAll('-', ' ') ?? ''
  const requestedTopic = params.get('topic')?.replaceAll('-', ' ') ?? ''
  const requestedPublicationId = params.get('publication') ?? ''
  const requestedChapterId = params.get('chapter') ?? ''
  const hasReaderSource = Boolean(requestedPublicationId && requestedChapterId)

  const [sourceContext, setSourceContext] = useState<GroundedPracticeSource | null>(null)
  const [practiceAssignments, setPracticeAssignments] = useState<LearnerAssessmentAssignment[]>([])
  const [assignmentError, setAssignmentError] = useState('')
  const [practiceSubject, setPracticeSubject] = useState('')
  const [questions, setQuestions] = useState<PracticeQuestion[]>([])
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [textAnswer, setTextAnswer] = useState('')
  const [showHint, setShowHint] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [answerCorrect, setAnswerCorrect] = useState<boolean | null>(null)
  const [expectedAnswer, setExpectedAnswer] = useState<string | null>(null)
  const [bankExplanation, setBankExplanation] = useState<string | null>(null)
  const [reviewUrl, setReviewUrl] = useState<string | null>(null)
  const [correct, setCorrect] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const startedAtRef = useRef(Date.now())
  const sessionIdRef = useRef(typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        if (!hasReaderSource && !identityLoading && identity && !/^form\s*[1-4]$/i.test(identity.className.trim())) {
          if (!cancelled) { setSourceContext(null); setQuestions([]) }
          return
        }
        if (hasReaderSource) {
          const grounded = await getGroundedChapterPractice(requestedPublicationId, requestedChapterId, 10)
          if (!cancelled) {
            setSourceContext(grounded?.source ?? null)
            setQuestions(grounded?.questions.map(question => ({ ...question, kind: 'grounded' as const })) ?? [])
          }
          return
        }
        if (!cancelled) setSourceContext(null)
        const form = identity?.className?.trim() ?? ''
        const { data, error: loadError } = await supabase.rpc('student_list_vibelearn_practice_questions' as never, {
          p_subject: requestedSubject || null,
          p_topic: requestedTopic || null,
          p_form: /^form\s*[1-4]$/i.test(form) ? form : null,
          p_limit: 20,
        })
        if (loadError) throw new Error(loadError.message)
        if (!cancelled) setQuestions((Array.isArray(data) ? data : []).flatMap(value => { const parsed = asBankQuestion(value); return parsed ? [parsed] : [] }))
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
  }, [hasReaderSource, requestedPublicationId, requestedChapterId, requestedSubject, requestedTopic, identityLoading, identity?.className])

  // Canonical assessment discovery scopes published practice to this signed-in
  // learner, including independent learners without a school enrollment.
  useEffect(() => {
    if (identityLoading || !identity) return
    let cancelled = false
    setAssignmentError('')
    listMyAssessmentAssignments()
      .then(items => { if (!cancelled) setPracticeAssignments(items.filter(item => item.assessmentType === 'practice')) })
      .catch(() => { if (!cancelled) setAssignmentError('Available practice sets could not be loaded. Please refresh.') })
    return () => { cancelled = true }
  }, [identityLoading, identity?.studentId])

  const question = questions[index] ?? null
  const finished = questions.length > 0 && index >= questions.length
  const progress = questions.length === 0 ? 0 : Math.round((Math.min(index, questions.length) / questions.length) * 100)
  const scoreLabel = useMemo(() => questions.length ? `${correct}/${questions.length}` : '0/0', [correct, questions.length])
  const practiceTitle = sourceContext?.chapterTitle || requestedTopic || requestedSubject || 'Topic'
  const practiceSubjects = useMemo(() => Array.from(new Set(practiceAssignments.map(item => {
    const match = item.title.match(/(?:grade|form)\s*\d+\s+(.+?)\s*[—–-]\s*/i)
    return match?.[1]?.trim() || 'Other'
  }))).sort((a, b) => a.localeCompare(b)), [practiceAssignments])
  const selectedPracticeSubject = practiceSubject || requestedSubject
  const filteredPracticeAssignments = practiceAssignments.filter(item => {
    const title = item.title.toLowerCase()
    return (!selectedPracticeSubject || title.includes(selectedPracticeSubject.toLowerCase())) &&
      (!requestedTopic || title.includes(requestedTopic.toLowerCase()))
  })
  const showLegacyBank = !hasReaderSource && /^form\s*[1-4]$/i.test(identity?.className?.trim() ?? '')
  const backUrl = sourceContext ? `/read/textbook/${sourceContext.publicationId}?chapter=${sourceContext.chapterId}` : '/student/vibelearn'

  async function checkAnswer() {
    if (!question || submitted || saving) return
    if (question.kind === 'bank' && selected === null) return
    if (question.kind === 'grounded' && !textAnswer.trim()) return
    setSaving(true)
    setError('')
    try {
      if (question.kind === 'grounded') {
        const result = asResult(await recordGroundedPracticeAnswer({ contentBlockId: question.contentBlockId, responseText: textAnswer, responseMs: Math.max(0, Date.now() - startedAtRef.current), sessionId: sessionIdRef.current }))
        const isCorrect = result.correct === true
        setAnswerCorrect(isCorrect)
        setExpectedAnswer(typeof result.expected_answer === 'string' ? result.expected_answer : null)
        setReviewUrl(typeof result.review_url === 'string' ? result.review_url : null)
        setSubmitted(true)
        if (isCorrect) setCorrect(value => value + 1)
      } else {
        const result = asResult(await recordVibeLearnPracticeAnswer({ examQuestionId: question.id, selectedIndex: selected as number, responseMs: Math.max(0, Date.now() - startedAtRef.current), sessionId: sessionIdRef.current }))
        const isCorrect = result.correct === true
        setAnswerCorrect(isCorrect)
        setBankExplanation(typeof result.explanation === 'string' ? result.explanation : null)
        setSubmitted(true)
        if (isCorrect) setCorrect(value => value + 1)
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Your answer could not be saved. Try again.')
    } finally { setSaving(false) }
  }

  function nextQuestion() { setIndex(value => value + 1); setSelected(null); setTextAnswer(''); setSubmitted(false); setAnswerCorrect(null); setExpectedAnswer(null); setBankExplanation(null); setReviewUrl(null); setShowHint(false); startedAtRef.current = Date.now() }
  function restart() { setIndex(0); setCorrect(0); setSelected(null); setTextAnswer(''); setSubmitted(false); setAnswerCorrect(null); setExpectedAnswer(null); setBankExplanation(null); setReviewUrl(null); setShowHint(false); startedAtRef.current = Date.now(); sessionIdRef.current = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : null }

  return <main style={shell}><div style={{ maxWidth: 760, margin: '0 auto' }}>
    <VibeLearnSubnav />
    <button style={backButton} onClick={() => router.push(backUrl)}>← {sourceContext ? 'Back to unit' : 'VibeLearn'}</button>
    <section style={hero}><div style={eyebrow}>Practice mode</div><h1 style={{ margin: '7px 0 4px' }}>{practiceTitle} practice</h1><p style={{ margin: 0, color: '#cbd5e1' }}>Every checked answer strengthens your personal revision plan and mistake notebook. No AI tutor is active during scoring.</p></section>

    {sourceContext && <section style={{ ...card, borderColor: '#c7d2fe', background: '#f5f3ff' }}><div style={eyebrowDark}>Exact learning source</div><strong style={{ display: 'block', margin: '6px 0 3px' }}>{sourceContext.publicationTitle} · {sourceContext.chapterTitle}</strong><p style={muted}>{[sourceContext.grade, sourceContext.subject].filter(Boolean).join(' · ') || 'VibeTextbook'} · {sourceContext.assessableBlockCount} assessable blocks · {sourceContext.verifiedOutcomeCount} verified outcomes</p><p style={{ ...muted, marginTop: 8 }}>Questions come from authored assessable blocks in this exact unit. Answers are scored by the server, and mistakes retain a link back to their source section.</p></section>}
    {assignmentError && <section role="alert" style={{ ...card, color: '#b91c1c' }}>{assignmentError}</section>}
    {!hasReaderSource && <section style={card} aria-label="Available practice assessments">
      <div style={eyebrowDark}>Your grade · Approved practice</div>
      <h2 style={{ fontSize: 19, margin: '7px 0 8px' }}>Choose a subject and practise</h2>
      <p style={{ ...muted, lineHeight: 1.6 }}>Only practice available to your learner account appears here. School linkage is optional for public practice. Marks and attempts stay in your existing assessment history.</p>
      {practiceSubjects.length > 1 && <div aria-label="Practice subjects" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '14px 0' }}>
        <button type="button" aria-pressed={!selectedPracticeSubject} onClick={() => setPracticeSubject('')} style={secondaryButton}>All subjects</button>
        {practiceSubjects.map(subject => <button type="button" key={subject} aria-pressed={selectedPracticeSubject.toLowerCase() === subject.toLowerCase()} onClick={() => setPracticeSubject(subject)} style={{ ...secondaryButton, background: selectedPracticeSubject.toLowerCase() === subject.toLowerCase() ? '#c7d2fe' : '#eef2ff' }}>{subject}</button>)}
      </div>}
      {assignmentError ? <p role="alert" style={{ color: '#b91c1c', marginTop: 12 }}>{assignmentError}</p>
        : identityLoading ? <p role="status" style={{ ...muted, marginTop: 12 }}>Checking your available practice…</p>
        : filteredPracticeAssignments.length === 0 ? <div style={{ marginTop: 14 }}>
          <strong>{requestedTopic ? 'No approved practice for this topic yet' : 'No practice sets available for this selection yet'}</strong>
          <p style={{ ...muted, marginTop: 6 }}>Only approved questions are offered. Explore available exams or read published units while more topic sets are prepared.</p>
          <button style={{ ...secondaryButton, marginTop: 10 }} onClick={() => router.push('/student/vibelearn/exams')}>Explore available assessments</button>
        </div> : <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
        {filteredPracticeAssignments.map(item => {
          const active = item.attemptStatus === 'in_progress' && (!item.attemptExpiresAt || Date.parse(item.attemptExpiresAt) > Date.now())
          const resultReady = Boolean(item.attemptId && (item.resultStatus === 'released' || (item.resultStatus === 'marked' && item.showScorePolicy === 'immediate')))
          const canLaunch = item.canStart || active
          return <article key={item.assignmentId} style={{ border: '1px solid #e2e8f0', padding: 14, borderRadius: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'start' }}>
              <strong style={{ fontSize: 15 }}>{item.title}</strong>
              <span style={pill}>{active ? 'In progress' : resultReady ? 'Completed' : item.canStart ? 'New practice' : item.availability.replaceAll('_', ' ')}</span>
            </div>
            <p style={{ ...muted, marginTop: 8 }}>Approved practice set · {item.timeLimitMinutes ? `${item.timeLimitMinutes} min · ` : ''}Up to {item.maxAttempts} attempt{item.maxAttempts === 1 ? '' : 's'}{item.attemptNumber ? ` · Attempt ${item.attemptNumber} used` : ''}</p>
            <p style={{ ...muted, marginTop: 5 }}>Use the published assessment to answer, submit and review permitted results. A topic-specific drill will appear when verified topic questions are published.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginTop: 12 }}>
              <button type="button" style={{ ...primaryButton, opacity: canLaunch ? 1 : 0.5 }} disabled={!canLaunch}
                onClick={() => router.push(`/student/assessment/${encodeURIComponent(item.assignmentId)}`)}>
                {active ? 'Resume practice' : item.attemptId ? 'Try another attempt' : 'Start practice'}
              </button>
              {resultReady && item.attemptId && <button type="button" style={secondaryButton}
                onClick={() => router.push(`/student/results/${encodeURIComponent(item.attemptId as string)}`)}>Review result</button>}
            </div>
          </article>
        })}
      </div>}
    </section>}
    {error && <section style={{ ...card, color: '#b91c1c' }}>{error}</section>}
    {!hasReaderSource && !showLegacyBank ? null : loading ? <section style={card}>Loading questions…</section> : questions.length === 0 ? <section style={card}><strong>No grounded questions available</strong><p style={muted}>{sourceContext ? 'This unit is readable, but it has no authored, markable question blocks yet. Review the unit or choose another practice set.' : identity && !/^form\s*[1-4]$/i.test(identity.className.trim()) ? `Verified ${identity.className} practice questions are not available yet. You can continue with your assigned class exercises.` : 'No verified question-bank drills are available for this selection yet.'}</p>{!sourceContext && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}><button style={primaryButton} onClick={() => router.push('/student/vibelearn/reading')}>Browse published learning units</button>{identity?.classId && <button style={secondaryButton} onClick={() => router.push('/student/exercises')}>Open class exercises</button>}</div>}</section> : finished ? <section style={card}><div style={eyebrowDark}>Session complete</div><h2 style={{ fontSize: 28, margin: '8px 0' }}>{scoreLabel}</h2><p style={muted}>Your answers and grounded mistakes are now part of your learning journey and revision evidence.</p><div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}><button style={primaryButton} onClick={restart}>Try again</button>{sourceContext && <button style={secondaryButton} onClick={() => router.push(backUrl)}>Review this unit</button>}<button style={secondaryButton} onClick={() => router.push('/student/vibelearn/mistakes')}>Open mistakes</button><button style={secondaryButton} onClick={() => router.push('/student/vibelearn/revision')}>Open revision plan</button><button style={secondaryButton} onClick={() => router.push('/student/vibelearn/exams')}>Open exams</button></div></section> : question && <>
      <section style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}><div style={eyebrowDark}>Question {index + 1} of {questions.length}</div><div style={pill}>{question.kind === 'grounded' ? 'From this unit' : (question.topic ?? question.subject)}</div></div>
        <div style={progressTrack}><div style={{ ...progressFill, width: `${progress}%` }} /></div>
        <h2 style={{ fontSize: 20, lineHeight: 1.5 }}>{question.kind === 'grounded' ? question.prompt : question.question}</h2>
        {question.kind === 'grounded' ? <textarea value={textAnswer} onChange={event => setTextAnswer(event.target.value)} disabled={submitted || saving} placeholder="Type your answer" rows={4} style={answerInput} /> : <div style={{ display: 'grid', gap: 10 }}>{question.options.map((option, optionIndex) => { const isSelected = selected === optionIndex; const isCorrect = submitted && isSelected && answerCorrect === true; const isWrongSelected = submitted && isSelected && answerCorrect === false; return <button key={`${question.id}-${optionIndex}`} disabled={submitted || saving} onClick={() => setSelected(optionIndex)} style={{ ...optionButton, borderColor: isCorrect ? '#10b981' : isWrongSelected ? '#ef4444' : isSelected ? '#4f46e5' : '#e2e8f0', background: isCorrect ? '#ecfdf5' : isWrongSelected ? '#fef2f2' : isSelected ? '#eef2ff' : '#fff' }}><span style={optionLetter}>{String.fromCharCode(65 + optionIndex)}</span><span>{option}</span></button> })}</div>}
        {!submitted && <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>{question.kind === 'bank' && <button style={secondaryButton} onClick={() => setShowHint(value => !value)}>{showHint ? 'Hide hint' : 'Need a hint?'}</button>}<button style={{ ...primaryButton, opacity: (question.kind === 'grounded' ? !textAnswer.trim() : selected === null) || saving ? 0.5 : 1 }} disabled={(question.kind === 'grounded' ? !textAnswer.trim() : selected === null) || saving} onClick={() => void checkAnswer()}>{saving ? 'Checking…' : 'Check answer'}</button></div>}
        {question.kind === 'bank' && showHint && !submitted && <div style={hintBox}><strong>Hint</strong><div style={{ marginTop: 5 }}>{question.hint ?? 'Eliminate options that clearly conflict with the topic, then compare the remaining choices carefully.'}</div></div>}
        {submitted && <div style={answerCorrect ? correctBox : incorrectBox}><strong>{answerCorrect ? 'Correct' : 'Not yet'}</strong>{question.kind === 'grounded' ? <div style={{ marginTop: 6 }}>{expectedAnswer && <div><strong>Expected answer:</strong> {expectedAnswer}</div>}{!answerCorrect && <div style={{ marginTop: 6 }}>Review the exact source section, then retry this practice set.</div>}</div> : <div style={{ marginTop: 6 }}>{bankExplanation ?? 'Review the question and compare your choice with the topic before continuing.'}</div>}<div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>{!answerCorrect && reviewUrl && <button style={secondaryButton} onClick={() => router.push(reviewUrl)}>Review this section</button>}<button style={primaryButton} onClick={nextQuestion}>{index + 1 === questions.length ? 'Finish session' : 'Next question'}</button></div></div>}
      </section>
      <section style={{ ...card, background: '#faf5ff', borderColor: '#ddd6fe' }}><div style={eyebrowDark}>Tutor boundary</div><p style={{ ...muted, lineHeight: 1.6 }}>Scoring is deterministic and server-authoritative. VibeTwin does not answer questions or reveal solutions while scoring is active.</p></section>
    </>}
  </div></main>
}

const shell: React.CSSProperties = { minHeight: '100vh', background: '#f8fafc', padding: '18px 14px 90px', color: '#0f172a', fontFamily: "'Plus Jakarta Sans', sans-serif" }
const hero: React.CSSProperties = { background: 'linear-gradient(135deg,#0f172a,#1e1b4b)', color:'#fff', borderRadius:20, padding:20, marginBottom:12 }
const card: React.CSSProperties = { background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, padding:16, marginBottom:12 }
const eyebrow: React.CSSProperties = { fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:1.1, color:'#a5b4fc' }
const eyebrowDark: React.CSSProperties = { fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:1.1, color:'#4f46e5' }
const muted: React.CSSProperties = { fontSize:12, color:'#64748b', margin:0 }
const backButton: React.CSSProperties = { border:'none', background:'transparent', color:'#4338ca', fontWeight:800, marginBottom:10, cursor:'pointer', fontFamily:'inherit' }
const pill: React.CSSProperties = { width:'fit-content', background:'#eef2ff', color:'#4338ca', borderRadius:999, padding:'4px 8px', fontSize:10, fontWeight:800 }
const progressTrack: React.CSSProperties = { height:6, borderRadius:999, background:'#e2e8f0', overflow:'hidden', margin:'12px 0 16px' }
const progressFill: React.CSSProperties = { height:'100%', background:'#4f46e5' }
const optionButton: React.CSSProperties = { width:'100%', border:'1px solid #e2e8f0', borderRadius:12, padding:12, display:'flex', gap:10, alignItems:'flex-start', textAlign:'left', fontFamily:'inherit', cursor:'pointer' }
const optionLetter: React.CSSProperties = { width:24, height:24, borderRadius:999, background:'#f1f5f9', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, flexShrink:0 }
const answerInput: React.CSSProperties = { width:'100%', border:'1px solid #cbd5e1', borderRadius:12, padding:12, fontFamily:'inherit', fontSize:14, resize:'vertical' }
const primaryButton: React.CSSProperties = { border:'none', background:'#4f46e5', color:'#fff', borderRadius:11, padding:'10px 14px', fontWeight:800, cursor:'pointer', fontFamily:'inherit' }
const secondaryButton: React.CSSProperties = { border:'1px solid #c7d2fe', background:'#eef2ff', color:'#4338ca', borderRadius:10, padding:'8px 11px', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }
const hintBox: React.CSSProperties = { marginTop:12, padding:12, background:'#fffbeb', border:'1px solid #fde68a', borderRadius:12, color:'#78350f' }
const correctBox: React.CSSProperties = { marginTop:14, padding:13, background:'#ecfdf5', border:'1px solid #a7f3d0', borderRadius:12, color:'#065f46' }
const incorrectBox: React.CSSProperties = { marginTop:14, padding:13, background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:12, color:'#9a3412' }
