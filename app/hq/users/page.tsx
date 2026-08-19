"use client"

import { useCallback, useEffect, useState } from "react"
import { hqSupabase } from "@/lib/hq/supabase"
import { HQPage, HQPanel, HQ_THEME as C, hqButtonStyle } from "@/components/hq/HQShell"

type UserRow={id:string;full_name:string|null;role:string|null;account_status:string;created_at:string;school_id:string|null;vc_id:string|null;active_subscription_count:number;last_sign_in_at:string|null}
type UserMetrics={total_users:number;new_24h:number;new_7d:number;new_30d:number;signed_in_24h:number;signed_in_7d:number;signed_in_30d:number;never_signed_in:number;active_accounts:number;unaffiliated_profiles:number;active_subscriptions:number;trialing_subscriptions:number;past_due_subscriptions:number}
type ValueMetrics={north_star:{learners_with_learning_evidence_7d:number;learners_progressing_30d:number;teachers_creating_learning_value_7d:number};activation:{teacher_profiles:number;teachers_with_class:number;student_profiles:number;students_with_canonical_identity:number;parent_profiles:number;parents_linked_to_student:number};learning_7d:{active_learners:number;student_learning_events:number;content_learning_events:number;reading_sessions:number;adaptive_sessions:number};teaching_7d:{active_teachers:number;lesson_plans_created:number;homework_created:number;homework_submissions:number};mastery_30d:{learners_progressing:number;assessed_learners:number;proficient_or_mastered_outcomes:number;adaptive_mastery_gain_sessions:number};schools:{active_30d:number;with_teacher_members:number;with_learning_value_30d:number};coverage:{product_event_kernel_present:boolean;learning_event_kernel_present:boolean;mastery_evidence_present:boolean;cohort_retention_instrumented:boolean;acquisition_attribution_instrumented:boolean;experiment_registry_instrumented:boolean}}
type State<T>={status:"loading"|"live"|"failed";data:T|null;error?:string}
const init=<T,>():State<T>=>({status:"loading",data:null})
const shown=(state:State<unknown>,value:unknown)=>state.status==="live"&&value!==undefined&&value!==null?value:"Unknown"
const sourceTone=(state:State<unknown>)=>state.status==="live"?C.green:state.status==="failed"?C.red:C.muted

function Metric({label,value,sub,accent}:{label:string;value:unknown;sub?:string;accent?:string}){return <div style={{padding:14,border:`1px solid ${C.border}`,borderRadius:12,background:C.panel,minWidth:0}}><div style={{fontSize:10.5,color:C.muted,fontWeight:800,textTransform:"uppercase",letterSpacing:".04em"}}>{label}</div><div style={{fontSize:24,fontWeight:900,marginTop:4,color:accent??C.text}}>{String(value??"Unknown")}</div>{sub&&<div style={{fontSize:10,color:C.muted,marginTop:3,lineHeight:1.45}}>{sub}</div>}</div>}
function Source({label,state}:{label:string;state:State<unknown>}){return <span title={state.error} style={{fontSize:9,fontWeight:850,color:sourceTone(state)}}>{label}: {state.status==="live"?"Live":state.status==="failed"?"Unavailable":"Loading"}</span>}
function Ratio({label,numerator,denominator,state}:{label:string;numerator:number|undefined;denominator:number|undefined;state:State<unknown>}){const known=state.status==="live"&&typeof numerator==="number"&&typeof denominator==="number";const percentage=known&&denominator?Math.round(numerator!/denominator*100):null;return <div style={{padding:"11px 0",borderTop:`1px solid ${C.border}`}}><div style={{display:"flex",justifyContent:"space-between",gap:12,fontSize:12}}><span>{label}</span><b>{known?`${numerator}/${denominator} · ${percentage}%`:"Unknown"}</b></div>{percentage!==null&&<div style={{height:5,borderRadius:999,background:"rgba(255,255,255,.06)",marginTop:7,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(100,percentage)}%`,background:C.green}}/></div>}</div>}
function relativeTime(value:string|null){if(!value)return "Never";const ms=Date.now()-new Date(value).getTime();const min=Math.floor(ms/60000);if(min<1)return "Just now";if(min<60)return `${min}m ago`;const hr=Math.floor(min/60);if(hr<24)return `${hr}h ago`;const d=Math.floor(hr/24);return d<30?`${d}d ago`:new Date(value).toLocaleDateString()}

export default function HQPeople(){
 const[users,setUsers]=useState<UserRow[]>([])
 const[userState,setUserState]=useState<State<UserMetrics>>(init)
 const[valueState,setValueState]=useState<State<ValueMetrics>>(init)
 const[directoryState,setDirectoryState]=useState<State<UserRow[]>>({status:"live",data:[]})
 const[query,setQuery]=useState("")
 const[searching,setSearching]=useState(false)

 const loadOverview=useCallback(async()=>{
  const settled=await Promise.allSettled([hqSupabase.rpc("hq_user_intelligence_overview"),hqSupabase.rpc("hq_founder_value_intelligence")])
  const consume=<T,>(item:PromiseSettledResult<any>):State<T>=>item.status==="rejected"?{status:"failed",data:null,error:String(item.reason)}:item.value.error?{status:"failed",data:null,error:item.value.error.message??"Source unavailable"}:{status:"live",data:item.value.data as T}
  setUserState(consume<UserMetrics>(settled[0]));setValueState(consume<ValueMetrics>(settled[1]))
 },[])
 useEffect(()=>{void loadOverview()},[loadOverview])

 async function searchUsers(){
  const q=query.trim()
  if(q.length<2){setDirectoryState({status:"failed",data:null,error:"Enter at least 2 characters to investigate a specific account."});setUsers([]);return}
  setSearching(true);setDirectoryState({status:"loading",data:null})
  const{data,error}=await hqSupabase.rpc("hq_user_directory",{p_search:q,p_limit:50})
  if(error){setDirectoryState({status:"failed",data:null,error:error.message});setUsers([])}else{const rows=(data??[]) as UserRow[];setUsers(rows);setDirectoryState({status:"live",data:rows})}
  setSearching(false)
 }

 const m=userState.data
 const v=valueState.data
 const signedInRate=userState.status==="live"&&m?.total_users?Math.round(m.signed_in_30d/m.total_users*100):null
 const attention=userState.status==="live"&&m?m.never_signed_in+m.past_due_subscriptions:null
 const overviewError=[userState,valueState].filter(x=>x.status==="failed").map(x=>x.error).filter(Boolean).join(" · ")

 return <HQPage title="People" description="Activation, teaching and learning value first. Account-level identity appears only during targeted owner investigation." actions={<button onClick={()=>void loadOverview()} style={hqButtonStyle}>Refresh evidence</button>}>
  {overviewError&&<div role="alert" style={{padding:11,marginBottom:10,border:`1px solid ${C.red}44`,borderRadius:10,color:C.red,fontSize:10}}>Some People evidence is unavailable. Missing evidence remains Unknown; successful sources stay usable.</div>}
  <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:10}}><Source label="Accounts" state={userState}/><Source label="Value" state={valueState}/></div>

  <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8}}>
   <Metric label="Registered" value={shown(userState,m?.total_users)}/><Metric label="Signed in today" value={shown(userState,m?.signed_in_24h)}/><Metric label="Signed in 7d" value={shown(userState,m?.signed_in_7d)}/><Metric label="New 7d" value={shown(userState,m?.new_7d)}/><Metric label="30d sign-in reach" value={signedInRate===null?"Unknown":`${signedInRate}%`} sub={userState.status==="live"&&m?`${m.signed_in_30d} accounts`:"Evidence unavailable"}/><Metric label="Needs attention" value={attention??"Unknown"} sub="Never signed in + past due" accent={attention===null?C.muted:attention>0?C.amber:C.green}/>
  </section>

  <div style={{height:12}}/><HQPanel title="Learning value" description="Evidence of meaningful teaching/learning activity; this does not claim educational effectiveness."><div style={{padding:14,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:8}}><Metric label="Learners active · 7d" value={shown(valueState,v?.north_star.learners_with_learning_evidence_7d)} sub="Canonical learning evidence"/><Metric label="Learners progressing · 30d" value={shown(valueState,v?.north_star.learners_progressing_30d)} sub="Recorded progress evidence"/><Metric label="Teachers creating value · 7d" value={shown(valueState,v?.north_star.teachers_creating_learning_value_7d)} sub="Lesson plan or homework activity"/><Metric label="Active schools · 30d" value={shown(valueState,v?.schools.active_30d)} sub="Teaching or learning activity"/></div></HQPanel>

  <div style={{height:12}}/><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:12}}>
   <HQPanel title="Activation"><div style={{padding:"0 14px 14px"}}><Ratio label="Teachers with a class" numerator={v?.activation.teachers_with_class} denominator={v?.activation.teacher_profiles} state={valueState}/><Ratio label="Students with canonical identity" numerator={v?.activation.students_with_canonical_identity} denominator={v?.activation.student_profiles} state={valueState}/><Ratio label="Parents linked to a learner" numerator={v?.activation.parents_linked_to_student} denominator={v?.activation.parent_profiles} state={valueState}/></div></HQPanel>
   <HQPanel title="Teaching · 7 days"><div style={{padding:14,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><Metric label="Active teachers" value={shown(valueState,v?.teaching_7d.active_teachers)}/><Metric label="Lesson plans" value={shown(valueState,v?.teaching_7d.lesson_plans_created)}/><Metric label="Homework set" value={shown(valueState,v?.teaching_7d.homework_created)}/><Metric label="Submissions" value={shown(valueState,v?.teaching_7d.homework_submissions)}/></div></HQPanel>
   <HQPanel title="Learning · 7 days"><div style={{padding:14,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><Metric label="Active learners" value={shown(valueState,v?.learning_7d.active_learners)}/><Metric label="Learning events" value={shown(valueState,v?.learning_7d.student_learning_events)}/><Metric label="Reading sessions" value={shown(valueState,v?.learning_7d.reading_sessions)}/><Metric label="Adaptive sessions" value={shown(valueState,v?.learning_7d.adaptive_sessions)}/></div></HQPanel>
   <HQPanel title="Mastery evidence · 30 days"><div style={{padding:14,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><Metric label="Learners progressing" value={shown(valueState,v?.mastery_30d.learners_progressing)}/><Metric label="Assessed learners" value={shown(valueState,v?.mastery_30d.assessed_learners)}/><Metric label="Proficient/mastered" value={shown(valueState,v?.mastery_30d.proficient_or_mastered_outcomes)}/><Metric label="Mastery-gain sessions" value={shown(valueState,v?.mastery_30d.adaptive_mastery_gain_sessions)}/></div></HQPanel>
  </div>

  <div style={{height:12}}/><HQPanel title="Measurement coverage"><div style={{padding:14,fontSize:11,lineHeight:1.65,color:C.muted}}>{valueState.status!=="live"?"Coverage evidence is Unknown.":<>Product events <b style={{color:v?.coverage.product_event_kernel_present?C.green:C.amber}}>{v?.coverage.product_event_kernel_present?"present":"missing"}</b>; learning events <b style={{color:v?.coverage.learning_event_kernel_present?C.green:C.amber}}>{v?.coverage.learning_event_kernel_present?"present":"missing"}</b>; mastery evidence <b style={{color:v?.coverage.mastery_evidence_present?C.green:C.amber}}>{v?.coverage.mastery_evidence_present?"present":"missing"}</b>. {!v?.coverage.cohort_retention_instrumented||!v?.coverage.acquisition_attribution_instrumented||!v?.coverage.experiment_registry_instrumented?<span style={{color:C.amber}}>Uncertified retention/acquisition/experiment sources remain explicitly missing rather than inferred.</span>:null}</>}</div></HQPanel>

  <div style={{height:12}}/><HQPanel title="Targeted account investigation" description="Search only when operational evidence requires account-level context. Broad account PII is not loaded by default."><div style={{padding:14,display:"grid",gridTemplateColumns:"minmax(0,1fr) auto",gap:8}}><input aria-label="Search users" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void searchUsers()}} placeholder="Name or VibeSchool ID · minimum 2 characters" style={{width:"100%",boxSizing:"border-box",padding:10,borderRadius:9,border:`1px solid ${C.border}`,background:C.panel,color:C.text}}/><button onClick={()=>void searchUsers()} disabled={searching} style={hqButtonStyle}>{searching?"Searching…":"Search"}</button></div>{directoryState.status==="failed"&&<div role="alert" style={{padding:"0 14px 14px",color:C.red,fontSize:10}}>{directoryState.error}</div>}{directoryState.status==="live"&&query.trim().length>=2&&users.length===0?<div style={{padding:"0 14px 14px",color:C.muted,fontSize:11}}>No matching accounts.</div>:users.map(user=><div key={user.id} style={{padding:"12px 14px",borderTop:`1px solid ${C.border}`,display:"grid",gridTemplateColumns:"minmax(0,2fr) minmax(110px,1fr) minmax(100px,1fr)",gap:10,fontSize:12}}><div style={{minWidth:0}}><b>{user.full_name||"Unnamed user"}</b><div style={{color:C.muted,fontSize:10,overflowWrap:"anywhere"}}>{user.vc_id||user.id}</div></div><div><div style={{color:C.muted,fontSize:10}}>Last sign-in</div><b>{relativeTime(user.last_sign_in_at)}</b></div><div><div style={{color:user.account_status==="active"?C.green:C.amber}}>{user.account_status}</div><div style={{fontSize:10,marginTop:3}}>{user.role||"Role unknown"}</div></div></div>)}</HQPanel>
 </HQPage>
}
