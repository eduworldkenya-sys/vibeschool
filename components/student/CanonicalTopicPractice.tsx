'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Clock3, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import styles from './CanonicalTopicPractice.module.css'
import LearningNotebookPrompt from '@/components/learn/LearningNotebookPrompt'
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
const button:React.CSSProperties={border:0,borderRadius:11,minHeight:44,padding:'10px 14px',color:'var(--vs-on-accent)',background:'var(--vs-accent)',fontFamily:'inherit',fontSize:13,fontWeight:800,cursor:'pointer'}
const secondary:React.CSSProperties={...button,color:'var(--vs-text)',background:'var(--vs-card)',border:'1px solid var(--vs-border)'}
const muted:React.CSSProperties={fontSize:13,lineHeight:1.45,color:'var(--vs-muted)'}
const optionStyle:React.CSSProperties={...secondary,textAlign:'left',width:'100%',minHeight:48}

export default function CanonicalTopicPractice({grade,subject='',topic=''}:{grade:string;subject?:string;topic?:string}) {
  const router=useRouter()
  const {play}=useLearningFeedback()
  const surfaceRef=useRef<HTMLElement|null>(null)
  const [visibleHeight,setVisibleHeight]=useState<number|null>(null)
  // Measure the actual usable space above the fixed bottom navigation.
  // This accounts for OfflineBar, Focus Mode and browser viewport changes.
  useEffect(()=>{
    const measure=()=>{
      const surface=surfaceRef.current
      if(!surface)return
      const viewport=window.visualViewport?.height??window.innerHeight
      const mobile=window.matchMedia('(max-width:1023px)').matches
      const nav=mobile?document.querySelector('nav[aria-label="Student primary navigation"]'):null
      const navTop=nav?.getBoundingClientRect().top??viewport
      const bottom=mobile?Math.min(viewport,navTop):viewport
      const usable=Math.max(240,Math.floor(bottom-surface.getBoundingClientRect().top-8))
      setVisibleHeight(previous=>previous===usable?previous:usable)
    }
    measure()
    window.addEventListener('resize',measure)
    window.visualViewport?.addEventListener('resize',measure)
    const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(measure):null
    const app=surfaceRef.current?.closest('.student-app')
    if(app)Array.from(app.children).slice(0,3).forEach(child=>observer?.observe(child))
    return()=>{
      window.removeEventListener('resize',measure)
      window.visualViewport?.removeEventListener('resize',measure)
      observer?.disconnect()
    }
  },[])

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
  return <main ref={surfaceRef} className={styles.shell} style={visibleHeight===null?undefined:{height:visibleHeight}}>
    {error && <div role="alert" className={styles.alert}>
      {error}{!workspace && <button type="button" style={{...secondary,minHeight:30,marginLeft:8}} disabled={loading||busy} onClick={()=>{setError('');void refresh().catch(cause=>setError(cause instanceof Error?cause.message:'Could not reload topics.'))}}>Retry</button>}
    </div>}
    {!workspace && <section className={styles.screen} aria-label="Practice topics">
      <div className={styles.eyebrow}>{subjectFilter || (subjects.length===1?subjects[0]:'Topic Practice')}</div>
      <div className={styles.titleRow}>
        <h1 className={styles.heading}>Practice</h1>
        <span className={styles.count}>{loading?'Loading…':topicCards.length+' topic'+(topicCards.length===1?'':'s')}</span>
      </div>
      {subjects.length>1 && <div className={styles.filters} aria-label="Filter topics by subject">
        {['',...subjects].map(value=><button key={value||'all'} type="button" aria-pressed={subjectFilter===value} onClick={()=>setSubjectFilter(value)}>{value||'All'}</button>)}
      </div>}
      {loading ? <div role="status" className={styles.empty}>Loading topics…</div>
        : topicCards.length===0 ? <div className={styles.empty}>
          <BookOpen size={24} color="var(--vs-accent)" aria-hidden="true"/>
          <strong>{topics.length?'No matching topics':'No ready topics yet'}</strong>
          {topics.length>0 && <button type="button" style={secondary} onClick={()=>{setSubjectFilter('');router.replace('/student/vibelearn/topic-practice')}}>All topics</button>}
          {topics.length===0 && <button type="button" style={secondary} onClick={()=>void refresh().catch(cause=>setError(cause instanceof Error?cause.message:'Could not reload topics.'))}>Retry</button>}
          {topics.length===0 && <button type="button" style={secondary} onClick={()=>router.push('/student/vibelearn/exams')}>Browse Exams</button>}
        </div>
        : <div className={styles.topicList}>
          {topicCards.map(card=><button key={card.key} type="button" className={styles.topic} disabled={busy||card.remaining===0} onClick={()=>void open(card.preferred)}>
            <span className={styles.topicIcon}><BookOpen size={20} aria-hidden="true"/></span>
            <span className={styles.topicText}><strong>{card.title}</strong><small>{card.count} set{card.count===1?'':'s'} · Untimed</small></span>
            <span className={styles.topicGo}>{card.preferred.in_progress?'Continue':card.remaining===0?'Done':card.preferred.completed_attempts>0?'Again':''}<ArrowRight size={18} aria-hidden="true"/></span>
          </button>)}
        </div>}
    </section>}
    {workspace && !finished && <section className={styles.screen} aria-label="Practice question">
      <div className={styles.questionTop}>
        <div className={styles.topline}>
          <button type="button" className={styles.back} onClick={()=>{setWorkspace(null);setFinished(null);setFeedback([]);setReviewing(false)}}><ArrowLeft size={15} aria-hidden="true"/>Topics</button>
          <button type="button" className={styles.back} onClick={()=>router.push('/student/study')}>Save &amp; exit</button>
        </div>
        <div className={styles.questionTitle}><span>{workspace.title.replace(/^Grade\s*\d+\s*Mathhematics\s*[—–-]\s*/i,'').replace(/\s*[·•]\s*Topic Practice Batch\s*\d+.*$/i,'')}</span><span className={styles.meta}><Clock3 size={14} style={{verticalAlign:'middle'}} aria-hidden="true"/> Untimed</span></div>
        <div role="progressbar" aria-label="Practice questions recorded" aria-valuemin={0} aria-valuemax={5} aria-valuenow={savedCount} className={styles.progress}>
          {workspace.items.map(question=><span key={question.id} className={styles.progressSegment}><span className={styles.progressFill} style={{display:'block',width:seen.has(question.id)?'100%':'0%'}}/></span>)}
        </div>
      </div>
      {item ? <>
        <div className={styles.questionCard}>
          <div className={styles.questionNumber}>QUESTION {index+1} OF 5</div>
          <h2 className={styles.prompt}>{item.prompt}</h2>
          {(item.hint || !seen.has(item.id)) && <details className={styles.help}>
            <summary>Working / Hint</summary>
            <LearningNotebookPrompt subject={workspace.title} stage="practice" compact />
            {item.hint && <p>{item.hint}</p>}
          </details>}
        </div>
        <div className={styles.options} role="group" aria-label="Choose an answer">
          {options.map((option,i)=><button key={option.value} type="button" className={styles.option} disabled={busy||seen.has(item.id)} aria-pressed={selectedValue===option.value} onClick={()=>void save(option.value)}>
            <span className={styles.optionLabel}>{String.fromCharCode(65+i)}</span><span style={{minWidth:0,flex:1}}>{option.label}</span>
            {currentFeedback?.correct_answer===option.value && <CheckCircle2 size={16} color="var(--vs-accent)" aria-hidden="true"/>}
          </button>)}
        </div>
        <div className={styles.feedbackBar} role="status" aria-live="polite">
          {seen.has(item.id) ? currentFeedback
            ? <><span>{currentFeedback.skipped?'Skipped':currentFeedback.correct?'Correct':'Not quite'}</span>
               <details><summary>Why?</summary><LearningFeedback status={currentFeedback.skipped?'skipped':currentFeedback.correct?'correct':'incorrect'}
                 answer={currentFeedback.correct_answer ? currentFeedback.correct_answer+'. '+(options.find(option=>option.value===currentFeedback.correct_answer)?.label??'') : null}
                 explanation={currentFeedback.explanation}><span /></LearningFeedback></details></>
            : <><span>Answer saved</span><button type="button" className={styles.back} style={{minHeight:25,padding:'2px 7px'}} disabled={busy} onClick={()=>void retryFeedback()}>Retry feedback</button></>
            : busy?'Saving…':''}
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.action+' '+styles.actionSecondary} disabled={busy||seen.has(item.id)} onClick={()=>void save(null)}>Skip</button>
          <button type="button" className={styles.action+' '+styles.actionPrimary} disabled={busy||!seen.has(item.id)} onClick={next}>{index===4?'Finish':'Next'} <ArrowRight size={15} style={{verticalAlign:'middle'}} aria-hidden="true"/></button>
        </div>
      </> : <div className={styles.finish}>
        <h2 style={{fontSize:20,marginBottom:12}}>All five recorded</h2>
        <p style={muted} role="status">{everyAnswerSaved?'Ready to finish.':'Finish after all five answers are saved.'}</p>
        <button type="button" disabled={busy||!everyAnswerSaved} style={{...button,marginTop:16}} onClick={()=>void finish()}>{busy?'Submitting…':'Finish practice'}</button>
      </div>}
    </section>}
    {workspace && finished && <section className={styles.finish}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}><Sparkles size={25} color="var(--vs-accent)" aria-hidden="true"/><h2 style={{fontSize:23,margin:0}}>Practice complete!</h2></div>
      {finished.scoreReleased && finished.score!==null && finished.maxScore!==null
        ? <p style={{fontSize:23,fontWeight:800,margin:'10px 0'}}>{finished.score} / {finished.maxScore} marks{finished.percentage!==null ? ` · ${Math.round(finished.percentage)}%` : ''}</p>
        : <p role="status" style={muted}>Your attempt is saved. The result is not yet released.</p>}
      {feedbackReady
        ? <div aria-label="Answer summary" style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:8,marginBottom:16}}>{[{label:'Correct',value:correct},{label:'Incorrect',value:incorrect},{label:'Skipped',value:skipped}].map(entry=><div key={entry.label} style={{padding:12,borderRadius:12,background:'var(--vs-soft)',textAlign:'center'}}><strong style={{display:'block',fontSize:22}}>{entry.value}</strong><span style={muted}>{entry.label}</span></div>)}</div>
        : <p role="status" style={muted}>Your attempt is saved. Detailed review is temporarily unavailable. Your recorded score is not being estimated from missing feedback.</p>}
      {finished.scoreReleased && <button style={{...secondary,marginRight:8,marginBottom:8}} onClick={()=>router.push('/student/results/'+encodeURIComponent(finished.attemptId)+'?from=topic-practice')}>View saved result</button>}
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
