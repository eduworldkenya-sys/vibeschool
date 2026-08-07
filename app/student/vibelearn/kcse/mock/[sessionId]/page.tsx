'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import VibeLearnSubnav from '@/components/student/VibeLearnSubnav'
import { getKcseMock, saveKcseMockAnswer, submitKcseMock, type KcseMock } from '@/lib/student/kcse'

export default function KcseMockPage() {
  const params = useParams<{ sessionId: string }>()
  const query = useSearchParams()
  const clientId = query.get('client') ?? ''
  const [mock, setMock] = useState<KcseMock | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now())

  const load = useCallback(async () => {
    try { setMock(await getKcseMock(params.sessionId)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load this mock.') }
  }, [params.sessionId])

  useEffect(() => { void load() }, [load])
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id) }, [])

  const secondsLeft = useMemo(() => mock ? Math.max(0, Math.floor((new Date(mock.expires_at).getTime() - now) / 1000)) : 0, [mock, now])
  const timeLabel = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`

  async function choose(questionId: string, selectedIndex: number) {
    if (!mock || mock.status !== 'in_progress' || !clientId) return
    setSaving(questionId); setError('')
    try {
      await saveKcseMockAnswer(mock.session_id, questionId, selectedIndex, null, clientId)
      setMock({ ...mock, questions: mock.questions.map(q => q.id === questionId ? { ...q, selected_index: selectedIndex } : q) })
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not autosave answer.') }
    finally { setSaving(null) }
  }

  async function finish() {
    if (!mock || !clientId) return
    setSubmitting(true); setError('')
    try { setMock(await submitKcseMock(mock.session_id, clientId)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not submit mock.') }
    finally { setSubmitting(false) }
  }

  if (!clientId) return <main style={shell}><div style={{maxWidth:820,margin:'0 auto'}}><VibeLearnSubnav/><section style={card}><strong>Mock device token missing.</strong><p style={muted}>Start this paper from the KCSE Candidate OS so Vibeschool can protect the resumable session.</p></section></div></main>

  return <main style={shell}><div style={{ maxWidth: 900, margin:'0 auto' }}><VibeLearnSubnav/>
    {error && <section style={{...card,color:'#b91c1c'}}>{error}</section>}
    {!mock ? <section style={card}>Loading timed paper…</section> : <>
      <section style={hero}><div><div style={eyebrow}>KCSE Timed Mock</div><h1 style={{margin:'6px 0 4px'}}>{mock.subject} · {mock.paper_code}</h1><p style={{margin:0,color:'#cbd5e1'}}>{mock.title} · {mock.total_marks} marks</p></div><div style={timer}>{mock.status === 'in_progress' ? timeLabel : mock.status.replaceAll('_',' ')}</div></section>
      {mock.status === 'submitted' && <section style={{...card,borderColor:'#86efac',background:'#f0fdf4'}}><strong>Submitted: {mock.score}/{mock.max_score} · {mock.percentage}%</strong><p style={muted}>Answers and explanations are revealed only after submission. Missed items were added to your recovery loop automatically.</p></section>}
      {mock.questions.map((question, i) => <section key={question.id} style={card}><div style={{display:'flex',justifyContent:'space-between',gap:8}}><strong>Question {i+1}</strong><span style={pill}>{question.topic}</span></div><h2 style={{fontSize:18,lineHeight:1.5}}>{question.question}</h2><div style={{display:'grid',gap:8}}>{question.options.map((option, optionIndex) => <button key={optionIndex} disabled={mock.status !== 'in_progress' || saving === question.id} onClick={() => void choose(question.id, optionIndex)} style={{...choice,...(question.selected_index===optionIndex?choiceSelected:{}),...(mock.status==='submitted'&&question.correct_index===optionIndex?choiceCorrect:{}),...(mock.status==='submitted'&&question.selected_index===optionIndex&&question.correct_index!==optionIndex?choiceWrong:{})}}>{String.fromCharCode(65+optionIndex)}. {option}</button>)}</div>{mock.status==='submitted' && question.explanation && <div style={explanation}><strong>{question.is_correct ? 'Correct' : 'Review'}</strong><p style={muted}>{question.explanation}</p></div>}</section>)}
      {mock.status==='in_progress' && <section style={card}><button style={primaryButton} disabled={submitting} onClick={() => void finish()}>{submitting?'Submitting…':'Submit timed mock'}</button><p style={muted}>Submitting ends the paper and unlocks marking. Tutor help and answer reveal stay blocked before submission.</p></section>}
    </>}
  </div></main>
}

const shell: React.CSSProperties={minHeight:'100vh',background:'#f8fafc',padding:'18px 14px 90px',color:'#0f172a',fontFamily:"'Plus Jakarta Sans', sans-serif"}
const hero: React.CSSProperties={background:'linear-gradient(135deg,#020617,#7f1d1d)',color:'#fff',borderRadius:20,padding:20,marginBottom:12,display:'flex',justifyContent:'space-between',gap:14,alignItems:'center',flexWrap:'wrap'}
const card: React.CSSProperties={background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,padding:16,marginBottom:12}
const eyebrow: React.CSSProperties={fontSize:10,fontWeight:900,textTransform:'uppercase',letterSpacing:1.1,color:'#fecaca'}
const muted: React.CSSProperties={fontSize:12,color:'#64748b',lineHeight:1.55}
const timer: React.CSSProperties={fontSize:28,fontWeight:900,background:'#fff',color:'#991b1b',borderRadius:14,padding:'10px 14px',fontVariantNumeric:'tabular-nums'}
const pill: React.CSSProperties={fontSize:10,fontWeight:800,borderRadius:999,padding:'4px 8px',background:'#f1f5f9',color:'#475569'}
const choice: React.CSSProperties={border:'1px solid #cbd5e1',background:'#fff',borderRadius:12,padding:12,textAlign:'left',cursor:'pointer',fontFamily:'inherit'}
const choiceSelected: React.CSSProperties={borderColor:'#4f46e5',background:'#eef2ff'}
const choiceCorrect: React.CSSProperties={borderColor:'#22c55e',background:'#f0fdf4'}
const choiceWrong: React.CSSProperties={borderColor:'#ef4444',background:'#fef2f2'}
const explanation: React.CSSProperties={borderTop:'1px solid #e2e8f0',marginTop:12,paddingTop:12}
const primaryButton: React.CSSProperties={border:'none',background:'#991b1b',color:'#fff',borderRadius:10,padding:'10px 14px',fontWeight:900,cursor:'pointer',fontFamily:'inherit'}
