'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStudent } from '@/lib/student-context'
import { supabase } from '@/lib/supabase'
import { recordVibeLearnPracticeAnswer } from '@/lib/student/vibelearn'

type Question = { id:string; subject:string; topic:string; question:string; options:string[] }
type Topic = {subject:string;topic:string;count:number}
type Answer = { questionId:string; choice:number|null; correct:boolean|null; correctIndex:number|null; explanation:string|null }
type Session = { grade:string; subject:string; topic:string; questionIds:string[]; index:number; answers:Answer[]; id:string; finished:boolean }
const TARGET = 5
const STORAGE = 'vibeschool:topic-practice:v1:'
function readQuestions(value:unknown):Question[] {
  if (!Array.isArray(value)) return []
  return value.flatMap(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const row = item as Record<string,unknown>
    if (typeof row.id !== 'string' || typeof row.question !== 'string' || typeof row.topic !== 'string' || typeof row.subject !== 'string' || !Array.isArray(row.options)) return []
    const options = row.options.filter((x):x is string => typeof x === 'string')
    return options.length >= 2 ? [{ id:row.id,question:row.question,subject:row.subject,topic:row.topic,options }] : []
  })
}
function readSession(key:string):Session|null {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const state = JSON.parse(raw) as Session
    if (!state || !Array.isArray(state.questionIds) || state.questionIds.length !== TARGET || !Array.isArray(state.answers) || !Number.isInteger(state.index)) return null
    return state
  } catch { return null }
}
export default function TopicPracticePage() {
  const router = useRouter()
  const { identity, loading: identityLoading } = useStudent()
  const [grade, setGrade] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [completedTopics, setCompletedTopics] = useState<string[]>([])
  const [session, setSession] = useState<Session|null>(null)
  const [choice, setChoice] = useState<number|null>(null)
  const [reviewQuestionId, setReviewQuestionId] = useState<string|null>(null)
  const [reviewResult, setReviewResult] = useState<{correct:boolean;correctIndex:number|null;explanation:string|null}|null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [initialised, setInitialised] = useState(false)
  const storageKey = identity?.studentId ? STORAGE + identity.studentId : ''
  useEffect(() => {
    if (identityLoading || !identity || initialised) return
    const profileGrade = /^grade\s*\d+$/i.test(identity.className.trim()) ? identity.className.trim() : /^form\s*[1-4]$/i.test(identity.className.trim()) ? identity.className.trim() : ''
    setGrade(profileGrade || window.localStorage.getItem(STORAGE + identity.studentId + ':grade') || '')
    setSession(readSession(STORAGE + identity.studentId))
    try { const saved = JSON.parse(window.localStorage.getItem(STORAGE + identity.studentId + ':completed') || '[]'); if (Array.isArray(saved)) setCompletedTopics(saved.filter((x):x is string => typeof x === 'string')) } catch { setCompletedTopics([]) }
    setInitialised(true)
  }, [identityLoading, identity, initialised])
  useEffect(() => {
    if (!initialised || !grade || !storageKey) { setLoading(false); return }
    let cancelled = false
    setLoading(true); setError('')
    async function load() {
      const [catalog, previous] = await Promise.all([
        supabase.rpc('student_list_topic_practice_topics' as never, {p_form:grade}),
        Promise.resolve(readSession(storageKey)),
      ])
      if (catalog.error) throw catalog.error
      const readyTopics = (Array.isArray(catalog.data) ? catalog.data : []).flatMap(item => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return []
        const row = item as Record<string,unknown>
        return typeof row.subject === 'string' && typeof row.topic === 'string' && typeof row.count === 'number' && row.count >= TARGET
          ? [{subject:row.subject,topic:row.topic,count:row.count}] : []
      })
      if (!cancelled) setTopics(readyTopics)
      // Rehydrate the precise five question IDs selected for the unfinished session.
      if (previous && previous.grade === grade) {
        const {data:bank,error:bankError} = await supabase.rpc('student_list_vibelearn_practice_questions' as never,{
          p_subject:previous.subject,p_topic:previous.topic,p_form:grade,p_limit:20,
        })
        if (bankError) throw bankError
        if (!cancelled) setQuestions(readQuestions(bank))
      } else if (!cancelled) setQuestions([])
    }
    void load().catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Topic practice could not be loaded.') })
      .finally(() => {if (!cancelled) setLoading(false)})
    return () => { cancelled = true }
  }, [initialised,grade,storageKey])
  function remember(next:Session|null) {
    setSession(next); setChoice(null); setReviewQuestionId(null); setReviewResult(null)
    if (!storageKey) return
    try { if (next) window.localStorage.setItem(storageKey,JSON.stringify(next)); else window.localStorage.removeItem(storageKey) } catch { /* browser persistence unavailable */ }
  }
  const currentQuestion = session && !session.finished ? questions.find(q => q.id === session.questionIds[session.index]) : null
  const currentAnswer = currentQuestion ? session?.answers.find(a => a.questionId === currentQuestion.id) : null
  const completed = session?.answers.length ?? 0
  const results = {correct:session?.answers.filter(a => a.correct === true).length ?? 0, incorrect:session?.answers.filter(a => a.correct === false).length ?? 0, skipped:session?.answers.filter(a => a.correct === null).length ?? 0}
  async function start(topic:Topic) {
    if (busy) return
    setBusy(true); setError('')
    try {
      const {data:bank,error:bankError} = await supabase.rpc('student_list_vibelearn_practice_questions' as never,{
        p_subject:topic.subject,p_topic:topic.topic,p_form:grade,p_limit:TARGET,
      })
      if (bankError) throw bankError
      const selected = readQuestions(bank)
      if (selected.length !== TARGET) throw new Error('This topic is no longer ready for five-question practice.')
      setQuestions(selected)
      remember({grade,subject:topic.subject,topic:topic.topic,questionIds:selected.map(q => q.id),index:0,answers:[],id:crypto.randomUUID(),finished:false})
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not start this topic.') }
    finally { setBusy(false) }
  }
  async function answer(index:number) {
    if (!currentQuestion || !session || busy || currentAnswer) return
    setBusy(true); setError('')
    try {
      const result = await recordVibeLearnPracticeAnswer({examQuestionId:currentQuestion.id,selectedIndex:index,sessionId:session.id,responseMs:null})
      const row = result && typeof result === 'object' ? result as Record<string,unknown> : {}
      if (typeof row.correct !== 'boolean') throw new Error('Marking did not return a result.')
      let correctIndex:number|null = null
      try {
        const feedback = await supabase.rpc('student_get_topic_practice_feedback' as never,{p_exam_question_id:currentQuestion.id,p_session_id:session.id})
        if (!feedback.error && feedback.data && typeof feedback.data === 'object' && !Array.isArray(feedback.data)) {
          const value = feedback.data as Record<string,unknown>
          if (typeof value.correct_index === 'number') correctIndex = value.correct_index
        }
      } catch { /* The attempt remains scored even if review data is temporarily unavailable. */ }
      remember({...session,answers:[...session.answers,{questionId:currentQuestion.id,choice:index,correct:row.correct,correctIndex,explanation:typeof row.explanation === 'string' ? row.explanation : null}]})
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not mark this answer.') }
    finally { setBusy(false) }
  }
  function skip() {
    if (!session || !currentQuestion || busy || currentAnswer) return
    remember({...session,answers:[...session.answers,{questionId:currentQuestion.id,choice:null,correct:null,correctIndex:null,explanation:null}]})
  }
  function next() {
    if (!session || !currentAnswer) return
    const finished = session.index+1 >= TARGET
    remember({...session,index:Math.min(TARGET,session.index+1),finished})
    if (finished && identity?.studentId) {
      const key = session.grade + '::' + session.subject + '::' + session.topic
      const nextCompleted = Array.from(new Set([...completedTopics,key]))
      setCompletedTopics(nextCompleted)
      try { window.localStorage.setItem(STORAGE + identity.studentId + ':completed',JSON.stringify(nextCompleted)) } catch {}
    }
  }
  async function retryQuestion(question:Question) {
    if (choice === null || busy || !session) return
    setBusy(true); setError('')
    try {
      const reviewSessionId = crypto.randomUUID()
      const result = await recordVibeLearnPracticeAnswer({examQuestionId:question.id,selectedIndex:choice,sessionId:reviewSessionId,responseMs:null})
      const row = result && typeof result === 'object' ? result as Record<string,unknown> : {}
      if (typeof row.correct !== 'boolean') throw new Error('Marking did not return a result.')
      let correctIndex:number|null = null
      // This feedback is authorized by the just-created scored attempt.
      const feedback = await supabase.rpc('student_get_topic_practice_feedback' as never,{p_exam_question_id:question.id,p_session_id:reviewSessionId})
      if (!feedback.error && feedback.data && typeof feedback.data === 'object' && !Array.isArray(feedback.data)) {
        const item = feedback.data as Record<string,unknown>
        if (typeof item.correct_index === 'number') correctIndex = item.correct_index
      }
      setReviewResult({correct:row.correct,correctIndex,explanation:typeof row.explanation === 'string' ? row.explanation : null})
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not retry this question.') }
    finally { setBusy(false) }
  }
  function selectGrade(value:string) {
    setGrade(value); remember(null)
    if (identity?.studentId) try { window.localStorage.setItem(STORAGE + identity.studentId + ':grade',value) } catch {}
  }
  if (identityLoading || !identity) return <main style={shell}>Opening practice…</main>
  return <main style={shell}>
    <button style={plain} onClick={() => router.push('/student/vibelearn')}>← Learn</button>
    <h1 style={{margin:'12px 0 6px',fontSize:26}}>Topic Practice</h1>
    <p style={muted}>Five questions. No timer or class code.</p>
    {!grade && <section style={card}><h2 style={heading}>Choose your grade once</h2><div style={grid}>{[4,5,6,7,8,9].map(n => <button key={n} style={button} onClick={() => selectGrade('Grade '+n)}>Grade {n}</button>)}</div></section>}
    {grade && <p style={{...muted,marginTop:12}}>{grade} <button style={plain} onClick={() => selectGrade('')}>Change</button></p>}
    {error && <p role="alert" style={{color:'#b91c1c'}}>{error}</p>}
    {grade && loading && <section style={card}>Loading available topics…</section>}
    {grade && !loading && session?.finished && <section style={card}>
      <h2 style={heading}>Practice complete</h2>
      <p style={{fontSize:18,fontWeight:800}}>{results.correct} correct · {results.incorrect} incorrect · {results.skipped} skipped</p>
      <button style={button} onClick={() => { setReviewQuestionId('all'); setReviewResult(null) }}>Review mistakes</button>
      <button style={secondary} onClick={() => remember(null)}>Choose another topic</button>
      {reviewQuestionId && <div style={{marginTop:20,display:'grid',gap:12}}>{session.answers.filter(a => a.correct !== true).length === 0 ? <p style={muted}>No missed or skipped questions.</p> : session.answers.filter(a => a.correct !== true).map(a => {
        const q = questions.find(item => item.id === a.questionId)
        if (!q) return null
        const active = reviewQuestionId === q.id
        return <div key={q.id} style={{border:'1px solid var(--vs-border)',padding:13,borderRadius:12}}><strong>{q.question}</strong><p style={muted}>{a.correct === null ? 'Skipped' : 'Incorrect'}</p><button style={plain} onClick={() => {setReviewQuestionId(active ? 'all' : q.id);setReviewResult(null);setChoice(null)}}>{active ? 'Close' : 'Retry question'}</button>{active && <div style={{display:'grid',gap:8}}>{q.options.map((option,i) => <button key={i} disabled={busy || Boolean(reviewResult)} style={{...optionButton,background:choice===i?'#e0e7ff':'var(--vs-card)'}} onClick={() => setChoice(i)}>{String.fromCharCode(65+i)}. {option}</button>)}{reviewResult ? <div role='status'><strong>{reviewResult.correct ? 'Correct' : 'Not correct'}</strong>{reviewResult.correctIndex !== null && <p>Correct answer: {String.fromCharCode(65+reviewResult.correctIndex)}. {q.options[reviewResult.correctIndex]}</p>}<p>{reviewResult.explanation}</p></div> : <button disabled={choice===null || busy} style={button} onClick={() => void retryQuestion(q)}>Check answer</button>}</div>}</div>
      })}</div>}
    </section>}
    {grade && !loading && session && !session.finished && <section style={card}>
      <p style={muted}>{session.subject} · {session.topic}</p>
      <div style={{display:'flex',justifyContent:'space-between',gap:8,margin:'8px 0 18px'}}><strong>Question {session.index+1} of {TARGET}</strong><span>{completed} answered or skipped</span></div>
      {currentQuestion ? <>
        <h2 style={{...heading,fontSize:19,lineHeight:1.5}}>{currentQuestion.question}</h2>
        <div style={{display:'grid',gap:10}}>
          {currentQuestion.options.map((option,i)=><button key={i} disabled={busy || Boolean(currentAnswer)} onClick={() => void answer(i)} style={{...optionButton,background:currentAnswer?.choice === i ? '#e0e7ff':'#fff'}}>{String.fromCharCode(65+i)}. {option}</button>)}
        </div>
        {currentAnswer ? <div role="status" style={{marginTop:16,padding:13,borderRadius:12,background:'#f1f5f9'}}><strong>{currentAnswer.correct === null ? 'Skipped' : currentAnswer.correct ? 'Correct' : 'Not correct'}</strong>{currentAnswer.correctIndex !== null && <p>Correct answer: {String.fromCharCode(65+currentAnswer.correctIndex)}. {currentQuestion.options[currentAnswer.correctIndex]}</p>}{currentAnswer.explanation && <p>{currentAnswer.explanation}</p>}<button style={{...button,marginTop:12}} onClick={next}>{session.index === TARGET-1 ? 'See results' : 'Next'}</button></div> : <button disabled={busy} style={{...secondary,marginTop:14}} onClick={skip}>Skip question</button>}
      </> : <p>This question is no longer available. Choose a new topic.</p>}
    </section>}
    {grade && !loading && !session && <section style={card}>
      <h2 style={heading}>Choose a topic</h2>
      {topics.length === 0 ? <p style={muted}>No five-question topics are ready for {grade} yet. Only approved practice material will appear here.</p> : <div style={{display:'grid',gap:10}}>{topics.map(item => <button key={item.subject+'::'+item.topic} disabled={busy} style={optionButton} onClick={() => void start(item)}><strong>{item.topic}</strong><span style={{display:'block',fontSize:12,color:'#64748b'}}>{item.subject} · {TARGET} questions · {completedTopics.includes(grade+'::'+item.subject+'::'+item.topic) ? 'Practise again' : 'Start'}</span></button>)}</div>}
    </section>}
  </main>
}
const shell:React.CSSProperties={maxWidth:760,margin:'0 auto',padding:'20px 14px 120px',color:'var(--vs-text)',minHeight:'70vh'}
const card:React.CSSProperties={padding:20,background:'var(--vs-card)',border:'1px solid var(--vs-border)',borderRadius:16,marginTop:16}
const heading:React.CSSProperties={fontSize:17,margin:'0 0 14px'}
const muted:React.CSSProperties={fontSize:13,color:'var(--vs-muted)',lineHeight:1.6}
const grid:React.CSSProperties={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))',gap:10}
const button:React.CSSProperties={border:0,background:'#4f46e5',color:'#fff',borderRadius:11,padding:'13px 17px',minHeight:44,fontWeight:800,cursor:'pointer'}
const secondary:React.CSSProperties={...button,background:'transparent',color:'var(--vs-text)',border:'1px solid var(--vs-border)',marginLeft:8}
const plain:React.CSSProperties={border:0,background:'transparent',color:'#6366f1',padding:'8px 0',fontSize:13,fontWeight:700,cursor:'pointer'}
const optionButton:React.CSSProperties={border:'1px solid var(--vs-border)',borderRadius:12,padding:15,minHeight:54,textAlign:'left',color:'var(--vs-text)',background:'var(--vs-card)',fontFamily:'inherit',fontSize:15,cursor:'pointer'}
