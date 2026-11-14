'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ChevronRight, Clock3, History, RotateCcw, TrendingUp } from 'lucide-react'
import { useStudent } from '@/lib/student-context'
import { supabase } from '@/lib/supabase'

type SavedAttempt = {
  attemptId: string
  attemptNumber: number
  submittedAt: string | null
  resultAvailable: boolean
  score: number | null
  maxScore: number | null
  percentage: number | null
}
type ActiveAttempt = { attemptId: string; attemptNumber: number; savedAnswers: number; totalQuestions: number }
type TopicProgress = {
  assignmentId: string; subject: string; topic: string
  completedAttempts: number; activeAttempt: ActiveAttempt | null; attempts: SavedAttempt[]
}
function obj(value:unknown):Record<string,unknown>|null {
  return value && typeof value==='object' && !Array.isArray(value) ? value as Record<string,unknown> : null
}
function num(value:unknown):number|null {
  if (value===null||value===undefined)return null
  const result=Number(value)
  return Number.isFinite(result)?result:null
}
function parseHistory(value:unknown):TopicProgress[] {
  if(!Array.isArray(value))throw new Error('Practice progress returned an invalid response.')
  return value.flatMap((raw):TopicProgress[]=>{
    const t=obj(raw)
    if(!t||typeof t.assignment_id!=='string'||typeof t.subject!=='string'||typeof t.topic!=='string')return []
    const a=obj(t.active_attempt)
    const active=a&&typeof a.attempt_id==='string'?{
      attemptId:a.attempt_id,attemptNumber:num(a.attempt_number)??1,
      savedAnswers:num(a.saved_answers)??0,totalQuestions:num(a.total_questions)??5
    }:null
    const attempts=(Array.isArray(t.attempts)?t.attempts:[]).flatMap((rawAttempt):SavedAttempt[]=>{
      const item=obj(rawAttempt)
      if(!item||typeof item.attempt_id!=='string')return []
      const available=item.result_available===true
      return [{
        attemptId:item.attempt_id,attemptNumber:num(item.attempt_number)??0,
        submittedAt:typeof item.submitted_at==='string'?item.submitted_at:null,
        resultAvailable:available,score:available?num(item.score):null,
        maxScore:available?num(item.max_score):null,
        percentage:available?num(item.percentage):null
      }]
    })
    return [{
      assignmentId:t.assignment_id,subject:t.subject,topic:t.topic,
      completedAttempts:num(t.completed_attempts)??attempts.length,
      activeAttempt:active,attempts
    }]
  })
}
const shell:React.CSSProperties={maxWidth:990,margin:'0 auto',padding:'22px 16px 120px',color:'var(--vs-text)'}
const card:React.CSSProperties={background:'var(--vs-card)',border:'1px solid var(--vs-border)',borderRadius:18,padding:20}
const muted:React.CSSProperties={color:'var(--vs-muted)',fontSize:13,lineHeight:1.5}
const accent:React.CSSProperties={color:'var(--vs-accent)',fontWeight:800,textDecoration:'none'}
const primary:React.CSSProperties={display:'inline-flex',justifyContent:'center',alignItems:'center',gap:9,background:'var(--vs-accent)',color:'var(--vs-on-accent, #fff)',padding:'12px 16px',borderRadius:12,fontWeight:800,textDecoration:'none',minHeight:44}
const shortDate=(iso:string|null)=>iso?new Intl.DateTimeFormat('en-KE',{day:'numeric',month:'short',year:'numeric',timeZone:'Africa/Nairobi'}).format(new Date(iso)):'Date unavailable'
const scoreLabel=(attempt:SavedAttempt)=>attempt.score!==null&&attempt.maxScore!==null?`${attempt.score}/${attempt.maxScore}`:'Result unavailable'

export default function TopicPracticeProgressPage(){
  const {identity,loading:identityLoading}=useStudent()
  const params=useSearchParams()
  const subject=params.get('subject')?.trim().toLowerCase()??''
  const [topics,setTopics]=useState<TopicProgress[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const className=identity?.className?.trim()??''
  const match=className.match(/^(Grade\s*(?:[1-9]|1[0-2])|Form\s*[1-4])(?:\s+.+)?$/i)
  const grade=match?.[1]?.replace(/\s+/g,' ').replace(/^grade/i,'Grade').replace(/^form/i,'Form')??''
  const supported=/^grade\s*(?:4|9)$/i.test(grade)

  const load=useCallback(async()=>{
    if(!identity||!supported){setLoading(false);return}
    setLoading(true);setError('')
    try{
      const {data,error:rpcError}=await supabase.rpc('student_topic_practice_progress_history' as never,{p_grade:grade})
      if(rpcError)throw new Error(rpcError.message)
      setTopics(parseHistory(data))
    }catch(cause){setError(cause instanceof Error?cause.message:'Could not load practice progress.')}
    finally{setLoading(false)}
  },[identity?.studentId,grade,supported])
  useEffect(()=>{if(!identityLoading)void load()},[identityLoading,load])
  const visible=useMemo(()=>topics.filter(t=>!subject||t.subject.toLowerCase()===subject),[topics,subject])
  const completed=visible.reduce((total,t)=>total+t.completedAttempts,0)
  const activeCount=visible.filter(t=>t.activeAttempt).length
  const released=visible.flatMap(t=>t.attempts).filter(a=>a.resultAvailable&&a.percentage!==null)
  const latestReleased=visible.flatMap(t=>t.attempts).filter(a=>a.resultAvailable&&a.submittedAt).sort((a,b)=>(b.submittedAt??'').localeCompare(a.submittedAt??''))[0]
  const average=released.length?Math.round(released.reduce((sum,a)=>sum+(a.percentage??0),0)/released.length):null

  return <main style={shell}>
    <nav aria-label="Topic Practice progress navigation" style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap',marginBottom:22}}>
      <Link href={'/student/vibelearn/topic-practice'+(subject?'?subject='+encodeURIComponent(subject):'')} style={{...accent,display:'inline-flex',alignItems:'center',gap:7}}><ArrowLeft size={17}/> Topic Practice</Link>
      <Link href="/student/marks" style={{...muted,textDecoration:'none',display:'inline-flex',alignItems:'center',gap:5}}>Overall progress <ChevronRight size={15}/></Link>
    </nav>
    <header style={{marginBottom:20}}>
      <div style={{fontSize:11,letterSpacing:1.2,fontWeight:850,color:'var(--vs-accent)',marginBottom:9}}>VIBELEARN · MY PRACTICE</div>
      <h1 style={{fontSize:'clamp(27px,4vw,38px)',letterSpacing:'-.04em',margin:'0 0 8px'}}>Topic Practice progress</h1>
      <p style={{...muted,margin:0}}>Your attempts, saved work and released results — separate from your overall learner report.</p>
    </header>
    {identityLoading||loading?<section style={card} role="status">Loading your saved practice history…</section>:
     !identity?<section style={card}>Sign in to see your own practice progress.</section>:
     !supported?<section style={card}>Topic Practice progress is currently available for Grade 4 and Grade 9.</section>:
     error?<section style={card} role="alert"><p>{error}</p><button type="button" onClick={()=>void load()} style={{...primary,border:0,cursor:'pointer'}}>Try again</button></section>:
     <>
       <section aria-label="Practice summary" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:12,marginBottom:18}}>
         {[
           {label:'Completed attempts',value:String(completed),icon:<CheckCircle2 size={19}/>},
           {label:'Active practice',value:String(activeCount),icon:<Clock3 size={19}/>},
           {label:'Average released score',value:average===null?'—':average+'%',icon:<TrendingUp size={19}/>}
         ].map(metric=><div key={metric.label} style={{...card,padding:18,display:'grid',gap:7}}>
           <span style={{color:'var(--vs-accent)'}}>{metric.icon}</span><strong style={{fontSize:28,letterSpacing:'-.03em'}}>{metric.value}</strong>
           <span style={muted}>{metric.label}</span>
         </div>)}
       </section>
       {visible.length===0?<section style={card}>No published practice sets match this subject yet. <Link href="/student/vibelearn/topic-practice" style={accent}>Explore available topics</Link></section>:
       <section aria-label="Progress by topic" style={{display:'grid',gap:16}}>
         {visible.map(t=>{
           const latest=t.attempts.find(a=>a.resultAvailable&&a.score!==null&&a.maxScore!==null)
           const scored=t.attempts.filter(a=>a.resultAvailable&&a.percentage!==null)
           const best=scored.length?Math.max(...scored.map(a=>a.percentage??0)):null
           const practiceHref='/student/vibelearn/topic-practice?subject='+encodeURIComponent(t.subject)+'&topic='+encodeURIComponent(t.topic)
           return <article key={t.assignmentId} style={card}>
             <div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap',alignItems:'flex-start'}}>
               <div><span style={{...muted,fontWeight:750}}>{t.subject} · {grade}</span><h2 style={{fontSize:21,margin:'5px 0 6px'}}>{t.topic}</h2></div>
               <span style={{fontSize:12,fontWeight:800,borderRadius:999,padding:'6px 10px',color:'var(--vs-accent)',background:'var(--vs-accent-soft)'}}>{t.activeAttempt?'In progress':'Ready to practise'}</span>
             </div>
             <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(125px,1fr))',gap:9,margin:'17px 0'}}>
               <div style={{padding:13,borderRadius:12,background:'var(--vs-soft)'}}><strong style={{display:'block',fontSize:21}}>{t.completedAttempts}</strong><span style={muted}>Completed</span></div>
               <div style={{padding:13,borderRadius:12,background:'var(--vs-soft)'}}><strong style={{display:'block',fontSize:21}}>{latest?scoreLabel(latest):'—'}</strong><span style={muted}>Latest released</span></div>
               <div style={{padding:13,borderRadius:12,background:'var(--vs-soft)'}}><strong style={{display:'block',fontSize:21}}>{best!==null?Math.round(best)+'%':'—'}</strong><span style={muted}>Best released</span></div>
             </div>
             {t.activeAttempt&&<div style={{background:'var(--vs-accent-soft)',borderRadius:12,padding:14,marginBottom:14}}>
               <div style={{display:'flex',justifyContent:'space-between',gap:10,fontSize:13,fontWeight:800,marginBottom:8}}><span>Current attempt · {t.activeAttempt.savedAnswers} of {t.activeAttempt.totalQuestions} answers saved</span><span>Untimed</span></div>
               <div role="progressbar" aria-label="Saved questions" aria-valuenow={t.activeAttempt.savedAnswers} aria-valuemin={0} aria-valuemax={t.activeAttempt.totalQuestions} style={{height:7,background:'var(--vs-border)',borderRadius:99,overflow:'hidden'}}><div style={{height:'100%',width:Math.min(100,t.activeAttempt.savedAnswers/Math.max(1,t.activeAttempt.totalQuestions)*100)+'%',background:'var(--vs-accent)',borderRadius:99}}/></div>
             </div>}
             <Link href={practiceHref} style={{...primary,width:'100%',boxSizing:'border-box'}}>{t.activeAttempt?'Continue practice':'Practise again'} <ArrowRight size={16}/></Link>
             <div style={{display:'flex',alignItems:'center',gap:8,margin:'23px 0 10px'}}><History size={17} color="var(--vs-accent)"/><h3 style={{fontSize:16,margin:0}}>Attempt history</h3></div>
             {t.attempts.length===0?<p style={muted}>Your completed practice attempts will appear here.</p>:
               <div style={{display:'grid',gap:8}}>{t.attempts.map(a=><div key={a.attemptId} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap',border:'1px solid var(--vs-border)',borderRadius:12,padding:'12px 13px'}}>
                 <div><strong style={{display:'block',fontSize:13}}>Attempt {a.attemptNumber} · {shortDate(a.submittedAt)}</strong><span style={muted}>{a.resultAvailable&&a.score!==null?scoreLabel(a)+(a.percentage!==null?' · '+Math.round(a.percentage)+'%':''):'Result not released'}</span></div>
                 {a.resultAvailable?<Link href={'/student/results/'+encodeURIComponent(a.attemptId)+'?from=topic-practice'} style={{...accent,fontSize:13,display:'inline-flex',gap:5,alignItems:'center'}}>Review <ChevronRight size={15}/></Link>:<span style={muted}>Awaiting result</span>}
               </div>)}</div>}
           </article>
         })}
       </section>}
       {latestReleased&&<p style={{...muted,marginTop:16}}>Scores are shown only for released attempts or immediately marked practice. Formal exam result restrictions remain unchanged.</p>}
       <div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:20}}>
         <Link href="/student/vibelearn/mistakes" style={{...accent,display:'inline-flex',gap:7,alignItems:'center'}}><RotateCcw size={16}/> Review mistakes</Link>
         <Link href="/student/study" style={{...accent,display:'inline-flex',gap:7,alignItems:'center'}}><BookOpen size={16}/> Back to Learn</Link>
       </div>
     </>}
  </main>
}
