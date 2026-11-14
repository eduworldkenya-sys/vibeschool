'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Clock3, RotateCcw, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import LearningNotebookPrompt from '@/components/learn/LearningNotebookPrompt'
import StudentLearningFeatureLinks from '@/components/student/StudentLearningFeatureLinks'
import LearningFeedback, { playLearningSound, useLearningFeedback } from '@/components/student/LearningFeedback'
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
const button:React.CSSProperties={border:0,borderRadius:11,minHeight:46,padding:'11px 16px',color:'#fff',background:'var(--vs-accent)',fontFamily:'inherit',fontSize:14,fontWeight:800,cursor:'pointer'}
const secondary:React.CSSProperties={...button,color:'var(--vs-text)',background:'var(--vs-card)',border:'1px solid var(--vs-border)'}
const muted:React.CSSProperties={fontSize:13,lineHeight:1.55,color:'var(--vs-muted)'}
const optionStyle:React.CSSProperties={...secondary,textAlign:'left',width:'100%',minHeight:54}
const topicTile:React.CSSProperties={...optionStyle,display:'flex',alignItems:'center',justifyContent:'space-between',gap:14,padding:16,borderRadius:15}
const progressTrack:React.CSSProperties={height:7,flex:1,background:'var(--vs-border)',borderRadius:99,overflow:'hidden'}

export default function CanonicalTopicPractice({grade,subject='',topic=''}:{grade:string;subject?:string;topic?:string}) {
  const router=useRouter()
  const {play}=useLearningFeedback()
  const [topics,setTopics]=useState<Topic[]>([])
  const [subjectFilter,setSubjectFilter]=useState(subject)
  useEffect(()=>setSubjectFilter(subject),[subject])
  const [workspace,setWorkspace]=useState<AttemptWorkspace|null>(null)
  const topicCards=useMemo(()=>{
    const groups=new Map<string,Topic[]>()
    for(const topic of topics){
      const display=topic.topic==='Indices'?'Indices and Logarithms':topic.topic
      const key=topic.subject+'::'+display
      groups.set(key,[...(groups.get(key)??[]),topic])
    }
    return [...groups.entries()].map(([key,sets])=>{
      const preferred=sets.find(item=>item.in_progress)
        ??sets.find(item=>item.completed_attempts===0&&item.max_attempts>0)
        ??sets.find(item=>item.completed_attempts<item.max_attempts)
        ??sets[0]
      const remaining=sets.filter(item=>item.in_progress||item.completed_attempts<item.max_attempts).length
      return {key,title:key.split('::')[1],preferred,count:sets.length,remaining}
    }).sort((a,b)=>a.title.localeCompare(b.title)).filter(card =>
      (!subjectFilter || card.preferred.subject.toLowerCase() === subjectFilter.toLowerCase()) &&
      (!topic || card.title.toLowerCase() === topic.toLowerCase()))
  },[topics,subjectFilter,topic])
  const subjects=useMemo(()=>[...new Set(topics.map(item=>item.subject))].sort(),[topics])
  const [feedback,setFeedback]=useState<Feedback[]>([])
  const [index,setIndex]=useState(0)
  const [finished,setFinished]=useState<SubmitAttemptResult|null>(null)
  const [reviewing,setReviewing]=useState(false)
  const [retryChoices,setRetryChoices]=useState<Record<string,string>>({})
  const [busy,setBusy]=useState(false)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [showExplanation,setShowExplanation]=useState(true)
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
      // The assessment engine owns the attempt. A temporarily unavailable
      // feedback RPC must not lock a learner out of an already saved attempt.
      const marks=await fetchFeedback(attempt.attemptId).catch(() => [] as Feedback[])
      const answered=new Set([...attempt.responses.map(response=>response.assessmentItemId),...marks.map(mark=>mark.item_id)])
      const first=attempt.items.findIndex(item=>!answered.has(item.id))
      setWorkspace(attempt);setFeedback(marks)
      setIndex(first<0?5:first)
      setFinished(null);setReviewing(false);setRetryChoices({})
    }catch(cause){setError(cause instanceof Error?cause.message:'Could not open topic practice.')}
    finally{setBusy(false)}
  }
  const item=workspace?.items[index]??null
  const currentFeedback=item?feedback.find(row=>row.item_id===item.id):null
  const options=item?optionsOf(item.options):[]
  const seen=new Set([...feedback.map(entry=>entry.item_id),...(workspace?.responses??[]).map(response=>response.assessmentItemId)])
  const everyAnswerSaved=workspace?.items.length===5 && workspace.items.every(question=>seen.has(question.id))
  const feedbackReady=feedback.length===5
  const incorrect=feedback.filter(entry=>entry.correct===false).length
  const correct=feedback.filter(entry=>entry.correct===true).length
  const skipped=feedback.filter(entry=>entry.skipped).length
  const savedCount=workspace?.items.filter(question=>seen.has(question.id)).length??0
  const savedResponse=item?workspace?.responses.find(response=>response.assessmentItemId===item.id):null
  const selectedValue=savedResponse?.responseValue === null ? null : typeof savedResponse?.responseValue==='string' ? savedResponse.responseValue : currentFeedback?.selected??null
  async function save(value:string|null) {
    if(!workspace || !item || busy || seen.has(item.id))return
    setBusy(true);setError('')
    try{
      // Canonical EXQ saves and owns the response. No alternate attempt record.
      await saveResponse({attemptId:workspace.attemptId,assessmentItemId:item.id,responseValue:value})
      setWorkspace(previous=>previous?{...previous,responses:[...previous.responses.filter(response=>response.assessmentItemId!==item.id),{
        assessmentItemId:item.id,responseValue:value,responseText:null,status:'saved',revision:1,clientUpdatedAt:null,lastSavedAt:new Date().toISOString()
      }]}:previous)
      try {
        const marks=await fetchFeedback(workspace.attemptId)
        setFeedback(marks)
        const mark=marks.find(entry=>entry.item_id===item.id)
        if(mark)playLearningSound(mark.skipped?'skipped':mark.correct?'correct':'incorrect')
      } catch {
        setError('Your answer was saved, but feedback could not load. Choose topic, then Continue to restore your progress.')
      }
    }catch(cause){setError(cause instanceof Error?cause.message:'Your response could not be saved.')}
    finally{setBusy(false)}
  }
  async function retryFeedback() {
    if(!workspace || busy)return
    setBusy(true);setError('')
    try { setFeedback(await fetchFeedback(workspace.attemptId)) }
    catch { setError('Your answers remain saved. Feedback is temporarily unavailable; you can still finish once all five answers are saved.') }
    finally { setBusy(false) }
  }
  function next() {
    if(!workspace || !item || !seen.has(item.id))return
    setIndex(index+1)
  }
  async function finish() {
    if(!workspace || busy || !everyAnswerSaved)return
    setBusy(true);setError('')
    try{
      // Canonical submission is the authority for marks and completion. Never
      // report a successful submission as failed because a follow-up read failed.
      const result=await submitAttempt(workspace.attemptId)
      setFinished(result)
      play('complete')
      setReviewing(false)
      const [updatedFeedback,updatedTopics]=await Promise.allSettled([
        fetchFeedback(workspace.attemptId),
        fetchTopics(grade),
      ])
      if(updatedFeedback.status==='fulfilled')setFeedback(updatedFeedback.value)
      if(updatedTopics.status==='fulfilled')setTopics(updatedTopics.value)
      if(updatedFeedback.status==='rejected' || updatedTopics.status==='rejected')
        setError('Your practice result is saved. Some review details could not be refreshed; reopen Topic Practice to try again.')
    }catch(cause){setError(cause instanceof Error?cause.message:'The practice attempt could not be submitted.')}
    finally{setBusy(false)}
  }
  return <main style={shell}>
    {!workspace && <StudentLearningFeatureLinks mode="practice" grade={grade} subject={subject}/>}
    <header style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap'}}>
      <button type="button" style={{...secondary,display:'inline-flex',alignItems:'center',gap:7}} onClick={()=>{if(workspace){setWorkspace(null);setFinished(null);setFeedback([])}else router.push('/student/study')}}>
        <ArrowLeft size={16} aria-hidden="true" />{workspace?'Save & exit':'Back to Learn'}
      </button>
      <span style={{...muted,display:'inline-flex',alignItems:'center',gap:6}}><Clock3 size={15} aria-hidden="true"/> Untimed · {grade}</span>
    </header>
    <div style={{margin:'22px 0 18px'}}>
      <p style={{...muted,fontSize:12,fontWeight:800,letterSpacing:1,textTransform:'uppercase',margin:'0 0 6px'}}>VibeLearn / Practise</p>
      <h1 style={{fontSize:'clamp(25px,4vw,34px)',letterSpacing:'-.035em',margin:'0 0 8px'}}>{workspace ? 'Keep going' : 'Ready to practise?'}</h1>
      <p style={{...muted,fontSize:14,margin:0}}>{workspace?'Your answers are saved as you go. Complete all five questions at your own pace.':'Choose a topic, answer five questions and learn from every answer.'}</p>
    </div>
    {error && <div role="alert" style={{...card,borderColor:'#fda4af',color:'#be123c',display:'flex',flexWrap:'wrap',gap:10,alignItems:'center'}}>
      <span style={{flex:1}}>{error}</span>
      {!workspace && <button type="button" disabled={loading||busy} style={secondary} onClick={()=>{setError('');void refresh().catch(cause=>setError(cause instanceof Error?cause.message:'Could not reload topics.'))}}>Try again</button>}
    </div>}
    {loading && !workspace && <div role="status" style={card}>Loading your topics…</div>}
    {!loading && !workspace && <section aria-label="Choose a practice topic" style={{...card,marginTop:0}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:14}}>
        <h2 style={{fontSize:19,margin:0}}>Choose a topic</h2>
        <span style={{...muted,fontSize:12}}>{topicCards.length} available · 5 questions each</span>
      </div>
      {subjects.length>1 && <div aria-label="Filter practice by subject" style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}>
        {['',...subjects].map(value=><button key={value||'all'} type="button" aria-pressed={subjectFilter===value} onClick={()=>setSubjectFilter(value)}
          style={{...secondary,minHeight:36,padding:'7px 13px',borderRadius:999,background:subjectFilter===value?'var(--vs-accent-soft)':'var(--vs-card)',borderColor:subjectFilter===value?'var(--vs-accent)':'var(--vs-border)'}}>{value||'All subjects'}</button>)}
      </div>}
      {topicCards.length===0
        ? <div style={{padding:'18px 4px',display:'grid',gap:10,justifyItems:'start'}}>
          <BookOpen size={29} color="var(--vs-accent)" aria-hidden="true"/>
          <strong>{topics.length?'No topics match this filter.':'Practice topics are being prepared'}</strong>
          <p style={{...muted,margin:0}}>{topics.length?'Try another subject to see available topics.':'Published five-question, untimed sets will appear here automatically. You can continue learning while they are prepared.'}</p>
          {topics.length>0 && <button type="button" style={secondary} onClick={()=>{setSubjectFilter('');router.replace('/student/vibelearn/topic-practice')}}>Show all topics</button>}
          {topics.length===0 && <button type="button" style={secondary} onClick={()=>void refresh().catch(cause=>setError(cause instanceof Error?cause.message:'Could not reload topics.'))}>Check again</button>}
        </div>
        : <div style={{display:'grid',gap:10}}>{topicCards.map(card=><button key={card.key} type="button" disabled={busy||card.remaining===0}
          onClick={()=>void open(card.preferred)} style={{...topicTile,opacity:card.remaining===0?.65:1}}>
          <span style={{display:'flex',alignItems:'center',gap:12,minWidth:0}}>
            <span style={{background:'var(--vs-accent-soft)',padding:11,borderRadius:12,display:'inline-flex',color:'var(--vs-accent)'}}><BookOpen size={20} aria-hidden="true"/></span>
            <span style={{minWidth:0}}><strong style={{display:'block',fontSize:15,marginBottom:3}}>{card.title}</strong>
            <span style={muted}>{card.preferred.subject} · {card.count} set{card.count===1?'':'s'} · No timer</span></span>
          </span>
          <span style={{display:'inline-flex',alignItems:'center',gap:6,color:'var(--vs-accent)',fontWeight:800,whiteSpace:'nowrap'}}>
            {card.preferred.in_progress?'Continue':card.remaining===0?'Completed':card.preferred.completed_attempts>0?'Again':'Start'} <ArrowRight size={17} aria-hidden="true"/>
          </span>
        </button>)}</div>}
    </section>}
    {!workspace && !loading && <nav aria-label="Other learning tools" style={{display:'flex',flexWrap:'wrap',gap:9,marginTop:18}}>
      <button style={secondary} onClick={()=>router.push('/student/vibelearn/revision')}><RotateCcw size={15} style={{verticalAlign:'middle',marginRight:6}}/>Revision</button>
      <button style={secondary} onClick={()=>router.push('/student/marks')}><CheckCircle2 size={15} style={{verticalAlign:'middle',marginRight:6}}/>My progress</button>
      <button style={secondary} onClick={()=>router.push('/student/study')}><BookOpen size={15} style={{verticalAlign:'middle',marginRight:6}}/>Learn</button>
    </nav>}
    {workspace && !finished && <section style={card}>
      <p style={{...muted,margin:'0 0 12px'}}>{workspace.title}</p>
      <div role="progressbar" aria-label="Practice questions recorded" aria-valuemin={0} aria-valuemax={5} aria-valuenow={savedCount} style={{display:'flex',gap:6,margin:'0 0 18px'}}>
        {workspace.items.map(question=><span key={question.id} style={progressTrack}><span style={{display:'block',height:'100%',width:seen.has(question.id)?'100%':'0%',background:'var(--vs-accent)',borderRadius:99}} /></span>)}
      </div>
      <p style={{...muted,margin:'0 0 12px'}}>{savedCount} of 5 recorded · Answers saved automatically</p>
      {item ? <>
        <p style={{fontWeight:800,fontSize:14,letterSpacing:'.02em',color:'var(--vs-accent)'}}>QUESTION {index+1} OF 5</p>
        <h2 style={{fontSize:19,lineHeight:1.5,margin:'12px 0 18px'}}>{item.prompt}</h2>
        <LearningNotebookPrompt subject={workspace.title} stage="practice" compact />
        {item.hint && !seen.has(item.id) && <details style={{padding:'10px 12px',border:'1px solid var(--vs-border)',borderRadius:10,marginBottom:14}}>
          <summary style={{cursor:'pointer',color:'var(--vs-accent)',fontWeight:700}}>Need a hint?</summary>
          <p style={muted}>{item.hint}</p>
        </details>}
        <div style={{display:'grid',gap:10}}>
          {options.map(option=><button key={option.value} type="button" disabled={busy||seen.has(item.id)} aria-pressed={selectedValue===option.value} style={{...optionStyle,display:'flex',alignItems:'center',gap:12,padding:14,borderRadius:13,background:selectedValue===option.value?'var(--vs-accent-soft)':'var(--vs-card)',borderColor:selectedValue===option.value?'var(--vs-accent)':'var(--vs-border)'}} onClick={()=>void save(option.value)}><span style={{border:'1px solid var(--vs-border)',borderRadius:9,padding:'7px 10px',fontWeight:800}}>{option.value}</span><span style={{flex:1}}>{option.label}</span>{currentFeedback?.correct_answer===option.value&&<CheckCircle2 size={18} color="var(--vs-accent)"/>}</button>)}
        </div>
        {seen.has(item.id) && !currentFeedback && <div role="status" style={{...card,background:'var(--vs-soft)'}}>
          <p style={muted}>Answer saved securely. Feedback could not load yet; you can retry feedback or continue without losing your answer.</p>
          <button type="button" disabled={busy} style={secondary} onClick={()=>void retryFeedback()}>{busy?'Loading…':'Retry feedback'}</button>
          <button type="button" disabled={busy} style={{...secondary,marginLeft:8}} onClick={next}>{index===4?'Review & finish':'Next question'}</button>
        </div>}
        {currentFeedback?<LearningFeedback
          status={currentFeedback.skipped?'skipped':currentFeedback.correct?'correct':'incorrect'}
          answer={currentFeedback.correct_answer ? currentFeedback.correct_answer + '. ' + (options.find(option=>option.value===currentFeedback.correct_answer)?.label??'') : null}
          explanation={showExplanation?currentFeedback.explanation:null}>
          <div style={{display:'flex',flexWrap:'wrap',gap:8,alignItems:'center'}}><button style={button} onClick={next}>{index===4?'Review and finish':'Next question'} <ArrowRight size={15} style={{verticalAlign:'middle'}}/></button><button style={secondary} type="button" onClick={()=>setShowExplanation(v=>!v)}>{showExplanation?'Hide explanation':'Show explanation'}</button></div>
        </LearningFeedback>:!seen.has(item.id) && <button disabled={busy} style={{...secondary,marginTop:14}} onClick={()=>void save(null)}>{busy?'Saving…':'Skip question'}</button>}
      </>:<>
        <h2 style={{fontSize:20}}>All five questions recorded</h2>
        <p style={muted}>Check the summary and finish to save your official result.</p>
        <p style={muted} role="status">{everyAnswerSaved ? 'All five answers are recorded. You can finish even if review feedback is temporarily unavailable.' : 'Finish is available after all five answers have been recorded.'}</p>
        <button disabled={busy||!everyAnswerSaved} style={button} onClick={()=>void finish()}>{busy?'Submitting…':'Finish practice'}</button>
      </>}
    </section>}
    {workspace && finished && <section style={card}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}><Sparkles size={25} color="var(--vs-accent)" aria-hidden="true"/><h2 style={{fontSize:23,margin:0}}>Practice complete!</h2></div>
      {finished.scoreReleased && finished.score!==null && finished.maxScore!==null
        ? <p style={{fontSize:23,fontWeight:800,margin:'10px 0'}}>{finished.score} / {finished.maxScore} marks{finished.percentage!==null ? ` · ${Math.round(finished.percentage)}%` : ''}</p>
        : <p role="status" style={muted}>Your attempt is saved. The result is not yet released.</p>}
      {feedbackReady
        ? <div aria-label="Answer summary" style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:8,marginBottom:16}}>{[{label:'Correct',value:correct},{label:'Incorrect',value:incorrect},{label:'Skipped',value:skipped}].map(entry=><div key={entry.label} style={{padding:12,borderRadius:12,background:'var(--vs-soft)',textAlign:'center'}}><strong style={{display:'block',fontSize:22}}>{entry.value}</strong><span style={muted}>{entry.label}</span></div>)}</div>
        : <p role="status" style={muted}>Your attempt is saved. Detailed review is temporarily unavailable. Your recorded score is not being estimated from missing feedback.</p>}
      {finished.scoreReleased && <button style={{...secondary,marginRight:8,marginBottom:8}} onClick={()=>router.push('/student/results/'+encodeURIComponent(finished.attemptId))}>View saved result</button>}
      {feedbackReady && <button style={button} onClick={()=>setReviewing(true)}>{incorrect+skipped>0?'Review mistakes':'Review answers'}</button>}
      {!feedbackReady && <button style={secondary} onClick={()=>void retryFeedback()} disabled={busy}>Reload review feedback</button>}
      <button style={{...secondary,marginLeft:8}} onClick={()=>{setWorkspace(null);setFinished(null);setFeedback([]);setReviewing(false)}}>Choose another topic</button>
      <button style={{...secondary,marginLeft:8}} onClick={()=>router.push('/student/study')}>Back to Learn</button>
      {reviewing && <div style={{display:'grid',gap:10,marginTop:16}}>
        {incorrect+skipped===0 ? <p style={muted}>All five answers were correct. Choose another topic to continue learning.</p>
          : <p style={muted}>Retry missed or skipped questions for learning. These retries do not change your recorded score.</p>}
        {workspace.items.filter(question=>feedback.some(mark=>mark.item_id===question.id&&mark.correct!==true)).map(question=>{
        const mark=feedback.find(row=>row.item_id===question.id)
        const options=optionsOf(question.options)
        const retryChoice=retryChoices[question.id] ?? null
        return <article key={question.id} style={{padding:12,border:'1px solid var(--vs-border)',borderRadius:12}}>
          <strong>{question.prompt}</strong>
          <p style={muted}>{mark?.skipped?'Skipped question':'Question to revise'}</p>
          <div style={{display:'grid',gap:8,marginTop:10}}>
            {options.map(option=><button key={option.value} style={{...optionStyle,background:retryChoice===option.value?'var(--vs-accent-soft)':'var(--vs-card)'}} disabled={retryChoice!==null} onClick={()=>setRetryChoices(prev=>({...prev,[question.id]:option.value}))}>{option.value}. {option.label}</button>)}
          </div>
          {retryChoice!==null && <div role="status" style={{marginTop:12}}>
            <strong>{retryChoice===mark?.correct_answer?'Correct on retry':'Not correct yet'}</strong>
            <p style={muted}>Correct answer: {mark?.correct_answer}. {options.find(option=>option.value===mark?.correct_answer)?.label}</p>
            {mark?.explanation && <p style={muted}>{mark.explanation}</p>}
            <button style={secondary} onClick={()=>setRetryChoices(prev=>{const next={...prev};delete next[question.id];return next})}>Try this question again</button>
          </div>}
        </article>
      })}</div>}
    </section>}
  </main>
}
