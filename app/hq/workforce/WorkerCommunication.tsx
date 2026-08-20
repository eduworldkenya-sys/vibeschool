"use client"

import {useMemo,useState} from "react"
import {HQPanel,HQ_THEME as C,hqButtonStyle} from "@/components/hq/HQShell"
import {workerIdentity,WORKER_IDENTITIES} from "@/lib/hq/workforceIdentity"

type Obj=Record<string,any>
type Props={workers:Obj[];jobs:Obj[];shadowRuns:Obj[];decisions:Obj[];authority:Obj[];evidence:Obj[];collaborations?:Obj[];assignments?:Obj[]}
type ThreadEvent={id:string;at:string|null;workerKey:string|null;kind:string;summary:string;proof:Obj;from?:string|null;to?:string|null}
const when=(v:any)=>v?new Date(String(v)).toLocaleString("en-KE"):"—"
const short=(v:any,n=150)=>{const s=typeof v==="string"?v:JSON.stringify(v??{});return s.length>n?s.slice(0,n)+"…":s}
const workText=(x:Obj)=>String(x.title??x.work_title??x.decision_key??x.work_type??"").toLowerCase()
function inferredWorker(x:Obj):string|null{
 const explicit=x.worker_key??x.assigned_worker_key??x.from_worker_key??null
 if(explicit)return String(explicit)
 const dept=String(x.department_key??x.department??"").toLowerCase(),t=workText(x)
 if(dept.includes("quality")||t.includes("verify")||t.includes("review teacher guide"))return "luca"
 if(dept.includes("content")||dept.includes("publishing")||t.includes("publication")||t.includes("content health"))return "travis"
 if(dept.includes("security"))return "michael"
 if(dept.includes("school-success"))return "phyllys"
 if(dept.includes("growth"))return "chloe"
 if(dept.includes("operations")||dept.includes("support"))return "david"
 if(dept.includes("workforce")||t.includes("workforce"))return "mykphyl"
 if(t.includes("research")||t.includes("curriculum"))return "nina"
 if(t.includes("vibelab")||t.includes("repair")||t.includes("engineering"))return "brian"
 return null
}
function eventsFrom(p:Props):ThreadEvent[]{
 const out:ThreadEvent[]=[]
 ;(p.assignments??[]).forEach((x,i)=>out.push({id:`assignment-${x.id??i}`,at:x.updated_at??x.assigned_at,workerKey:inferredWorker(x),kind:"Founder assignment",summary:`${x.work_title??"Work"} · ${x.status}`,proof:x,from:"Founder",to:inferredWorker(x)}))
 ;(p.collaborations??[]).forEach((x,i)=>out.push({id:`collab-${x.id??i}`,at:x.updated_at??x.created_at,workerKey:inferredWorker(x),kind:"Handoff",summary:`${x.collaboration_type} · ${x.status} · authority transfer: ${x.authority_transfer===false?"no":"unexpected"}`,proof:x,from:x.from_worker_key,to:x.to_worker_key}))
 p.jobs.forEach((x,i)=>out.push({id:`job-${x.id??i}`,at:x.updated_at??x.created_at,workerKey:inferredWorker(x),kind:"Work",summary:`${x.title??x.work_type??"Work item"} · ${x.status??"unknown"}`,proof:x}))
 p.shadowRuns.forEach((x,i)=>out.push({id:`run-${x.id??x.trace_id??i}`,at:x.started_at??x.created_at,workerKey:inferredWorker(x),kind:"Execution",summary:`${x.status??"run"} · trace ${x.trace_id??"—"}`,proof:x}))
 p.decisions.forEach((x,i)=>out.push({id:`decision-${x.id??i}`,at:x.updated_at??x.created_at,workerKey:inferredWorker(x),kind:"Decision",summary:`${x.decision_key??"Decision"} · ${x.state??"unknown"}: ${short(x.proposed_action,100)}`,proof:x}))
 p.authority.forEach((x,i)=>out.push({id:`authority-${x.id??i}`,at:x.created_at??x.decided_at??x.occurred_at,workerKey:inferredWorker(x),kind:"Authority",summary:`${x.decision??"decision"} · ${x.reason_code??x.scope_type??"authority check"}`,proof:x}))
 p.evidence.forEach((x,i)=>out.push({id:`evidence-${x.id??i}`,at:x.created_at,workerKey:inferredWorker(x),kind:"Evidence",summary:`${x.evidence_kind??"Evidence"} · ${x.source_type??"source"} · trace ${x.trace_id??"—"}`,proof:x}))
 return out.sort((a,b)=>String(b.at??"").localeCompare(String(a.at??""))).slice(0,120)
}
const label=(key?:string|null)=>key==="Founder"?"Founder":key?workerIdentity(key).name:"VibeSchool System"
function Proof({event}:{event:ThreadEvent}){const x=event.proof;const verifier=x.verifier_worker_key??x.verified_by_worker_key??null;return <div style={{padding:14,display:"grid",gap:10,fontSize:11.5}}><div><strong>Task</strong><div>{x.title??x.work_title??x.decision_key??event.summary}</div></div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10}}><div><strong>Responsible</strong><div>{label(event.workerKey)}</div></div><div><strong>Status</strong><div>{x.status??x.state??"Recorded"}</div></div><div><strong>Requested by</strong><div>{event.from?label(event.from):x.created_by??"VibeSchool System"}</div></div><div><strong>Verifier</strong><div>{verifier?label(verifier):"Not independently verified"}</div></div><div><strong>Recorded</strong><div>{when(event.at)}</div></div><div><strong>Evidence</strong><div>{x.evidence_id??x.trace_id??x.proof_ref??"Backing record attached"}</div></div></div><details><summary style={{cursor:"pointer",color:C.muted}}>Technical details</summary><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",maxHeight:300,overflow:"auto",fontSize:10}}>{JSON.stringify(x,null,2)}</pre></details></div>}
export default function WorkerCommunication(props:Props){const[selected,setSelected]=useState<ThreadEvent|null>(null),[filter,setFilter]=useState("all");const events=useMemo(()=>eventsFrom(props),[props]);const visible=filter==="all"?events:events.filter(e=>label(e.workerKey)===filter||label(e.to)===filter);const handoffs=(props.collaborations??[]).slice(0,20);return <div style={{display:"grid",gap:12}}><HQPanel title="Worker Room" description="Governed work, system activity and real worker handoffs. Unattributed automation is shown as VibeSchool System rather than a fictional worker."><div style={{padding:12,display:"flex",gap:7,overflowX:"auto"}}><button onClick={()=>setFilter("all")} style={{...hqButtonStyle,whiteSpace:"nowrap",color:filter==="all"?C.green:C.muted}}>Everyone</button>{Object.values(WORKER_IDENTITIES).map(w=><button key={w.name} onClick={()=>setFilter(w.name)} style={{...hqButtonStyle,whiteSpace:"nowrap",color:filter===w.name?C.green:C.muted}}>{w.name}</button>)}</div><div style={{display:"grid"}}>{visible.length?visible.map((e,i)=><button key={e.id} onClick={()=>setSelected(e)} style={{textAlign:"left",background:"transparent",color:C.text,border:"none",borderTop:i?`1px solid ${C.border}`:"none",padding:13,cursor:"pointer"}}><div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}><strong>{e.from&&e.to?`${label(e.from)} → ${label(e.to)}`:label(e.workerKey)} <span style={{fontSize:10,color:C.muted}}>· {e.kind}</span></strong><span style={{fontSize:10,color:C.muted}}>{when(e.at)}</span></div><div style={{fontSize:11.5,marginTop:5}}>{e.summary}</div></button>):<div style={{padding:24,color:C.muted,textAlign:"center"}}>No governed activity recorded for this worker yet.</div>}</div></HQPanel><HQPanel title="Verified handoffs" description="Actual collaboration records only; handoffs never transfer authority."><div style={{padding:12,display:"grid",gap:7}}>{handoffs.length?handoffs.map(x=><button key={x.id} onClick={()=>setSelected({id:String(x.id),at:x.updated_at,workerKey:inferredWorker(x),kind:"Handoff",summary:String(x.collaboration_type),proof:x,from:x.from_worker_key,to:x.to_worker_key})} style={{padding:11,border:`1px solid ${C.border}`,borderRadius:12,background:C.panelSoft,color:C.text,textAlign:"left"}}><strong>{label(x.from_worker_key)} → {label(x.to_worker_key)}</strong><div style={{fontSize:10.5,color:C.muted,marginTop:4}}>{x.collaboration_type} · {x.status} · {when(x.updated_at)}</div></button>):<div style={{fontSize:11,color:C.muted}}>No collaboration records yet.</div>}</div></HQPanel><HQPanel title="Communication proof" description="Founder-readable proof first; raw engine data stays available under Technical details.">{selected?<Proof event={selected}/>:<div style={{padding:14,fontSize:11,color:C.muted}}>Select a Worker Room activity.</div>}</HQPanel></div>}
