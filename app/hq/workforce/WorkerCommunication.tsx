"use client"

import {useMemo,useState} from "react"
import {HQPanel,HQ_THEME as C,hqButtonStyle} from "@/components/hq/HQShell"
import {workerIdentity,WORKER_IDENTITIES} from "@/lib/hq/workforceIdentity"

type Obj=Record<string,any>
type Props={workers:Obj[];jobs:Obj[];shadowRuns:Obj[];decisions:Obj[];authority:Obj[];evidence:Obj[]}
type ThreadEvent={id:string;at:string|null;workerKey:string|null;kind:string;summary:string;proof:Obj}
const when=(v:any)=>v?new Date(String(v)).toLocaleString("en-KE"):"—"
const short=(v:any,n=150)=>{const s=typeof v==="string"?v:JSON.stringify(v??{});return s.length>n?s.slice(0,n)+"…":s}

function eventsFrom(p:Props):ThreadEvent[]{
 const out:ThreadEvent[]=[]
 p.jobs.forEach((x,i)=>out.push({id:`job-${x.id??i}`,at:x.updated_at??x.created_at,workerKey:x.worker_key??x.assigned_worker_key??null,kind:"Work",summary:`${x.title??x.work_type??"Work item"} · ${x.status??"unknown"}`,proof:x}))
 p.shadowRuns.forEach((x,i)=>out.push({id:`run-${x.id??x.trace_id??i}`,at:x.started_at??x.created_at,workerKey:x.worker_key??null,kind:"Execution",summary:`${x.status??"run"} · trace ${x.trace_id??"—"}`,proof:x}))
 p.decisions.forEach((x,i)=>out.push({id:`decision-${x.id??i}`,at:x.updated_at??x.created_at,workerKey:x.worker_key??null,kind:"Decision",summary:`${x.decision_key??"Decision"} · ${x.state??"unknown"}: ${short(x.proposed_action,100)}`,proof:x}))
 p.authority.forEach((x,i)=>out.push({id:`authority-${x.id??i}`,at:x.created_at??x.decided_at,workerKey:x.worker_key??null,kind:"Authority",summary:`${x.decision??"decision"} · ${x.reason_code??x.scope_type??"authority check"}`,proof:x}))
 p.evidence.forEach((x,i)=>out.push({id:`evidence-${x.id??i}`,at:x.created_at,workerKey:x.worker_key??null,kind:"Evidence",summary:`${x.evidence_kind??"Evidence"} · ${x.source_type??"source"} · trace ${x.trace_id??"—"}`,proof:x}))
 return out.sort((a,b)=>String(b.at??"").localeCompare(String(a.at??""))).slice(0,80)
}

export default function WorkerCommunication(props:Props){
 const [selected,setSelected]=useState<ThreadEvent|null>(null)
 const [filter,setFilter]=useState("all")
 const events=useMemo(()=>eventsFrom(props),[props])
 const visible=filter==="all"?events:events.filter(e=>workerIdentity(e.workerKey).name===filter)
 return <div style={{display:"grid",gap:12}}>
  <HQPanel title="Worker Room" description="Human-readable view of governed worker activity. Every statement below is derived from Worker Engine records; names do not grant authority.">
   <div style={{padding:14,display:"flex",gap:8,flexWrap:"wrap"}}>
    <button onClick={()=>setFilter("all")} style={{...hqButtonStyle,color:filter==="all"?C.green:C.muted}}>Everyone</button>
    {Object.values(WORKER_IDENTITIES).map(w=><button key={w.name} onClick={()=>setFilter(w.name)} style={{...hqButtonStyle,color:filter===w.name?C.green:C.muted}}>{w.name}</button>)}
   </div>
   <div style={{display:"grid"}}>{visible.length?visible.map((e,i)=>{const w=workerIdentity(e.workerKey);return <button key={e.id} onClick={()=>setSelected(e)} style={{textAlign:"left",background:"transparent",color:C.text,border:"none",borderTop:i?`1px solid ${C.border}`:"none",padding:14,cursor:"pointer"}}><div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"baseline"}}><strong>{w.name} <span style={{fontSize:10,color:C.muted}}>· {w.role}</span></strong><span style={{fontSize:10,color:C.muted}}>{when(e.at)}</span></div><div style={{fontSize:11.5,marginTop:5}}>{e.kind}: {e.summary}</div></button>}):<div style={{padding:24,color:C.muted,textAlign:"center"}}>No governed activity recorded for this worker yet.</div>}</div>
  </HQPanel>
  <HQPanel title="Communication proof" description="Select an activity to inspect the underlying record rather than trusting a conversational claim.">
   <div style={{padding:14,fontSize:11.5,color:selected?C.text:C.muted,whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{selected?JSON.stringify(selected.proof,null,2):"Select a Worker Room activity."}</div>
  </HQPanel>
  <HQPanel title="How workers collaborate" description="Worker-to-worker collaboration remains structured and non-authority-transferring.">
   <div style={{padding:14,fontSize:11.5,lineHeight:1.7}}>Founder → <strong>Laban</strong> coordinates → specialists investigate or execute → <strong>Luca</strong> verifies → Laban consolidates → Founder receives decisions and exceptions. Existing routing, collaboration, authority, evidence and trace records remain the source of truth.</div>
  </HQPanel>
 </div>
}
