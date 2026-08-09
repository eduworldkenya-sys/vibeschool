"use client"
export const dynamic = "force-dynamic"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

type WorkforceDecision = {
  id: string
  decision_key: string
  worker_key: string | null
  lane_key: string
  job_key: string
  proposed_action: string
  reason: string
  risk: "low" | "normal" | "high" | "critical" | string
  status: "pending" | "revision_requested" | string
  revision: string | null
  run_id: string | null
  evidence_snapshot_id: string | null
  created_at: string
}

type Action = "approve" | "revise" | "reject" | "skip"
const sb = supabase as any
const C={bg:"#07111f",panel:"rgba(255,255,255,.025)",border:"rgba(255,255,255,.09)",text:"#f8fafc",muted:"rgba(255,255,255,.5)",green:"#34d399",blue:"#60a5fa",amber:"#f59e0b",red:"#fb7185",violet:"#a78bfa"}
const btn:React.CSSProperties={height:38,padding:"0 12px",borderRadius:10,border:`1px solid ${C.border}`,background:"rgba(255,255,255,.04)",color:C.text,fontSize:11,fontWeight:850,cursor:"pointer"}
const riskTone=(risk:string)=>risk==="critical"?C.red:risk==="high"?C.amber:risk==="normal"?C.blue:C.muted

export default function HQWorkforceDecisionsPage(){
  const router=useRouter()
  const[items,setItems]=useState<WorkforceDecision[]>([])
  const[notes,setNotes]=useState<Record<string,string>>({})
  const[busy,setBusy]=useState("")
  const[loading,setLoading]=useState(true)
  const[error,setError]=useState("")
  const[message,setMessage]=useState("")

  const load=useCallback(async()=>{
    setError("")
    try{
      const{data,error}=await sb.rpc("hq_workforce_list_decisions",{p_status:"actionable",p_limit:100})
      if(error)throw error
      setItems((data??[]) as WorkforceDecision[])
    }catch(e){setError(e instanceof Error?e.message:"Decision inbox could not be loaded.")}
    finally{setLoading(false)}
  },[])

  useEffect(()=>{void load()},[load])
  const counts=useMemo(()=>({critical:items.filter(x=>x.risk==="critical").length,high:items.filter(x=>x.risk==="high").length,total:items.length}),[items])

  async function decide(item:WorkforceDecision,action:Action){
    const note=(notes[item.id]??"").trim()
    if((action==="revise"||action==="reject")&&!note){setError(`${action==="revise"?"Revision":"Rejection reason"} is required.`);return}
    const warning=action==="approve"?"Approve this workforce decision? It will record positive evidence and authorize the decision state, but downstream execution still remains subject to its runtime authority/verification path.":action==="reject"?"Reject this proposal and record it as a contextual counterexample?":action==="revise"?"Request revision and record this correction as learning evidence?":"Skip this decision without creating learning evidence?"
    if(!window.confirm(warning))return
    setBusy(item.id);setError("");setMessage("")
    try{
      const{data,error}=await sb.rpc("hq_workforce_decide",{p_id:item.id,p_action:action,p_revision:note||null})
      if(error)throw error
      const result=data as Record<string,unknown>|null
      setMessage(`${item.decision_key}: ${String(result?.status??action)}`)
      setNotes(prev=>{const n={...prev};delete n[item.id];return n})
      await load()
    }catch(e){setError(e instanceof Error?e.message:"Decision action failed.")}
    finally{setBusy("")}
  }

  return <main style={{minHeight:"100dvh",background:C.bg,color:C.text,fontFamily:"Inter,system-ui,sans-serif"}}><div style={{maxWidth:980,margin:"0 auto",padding:"0 16px 80px"}}>
    <header style={{position:"sticky",top:0,zIndex:20,margin:"0 -16px",padding:"13px 16px",background:"rgba(7,17,31,.96)",backdropFilter:"blur(16px)",borderBottom:`1px solid ${C.border}`}}><div style={{maxWidth:980,margin:"0 auto",display:"flex",alignItems:"center",gap:9}}><button onClick={()=>router.push("/hq")} style={btn}>← HQ</button><div style={{flex:1}}><div style={{fontSize:18,fontWeight:950}}>Decision Inbox</div><div style={{fontSize:10.5,color:C.muted}}>Founder authority boundary · evidence-backed workforce decisions</div></div><button onClick={()=>void load()} disabled={loading} style={btn}>{loading?"Loading…":"Refresh"}</button></div></header>
    <section style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:9,marginTop:16}}>{[["Actionable",counts.total,C.blue],["Critical",counts.critical,C.red],["High",counts.high,C.amber]].map(([label,value,tone])=><div key={String(label)} style={{padding:13,border:`1px solid ${C.border}`,borderRadius:14,background:C.panel}}><div style={{fontSize:23,fontWeight:950,color:String(tone)}}>{String(value)}</div><div style={{fontSize:10.5,color:C.muted,marginTop:4}}>{String(label)}</div></div>)}</section>
    {error&&<div style={{marginTop:12,padding:12,border:"1px solid rgba(251,113,133,.3)",borderRadius:11,background:"rgba(251,113,133,.08)",color:"#fecdd3",fontSize:12}}>{error}</div>}
    {message&&<div style={{marginTop:12,padding:12,border:"1px solid rgba(52,211,153,.3)",borderRadius:11,background:"rgba(52,211,153,.08)",color:"#bbf7d0",fontSize:12}}>{message}</div>}
    <section style={{marginTop:14,display:"grid",gap:10}}>{!loading&&items.length===0?<div style={{padding:26,textAlign:"center",border:`1px solid ${C.border}`,borderRadius:15,color:C.muted}}>No workforce decisions currently require founder authority.</div>:items.map(item=>{const working=busy===item.id;return <article key={item.id} style={{border:`1px solid ${C.border}`,borderRadius:15,background:C.panel,overflow:"hidden"}}><div style={{padding:14,display:"flex",gap:12,alignItems:"flex-start",borderBottom:`1px solid ${C.border}`}}><div style={{flex:1,minWidth:0}}><div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}><strong style={{fontSize:13}}>{item.proposed_action}</strong><span style={{fontSize:9.5,fontWeight:900,color:riskTone(item.risk),border:`1px solid ${riskTone(item.risk)}55`,borderRadius:999,padding:"3px 7px"}}>{item.risk.toUpperCase()}</span>{item.status==="revision_requested"&&<span style={{fontSize:9.5,color:C.violet}}>REVISION REQUESTED</span>}</div><div style={{fontSize:10.5,color:C.muted,marginTop:5}}>{item.lane_key} · {item.worker_key??"Unassigned worker"} · {new Date(item.created_at).toLocaleString("en-KE")}</div></div></div><div style={{padding:14}}><div style={{fontSize:11.5,lineHeight:1.55}}>{item.reason}</div><div style={{marginTop:10,fontSize:10,color:C.muted,overflowWrap:"anywhere"}}>Job {item.job_key} · Run {item.run_id??"—"} · Snapshot {item.evidence_snapshot_id??"—"}</div>{item.revision&&<div style={{marginTop:10,padding:10,borderRadius:10,background:"rgba(167,139,250,.08)",fontSize:11}}><strong>Current founder note:</strong> {item.revision}</div>}<textarea value={notes[item.id]??""} onChange={e=>setNotes(p=>({...p,[item.id]:e.target.value}))} placeholder="Revision or rejection reason (required only for Revise / Reject)" rows={3} style={{width:"100%",marginTop:12,boxSizing:"border-box",resize:"vertical",border:`1px solid ${C.border}`,borderRadius:10,background:"rgba(255,255,255,.035)",color:C.text,padding:10,font: "inherit",fontSize:11.5}}/><div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}><button disabled={working} onClick={()=>void decide(item,"approve")} style={{...btn,color:C.green}}>Approve</button><button disabled={working} onClick={()=>void decide(item,"revise")} style={{...btn,color:C.violet}}>Revise</button><button disabled={working} onClick={()=>void decide(item,"reject")} style={{...btn,color:C.red}}>Reject</button><button disabled={working} onClick={()=>void decide(item,"skip")} style={{...btn,color:C.muted}}>Skip</button></div></div></article>})}</section>
  </div></main>
}
