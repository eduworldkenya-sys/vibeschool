"use client"

import {useMemo,useState} from "react"
import {HQPanel,HQ_THEME as C,hqButtonStyle} from "@/components/hq/HQShell"
import {workerIdentity,WORKER_IDENTITIES} from "@/lib/hq/workforceIdentity"

type Obj=Record<string,any>
type Props={workers:Obj[];jobs:Obj[];shadowRuns:Obj[];decisions:Obj[];authority:Obj[];evidence:Obj[];collaborations?:Obj[];assignments?:Obj[]}
type ThreadEvent={id:string;at:string|null;workerKey:string|null;kind:string;summary:string;proof:Obj;from?:string|null;to?:string|null}
const when=(v:any)=>v?new Date(String(v)).toLocaleString("en-KE"):"—"
const short=(v:any,n=150)=>{const s=typeof v==="string"?v:JSON.stringify(v??{});return s.length>n?s.slice(0,n)+"…":s}

function eventsFrom(p:Props):ThreadEvent[]{
 const out:ThreadEvent[]=[]
 ;(p.assignments??[]).forEach((x,i)=>out.push({id:`assignment-${x.id??i}`,at:x.updated_at??x.assigned_at,workerKey:x.worker_key,kind:"Founder assignment",summary:`${x.work_title??"Work"} · ${x.status}`,proof:x,from:"Founder",to:x.worker_key}))
 ;(p.collaborations??[]).forEach((x,i)=>out.push({id:`collab-${x.id??i}`,at:x.updated_at??x.created_at,workerKey:x.from_worker_key,kind:"Handoff",summary:`${x.collaboration_type} · ${x.status} · authority transfer: ${x.authority_transfer===false?"no":"unexpected"}`,proof:x,from:x.from_worker_key,to:x.to_worker_key}))
 p.jobs.forEach((x,i)=>out.push({id:`job-${x.id??i}`,at:x.updated_at??x.created_at,workerKey:x.worker_key??x.assigned_worker_key??null,kind:"Work",summary:`${x.title??x.work_type??"Work item"} · ${x.status??"unknown"}`,proof:x}))
 p.shadowRuns.forEach((x,i)=>out.push({id:`run-${x.id??x.trace_id??i}`,at:x.started_at??x.created_at,workerKey:x.worker_key??null,kind:"Execution",summary:`${x.status??"run"} · trace ${x.trace_id??"—"}`,proof:x}))
 p.decisions.forEach((x,i)=>out.push({id:`decision-${x.id??i}`,at:x.updated_at??x.created_at,workerKey:x.worker_key??null,kind:"Decision",summary:`${x.decision_key??"Decision"} · ${x.state??"unknown"}: ${short(x.proposed_action,100)}`,proof:x}))
 p.authority.forEach((x,i)=>out.push({id:`authority-${x.id??i}`,at:x.created_at??x.decided_at??x.occurred_at,workerKey:x.worker_key??null,kind:"Authority",summary:`${x.decision??"decision"} · ${x.reason_code??x.scope_type??"authority check"}`,proof:x}))
 p.evidence.forEach((x,i)=>out.push({id:`evidence-${x.id??i}`,at:x.created_at,workerKey:x.worker_key??null,kind:"Evidence",summary:`${x.evidence_kind??"Evidence"} · ${x.source_type??"source"} · trace ${x.trace_id??"—"}`,proof:x}))
 return out.sort((a,b)=>String(b.at??"").localeCompare(String(a.at??""))).slice(0,120)
}

const label=(key?:string|null)=>key==="Founder"?"Founder":workerIdentity(key).name
export default function WorkerCommunication(props:Props){
 const [selected,setSelected]=useState<ThreadEvent|null>(null)
 const [filter,setFilter]=useState("all")
 const events=useMemo(()=>eventsFrom(props),[props])
 const visible=filter==="all"?events:events.filter(e=>workerIdentity(e.workerKey).name===filter||label(e.to)===filter)
 const handoffs=(props.collaborations??[]).slice(0,20)
 return <div style={{display:"grid",gap:12}}>
  <HQPanel title="Worker Room" description="A human-readable record of governed work and worker-to-worker handoffs. Every communication shown here has a real backing record.">
   <div style={{padding:12,display:"flex",gap:7,overflowX:"auto",scrollSnapType:"x proximity"}}>
    <button onClick={()=>setFilter("all")} style={{...hqButtonStyle,whiteSpace:"nowrap",color:filter==="all"?C.green:C.muted}}>Everyone</button>
    {Object.values(WORKER_IDENTITIES).map(w=><button key={w.name} onClick={()=>setFilter(w.name)} style={{...hqButtonStyle,whiteSpace:"nowrap",color:filter===w.name?C.green:C.muted}}>{w.name}</button>)}
   </div>
   <div style={{display:"grid"}}>{visible.length?visible.map((e,i)=>{const w=workerIdentity(e.workerKey);const isHandoff=!!e.from&&!!e.to;return <button key={e.id} onClick={()=>setSelected(e)} style={{textAlign:"left",background:"transparent",color:C.text,border:"none",borderTop:i?`1px solid ${C.border}`:"none",padding:13,cursor:"pointer"}}><div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"baseline",flexWrap:"wrap"}}><strong>{isHandoff?`${label(e.from)} → ${label(e.to)}`:w.name} <span style={{fontSize:10,color:C.muted}}>· {e.kind}</span></strong><span style={{fontSize:10,color:C.muted}}>{when(e.at)}</span></div><div style={{fontSize:11.5,marginTop:5}}>{e.summary}</div></button>}):<div style={{padding:24,color:C.muted,textAlign:"center"}}>No governed activity recorded for this worker yet.</div>}</div>
  </HQPanel>
  <HQPanel title="Verified handoffs" description="These are actual collaboration records. A handoff never transfers authority."><div style={{padding:12,display:"grid",gap:7}}>{handoffs.length?handoffs.map(x=><button key={x.id} onClick={()=>setSelected({id:String(x.id),at:x.updated_at,workerKey:x.from_worker_key,kind:"Handoff",summary:String(x.collaboration_type),proof:x,from:x.from_worker_key,to:x.to_worker_key})} style={{padding:11,border:`1px solid ${C.border}`,borderRadius:12,background:C.panelSoft,color:C.text,textAlign:"left"}}><strong>{label(x.from_worker_key)} → {label(x.to_worker_key)}</strong><div style={{fontSize:10.5,color:C.muted,marginTop:4}}>{x.collaboration_type} · {x.status} · {when(x.updated_at)}</div></button>):<div style={{fontSize:11,color:C.muted}}>No collaboration records yet.</div>}</div></HQPanel>
  <HQPanel title="Communication proof" description="Select an activity or handoff to inspect its backing Worker Engine record.">
   <div style={{padding:13,fontSize:11,color:selected?C.text:C.muted,whiteSpace:"pre-wrap",overflowWrap:"anywhere",maxHeight:420,overflowY:"auto"}}>{selected?JSON.stringify(selected.proof,null,2):"Select a Worker Room activity."}</div>
  </HQPanel>
 </div>
}
