"use client"
export const dynamic="force-dynamic"

import {useCallback,useEffect,useMemo,useState} from "react"
import {supabase} from "@/lib/supabase"
import {HQPage,HQPanel,HQ_THEME as C,hqButtonStyle} from "@/components/hq/HQShell"

type Obj=Record<string,any>
type Snapshot={generated_at:string;engine:Obj|null;counts:Obj;workers:Obj[];jobs:Obj[];shadow_candidates:Obj[];shadow_runs:Obj[];decisions:Obj[];skills:Obj[];authority:Obj[];evidence:Obj[];failures:{anomalies:Obj[];dead_letters:Obj[]};resources:Obj[]}
type OpsSnapshot={generated_at:string;engine:Obj;global_policy:Obj|null;authority:Obj[];breakers:Obj[];executions:Obj[];budgets:Obj[];control_events:Obj[];counts:Obj}
type Tab="Control Room"|"Workers"|"Jobs"|"Shadow Runs"|"Decisions"|"Skills"|"Authority"|"Evidence"|"Failures"|"Resources"
type Kind="info"|"good"|"warn"|"bad"
const sb=supabase as any
const tabs:Tab[]=["Control Room","Workers","Jobs","Shadow Runs","Decisions","Skills","Authority","Evidence","Failures","Resources"]
const yes=(v:any)=>v===true
const tone=(k:Kind)=>k==="bad"?C.red:k==="warn"?C.amber:k==="good"?C.green:C.blue
const when=(v:any)=>v?new Date(String(v)).toLocaleString("en-KE"):"—"
const short=(v:any,n=110)=>{const s=typeof v==="string"?v:JSON.stringify(v??{});return s.length>n?s.slice(0,n)+"…":s}
const num=(v:any,fallback:number)=>Number.isFinite(Number(v))?Number(v):fallback

function Badge({children,kind="info"}:{children:React.ReactNode;kind?:Kind}){return <span style={{display:"inline-flex",alignItems:"center",minHeight:24,padding:"0 8px",borderRadius:999,border:`1px solid ${tone(kind)}44`,background:`${tone(kind)}12`,color:tone(kind),fontSize:10,fontWeight:900}}>{children}</span>}
function Metric({label,value,kind="info"}:{label:string;value:any;kind?:Kind}){return <div style={{padding:13,border:`1px solid ${C.border}`,borderRadius:14,background:C.panelSoft}}><div style={{fontSize:22,fontWeight:950,color:tone(kind)}}>{String(value??0)}</div><div style={{marginTop:4,fontSize:10.5,color:C.muted}}>{label}</div></div>}
function Rows({items,render,empty="No records."}:{items:Obj[];render:(x:Obj)=>React.ReactNode;empty?:string}){return <div style={{display:"grid",gap:8}}>{items.length?items.map((x,i)=><div key={String(x.id??x.trace_id??x.worker_key??x.skill_key??i)} style={{padding:12,borderBottom:i===items.length-1?"none":`1px solid ${C.border}`}}>{render(x)}</div>):<div style={{padding:24,textAlign:"center",fontSize:11.5,color:C.muted}}>{empty}</div>}</div>}
function Box({title,children}:{title:string;children:React.ReactNode}){return <div style={{padding:14,border:`1px solid ${C.border}`,borderRadius:14,background:C.panelSoft}}><div style={{fontSize:12,fontWeight:900,marginBottom:8}}>{title}</div>{children}</div>}

export default function WorkerEngineControlRoom(){
 const[data,setData]=useState<Snapshot|null>(null)
 const[ops,setOps]=useState<OpsSnapshot|null>(null)
 const[tab,setTab]=useState<Tab>("Control Room")
 const[loading,setLoading]=useState(true)
 const[actionBusy,setActionBusy]=useState(false)
 const[error,setError]=useState("")
 const[message,setMessage]=useState("")
 const[showStart,setShowStart]=useState(false)

 const load=useCallback(async()=>{setLoading(true);setError("");try{
  const[{data:base,error:baseError},{data:oper,error:opsError}]=await Promise.all([
   sb.rpc("hq_workforce_get_control_room_snapshot",{p_recent_limit:50}),
   sb.rpc("hq_workforce_owner_control_snapshot",{p_recent_limit:50})
  ])
  if(baseError)throw baseError
  setData(base as Snapshot)
  if(opsError){setOps(null);setError(`Operational controls are not commissioned on this environment: ${opsError.message}`)}else setOps(oper as OpsSnapshot)
 }catch(err){setError(err instanceof Error?err.message:"Worker Engine Control Room could not be loaded.")}finally{setLoading(false)}},[])
 useEffect(()=>{void load()},[load])

 const e=ops?.engine??data?.engine??{}
 const runtimeOn=yes(e.runtime_execution_enabled)
 const globalStop=yes(e.shadow_global_stop)
 const policy=ops?.global_policy
 const activeAuthority=num(ops?.counts?.active_authority,0)
 const canStart=Boolean(ops)&&!runtimeOn&&!globalStop&&yes(policy?.enabled)&&activeAuthority>0&&num(policy?.max_autonomy_level,0)>0
 const startAutonomy=Math.max(1,Math.min(4,num(policy?.max_autonomy_level,1)))
 const startRisk=Math.max(0,Math.min(5,num(policy?.max_risk_class,0)))
 const safety=useMemo(()=>({runtimeOff:!runtimeOn&&num(e.runtime_autonomy_level,0)===0,factoryOff:!yes(e.factory_enabled),heartbeatOff:!yes(e.heartbeat_enabled)}),[e,runtimeOn])

 async function invoke(label:string,call:()=>Promise<any>){setActionBusy(true);setError("");setMessage("");try{const r=await call();if(r.error)throw r.error;setMessage(`${label} completed. Authoritative state refreshed.`);setShowStart(false);await load()}catch(err){setError(err instanceof Error?err.message:String((err as any)?.message??err))}finally{setActionBusy(false)}}
 function reasonAndConfirm(label:string,token:string){const reason=window.prompt(`${label} — enter an audit reason`);if(!reason?.trim())return null;if(window.prompt(`Type ${token} to confirm`)!==token)return null;return reason.trim()}

 async function runtimeAction(kind:"start"|"stop"|"global-on"|"global-off"){
  if(!ops)return
  const label=kind==="start"?"Start Controlled Operations":kind==="stop"?"Stop Operations":kind==="global-on"?"Activate Global Stop":"Release Global Stop"
  const token=kind==="start"?"START":kind==="global-on"?"GLOBAL STOP":"CONFIRM"
  const reason=reasonAndConfirm(label,token);if(!reason)return
  await invoke(label,()=>kind==="start"
   ?sb.rpc("hq_workforce_owner_start_controlled_operations",{p_expected_updated_at:e.updated_at,p_autonomy_level:startAutonomy,p_max_risk:startRisk,p_reason:reason})
   :kind==="stop"
    ?sb.rpc("hq_workforce_owner_stop_operations",{p_expected_updated_at:e.updated_at,p_reason:reason})
    :sb.rpc("hq_workforce_owner_set_global_stop",{p_active:kind==="global-on",p_reason:reason}))
 }

 async function configureEnvelope(){if(!ops||runtimeOn)return
  const a=num(window.prompt("Maximum autonomy level (0–4)",String(policy?.max_autonomy_level??1)),NaN)
  const r=num(window.prompt("Maximum risk class (0–5)",String(policy?.max_risk_class??1)),NaN)
  const c=num(window.prompt("Maximum concurrency (1–1000)",String(policy?.max_concurrency??1)),NaN)
  const rate=num(window.prompt("Maximum executions per minute (1–100000)",String(policy?.max_executions_per_minute??10)),NaN)
  if(!Number.isInteger(a)||a<0||a>4||!Number.isInteger(r)||r<0||r>5||!Number.isInteger(c)||c<1||c>1000||!Number.isInteger(rate)||rate<1||rate>100000){setError("Envelope values are outside the supported backend limits.");return}
  const reason=reasonAndConfirm("Save global operating envelope","SAVE ENVELOPE");if(!reason)return
  await invoke("Global operating envelope",()=>sb.rpc("hq_workforce_owner_configure_global_envelope",{p_expected_updated_at:e.updated_at,p_enabled:a>0,p_max_autonomy_level:a,p_max_risk_class:r,p_max_concurrency:c,p_max_executions_per_minute:rate,p_reason:reason}))
 }

 async function authorityAction(g:Obj,action:"certify"|"activate"|"suspend"|"revoke"){
  const token=action==="activate"?"ACTIVATE AUTHORITY":action==="revoke"?"REVOKE":"CONFIRM"
  const reason=reasonAndConfirm(`${action} ${g.grant_key??g.capability_key}`,token);if(!reason)return
  await invoke(`Authority ${action}`,()=>sb.rpc("hq_workforce_owner_control_authority",{p_grant_id:g.id,p_action:action,p_reason:reason}))
 }
 async function resetBreaker(b:Obj){const reason=reasonAndConfirm(`Reset breaker ${b.scope_type}:${b.scope_ref}`,"RESET BREAKER");if(!reason)return;await invoke("Breaker reset",()=>sb.rpc("hq_workforce_owner_reset_breaker",{p_breaker_id:b.id,p_reason:reason}))}
 async function reviewDecision(id:string,state:"approved"|"rejected"|"revise"){const rationale=window.prompt(state==="approved"?"Optional review rationale":"Review rationale")??"";if(state!=="approved"&&!rationale.trim())return;await invoke("Decision review",()=>sb.rpc("hq_workforce_owner_review_shadow_decision",{p_decision_id:id,p_state:state,p_rationale:rationale||null}))}

 return <HQPage title="Worker Engine Control Room" description="Secure owner control plane for bounded Worker Engine operations, authority, evidence and emergency containment" actions={<button onClick={()=>void load()} disabled={loading||actionBusy} style={hqButtonStyle}>{loading?"Refreshing…":"Refresh state"}</button>}>
  {error&&<div role="alert" style={{marginBottom:12,padding:12,border:`1px solid ${C.red}55`,borderRadius:11,background:`${C.red}10`,color:C.red,fontSize:11.5}}>{error}</div>}
  {message&&<div role="status" style={{marginBottom:12,padding:12,border:`1px solid ${C.green}44`,borderRadius:11,background:`${C.green}10`,color:C.green,fontSize:11.5}}>{message}</div>}
  <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:10}}>{tabs.map(t=><button key={t} onClick={()=>setTab(t)} style={{...hqButtonStyle,minHeight:38,whiteSpace:"nowrap",color:tab===t?C.green:C.muted,borderColor:tab===t?`${C.green}55`:C.border}}>{t}</button>)}</div>
  {!data?<HQPanel><div style={{padding:28,color:C.muted,fontSize:12}}>{loading?"Loading authoritative Worker Engine state…":"No control-room snapshot available."}</div></HQPanel>:<>
   {tab==="Control Room"&&<div style={{display:"grid",gap:12}}>
    <HQPanel title="Safety summary" description="Authoritative backend posture. OFF is a legitimate safe state."><div style={{padding:14,display:"grid",gap:12}}>
     <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(128px,1fr))",gap:8}}>
      <Metric label="Runtime" value={runtimeOn?"ON":"OFF"} kind={runtimeOn?"warn":"good"}/><Metric label="Autonomy" value={`L${e.runtime_autonomy_level??0}`}/><Metric label="Maximum risk" value={`R${e.runtime_max_risk??0}`}/><Metric label="Global Stop" value={globalStop?"ACTIVE":"INACTIVE"} kind={globalStop?"good":"warn"}/><Metric label="Active authority" value={activeAuthority} kind={activeAuthority?"warn":"good"}/><Metric label="Active workers" value={ops?.counts?.active_workers??data.counts.active_workers}/><Metric label="Open decisions" value={ops?.counts?.open_decisions??data.counts.decisions_waiting} kind={num(ops?.counts?.open_decisions??data.counts.decisions_waiting,0)>0?"warn":"good"}/><Metric label="Tripped breakers" value={ops?.counts?.tripped_breakers??0} kind={num(ops?.counts?.tripped_breakers,0)>0?"bad":"good"}/>
     </div>
     <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><Badge kind={safety.runtimeOff?"good":"warn"}>Runtime {safety.runtimeOff?"L0 / OFF":"OPERATING"}</Badge><Badge kind={safety.factoryOff?"good":"bad"}>Factory {safety.factoryOff?"OFF":"ON"}</Badge><Badge kind={safety.heartbeatOff?"good":"warn"}>Heartbeat {safety.heartbeatOff?"OFF":"ON"}</Badge><Badge kind={yes(e.runtime_anomaly_paused)?"warn":"good"}>Anomaly pause {yes(e.runtime_anomaly_paused)?"ON":"clear"}</Badge><Badge kind={ops?"good":"warn"}>{ops?"Owner operation RPCs available":"Read-only fallback"}</Badge></div>
     <div style={{fontSize:10.5,color:C.muted}}>State version {when(e.updated_at)} · snapshot {when(ops?.generated_at??data.generated_at)}</div>
    </div></HQPanel>

    <HQPanel title="Safety envelope" description="Configure the explicit global ceiling while runtime is OFF; this does not start operations."><div style={{padding:14,display:"grid",gap:10}}><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:8}}><Metric label="Policy" value={yes(policy?.enabled)?"ENABLED":"DISABLED"} kind={yes(policy?.enabled)?"warn":"good"}/><Metric label="Policy autonomy" value={`L${policy?.max_autonomy_level??0}`}/><Metric label="Policy risk" value={`R${policy?.max_risk_class??0}`}/><Metric label="Concurrency" value={policy?.max_concurrency??"—"}/><Metric label="Rate / min" value={policy?.max_executions_per_minute??"—"}/></div><button disabled={!ops||runtimeOn||actionBusy} onClick={()=>void configureEnvelope()} style={{...hqButtonStyle,minHeight:42,color:C.blue}}>{policy?"Adjust permitted controls":"Create bounded global envelope"}</button>{runtimeOn&&<div style={{fontSize:10.5,color:C.amber}}>Stop Operations before changing the operating envelope.</div>}</div></HQPanel>

    <HQPanel title="Owner operations" description="All consequential actions are owner-authorized server-side, deliberately confirmed and audited."><div style={{padding:14,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:10}}>
     <Box title="Start Controlled Operations"><div style={{fontSize:10.5,color:C.muted,lineHeight:1.6}}>Requires Global Stop released, enabled policy and active temporary authority. Activation never creates authority.</div><button disabled={!canStart||actionBusy} onClick={()=>setShowStart(true)} style={{...hqButtonStyle,width:"100%",marginTop:10,minHeight:44,color:canStart?C.green:C.muted}}>Review activation</button>{!canStart&&<div style={{marginTop:7,fontSize:10,color:C.amber}}>Unavailable until the governed envelope is complete.</div>}</Box>
     <Box title="Stop Operations"><div style={{fontSize:10.5,color:C.muted,lineHeight:1.6}}>Normal shutdown: runtime OFF / L0 / R0; active temporary authority is suspended.</div><button disabled={!ops||!runtimeOn||actionBusy} onClick={()=>void runtimeAction("stop")} style={{...hqButtonStyle,width:"100%",marginTop:10,minHeight:44,color:C.amber}}>Stop Operations</button></Box>
     <Box title="Global Stop"><div style={{fontSize:10.5,color:C.muted,lineHeight:1.6}}>Emergency containment: stops runtime/shadow scheduling, trips the global breaker and neutralizes authority.</div>{globalStop?<button disabled={!ops||actionBusy} onClick={()=>void runtimeAction("global-off")} style={{...hqButtonStyle,width:"100%",marginTop:10,minHeight:44,color:C.amber}}>Release Global Stop</button>:<button disabled={!ops||actionBusy} onClick={()=>void runtimeAction("global-on")} style={{...hqButtonStyle,width:"100%",marginTop:10,minHeight:44,color:C.red}}>Activate Global Stop</button>}</Box>
    </div></HQPanel>

    {showStart&&<HQPanel title="Activation review" description="Current → proposed state. Backend checks run again at execution time."><div style={{padding:14,display:"grid",gap:10}}><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:8}}><Box title="Runtime">OFF → <strong>ON</strong></Box><Box title="Autonomy">L{e.runtime_autonomy_level??0} → <strong>L{startAutonomy}</strong></Box><Box title="Maximum risk">R{e.runtime_max_risk??0} → <strong>R{startRisk}</strong></Box><Box title="Authority">{activeAuthority} active temporary grant{activeAuthority===1?"":"s"}</Box></div><div style={{fontSize:10.5,color:C.muted}}>Policy ceiling: L{policy?.max_autonomy_level??0} / R{policy?.max_risk_class??0}, concurrency {policy?.max_concurrency??"—"}, rate {policy?.max_executions_per_minute??"—"}/min. Global Stop must remain released and authority unexpired.</div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button disabled={actionBusy} onClick={()=>void runtimeAction("start")} style={{...hqButtonStyle,minHeight:44,color:C.green}}>Confirm Start Controlled Operations</button><button disabled={actionBusy} onClick={()=>setShowStart(false)} style={{...hqButtonStyle,minHeight:44}}>Cancel</button></div></div></HQPanel>}

    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(290px,1fr))",gap:12}}>
     <HQPanel title="Temporary authority" description="Certify, activate, suspend or revoke governed drafts without direct database writes."><Rows items={ops?.authority??[]} empty="No temporary authority grants. Governed capability certification must produce a draft before activation can occur." render={g=><><div style={{display:"flex",gap:7,flexWrap:"wrap",alignItems:"center"}}><strong style={{fontSize:11.5}}>{g.capability_key}@{g.capability_version}</strong><Badge kind={g.status==="active"?"warn":g.status==="suspended"?"bad":"info"}>{g.status}</Badge><Badge>R{g.risk_class} · L{g.autonomy_level}</Badge></div><div style={{marginTop:5,fontSize:10.5,color:C.muted}}>{g.permitted_worker_key??"bounded worker scope"} · {g.operation} {g.resource_type} · expires {when(g.expires_at)}</div><div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:9}}>{g.status==="draft"&&<button disabled={actionBusy} onClick={()=>void authorityAction(g,"certify")} style={{...hqButtonStyle,minHeight:36}}>Certify</button>}{g.status==="certified"&&<button disabled={actionBusy||runtimeOn||globalStop} onClick={()=>void authorityAction(g,"activate")} style={{...hqButtonStyle,minHeight:36,color:C.green}}>Activate authority</button>}{g.status==="active"&&<button disabled={actionBusy} onClick={()=>void authorityAction(g,"suspend")} style={{...hqButtonStyle,minHeight:36,color:C.amber}}>Suspend</button>}{["draft","certified","active","suspended"].includes(g.status)&&<button disabled={actionBusy} onClick={()=>void authorityAction(g,"revoke")} style={{...hqButtonStyle,minHeight:36,color:C.red}}>Revoke</button>}</div></>}/></HQPanel>
     <HQPanel title="Circuit breakers" description="Reset removes a prohibition only; it never restarts runtime or grants authority."><Rows items={ops?.breakers??[]} empty="No breaker history in the current window." render={b=><><div style={{display:"flex",gap:7,flexWrap:"wrap"}}><Badge kind={b.status==="tripped"?"bad":"good"}>{b.status}</Badge><strong style={{fontSize:11.5}}>{b.scope_type}: {b.scope_ref}</strong></div><div style={{marginTop:5,fontSize:10.5,color:C.muted}}>{b.reason_code} · tripped {when(b.tripped_at)}{b.reset_at?` · reset ${when(b.reset_at)}`:""}</div>{b.status==="tripped"&&b.scope_type!=="global"&&<button disabled={actionBusy||runtimeOn} onClick={()=>void resetBreaker(b)} style={{...hqButtonStyle,minHeight:36,marginTop:9,color:C.amber}}>Review breaker reset</button>}{b.status==="tripped"&&b.scope_type==="global"&&<div style={{marginTop:8,fontSize:10,color:C.muted}}>Global breaker recovery is controlled only by Release Global Stop.</div>}</>}/></HQPanel>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(290px,1fr))",gap:12}}>
     <HQPanel title="Recent executions" description="What the Worker Engine actually attempted."><Rows items={ops?.executions??[]} empty="No governed execution records yet." render={x=><><div style={{display:"flex",gap:7,flexWrap:"wrap"}}><strong style={{fontSize:11.5}}>{x.worker_key}</strong><Badge>{x.capability_key}</Badge><Badge kind={x.status==="completed"?"good":x.status==="running"?"warn":x.status==="failed"||x.status==="dead_letter"?"bad":"info"}>{x.status}</Badge></div><div style={{marginTop:5,fontSize:10.5,color:C.muted}}>{x.operation} · attempts {x.attempt_count} · verification {x.verification_status??"—"} · {when(x.completed_at??x.started_at??x.created_at)}</div>{x.last_error&&<div style={{marginTop:5,fontSize:10,color:C.red}}>{short(x.last_error)}</div>}</>}/></HQPanel>
     <HQPanel title="Resource envelope" description="Enforceable execution budgets; no fabricated financial estimate."><Rows items={ops?.budgets??[]} empty="No execution budget window is configured." render={x=><><div style={{display:"flex",gap:7,flexWrap:"wrap"}}><strong style={{fontSize:11.5}}>{x.budget_key}</strong><Badge kind={x.status==="exhausted"?"bad":x.status==="active"?"good":"warn"}>{x.status}</Badge></div><div style={{marginTop:5,fontSize:10.5,color:C.muted}}>Consumed {x.consumed_amount} / {x.limit_amount} {x.unit} · reserved {x.reserved_amount} · ends {when(x.period_end)}</div></>}/></HQPanel>
    </div>
    <HQPanel title="Owner audit trail" description="Previous, requested and resulting state for consequential owner controls."><Rows items={ops?.control_events??[]} empty="No Control Room owner actions recorded yet." render={x=><><div style={{display:"flex",gap:7,flexWrap:"wrap"}}><strong style={{fontSize:11.5}}>{x.action_key}</strong><Badge kind={x.outcome==="succeeded"?"good":x.outcome==="rejected"?"bad":"info"}>{x.outcome}</Badge></div><div style={{marginTop:5,fontSize:10.5,color:C.muted}}>{when(x.created_at)} · {short(x.reason)}</div></>}/></HQPanel>
   </div>}

   {tab==="Workers"&&<HQPanel title="Workers" description="Identity, lane and lifecycle."><Rows items={data.workers} render={x=><><div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}><strong style={{fontSize:12.5}}>{x.title}</strong><Badge kind={x.status==="active"?"good":x.status==="suspended"?"bad":"warn"}>{x.status}</Badge><Badge>{x.department_key}</Badge></div><div style={{marginTop:5,fontSize:10.5,color:C.muted}}>{x.worker_key} · {x.reasoning_mode} · last update {when(x.updated_at)}</div></>}/></HQPanel>}
   {tab==="Jobs"&&<HQPanel title="Operational work"><Rows items={data.jobs} render={x=><><div style={{display:"flex",gap:7,flexWrap:"wrap"}}><strong style={{fontSize:12}}>{x.title}</strong><Badge kind={x.priority==="critical"?"bad":x.priority==="high"?"warn":"info"}>{x.priority}</Badge><Badge>{x.status}</Badge></div><div style={{marginTop:5,fontSize:10.5,color:C.muted}}>{x.department_key} · {x.work_type} · due {when(x.due_at)}</div></>}/></HQPanel>}
   {tab==="Shadow Runs"&&<div style={{display:"grid",gap:12}}><HQPanel title="Candidate queue"><Rows items={data.shadow_candidates} render={x=><><div style={{display:"flex",gap:7,flexWrap:"wrap"}}><Badge>{x.lane_key}</Badge><Badge kind={x.status==="escalated"?"warn":"info"}>{x.status}</Badge><strong style={{fontSize:11.5}}>Priority {x.priority}</strong></div><div style={{marginTop:5,fontSize:10.5,color:C.muted}}>{short(x.reasoning_summary)} · confidence {x.confidence??"—"}</div></>}/></HQPanel><HQPanel title="Trace runs"><Rows items={data.shadow_runs} render={x=><><div style={{display:"flex",gap:7,flexWrap:"wrap"}}><strong style={{fontSize:11.5}}>{x.trace_id}</strong><Badge>{x.status}</Badge>{x.consequential_action_performed?<Badge kind="bad">CONSEQUENTIAL WRITE</Badge>:<Badge kind="good">No production action</Badge>}</div><div style={{marginTop:5,fontSize:10.5,color:C.muted}}>{x.worker_key} · {x.lane_key??"—"} · {when(x.started_at)}</div></>}/></HQPanel></div>}
   {tab==="Decisions"&&<HQPanel title="Decision Inbox" description="Review does not grant runtime authority by itself."><Rows items={data.decisions} render={x=><><div style={{display:"flex",gap:7,flexWrap:"wrap"}}><strong style={{fontSize:12}}>{x.decision_key}</strong><Badge kind={x.hypothetical_authority_result==="deny"?"bad":x.hypothetical_authority_result==="escalate"?"warn":"good"}>{x.hypothetical_authority_result}</Badge><Badge>{x.state}</Badge></div><div style={{marginTop:6,fontSize:11}}>{short(x.proposed_action,140)}</div><div style={{marginTop:5,fontSize:10.5,color:C.muted}}>{x.authority_reason} · trace {x.trace_id}</div>{["proposed","awaiting_review","revise"].includes(x.state)&&<div style={{display:"flex",gap:6,marginTop:9,flexWrap:"wrap"}}><button onClick={()=>void reviewDecision(x.id,"approved")} style={{...hqButtonStyle,minHeight:36,color:C.green}}>Approve judgment</button><button onClick={()=>void reviewDecision(x.id,"revise")} style={{...hqButtonStyle,minHeight:36,color:C.violet}}>Revise</button><button onClick={()=>void reviewDecision(x.id,"rejected")} style={{...hqButtonStyle,minHeight:36,color:C.red}}>Reject</button></div>}</>}/></HQPanel>}
   {tab==="Skills"&&<HQPanel title="Skill Registry" description="Uncertified skill has zero autonomous execution authority."><Rows items={data.skills} render={x=><><div style={{display:"flex",gap:7,flexWrap:"wrap"}}><strong style={{fontSize:12}}>{x.skill_key}@{x.version}</strong><Badge kind={x.certification_status==="certified"?"good":x.certification_status==="revoked"?"bad":"warn"}>{x.certification_status}</Badge><Badge>R{x.risk_class} · L{x.autonomy_required}</Badge></div><div style={{marginTop:5,fontSize:10.5,color:C.muted}}>Attempts ≤ {x.max_attempts} · runtime ≤ {x.max_runtime_ms} ms · expires {when(x.expires_at)}</div></>}/></HQPanel>}
   {tab==="Authority"&&<HQPanel title="Authorization evidence" description="Allowed and denied runtime requests with scope and reason."><Rows items={data.authority} render={x=><><div style={{display:"flex",gap:7,flexWrap:"wrap"}}><Badge kind={x.decision==="deny"?"bad":"good"}>{x.decision}</Badge><strong style={{fontSize:11.5}}>{x.worker_key}</strong><Badge>{x.skill_key}</Badge><Badge>R{x.risk_class} · L{x.autonomy_level}</Badge></div><div style={{marginTop:5,fontSize:10.5,color:C.muted}}>{x.reason_code} · {x.scope_type} · {when(x.occurred_at)}</div></>}/></HQPanel>}
   {tab==="Evidence"&&<HQPanel title="Evidence & provenance"><Rows items={data.evidence} render={x=><><div style={{display:"flex",gap:7,flexWrap:"wrap"}}><Badge>{x.evidence_kind}</Badge><Badge kind={String(x.classification).includes("sensitive")?"warn":"info"}>{x.classification}</Badge><strong style={{fontSize:11}}>{x.source_type}</strong></div><div style={{marginTop:5,fontSize:10.5,color:C.muted}}>Trace {x.trace_id} · source {x.source_ref??"—"} · {when(x.created_at)}</div></>}/></HQPanel>}
   {tab==="Failures"&&<div style={{display:"grid",gap:12}}><HQPanel title="Worker Engine anomalies"><Rows items={data.failures.anomalies} render={x=><><div style={{display:"flex",gap:7,flexWrap:"wrap"}}><Badge kind={x.severity==="critical"?"bad":"warn"}>{x.severity}</Badge><Badge>{x.action}</Badge><strong style={{fontSize:11.5}}>{x.anomaly_key}</strong></div><div style={{marginTop:5,fontSize:10.5,color:C.muted}}>{short(x.details)} · {when(x.created_at)}</div></>}/></HQPanel><HQPanel title="Dead-letter work"><Rows items={data.failures.dead_letters} render={x=><><strong style={{fontSize:11.5}}>{x.error_code}</strong><div style={{marginTop:5,fontSize:10.5,color:C.muted}}>{x.worker_key} · attempts {x.attempts} · {short(x.error_detail)}</div></>}/></HQPanel></div>}
   {tab==="Resources"&&<HQPanel title="Resource governance"><Rows items={data.resources} render={x=><><div style={{display:"flex",gap:7,flexWrap:"wrap"}}><Badge>{x.resource_kind}</Badge><strong style={{fontSize:11.5}}>{x.amount} {x.unit}</strong>{x.worker_key&&<Badge>{x.worker_key}</Badge>}</div><div style={{marginTop:5,fontSize:10.5,color:C.muted}}>Window {when(x.window_started_at)} · recorded {when(x.recorded_at)}</div></>}/></HQPanel>}
  </>}
 </HQPage>
}
