'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { saveResponse, startOrResumeAttempt, submitAttempt } from '@/lib/assessment/engine'
import type { AttemptWorkspace, SubmitAttemptResult } from '@/lib/assessment/types'

type Topic = {
  assignment_id:string; subject:string;topic:string;question_count:number
  in_progress:boolean;completed_attempts:number;max_attempts:number
}
type Feedback = {
  item_id:string; skipped:boolean; correct:boolean|null
  selected:string|null;correct_answer:string|null;explanation:string|null
}
function arrayOfRecords(value:unknown):Record<string,unknown>[] {
  return Array.isArray(value) ? value.filter((row):row is Record<string,unknown> => Boolean(row && typeof row==='object' && !Array.isArray(row))) : []
}
function parseTopics(value:unknown):Topic[] {
  return arrayOfRecords(value).flatMap(row =>
    typeof row.assignment_id==='string' && typeof row.subject==='string' && typeof row.topic==='string' &&
    row.question_count===5 && typeof row.max_attempts==='number'
      ? [{assignment_id:row.assignment_id,subject:row.subject,topic:row.topic,
        question_count:5,in_progress:row.in_progress===true,
        completed_attempts:typeof row.completed_attempts==='number'?row.completed_attempts:0,
        max_attempts:row.max_attempts}] : []
  )
}
function parseFeedback(value:unknown):Feedback[] {
  return arrayOfRecords(value).flatMap(row =>
    typeof row.item_id==='string' ? [{item_id:row.item_id,skipped:row.skipped===true,
      correct:typeof row.correct==='boolean'?row.correct:null,
      selected:typeof row.selected==='string'?row.selected:null,
      correct_answer:typeof row.correct_answer==='string'?row.correct_answer:null,
      explanation:typeof row.explanation==='string'?row.explanation:null}] : []
  )
}
function optionsOf(value:unknown):Array<{value:string;label:string}> {
  return arrayOfRecords(value).flatMap(row=>
    typeof row.value==='string' && typeof row.label==='string'
      ? [{value:row.value,label:row.label}] : [])
}
async function fetchTopics(grade:string):Promise<Topic[]> {
  const {data,error} = await supabase.rpc('student_list_canonical_topic_practice' as never,{p_grade:grade})
  if (error) throw new Error(error.message)
  return parseTopics(data)
}
async function fetchFeedback(attemptId:string):Promise<Feedback[]> {
  const {data,error} = await supabase.rpc('student_get_canonical_topic_practice_feedback' as never,{p_attempt_id:attemptId})
  if (error) throw new Error(error.message)
  return parseFeedback(data)
}
const shell:React.CSSProperties={maxWidth:760,margin:'0 auto',padding:'20px 14px 120px',color:'var(--vs-text)'}
const card:React.CSSProperties={padding:18,background:'var(--vs-card)',border:'1px solid var(--vs-border)',borderRadius:16,marginTop:14}
const button:React.CSSProperties={border:0,borderRadius:11,minHeight:46,padding:'11px 16px',color:'#fff',background:'#4f46e5',fontFamily:'inherit',fontSize:14,fontWeight:800,cursor:'pointer'}
const secondary:React.CSSProperties={...button,color:'var(--vs-text)',background:'var(--vs-card)',border:'1px solid var(--vs-border)'}
const muted:React.CSSProperties={fontSize:13,lineHeight:1.55,color:'var(--vs-muted)'}
const optionStyle:React.CSSProperties={...secondary,textAlign:'left',width:'100%',minHeight:54}

export default function CanonicalTopicPractice({grade}:{grade:string}) {
  const router=useRouter()
  const [topics,setTopics]=useState<Topic[]>([])
  const [workspace,setWorkspace]=useState<AttemptWorkspace|null>(null)
  const [feedback,setFeedback]=useState<Feedback[]>([])
  const [index,setIndex]=useState(0)
  const [finished,setFinished]=useState<SubmitAttemptResult|null>(null)
  const [reviewing,setReviewing]=useState(false)
  const [busy,setBusy]=useState(false)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const refresh=useCallback(async()=>{
    const list=await fetchTopics(grade)
    setTopics(list)
  },[grade])
  useEffect(()=>{
    let cancelled=false
    setLoading(true)
    void fetchTopics(grade).then(list=>{if(!cancelled)setTopics(list)})
      .catch(cause=>{if(!cancelled)setError(cause instanceof Error?cause.message:'Topics could not be loaded.')})
      .finally(()=>{if(!cancelled)setLoading(false)})
    return ()=>{cancelled=true}
  },[grade])
  async function open(topic:Topic) {
    if(busy)return
    setBusy(true);setError('')
    try {
      const attempt=await startOrResumeAttempt(topic.assignment_id)
      if(attempt.items.length!==5 || attempt.timeLimitMinutes!==null) throw new Error('This practice set does not meet the five-question, untimed contract.')
      const marks=await fetchFeedback(attempt.attemptId)
      const first=attempt.items.findIndex(item=>!attempt.responses.some(response=>response.assessmentItemId===item.id))
      setWorkspace(attempt);setFeedback(marks)
      setIndex(first<0?5:first)
      setFinished(null);setReviewing(false)
    }catch(cause){setError(cause instanceof Error?cause.message:'Could not open topic practice.')}
    finally{setBusy(false)}
  }
  const item=workspace?.items[index]??null
  const currentFeedback=item?feedback.find(row=>row.item_id===item.id):null
  const options=item?optionsOf(item.options):[]
  const seen=new Set(feedback.map(entry=>entry.item_id))
  const incorrect=feedback.filter(entry=>entry.correct===false).length
  const correct=feedback.filter(entry=>entry.correct===true).length
  const skipped=feedback.filter(entry=>entry.skipped).length
  async function save(value:string|null) {
    if(!workspace || !item || busy || seen.has(item.id))return
    setBusy(true);setError('')
    try{
      // Canonical EXQ saves and owns the response. No alternate attempt record.
      await saveResponse({attemptId:workspace.attemptId,assessmentItemId:item.id,responseValue:value})
      const marks=await fetchFeedback(workspace.attemptId)
      setFeedback(marks)
      setWorkspace(previous=>previous?{...previous,responses:[...previous.responses.filter(response=>response.assessmentItemId!==item.id),{
        assessmentItemId:item.id,responseValue:value,responseText:null,status:'saved',revision:1,clientUpdatedAt:null,lastSavedAt:new Date().toISOString()
      }]}:previous)
    }catch(cause){setError(cause instanceof Error?cause.message:'Your response could not be saved.')}
    finally{setBusy(false)}
  }
  function next() {
    if(!workspace || !item || !seen.has(item.id))return
    setIndex(index+1)
  }
  async function finish() {
    if(!workspace || busy || feedback.length!==5)return
    setBusy(true);setError('')
    try{
      const result=await submitAttempt(workspace.attemptId)
      setFinished(result)
      setFeedback(await fetchFeedback(workspace.attemptId))
      await refresh()
    }catch(cause){setError(cause instanceof Error?cause.message:'The practice attempt could not be submitted.')}
    finally{setBusy(false)}
  }
  return <main style={shell}>
    <button style={secondary} onClick={()=>workspace?setWorkspace(null):router.push('/student/vibelearn')}>{workspace?'Choose topic':'← Learn'}</button>
    <h1 style={{fontSize:26,margin:'16px 0 6px'}}>Topic Practice</h1>
    <p style={muted}>{grade} · Five questions · No timer or class code</p>
    {error && <div role='alert' style={{...card,borderColor:'#fda4af',color:'#be123c'}}>{error}</div>}
    {loading && <div style={card}>Loading available topics…</div>}
    {!loading && !workspace && <section style={card}>
      <h2 style={{fontSize:18,margin:'0 0 12px'}}>Choose a topic</h2>
      {topics.length===0?<p style={muted}>No five-question topics are ready yet. Only approved, published practice will appear here.</p>:<div style={{display:'grid',gap:10}}>
        {topics.map(topic=><button key={topic.assignment_id} disabled={busy||(!topic.in_progress&&topic.completed_attempts>=topic.max_attempts)} onClick={()=>void open(topic)} style={{...optionStyle,display:'flex',justifyContent:'space-between',alignItems:'center',gap:14}}>
          <span><strong style={{display:'block'}}>{topic.topic}</strong><span style={muted}>{topic.subject} · 5 questions</span></span>
          <strong style={{color:'#4f46e5'}}>{topic.in_progress?'Continue':topic.completed_attempts>0?(topic.completed_attempts<topic.max_attempts?'Practise again':'Completed'):'Start'}</strong>
        </button>)}
      </div>}
    </section>}
    {workspace && !finished && <section style={card}>
      <p style={muted}>{workspace.title}</p>
      {item ? <>
        <p style={{fontWeight:800,fontSize:14}}>Question {index+1} of 5</p>
        <h2 style={{fontSize:19,lineHeight:1.5,margin:'12px 0 18px'}}>{item.prompt}</h2>
        <div style={{display:'grid',gap:10}}>
          {options.map(option=><button key={option.value} disabled={busy||seen.has(item.id)} style={{...optionStyle,background:currentFeedback?.selected===option.value?'#e0e7ff':'var(--vs-card)'}} onClick={()=>void save(option.value)}><strong>{option.value}.</strong> {option.label}</button>)}
        </div>
        {currentFeedback?<div role='status' style={{...card,background:'var(--vs-bg)'}}>
          <strong>{currentFeedback.skipped?'Skipped':currentFeedback.correct?'Correct':'Not correct'}</strong>
          {currentFeedback.correct_answer && <p>Correct answer: {currentFeedback.correct_answer}. {options.find(option=>option.value===currentFeedback.correct_answer)?.label}</p>}
          {currentFeedback.explanation && <p style={muted}>{currentFeedback.explanation}</p>}
          <button style={button} onClick={next}>{index===4?'Finish':'Next'}</button>
        </div>:<button disabled={busy} style={{...secondary,marginTop:14}} onClick={()=>void save(null)}>Skip</button>}
      </>:<>
        <h2 style={{fontSize:18}}>All five questions completed</h2>
        <p style={muted}>Check the summary and finish to save your official result.</p>
        <button disabled={busy||feedback.length!==5} style={button} onClick={()=>void finish()}>{busy?'Submitting…':'Finish practice'}</button>
      </>}
    </section>}
    {workspace && finished && <section style={card}>
      <h2 style={{fontSize:20}}>Practice complete</h2>
      <p style={{fontSize:17,fontWeight:800}}>{correct} correct · {incorrect} incorrect · {skipped} skipped</p>
      <button style={button} onClick={()=>setReviewing(true)}>Review mistakes</button>
      <button style={{...secondary,marginLeft:8}} onClick={()=>{setWorkspace(null);setFinished(null);setFeedback([]);setReviewing(false)}}>Choose another topic</button>
      {reviewing && <div style={{display:'grid',gap:10,marginTop:16}}>{workspace.items.filter(question=>feedback.some(mark=>mark.item_id===question.id&&mark.correct!==true)).map(question=>{
        const mark=feedback.find(row=>row.item_id===question.id)
        const options=optionsOf(question.options)
        return <article key={question.id} style={{padding:12,border:'1px solid var(--vs-border)',borderRadius:12}}>
          <strong>{question.prompt}</strong>
          <p style={muted}>{mark?.skipped?'Skipped':'Incorrect'} · Correct answer: {mark?.correct_answer} {options.find(option=>option.value===mark?.correct_answer)?.label}</p>
          {mark?.explanation && <p style={muted}>{mark.explanation}</p>}
        </article>
      })}</div>}
    </section>}
  </main>
}
