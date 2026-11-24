'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getRevisionWorkspace } from '@/lib/student/vibelearn'
import { getMyRevisionMemory } from '@/lib/student/revisionMemory'
import { learnerRevisionGrade, listRevisionTopics } from '@/lib/student/revisionTopic'

type Reading={records:number;completed:number}
type Practice={attempts:number;correct:number;open:number;resolved:number}
type Recall={items:number;due:number}
type Recovery={outcomes:number;qualifyingCases:number}
type Result<T>={status:'loading'|'error'}|{status:'ready';data:T}
const initial=<T,>():Result<T>=>({status:'loading'})
const record=(v:unknown):Record<string,unknown>=>v && typeof v==='object' && !Array.isArray(v)?v as Record<string,unknown>:{}
async function readingCounts(profileId:string):Promise<Reading>{
  const [records,completed]=await Promise.all([
    supabase.from('vibe_reading_progress').select('chapter_id',{count:'exact',head:true}).eq('viewer_id',profileId),
    supabase.from('vibe_reading_progress').select('chapter_id',{count:'exact',head:true}).eq('viewer_id',profileId).not('completed_at','is',null),
  ])
  if(records.error||completed.error||records.count===null||completed.count===null)throw new Error('Reading records unavailable')
  return {records:records.count,completed:completed.count}
}
async function practiceCounts():Promise<Practice>{
  const {journey}=await getRevisionWorkspace()
  return {attempts:journey.practiceAttempts,correct:journey.correctAnswers,open:journey.openMistakes,resolved:journey.resolvedMistakes}
}
async function recallCounts(className:string):Promise<Recall>{
  const grade=learnerRevisionGrade(className)
  const [mistakes,topics]=await Promise.all([getMyRevisionMemory(),grade?listRevisionTopics(grade):Promise.resolve([])])
  const saved= [...mistakes,...topics].filter(item=>item.recallCount>0)
  return {items:saved.length,due:saved.filter(item=>item.nextReviewAt && Date.parse(item.nextReviewAt)<=Date.now()).length}
}
async function recoveryCounts():Promise<Recovery>{
  const {data,error}=await supabase.rpc('student_get_exact_learning_recovery' as never,{p_attempt_id:null,p_limit:80})
  const payload=record(data)
  if(error||payload.ok!==true||!Array.isArray(payload.cases))throw new Error('Outcome evidence unavailable')
  const cases=new Map<string,Record<string,unknown>>()
  for(const raw of payload.cases){
    const item=record(raw)
    if(item.identity_state==='verified'&&typeof item.outcome_id==='string'&&typeof item.recovery_key==='string')cases.set(item.recovery_key,item)
  }
  return {outcomes:new Set([...cases.values()].map(item=>item.outcome_id)).size,qualifyingCases:[...cases.values()].filter(item=>item.recovery_evidence_met===true).length}
}
function useSource<T>(loader:()=>Promise<T>,scope:string,retry:number):Result<T>{
  const [state,setState]=useState<Result<T>>(initial<T>)
  useEffect(()=>{
    let active=true
    setState(initial<T>())
    void loader().then(data=>{if(active)setState({status:'ready',data})},()=>{if(active)setState({status:'error'})})
    return()=>{active=false}
  },[loader,scope,retry])
  return state
}
const tile:React.CSSProperties={border:'1px solid var(--vs-border)',borderRadius:12,padding:12,background:'var(--vs-card)',display:'grid',gap:7,minWidth:0}
const muted:React.CSSProperties={fontSize:12,lineHeight:1.5,color:'var(--vs-muted)',margin:0}
const action:React.CSSProperties={fontSize:13,fontWeight:700,color:'var(--vs-accent)',minHeight:40,display:'inline-flex',alignItems:'center'}
function EvidenceTile<T>({title,result,href,label,children}:{title:string;result:Result<T>;href:string;label:string;children:(data:T)=>React.ReactNode}){
  return <article style={tile}><h3 style={{fontSize:14,margin:0}}>{title}</h3>
    {result.status==='ready'?children(result.data):<p role="status" style={muted}>{result.status==='loading'?'Loading…':'Unavailable. Try refreshing.'}</p>}
    <Link href={href} style={action}>{label} ›</Link>
  </article>
}
export default function LearningEvidenceOverview(props:{studentId:string;profileId:string;className:string}){
  return <LearningEvidenceSession key={JSON.stringify([props.studentId,props.profileId,props.className])} {...props}/>
}
function LearningEvidenceSession({studentId,profileId,className}:{studentId:string;profileId:string;className:string}){
  const [retry,setRetry]=useState(0)
  const scope=JSON.stringify([studentId,profileId,className])
  const loadReading=useCallback(()=>readingCounts(profileId),[profileId])
  const loadRecall=useCallback(()=>recallCounts(className),[className])
  const reading=useSource(loadReading,scope,retry)
  const practice=useSource(practiceCounts,scope,retry)
  const recall=useSource(loadRecall,scope,retry)
  const recovery=useSource(recoveryCounts,scope,retry)
  const failed=[reading,practice,recall,recovery].some(item=>item.status==='error')
  return <section aria-label="Learning evidence overview" style={{marginBottom:16,display:'grid',gap:10}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}><h2 style={{fontSize:18,margin:0}}>My learning</h2>
    {failed&&<button type="button" onClick={()=>setRetry(n=>n+1)} style={{...action,background:'transparent',border:0}}>Refresh evidence</button>}</div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,155px),1fr))',gap:9}}>
      <EvidenceTile title="Reading" result={reading} href="/student/study" label="Continue reading">{data=><><strong style={{fontSize:24}}>{data.completed}</strong><p style={muted}>Completed chapter records · {data.records} reading records</p></>}</EvidenceTile>
      <EvidenceTile title="Question practice" result={practice} href="/student/vibelearn/topic-practice" label="Practise">{data=><><strong style={{fontSize:24}}>{data.attempts?Math.round(data.correct/data.attempts*100)+'%':'—'}</strong><p style={muted}>{data.correct} correct / {data.attempts} notebook practice attempts. Assessment scores are separate.</p></>}</EvidenceTile>
      <EvidenceTile title="Recall" result={recall} href="/student/vibelearn/revision" label="Revise">{data=><><strong style={{fontSize:24}}>{data.due}</strong><p style={muted}>Due among {data.items} saved recall items in the loaded revision records.</p></>}</EvidenceTile>
      <EvidenceTile title="Mistakes" result={practice} href="/student/vibelearn/mistakes" label="Review mistakes">{data=><><strong style={{fontSize:24}}>{data.open}</strong><p style={muted}>Open notebook mistakes · {data.resolved} resolved</p></>}</EvidenceTile>
      <EvidenceTile title="Outcome recovery" result={recovery} href="/student/vibelearn/recovery" label="Prove understanding">{data=><><strong style={{fontSize:24}}>{data.outcomes}</strong><p style={muted}>Verified outcomes in recent missed records · {data.qualifyingCases} cases meeting recovery evidence requirements</p></>}</EvidenceTile>
    </div>
    <p style={muted}>Reading, recall, scores and demonstrated understanding are different measures. Records may span earlier grades; outcome recovery covers up to 80 recent cases, not the entire curriculum.</p>
  </section>
}
