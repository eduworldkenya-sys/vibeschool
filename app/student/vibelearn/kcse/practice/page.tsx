'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import VibeLearnSubnav from '@/components/student/VibeLearnSubnav'
import { getKcseAdaptivePractice, recordKcsePracticeAnswer, type KcseQuestion } from '@/lib/student/kcse'

export default function KcseAdaptivePracticePage() {
  const params = useSearchParams()
  const subject = params.get('subject')
  const topic = params.get('topic')
  const [questions, setQuestions] = useState<KcseQuestion[]>([])
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<{ correct: boolean; correct_index: number; explanation: string | null; next_retest_days: number } | null>(null)
  const [startedAt, setStartedAt] = useState(Date.now())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const current = questions[index]

  useEffect(() => {
    let cancelled = false
    getKcseAdaptivePractice(subject, topic, 10)
      .then(result => { if (!cancelled) setQuestions(result.questions ?? []) })
      .catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not load practice.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [subject, topic])

  const provenance = useMemo(() => current ? [current.provenance_status?.replaceAll('_',' '), current.source_year, current.source_paper].filter(Boolean).join(' · ') : '', [current])

  async function submit() {
    if (!current || selected == null || feedback) return
    setError('')
    try {
      const result = await recordKcsePracticeAnswer(current.id, selected, Date.now() - startedAt)
      setFeedback(result)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not score this answer.') }
  }

  function next() {
    setIndex(value => Math.min(value + 1, questions.length - 1)); setSelected(null); setFeedback(null); setStartedAt(Date.now())
  }

  return <main style={shell}><div style={{ maxWidth: 820, margin: '0 auto' }}>
    <VibeLearnSubnav />
    <section style={hero}><div style={eyebrow}>KCSE Adaptive Practice</div><h1 style={{ margin: '7px 0 5px' }}>{subject ?? 'Your highest-value questions'}</h1><p style={{ margin: 0, color: '#cbd5e1' }}>{topic ? `${topic} · ` : ''}Mistakes and due retests are prioritised before new evidence.</p></section>
    {error && <section style={{ ...card, color: '#b91c1c' }}>{error}</section>}
    {loading ? <section style={card}>Selecting questions…</section> : !current ? <section style={card}><strong>No verified Form 4 questions available.</strong><p style={muted}>This is an availability gap, not evidence that you are weak. Vibeschool will not invent KCSE questions.</p></section> : <section style={card}>
      <div style={{ display:'flex', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}><span style={pill}>Question {index + 1}/{questions.length}</span><span style={pill}>{current.selection_reason}</span></div>
      <div style={{ marginTop:12 }}><strong>{current.subject} · {current.topic}</strong><div style={muted}>{current.difficulty} · {provenance || 'provenance not verified'}</div></div>
      <h2 style={{ fontSize:19, lineHeight:1.5 }}>{current.question}</h2>
      <div style={{ display:'grid', gap:9 }}>{current.options.map((option, optionIndex) => <button key={optionIndex} disabled={Boolean(feedback)} onClick={() => setSelected(optionIndex)} style={{ ...choice, ...(selected === optionIndex ? choiceSelected : {}), ...(feedback && optionIndex === feedback.correct_index ? choiceCorrect : {}), ...(feedback && selected === optionIndex && !feedback.correct ? choiceWrong : {}) }}>{String.fromCharCode(65 + optionIndex)}. {option}</button>)}</div>
      {!feedback ? <button style={{ ...primaryButton, marginTop:14 }} disabled={selected == null} onClick={() => void submit()}>Check answer</button> : <div style={{ ...feedbackBox, borderColor: feedback.correct ? '#86efac' : '#fca5a5', background: feedback.correct ? '#f0fdf4' : '#fef2f2' }}><strong>{feedback.correct ? 'Correct' : 'Not yet'}</strong><p style={muted}>{feedback.explanation ?? 'Review the concept and try again when it returns in your plan.'}</p><p style={muted}>Next spaced check: {feedback.next_retest_days} day{feedback.next_retest_days === 1 ? '' : 's'}.</p>{index < questions.length - 1 && <button style={primaryButton} onClick={next}>Next question</button>}</div>}
    </section>}
  </div></main>
}

const shell: React.CSSProperties={minHeight:'100vh',background:'#f8fafc',padding:'18px 14px 90px',color:'#0f172a',fontFamily:"'Plus Jakarta Sans', sans-serif"}
const hero: React.CSSProperties={background:'linear-gradient(135deg,#0f172a,#065f46)',color:'#fff',borderRadius:20,padding:20,marginBottom:12}
const card: React.CSSProperties={background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,padding:16,marginBottom:12}
const eyebrow: React.CSSProperties={fontSize:10,fontWeight:900,textTransform:'uppercase',letterSpacing:1.1,color:'#a7f3d0'}
const muted: React.CSSProperties={fontSize:12,color:'#64748b',margin:'6px 0',lineHeight:1.5}
const pill: React.CSSProperties={fontSize:10,fontWeight:800,borderRadius:999,padding:'4px 8px',background:'#ecfdf5',color:'#047857'}
const choice: React.CSSProperties={border:'1px solid #cbd5e1',background:'#fff',borderRadius:12,padding:12,textAlign:'left',cursor:'pointer',fontFamily:'inherit'}
const choiceSelected: React.CSSProperties={borderColor:'#4f46e5',background:'#eef2ff'}
const choiceCorrect: React.CSSProperties={borderColor:'#22c55e',background:'#f0fdf4'}
const choiceWrong: React.CSSProperties={borderColor:'#ef4444',background:'#fef2f2'}
const primaryButton: React.CSSProperties={border:'none',background:'#4f46e5',color:'#fff',borderRadius:10,padding:'9px 12px',fontWeight:800,cursor:'pointer',fontFamily:'inherit'}
const feedbackBox: React.CSSProperties={border:'1px solid',borderRadius:13,padding:14,marginTop:14}
