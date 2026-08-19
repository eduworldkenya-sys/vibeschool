"use client"
export const dynamic="force-dynamic"

import {useCallback,useEffect,useState} from "react"
import Link from "next/link"
import {supabase} from "@/lib/supabase"
import {HQPage,HQPanel,HQ_THEME as C,hqButtonStyle} from "@/components/hq/HQShell"

const sb=supabase as any
type Obj=Record<string,any>

export default function EmergencyStopPage(){
 const[readiness,setReadiness]=useState<Obj|null>(null);const[reason,setReason]=useState("");const[phrase,setPhrase]=useState("");const[busy,setBusy]=useState(false);const[error,setError]=useState("");const[result,setResult]=useState<Obj|null>(null)
 const load=useCallback(async()=>{const{data,error}=await sb.rpc("hq_workforce_runtime_readiness");if(error){setError(error.message);return}setReadiness(data as Obj)},[])
 useEffect(()=>{void load()},[load])
 const alreadyStopped=Boolean(readiness?.global_stop_active)&&!Boolean(readiness?.runtime_execution_enabled)&&Boolean(readiness?.shadow_stopped)
 const valid=!alreadyStopped&&reason.trim().length>=5&&phrase.trim().toUpperCase()==="STOP"
 async function stop(){if(!valid||busy)return;setBusy(true);setError("");setResult(null);try{const{data,error}=await sb.rpc("hq_workforce_owner_emergency_stop",{p_reason:reason.trim()});if(error)throw error;setResult(data as Obj);setPhrase("");setReason("");await load()}catch(e){setError(e instanceof Error?e.message:"Emergency stop failed.")}finally{setBusy(false)}}
 return <HQPage title="Global Stop" description="Owner emergency control · one-way safety action only">
  <div style={{display:"grid",gap:12,maxWidth:760}}><HQPanel title="Current safety state"><div style={{padding:16,display:"grid",gap:8,fontSize:12}}><div>Runtime <strong>{readiness?.runtime_execution_enabled?"ON":"OFF"}</strong></div><div>Autonomy <strong>L{String(readiness?.runtime_autonomy_level??"—")}</strong></div><div>Risk <strong>R{String(readiness?.runtime_max_risk??"—")}</strong></div><div>Shadow stopped <strong>{readiness?.shadow_stopped?"YES":"NO"}</strong></div><div>Global Stop <strong style={{color:readiness?.global_stop_active?C.green:C.red}}>{readiness?.global_stop_active?"ACTIVE":"NOT ACTIVE"}</strong></div></div></HQPanel>
  {alreadyStopped?<HQPanel title="Global Stop is already active"><div style={{padding:16,color:C.muted,fontSize:12,lineHeight:1.6}}>No mutation is needed. Runtime is OFF, shadow is stopped, and Global Stop is active. <Link href="/hq/operations" style={{color:C.blue}}>Return to Operations.</Link></div></HQPanel>:<HQPanel title="Activate emergency stop" description="This cannot start or increase autonomy. It only moves Worker Engine toward the safest state."><div style={{padding:16,display:"grid",gap:11}}><div style={{padding:11,border:`1px solid ${C.red}55`,borderRadius:11,background:`${C.red}0d`,color:"#fecaca",fontSize:11.5,lineHeight:1.55}}>This will force runtime execution OFF, autonomy L0, risk R0, heartbeat/factory OFF, shadow OFF, scheduler OFF and Global Stop ON. The before/after state and owner identity are recorded.</div><label style={{fontSize:11.5,fontWeight:800}}>Reason<input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Why is an emergency stop required?" style={{display:"block",width:"100%",marginTop:6,padding:11,borderRadius:10,border:`1px solid ${C.border}`,background:C.panelSoft,color:C.text,font:"inherit"}}/></label><label style={{fontSize:11.5,fontWeight:800}}>Type STOP to confirm<input value={phrase} onChange={e=>setPhrase(e.target.value)} autoComplete="off" style={{display:"block",width:"100%",marginTop:6,padding:11,borderRadius:10,border:`1px solid ${C.border}`,background:C.panelSoft,color:C.text,font:"inherit"}}/></label><button onClick={()=>void stop()} disabled={!valid||busy} style={{...hqButtonStyle,minHeight:48,color:valid?"#fecaca":C.muted,borderColor:valid?`${C.red}88`:C.border,background:valid?`${C.red}18`:"rgba(255,255,255,.03)"}}>{busy?"Activating Global Stop…":"Activate Global Stop"}</button></div></HQPanel>}
  {error&&<div role="alert" style={{padding:12,border:`1px solid ${C.red}55`,borderRadius:11,color:"#fecaca"}}>{error}</div>}{result&&<div role="status" style={{padding:12,border:`1px solid ${C.green}55`,borderRadius:11,color:"#bbf7d0"}}>Global Stop recorded. Event {String(result.event_key??"recorded")}.</div>}</div>
 </HQPage>
}
