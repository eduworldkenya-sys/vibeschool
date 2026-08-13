'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import VibeLearnSubnav from '@/components/student/VibeLearnSubnav'
import { getGroundedChapterPractice, recordGroundedPracticeAnswer, recordVibeLearnPracticeAnswer, type GroundedPracticeQuestion, type GroundedPracticeSource } from '@/lib/student/vibelearn'
import { getKcseAdaptivePractice, type KcseQuestion } from '@/lib/student/kcse'

type BankQuestion = KcseQuestion & { kind: 'bank' }
type GroundedQuestion = GroundedPracticeQuestion & { kind: 'grounded' }
type PracticeQuestion = BankQuestion | GroundedQuestion

function asResult(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {} }

export default function VibeLearnPracticePage() {
  const router = useRouter(); const params = useSearchParams()
  const requestedSubject = params.get('subject')?.replaceAll('-', ' ') ?? ''
  const requestedTopic = params.get('topic')?.replaceAll('-', ' ') ?? ''
  const requestedPublicationId = params.get('publication') ?? ''; const requestedChapterId = params.get('chapter') ?? ''
  const hasReaderSource = Boolean(requestedPublicationId && requestedChapterId)
  const [sourceContext, setSourceContext] = useState<GroundedPracticeSource | null>(null); const [questions, setQuestions] = useState<PracticeQuestion[]>([])
  const [index, setIndex] = useState(0); const [selected, setSelected] = useState<number | null>(null); const [textAnswer, setTextAnswer] = useState(''); const [showHint, setShowHint] = useState(false)
  const [submitted, setSubmitted] = useState(false); const [answerCorrect, setAnswerCorrect] = useState<boolean | null>(null); const [expectedAnswer, setExpectedAnswer] = useState<string | null>(null); const [reviewUrl, setReviewUrl] = useState<string | null>(null); const [explanation, setExplanation] = useState<string | null>(null)
  const [correct, setCorrect] = useState(0); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState('')
  const startedAtRef = useRef(Date.now()); const sessionIdRef = useRef(typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : null)

  useEffect(() => { let cancelled = false; async function load() { setLoading(true); setError(''); try {
    if (hasReaderSource) { const grounded = await getGroundedChapterPractice(requestedPublicationId, requestedChapterId, 10); if (!cancelled) { setSourceContext(grounded?.source ?? null); setQuestions((grounded?.questions ?? []).map(question => ({ ...question, kind: 'grounded' as const }))) }; return }
    const result = await getKcseAdaptivePractice(requestedSubject || null, requestedTopic || null, 20); if (!cancelled) { setSourceContext(null); setQuestions((result.questions ?? []).map(question => ({ ...question, kind: 'bank' as const }))) }
  } catch (reason) { if (!cancelled) { setQuestions([]); setSourceContext(null); setError(reason instanceof Error ? reason.message : 'Could not load practice questions.') } } finally { if (!cancelled) setLoading(false) } }
    void load(); return () => { cancelled = true }
  }, [hasReaderSource, requestedPublicationId, requestedChapterId, requestedSubject, requestedTopic])

  const question = questions[index] ?? null; const finished = questions.length > 0 && index >= questions.length; const progress = questions.length === 0 ? 0 : Math.round((Math.min(index, questions.length) / questions.length) * 100); const scoreLabel = `${correct}/${questions.length}`
  const practiceTitle = sourceContext?.chapterTitle || requestedTopic || requestedSubject || 'Mixed subject'; const backUrl = sourceContext ? `/read/textbook/${sourceContext.publicationId}?chapter=${sourceContext.chapterId}` : '/student/vibelearn'

  async function checkAnswer() { if (!question || submitted || saving) return; if (question.kind === 'bank' && selected === null) return; if (question.kind === 'grounded' && !textAnswer.trim()) return; setSaving(true); setError(''); try {
    if (question.kind === 'grounded') { const result = asResult(await recordGroundedPracticeAnswer({ contentBlockId: question.contentBlockId, responseText: textAnswer, responseMs: Math.max(0, Date.now() - startedAtRef.current), sessionId: sessionIdRef.current })); const isCorrect = result.correct === true; setAnswerCorrect(isCorrect); setExpectedAnswer(typeof result.expected_answer === 'string' ? result.expected_answer : null); setReviewUrl(typeof result.review_url === 'string' ? result.review_url : null); setExplanation(null); if (isCorrect) setCorrect(value => value + 1) }
    else { const result = asResult(await recordVibeLearnPracticeAnswer({ examQuestionId: question.id, selectedIndex: selected as number, responseMs: Math.max(0, Date.now() - startedAtRef.current), sessionId: sessionIdRef.current })); const isCorrect = result.correct === true; setAnswerCorrect(isCorrect); setExplanation(typeof result.explanation === 'string' ? result.explanation : null); if (isCorrect) setCorrect(value => value + 1) }
    setSubmitted(true)
  } catch (reason) { setError(reason instanceof Error ? reason.message : 'Your answer could not be saved. Try again.') } finally { setSaving(false) } }

  function nextQuestion() { setIndex(value => value + 1); setSelected(null); setTextAnswer(''); setSubmitted(false); setAnswerCorrect(null); setExpectedAnswer(null); setReviewUrl(null); setExplanation(null); setShowHint(false); startedAtRef.current = Date.now() }
  function restart() { setIndex(0); setCorrect(0); setSelected(null); setTextAnswer(''); setSubmitted(false); setAnswerCorrect(null); setExpectedAnswer(null); setReviewUrl(null); setExplanation(null); setShowHint(false); startedAtRef.current = Date.now(); sessionIdRef.current = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : null }

  return <main style={shell}><div style={{ maxWidth: 760, margin: '0 auto' }}><VibeLearnSubnav /><button style={backButton} onClick={() => router.push(backUrl)}>← {sourceContext ? 'Back to unit' : 'VibeLearn'}</button>
    <section style={hero}><div style={eyebrow}>Practice mode</div><h1 style={{ margin: '7px 0 4px' }}>{practiceTitle} practice</h1><p style={{ margin: 0, color: '#cbd5e1' }}>Scoring is server-authoritative. The learner client never receives the answer key before submission.</p></section>
    {sourceContext && <section style={{ ...card, borderColor: '#c7d2fe', background: '#f5f3ff' }}><div style={eyebrowDark}>Exact learning source</div><strong style={{ display: 'block', margin: '6px 0 3px' }}>{sourceContext.publicationTitle} · {sourceContext.chapterTitle}</strong><p style={muted}>{[sourceContext.grade, sourceContext.subject].filter(Boolean).join(' · ') || 'VibeTextbook'} · {sourceContext.assessableBlockCount} assessable blocks · {sourceContext.verifiedOutcomeCount} verified outcomes</p></section>}
    {error && <section style={{ ...card, color: '#b91c1c' }}>{error}</section>}
    {loading ? <section style={card}>Loading questions…</section> : questions.length === 0 ? <section style={card}><strong>No practice questions available</strong><p style={muted}>{sourceContext ? 'This unit has no authored, markable question blocks yet.' : 'Choose another subject or topic from VibeLearn.'}</p></section> : finished ? <section style={card}><div style={eyebrowDark}>Session complete</div><h2 style={{ fontSize: 28, margin: '8px 0' }}>{scoreLabel}</h2><p style={muted}>Your answers are now recorded in your learning evidence and revision workflow.</p><div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}><button style={primaryButton} onClick={restart}>Try again</button>{sourceContext && <button style={secondaryButton} onClick={() => router.push(backUrl)}>Review this unit</button>}<button style={secondaryButton} onClick={() => router.push('/student/vibelearn/mistakes')}>Open mistakes</button><button style={secondaryButton} onClick={() => router.push('/student/vibelearn/revision')}>Open revision plan</button></div></section> : question && <><section style={card}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}><div style={eyebrowDark}>Question {index + 1} of {questions.length}</div><div style={pill}>{question.kind === 'grounded' ? 'From this unit' : (question.topic ?? question.subject)}</div></div><div style={progressTrack}><div style={{ ...progressFill, width: `${progress}%` }} /></div><h2 style={{ fontSize: 20, lineHeight: 1.5 }}>{question.kind === 'grounded' ? question.prompt : question.question}</h2>
      {question.kind === 'grounded' ? <textarea value={textAnswer} onChange={event => setTextAnswer(event.target.value)} disabled={submitted || saving} placeholder="Type your answer" rows={4} style={answerInput} /> : <div style={{ display: 'grid', gap: 10 }}>{question.options.map((option, optionIndex) => { const isSelected = selected === optionIndex; return <button key={`${question.id}-${optionIndex}`} disabled={submitted || saving} onClick={() => setSelected(optionIndex)} style={{ ...optionButton, borderColor: isSelected ? '#4f46e5' : '#e2e8f0', background: isSelected ? '#eef2ff' : '#fff' }}><span style={optionLetter}>{String.fromCharCode(65 + optionIndex)}</span><span>{option}</span></button> })}</div>}
      {!submitted && <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>{question.kind === 'bank' && <button style={secondaryButton} onClick={() => setShowHint(value => !value)}>{showHint ? 'Hide hint' : 'Need a hint?'}</button>}<button style={{ ...primaryButton, opacity: (question.kind === 'grounded' ? !textAnswer.trim() : selected === null) || saving ? 0.5 : 1 }} disabled={(question.kind === 'grounded' ? !textAnswer.trim() : selected === null) || saving} onClick={() => void checkAnswer()}>{saving ? 'Checking…' : 'Check answer'}</button></div>}
      {question.kind === 'bank' && showHint && !submitted && <div style={hintBox}><strong>Hint</strong><div style={{ marginTop: 5 }}>{question.hint ?? 'Eliminate options that conflict with the learning outcome, then compare the remaining choices carefully.'}</div></div>}
      {submitted && <div style={answerCorrect ? correctBox : incorrectBox}><strong>{answerCorrect ? 'Correct' : 'Not yet'}</strong>{question.kind === 'grounded' ? <div style={{ marginTop: 6 }}>{expectedAnswer && <div><strong>Expected answer:</strong> {expectedAnswer}</div>}{!answerCorrect && <div style={{ marginTop: 6 }}>Review the exact source section, then retry this practice set.</div>}</div> : <div style={{ marginTop: 6 }}>{explanation ?? 'Review the explanation and retry the concept if needed.'}</div>}<div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>{!answerCorrect && reviewUrl && <button style={secondaryButton} onClick={() => router.push(reviewUrl)}>Review this section</button>}<button style={primaryButton} onClick={nextQuestion}>{index + 1 === questions.length ? 'Finish session' : 'Next question'}</button></div></div>}</section><section style={{ ...card, background: '#faf5ff', borderColor: '#ddd6fe' }}><div style={eyebrowDark}>Tutor boundary</div><p style={{ ...muted, lineHeight: 1.6 }}>VibeTwin does not answer questions or reveal solutions while scoring is active.</p></section></>}
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
