'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Outcome = { id:string; text:string; code:string|null; count:number; ready:boolean; latest:number }
type State = { status:'loading'|'error'|'ready'; outcomes:Outcome[] }
const record=(v:unknown):Record<string,unknown> => v && typeof v==='object' && !Array.isArray(v) ? v as Record<string,unknown> : {}

function selectOutcomes(payload:unknown):Outcome[] {
  const response=record(payload)
  if(response.ok!==true || !Array.isArray(response.cases)) throw new Error('Recovery evidence could not be loaded.')
  const groups=new Map<string,Outcome>()
  const seen=new Set<string>()
  for(const raw of response.cases){
    const item=record(raw)
    if(item.identity_state!=='verified' || item.recovery_evidence_met!==false ||
      typeof item.recovery_key!=='string' || typeof item.outcome_id!=='string' ||
      typeof item.outcome_text!=='string' || !item.outcome_text.trim() ||
      !['incorrect','skipped'].includes(String(item.reason))) continue
    if(seen.has(item.recovery_key))continue
    seen.add(item.recovery_key)
    const question=record(item.reassessment)
    const ready=question.outcome_id===item.outcome_id && typeof question.content_block_id==='string'
    const latest=typeof item.missed_at==='string'?Date.parse(item.missed_at)||0:0
    const prior=groups.get(item.outcome_id)
    if(prior){
      prior.count+=1
      prior.ready=prior.ready||ready
      prior.latest=Math.max(prior.latest,latest)
    }else groups.set(item.outcome_id,{id:item.outcome_id,text:item.outcome_text,code:typeof item.outcome_code==='string'?item.outcome_code:null,count:1,ready,latest})
  }
  return [...groups.values()].sort((a,b)=>Number(b.ready)-Number(a.ready)||b.count-a.count||b.latest-a.latest||a.id.localeCompare(b.id))
}

export default function RevisionOutcomeQueue({learnerId,className}:{learnerId:string;className:string}) {
  return <OutcomeQueue key={JSON.stringify([learnerId,className])}/>
}

function OutcomeQueue(){
  const [state,setState]=useState<State>({status:'loading',outcomes:[]})
  const [retry,setRetry]=useState(0)
  useEffect(()=>{
    let active=true
    setState({status:'loading',outcomes:[]})
    void (async()=>{
      try {
        const {data,error}=await supabase.rpc('student_get_exact_learning_recovery' as never,{p_attempt_id:null,p_limit:80})
        if(error)throw error
        const outcomes=selectOutcomes(data)
        if(active)setState({status:'ready',outcomes})
      }catch{
        if(active)setState({status:'error',outcomes:[]})
      }
    })()
    return()=>{active=false}
  },[retry])
  const linkStyle:React.CSSProperties={display:'flex',alignItems:'center',gap:12,justifyContent:'space-between',textDecoration:'none',color:'var(--vs-text)',padding:12,border:'1px solid var(--vs-border)',borderRadius:12,background:'var(--vs-card)',minHeight:48}
  return <section aria-label="Targeted outcome revision" style={{display:'grid',gap:8}}>
    <h2 style={{fontSize:18,margin:0}}>Revise your missed skills</h2>
    <p style={{fontSize:12,color:'var(--vs-muted)',margin:0}}>From recent recorded mistakes and released assessments, including earlier learning. Only verified outcome links are shown.</p>
    {state.status==='loading'?<p role="status">Checking learning evidence…</p>:state.status==='error'?<div role="alert">Targeted revision is unavailable. Your other revision tools still work. <button type="button" onClick={()=>setRetry(n=>n+1)}>Retry</button></div>:
      state.outcomes.length===0?<p style={{fontSize:13,color:'var(--vs-muted)',margin:0}}>No unresolved verified outcomes found in your recent records. This does not mean every skill is mastered.</p>:
      state.outcomes.slice(0,5).map(item=><Link key={item.id} href={'/student/vibelearn/recovery?'+new URLSearchParams({outcome:item.id}).toString()} style={linkStyle}>
        <span style={{minWidth:0,overflowWrap:'anywhere'}}><strong style={{fontSize:14}}>{item.text}</strong><small style={{display:'block',color:'var(--vs-muted)',marginTop:5}}>{item.count} recorded {item.count===1?'miss':'misses'} · {item.ready?'Fresh question available':'Review linked resources'}</small></span><span aria-hidden="true">›</span>
      </Link>)}
    <Link href="/student/vibelearn/mistakes" style={{fontSize:13,fontWeight:700,color:'var(--vs-accent)'}}>See all recorded mistakes</Link>
  </section>
}
