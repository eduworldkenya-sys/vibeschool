"use client"
import {useCallback,useEffect,useState} from "react"
import {hqSupabase} from "@/lib/hq/supabase"
import {HQPanel,HQ_THEME as C,hqButtonStyle} from "@/components/hq/HQShell"
type Obj=Record<string,any>; const sb=hqSupabase as any
const when=(v:any)=>v?new Date(String(v)).toLocaleString("en-KE"):"—"
function Metric({label,value}:{label:string;value:any}){return <div style={{padding:12,border:`1px solid ${C.border}`,borderRadius:12,background:C.panelSoft}}><strong style={{fontSize:18}}>{String(value??0)}</strong><div style={{fontSize:10.5,color:C.muted,marginTop:4}}>{label}</div></div>}
export default function Task15OwnerControls(){
 const[ops,setOps]=useState<Obj|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[showStart,setShowStart]=useState(false)
 const load=useCallback(async()=>{const r=await sb.rpc("hq_workforce_owner_control_snapshot",{p_recent_limit:20});if(r.error){setOps(null);setError("Operational controls are not commissioned in this environment. Read-only Worker Engine views remain available.");return}setOps(r.data);setError("")},[])
 useEffect(()=>{void load()},[load])
 async function invoke(label:string,fn:()=>Promise<any>){setBusy(true);setError("");try{const r=await fn();if(r.error)throw r.error;await load()}catch(e){setError(e instanceof Error?e.message:`${label} failed`)}finally{setBusy(false)}}
 function reason(label:string,token:string){const r=window.prompt(`${label} — audit reason`);if(!r?.trim())return null;return window.prompt(`Type ${token} to confirm`)===token?r.trim():null}
 if(!ops)return <HQPanel title="Owner operations"><div style={{padding:14,fontSize:11,color:C.muted}}>{error||"Loading owner controls…"}</div></HQPanel>
 const e=ops.engine??{},policy=ops.global_policy,active=Number(ops.counts?.active_authority??0),runtime=Boolean(e.runtime_execution_enabled),stop=Boolean(e.shadow_global_stop)
 const canStart=!runtime&&!stop&&Boolean(policy?.enabled)&&active>0&&Number(policy?.max_autonomy_level??0)>0
 async function start(){const r=reason("Start Controlled Operations","START");if(!r)return;await invoke("Start",()=>sb.rpc("hq_workforce_owner_start_controlled_operations",{p_expected_updated_at:e.updated_at,p_autonomy_level:Math.max(1,Math.min(4,Number(policy.max_autonomy_level))),p_max_risk:Math.max(0,Math.min(5,Number(policy.max_risk_class))),p_reason:r}))}
 async function stopOps(){const r=reason("Stop Operations","CONFIRM");if(!r)return;await invoke("Stop",()=>sb.rpc("hq_workforce_owner_stop_operations",{p_expected_updated_at:e.updated_at,p_reason:r}))}
 async function globalStop(active:boolean){const r=reason(active?"Activate Global Stop":"Release Global Stop",active?"GLOBAL STOP":"CONFIRM");if(!r)return;await invoke("Global Stop",()=>sb.rpc("hq_workforce_owner_set_global_stop",{p_active:active,p_reason:r}))}
 return <div style={{display:"grid",gap:12}}>
  {error&&<div role="alert" style={{padding:12,border:`1px solid ${C.red}55`,borderRadius:11,color:C.red}}>{error}</div>}
  <HQPanel title="Owner operations" description="Bounded runtime controls. Every consequential action is owner-gated, reasoned and server-authoritative."><div style={{padding:14,display:"grid",gap:12}}>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(125px,1fr))",gap:8}}><Metric label="Runtime" value={runtime?"ON":"OFF"}/><Metric label="Autonomy" value={`L${e.runtime_autonomy_level??0}`}/><Metric label="Maximum risk" value={`R${e.runtime_max_risk??0}`}/><Metric label="Global Stop" value={stop?"ACTIVE":"INACTIVE"}/><Metric label="Active authority" value={active}/><Metric label="Tripped breakers" value={ops.counts?.tripped_breakers??0}/></div>
   <div style={{fontSize:10.5,color:C.muted}}>State version {when(e.updated_at)}. Start requires an enabled global policy, active unexpired R1.4 authority and Global Stop released.</div>
   <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button disabled={busy||runtime||!canStart} onClick={()=>setShowStart(true)} style={hqButtonStyle}>Review Start</button><button disabled={busy} onClick={()=>void stopOps()} style={hqButtonStyle}>Stop Operations</button>{stop?<button disabled={busy} onClick={()=>void globalStop(false)} style={hqButtonStyle}>Release Global Stop</button>:<button disabled={busy} onClick={()=>void globalStop(true)} style={{...hqButtonStyle,color:C.red}}>GLOBAL STOP</button>}</div>
   {!canStart&&!runtime&&<div style={{fontSize:10.5,color:C.muted}}>Start is blocked by current authoritative readiness. The UI cannot manufacture policy or authority.</div>}
   {showStart&&<div style={{padding:12,border:`1px solid ${C.border}`,borderRadius:12}}><strong>Activation review</strong><div style={{fontSize:10.5,color:C.muted,margin:"6px 0 10px"}}>OFF → ON · autonomy L{policy?.max_autonomy_level??0} · max risk R{policy?.max_risk_class??0} · active authority {active}. This does not enable heartbeat or Factory.</div><button disabled={busy||!canStart} onClick={()=>void start()} style={hqButtonStyle}>Confirm controlled start</button></div>}
  </div></HQPanel>
  <HQPanel title="Recent governed executions" description="Verification status and authority linkage from canonical Worker lineage."><div style={{padding:14,display:"grid",gap:7}}>{(ops.executions??[]).slice(0,8).map((x:Obj)=><div key={x.id} style={{paddingBottom:7,borderBottom:`1px solid ${C.border}`,fontSize:10.5}}><strong>{x.task_key}</strong> · {x.status} · verification {x.verification_status??"—"}<div style={{color:C.muted}}>{x.worker_key} · authority {x.autonomous_authority_grant_id??"none"}</div></div>)}</div></HQPanel>
 </div>
}