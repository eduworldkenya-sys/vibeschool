"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { hqSupabase } from "@/lib/hq/supabase"
import { HQPage, HQPanel, HQ_THEME as C, hqButtonStyle } from "@/components/hq/HQShell"

type Obj = Record<string, any>
const sb = hqSupabase as any
const fmt = (v: unknown) => typeof v === "number" ? new Intl.NumberFormat("en-KE").format(v) : String(v ?? "—")

function Metric({label,value,tone=C.text}:{label:string;value:unknown;tone?:string}) {
  return <div style={{padding:14,border:`1px solid ${C.border}`,borderRadius:13,background:C.panelSoft}}><strong style={{display:"block",fontSize:22,color:tone}}>{fmt(value)}</strong><span style={{display:"block",marginTop:4,fontSize:11,color:C.muted}}>{label}</span></div>
}
function Badge({children,tone=C.blue}:{children:React.ReactNode;tone?:string}) {
  return <span style={{display:"inline-flex",minHeight:25,alignItems:"center",padding:"0 9px",borderRadius:999,border:`1px solid ${tone}55`,color:tone,fontSize:10,fontWeight:900}}>{children}</span>
}

export default function FounderOperationsPage() {
  const [brief,setBrief]=useState<Obj|null>(null)
  const [report,setReport]=useState<Obj|null>(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState("")
  const refresh=useCallback(async()=>{setLoading(true);setError("");try{
    const [b,r]=await Promise.all([sb.rpc("hq_autopilot_founder_brief"),sb.rpc("hq_get_seven_day_owner_report")])
    if(b.error) throw b.error
    if(r.error) throw r.error
    setBrief(b.data as Obj);setReport(r.data as Obj)
  } catch {setError("Operations evidence could not be refreshed. Nothing was changed.")} finally {setLoading(false)}},[])
  useEffect(()=>{void refresh()},[refresh])

  const constitution=brief?.constitution??{},runtime=constitution.runtime??{},ops=brief?.operations??{}
  const outstanding=report?.outstanding??{},incidents=Array.isArray(outstanding.incidents)?outstanding.incidents:[]
  const safeRuntime=!runtime.execution_enabled&&Number(runtime.autonomy_level??0)===0&&Number(runtime.max_risk??0)===0
  const globalStop=runtime.global_stop===true
  const breakers=Number(constitution.tripped_breakers??0)
  const attention=Number(ops.attention_required??0)
  const state=useMemo(()=>incidents.some((x:Obj)=>x.severity==="critical")?"INCIDENT":(!safeRuntime||!globalStop||breakers>0)?"DEGRADED":(incidents.length>0||attention>0)?"ATTENTION":"LIVE",[incidents,safeRuntime,globalStop,breakers,attention])
  const tone=state==="LIVE"?C.green:state==="ATTENTION"?C.amber:C.red

  return <HQPage title="Operations" description="Is VibeSchool operating safely right now? Runtime, incidents, verification and governance evidence in one founder view." actions={<button onClick={()=>void refresh()} disabled={loading} style={hqButtonStyle}>{loading?"Refreshing…":"Refresh operations"}</button>}>
    {error&&<div role="alert" style={{padding:12,border:`1px solid ${C.red}`,borderRadius:12,color:C.red,marginBottom:14}}>{error}</div>}
    <section style={{padding:18,border:`1px solid ${tone}55`,borderRadius:15,background:`${tone}0d`,marginBottom:14}}><div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}><strong style={{fontSize:26,color:tone}}>{state}</strong><Badge tone={safeRuntime?C.green:C.red}>Runtime {safeRuntime?"OFF · L0 · R0":"ACTIVE / UNSAFE"}</Badge><Badge tone={globalStop?C.green:C.red}>Global Stop {globalStop?"ACTIVE":"NOT ACTIVE"}</Badge></div><p style={{margin:"8px 0 0",fontSize:11.5,color:C.muted}}>Derived only from canonical owner-gated evidence. This page is observation-only and cannot activate Worker runtime or release Global Stop.</p></section>

    <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:9,marginBottom:14}}><Metric label="Canonical tasks" value={ops.total_tasks}/><Metric label="Completed" value={ops.completed}/><Metric label="Independently verified" value={ops.independently_verified} tone={C.green}/><Metric label="Verification records" value={ops.verification_records}/><Metric label="Attention required" value={attention} tone={attention?C.amber:C.green}/><Metric label="Dead letters" value={ops.dead_letters} tone={Number(ops.dead_letters)>0?C.red:C.green}/><Metric label="Tripped breakers" value={breakers} tone={breakers?C.red:C.green}/><Metric label="Open incidents" value={incidents.length} tone={incidents.length?C.red:C.green}/></section>

    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,340px),1fr))",gap:12}}>
      <HQPanel title="Worker runtime safety" description="Canonical constitution evidence; no mutation controls."><div style={{padding:14,display:"grid",gap:9,fontSize:12}}><div>Execution <strong>{runtime.execution_enabled?"ON":"OFF"}</strong></div><div>Autonomy <strong>L{fmt(runtime.autonomy_level)}</strong></div><div>Maximum risk <strong>R{fmt(runtime.max_risk)}</strong></div><div>Global Stop <strong style={{color:globalStop?C.green:C.red}}>{globalStop?"ACTIVE":"NOT ACTIVE"}</strong></div><div>Factory <strong>{runtime.factory_enabled?"ON":"OFF"}</strong></div><div>Heartbeat <strong>{runtime.heartbeat_enabled?"ON":"OFF"}</strong></div><div>Active capability authority <strong>{fmt(constitution.active_capability_authority)}</strong></div><Link href="/hq/workforce" style={{color:C.blue,textDecoration:"none",fontWeight:900}}>Open Worker Engine →</Link></div></HQPanel>
      <HQPanel title="Execution integrity" description="Completion is never presented as verified success."><div style={{padding:14,display:"grid",gap:9,fontSize:12}}><div>Completed tasks <strong>{fmt(ops.completed)}</strong></div><div>Independently verified <strong>{fmt(ops.independently_verified)}</strong></div><div>Verification records <strong>{fmt(ops.verification_records)}</strong></div><div>Retries observed <strong>{fmt(ops.retries_observed)}</strong></div><div>Dead letters <strong>{fmt(ops.dead_letters)}</strong></div><small style={{color:C.muted,lineHeight:1.5}}>{brief?.truth_note??"No inferred success is reported as verified success."}</small></div></HQPanel>
      <HQPanel title="Operational incidents" description="Current unresolved company incidents from the owner report."><div style={{display:"grid"}}>{incidents.length?incidents.slice(0,8).map((x:Obj,i:number)=><div key={x.id??i} style={{padding:13,borderTop:i?`1px solid ${C.border}`:0}}><strong style={{fontSize:12}}>{x.title??"Operational incident"}</strong><div style={{marginTop:4,fontSize:10.5,color:C.muted}}>{x.summary??x.explanation??x.status??"Review supporting evidence."}</div></div>):<div style={{padding:18,color:C.muted,fontSize:11}}>No unresolved incident is surfaced by the current owner report.</div>}</div></HQPanel>
    </div>

    <div style={{marginTop:14,padding:12,border:`1px solid ${C.border}`,borderRadius:12,color:C.muted,fontSize:11,lineHeight:1.5}}>For growth, retention, revenue, product usage and the founder morning brief, use <Link href="/hq/intelligence" style={{color:C.blue,fontWeight:900,textDecoration:"none"}}>Decision Intelligence</Link>. Operations intentionally stays focused on safety and execution truth.</div>
  </HQPage>
}
