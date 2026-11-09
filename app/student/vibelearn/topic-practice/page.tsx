'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStudent } from '@/lib/student-context'
import { supabase } from '@/lib/supabase'
import { recordVibeLearnPracticeAnswer } from '@/lib/student/vibelearn'

type Question = { id:string; subject:string; topic:string; question:string; options:string[] }
type Answer = { questionId:string; choice:number|null; correct:boolean|null; explanation:string|null }
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
  const [session, setSession] = useState<Session|null>(null)
  const [choice, setChoice] = useState<number|null>(null)
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
    setInitialised(true)
  }, [identityLoading, identity, initialised])
  useEffect(() => {
    if (!initialised || !grade) { setLoading(false); return }
    let cancelled = false
    setLoading(true); setError('')
    // Existing bank RPC enforces learner identity, verified provenance and hides answer keys.
    void supabase.rpc('student_list_vibelearn_practice_questions' as never, {
      p_subject:null, p_topic:null, p_form:grade, p_limit:20,
    }).then(({data,error:failure}) => {
      if (cancelled) return
      if (failure) throw failure
      setQuestions(readQuestions(data))
    }).catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Practice questions could not be loaded.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [initialised,grade])
  function remember(next:Session|null) {
    setSession(next); setChoice(null)
    if (!storageKey) return
    try { if (next) window.localStorage.setItem(storageKey,JSON.stringify(next)); else window.localStorage.removeItem(storageKey) } catch { /* browser persistence unavailable */ }
  }
  const topics = useMemo(() => {
    const map = new Map<string,Question[]>()
    for (const question of questions) {
      const key = question.subject + '::' + question.topic
      map.set(key,[...(map.get(key) ?? []),question])
    }
    return [...map.entries()].filter(([,items]) => items.length >= TARGET).map(([key,items]) => ({key,items,subject:items[0].subject,topic:items[0].topic}))
  }, [questions])
  const currentQuestion = session && !session.finished ? questions.find(q => q.id === session.questionIds[session.index]) : null
  const currentAnswer = currentQuestion ? session?.answers.find(a => a.questionId === currentQuestion.id) : null
  const completed = session?.answers.length ?? 0
  const results = {correct:session?.answers.filter(a => a.correct === true).length ?? 0, incorrect:session?.answers.filter(a => a.correct === false).length ?? 0, skipped:session?.answers.filter(a => a.correct === null).length ?? 0}
  function start(items:Question[]) {
    remember({grade,subject:items[0].subject,topic:items[0].topic,questionIds:items.slice(0,TARGET).map(q => q.id),index:0,answers:[],id:crypto.randomUUID(),finished:false})
  }
  async function answer(index:number) {
    if (!currentQuestion || !session || busy || currentAnswer) return
    setBusy(true); setError('')
    try {
      const result = await recordVibeLearnPracticeAnswer({examQuestionId:currentQuestion.id,selectedIndex:index,sessionId:session.id,responseMs:null})
      const row = result && typeof result === 'object' ? result as Record<string,unknown> : {}
      if (typeof row.correct !== 'boolean') throw new Error('Marking did not return a result.')
      remember({...session,answers:[...session.answers,{questionId:currentQuestion.id,choice:index,correct:row.correct,explanation:typeof row.explanation === 'string' ? row.explanation : null}]})
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not mark this answer.') }
    finally { setBusy(false) }
  }
  function skip() {
    if (!session || !currentQuestion || busy || currentAnswer) return
    remember({...session,answers:[...session.answers,{questionId:currentQuestion.id,choice:null,correct:null,explanation:null}]})
  }
  function next() {
    if (!session || !currentAnswer) return
    remember({...session,index:Math.min(TARGET,session.index+1),finished:session.index+1 >= TARGET})
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
      <button style={button} onClick={() => router.push('/student/vibelearn/mistakes')}>Review mistakes</button>
      <button style={secondary} onClick={() => remember(null)}>Choose another topic</button>
    </section>}
    {grade && !loading && session && !session.finished && <section style={card}>
      <p style={muted}>{session.subject} · {session.topic}</p>
      <div style={{display:'flex',justifyContent:'space-between',gap:8,margin:'8px 0 18px'}}><strong>Question {session.index+1} of {TARGET}</strong><span>{completed} answered or skipped</span></div>
      {currentQuestion ? <>
        <h2 style={{...heading,fontSize:19,lineHeight:1.5}}>{currentQuestion.question}</h2>
        <div style={{display:'grid',gap:10}}>
          {currentQuestion.options.map((option,i)=><button key={i} disabled={busy || Boolean(currentAnswer)} onClick={() => void answer(i)} style={{...optionButton,background:currentAnswer?.choice === i ? '#e0e7ff':'#fff'}}>{String.fromCharCode(65+i)}. {option}</button>)}
        </div>
        {currentAnswer ? <div role="status" style={{marginTop:16,padding:13,borderRadius:12,background:'#f1f5f9'}}><strong>{currentAnswer.correct === null ? 'Skipped' : currentAnswer.correct ? 'Correct' : 'Not correct'}</strong>{currentAnswer.explanation && <p>{currentAnswer.explanation}</p>}<button style={{...button,marginTop:12}} onClick={next}>{session.index === TARGET-1 ? 'See results' : 'Next'}</button></div> : <button disabled={busy} style={{...secondary,marginTop:14}} onClick={skip}>Skip question</button>}
      </> : <p>This question is no longer available. Choose a new topic.</p>}
    </section>}
    {grade && !loading && !session && <section style={card}>
      <h2 style={heading}>Choose a topic</h2>
      {topics.length === 0 ? <p style={muted}>No five-question topics are ready for {grade} yet. Only approved practice material will appear here.</p> : <div style={{display:'grid',gap:10}}>{topics.map(item => <button key={item.key} style={optionButton} onClick={() => start(item.items)}><strong>{item.topic}</strong><span style={{display:'block',fontSize:12,color:'#64748b'}}>{item.subject} · 5 questions · Start</span></button>)}</div>}
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
