"use client"
export const dynamic = "force-dynamic"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { hqSupabase } from "@/lib/hq/supabase"
import HQTwinDrawer from "@/components/hq/TwinDrawer"
import { HQPage, HQPanel, HQ_THEME as C, hqButtonStyle } from "@/components/hq/HQShell"
import { clearAllHQOfflineData, isHQOnline, readHQCache, saveHQCache } from "@/lib/hq/offline"

type Obj=Record<string,any>
type SourceState<T>={status:"loading"|"live"|"cached"|"failed";data:T|null;error?:string;observedAt?:string|null}
type Control={product_key:string;policy_key:string;desired_value:unknown;observed_value:unknown;state:string;verified_at?:string|null;last_error?:string|null}
type WorkerSnapshot={generated_at?:string;engine?:Obj|null;counts?:Obj;failures?:{anomalies?:Obj[];dead_letters?:Obj[]}}
type Cache={report:Obj|null;controls:Control[];health:Obj|null;decisions:Obj[];workforce:WorkerSnapshot|null}
type Health="Healthy"|"Degraded"|"Critical"|"Unknown"
const sb=hqSupabase as any
const initial=<T,>():SourceState<T>=>({status:"loading",data:null})
const fmt=(v:unknown)=>typeof v==="number"?new Intl.NumberFormat("en-KE",{maximumFractionDigits:1}).format(v):v==null?"Unknown":String(v)
const n=(v:unknown)=>typeof v==="number"&&Number.isFinite(v)?v:null
const arr=(v:unknown)=>Array.isArray(v)?v:[]
const str=(v:unknown)=>typeof v==="string"?v:""
const lower=(v:unknown)=>str(v).toLowerCase()
const firstNumber=(...values:unknown[])=>{for(const v of values){const x=n(v);if(x!==null)return x}return null}
const tone=(h:Health)=>h==="Healthy"?C.green:h==="Degraded"?C.amber:h==="Critical"?C.red:C.muted
const sourceLabel=(s:SourceState<unknown>)=>s.status==="live"?"Live":s.status==="cached"?"Cached":s.status==="failed"?"Unavailable":"Loading"

function Status({value}:{value:Health}){return <span style={{display:"inline-flex",alignItems:"center",minHeight:25,padding:"0 8px",borderRadius:999,border:`1px solid ${tone(value)}55`,background:`${tone(value)}12`,color:tone(value),fontSize:9,fontWeight:900}}>{value}</span>}
function SourceBadge({state}:{state:SourceState<unknown>}){const c=state.status==="live"?C.green:state.status==="cached"?C.amber:state.status==="failed"?C.red:C.muted;return <span title={state.error??undefined} style={{fontSize:8.5,fontWeight:850,color:c}}>{sourceLabel(state)}</span>}
function Metric({label,value,note,href}:{label:string;value:unknown;note?:string;href?:string}){const body=<div className="today-metric"><span>{label}</span><strong>{fmt(value)}</strong>{note&&<small>{note}</small>}</div>;return href?<Link href={href} style={{textDecoration:"none",color:"inherit"}}>{body}</Link>:body}
function Empty({children}:{children:React.ReactNode}){return <div style={{padding:18,color:C.muted,fontSize:11,lineHeight:1.55}}>{children}</div>}
function SectionHead({title,state,href}:{title:string;state?:SourceState<unknown>;href?:string}){return <div className="today-section-head"><strong>{title}</strong><div>{state&&<SourceBadge state={state}/>} {href&&<Link href={href}>Open</Link>}</div></div>}

function deriveHealth(report:Obj|null,health:Obj|null,workforce:WorkerSnapshot|null,reportState:SourceState<Obj>,healthState:SourceState<Obj>,workforceState:SourceState<WorkerSnapshot>){
 const operations=report?.operations??{}
 const outstanding=report?.outstanding??{}
 const incidents=arr(outstanding.incidents)
 const criticalIncidents=incidents.filter((x:Obj)=>["sev-0","sev-1","critical"].includes(lower(x.severity))).length
 const failedNotifications=firstNumber(operations?.notifications?.failed_24h)
 const paymentFailures=firstNumber(operations?.payments?.failed_7d)
 const runtimeDenials=firstNumber(operations?.runtime?.denials_24h)
 const certifications=arr(health?.runtime_certifications)
 const failedCerts=certifications.filter((x:Obj)=>lower(x.result)==="fail").length
 const engine=workforce?.engine??{}
 const workerUnsafe=Boolean(engine.runtime_execution_enabled)||Number(engine.runtime_autonomy_level??0)>0||Boolean(engine.factory_enabled)||Boolean(engine.heartbeat_enabled)
 const workerFailures=arr(workforce?.failures?.anomalies).length+arr(workforce?.failures?.dead_letters).length
 const unknown=(s:SourceState<unknown>)=>s.status!=="live"
 const result:Record<string,Health>={
  Auth:unknown(reportState)?"Unknown":criticalIncidents?"Critical":"Unknown",
  Teacher:"Unknown",
  Student:"Unknown",
  Parent:"Unknown",
  Admin:"Unknown",
  VibeLearn:"Unknown",
  "Learning writes":"Unknown",
  Assessments:"Unknown",
  Notifications:unknown(reportState)||failedNotifications===null?"Unknown":failedNotifications>0?"Degraded":"Healthy",
  "Worker Engine":unknown(workforceState)?"Unknown":workerUnsafe?"Critical":workerFailures>0?"Degraded":"Healthy",
  Payments:unknown(reportState)||paymentFailures===null?"Unknown":paymentFailures>0?"Degraded":"Healthy",
  "Control plane":unknown(healthState)?"Unknown":failedCerts>0?"Critical":certifications.length?"Healthy":"Unknown",
  Security:unknown(reportState)||runtimeDenials===null?"Unknown":runtimeDenials>0?"Degraded":"Healthy",
 }
 return result
}

export default function HQToday(){
 const router=useRouter()
 const[report,setReport]=useState<SourceState<Obj>>(initial)
 const[,setControls]=useState<SourceState<Control[]>>(initial)
 const[health,setHealth]=useState<SourceState<Obj>>(initial)
 const[decisions,setDecisions]=useState<SourceState<Obj[]>>(initial)
 const[workforce,setWorkforce]=useState<SourceState<WorkerSnapshot>>(initial)
 const[busy,setBusy]=useState(false)
 const[twinOpen,setTwinOpen]=useState(false)
 const[refreshError,setRefreshError]=useState("")

 const restore=useCallback(()=>{const cached=readHQCache<Cache>("task18-today");if(!cached)return false;const observedAt=new Date(cached.savedAt).toISOString();setReport({status:"cached",data:cached.value.report,observedAt});setControls({status:"cached",data:cached.value.controls,observedAt});setHealth({status:"cached",data:cached.value.health,observedAt});setDecisions({status:"cached",data:cached.value.decisions,observedAt});setWorkforce({status:"cached",data:cached.value.workforce,observedAt});return true},[])

 const refresh=useCallback(async()=>{
  setRefreshError("")
  const calls=await Promise.allSettled([
   sb.rpc("hq_get_seven_day_owner_report"),
   sb.rpc("hq_get_product_controls"),
   sb.rpc("hq_get_control_health_v2"),
   sb.rpc("hq_workforce_list_decisions",{p_status:"actionable",p_limit:100}),
   sb.rpc("hq_workforce_get_control_room_snapshot",{p_recent_limit:25}),
  ])
  const now=new Date().toISOString()
  const read=<T,>(i:number,current:SourceState<T>):SourceState<T>=>{
   const settled=calls[i]
   if(settled.status==="rejected")return current.data?{...current,status:"cached",error:String(settled.reason)}:{status:"failed",data:null,error:String(settled.reason)}
   const result=settled.value as {data:T|null;error?:{message?:string}|null}
   if(result.error)return current.data?{...current,status:"cached",error:result.error.message??"Source unavailable"}:{status:"failed",data:null,error:result.error.message??"Source unavailable"}
   return {status:"live",data:result.data,observedAt:now}
  }
  setReport(old=>read(0,old));setControls(old=>read(1,old));setHealth(old=>read(2,old));setDecisions(old=>read(3,old));setWorkforce(old=>read(4,old))

  const succeeded=calls.map(x=>x.status==="fulfilled"&&!(x.value as any)?.error)
  if(!succeeded.every(Boolean))setRefreshError("Some HQ evidence sources are unavailable. Available panels remain usable; unavailable or stale data is shown as Unknown, not zero or healthy.")
  if(succeeded.every(Boolean)){
   const values=calls.map(x=>(x as PromiseFulfilledResult<any>).value.data)
   saveHQCache("task18-today",{report:values[0],controls:values[1]??[],health:values[2],decisions:values[3]??[],workforce:values[4]})
  }
 },[])

 useEffect(()=>{if(!isHQOnline())restore();void refresh()},[refresh,restore])
 async function runCycle(){if(!isHQOnline()){setRefreshError("Reconnect before running the operating cycle.");return}setBusy(true);const{error}=await sb.rpc("hq_run_operating_cycle");if(error)setRefreshError(error.message??"Operating cycle failed.");else await refresh();setBusy(false)}
 async function signOut(){clearAllHQOfflineData();await hqSupabase.auth.signOut({scope:"local"});router.replace("/hq/login")}

 const r=report.data??{}
 const headline=r?.executive_dashboard?.headline??r?.executive_dashboard?.headline_metrics??{}
 const engagement=r?.product_engagement??{}
 const operations=r?.operations??{}
 const outstanding=r?.outstanding??{}
 const incidentItems=arr(outstanding.incidents)
 const findingItems=arr(outstanding.findings)
 const workItems=arr(outstanding.work)
 const supportItems=arr(outstanding.support_cases)
 const decisionItems=arr(decisions.data)
 const attention=[
  ...incidentItems.map((x:Obj)=>({...x,kind:"Incident",href:"/hq/intelligence"})),
  ...findingItems.map((x:Obj)=>({...x,kind:"Finding",href:"/hq/intelligence"})),
  ...supportItems.map((x:Obj)=>({...x,kind:"Support",href:"/hq/support"})),
  ...decisionItems.map((x:Obj)=>({...x,kind:"Decision",href:"/hq/decisions"})),
  ...arr(workforce.data?.failures?.anomalies).map((x:Obj)=>({...x,kind:"Worker",href:"/hq/workforce"})),
 ].sort((a:Obj,b:Obj)=>{const rank=(x:Obj)=>["critical","sev-0","sev-1","high"].includes(lower(x.severity??x.priority))?0:1;return rank(a)-rank(b)}).slice(0,12)

 const activeSchools=firstNumber(headline.active_schools,headline.schools,engagement.schools)
 const activeTeachers=firstNumber(headline.active_teachers,headline.teachers,engagement.teachers)
 const activeStudents=firstNumber(headline.active_students,headline.activated_learners,headline.learners,engagement.students)
 const activeParents=firstNumber(headline.active_parents,headline.parents,engagement.parents)
 const dau=firstNumber(headline.dau)
 const learningSessions=firstNumber(headline.learning_sessions,headline.active_sessions,engagement.learning_sessions)
 const attendance=firstNumber(headline.attendance_rate,engagement.attendance_rate)
 const revenue=firstNumber(r?.finance?.reconciled_revenue_kes,r?.finance?.revenue_kes,r?.finance?.total_revenue)
 const paymentAttempts=firstNumber(operations?.payments?.attempts_7d)
 const paymentSettled=firstNumber(operations?.payments?.settled_7d)
 const paymentFailures=firstNumber(operations?.payments?.failed_7d)
 const healthMap=deriveHealth(r,health.data,workforce.data,report,health,workforce)
 const healthValues=Object.values(healthMap)
 const overall:Health=healthValues.includes("Critical")?"Critical":healthValues.includes("Degraded")?"Degraded":healthValues.every(x=>x==="Healthy")?"Healthy":"Unknown"
 const engine=workforce.data?.engine??{}
 const workerSafe=workforce.status==="live"&&!Boolean(engine.runtime_execution_enabled)&&Number(engine.runtime_autonomy_level??0)===0&&!Boolean(engine.factory_enabled)&&!Boolean(engine.heartbeat_enabled)
 const generatedAt=report.data?.generated_at??report.observedAt

 return <><HQPage title="Today" description="Company state → attention → evidence → decision → action → verification" actions={<><button onClick={()=>void refresh()} style={hqButtonStyle}>Refresh evidence</button><button onClick={()=>void runCycle()} disabled={busy} style={hqButtonStyle}>{busy?"Running…":"Run operating cycle"}</button><button onClick={()=>setTwinOpen(true)} style={{...hqButtonStyle,color:C.blue}}>Ask HQ Twin</button><button onClick={()=>void signOut()} style={{...hqButtonStyle,color:C.red}}>Sign out</button></>}>
  <style jsx global>{`
  .today-banner{display:grid;grid-template-columns:1fr auto;gap:14px;align-items:center;padding:15px;border:1px solid var(--hq-border);border-radius:14px;background:linear-gradient(90deg,rgba(59,130,246,.08),rgba(34,197,94,.035));margin-bottom:10px}.today-banner h2{font-size:16px;margin:0 0 4px}.today-banner p{margin:0;color:var(--hq-muted);font-size:10px;line-height:1.5}.today-grid{display:grid;grid-template-columns:1.35fr 1fr;gap:10px;margin-top:10px}.today-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:12px}.today-metric{min-height:86px;border:1px solid rgba(148,163,184,.1);border-radius:11px;background:rgba(255,255,255,.02);padding:11px}.today-metric span{display:block;color:#8ea1b8;font-size:8.5px}.today-metric strong{display:block;margin-top:7px;color:#f8fafc;font-size:20px;letter-spacing:-.03em}.today-metric small{display:block;margin-top:5px;color:#71849a;font-size:8px;line-height:1.35}.today-section-head{display:flex;justify-content:space-between;align-items:center;padding:12px 13px;border-bottom:1px solid var(--hq-border)}.today-section-head strong{font-size:10px;text-transform:uppercase;letter-spacing:.05em}.today-section-head>div{display:flex;gap:10px;align-items:center}.today-section-head a{font-size:8.5px;color:#60a5fa;text-decoration:none}.today-attention{display:grid}.today-attention a{display:grid;grid-template-columns:74px 1fr auto;gap:10px;align-items:center;padding:11px 13px;text-decoration:none;color:inherit;border-bottom:1px solid rgba(148,163,184,.08)}.today-attention a:last-child{border-bottom:0}.today-attention i{font-style:normal;font-size:8px;font-weight:900;color:#f59e0b}.today-attention strong{font-size:10.5px}.today-attention small{font-size:8.5px;color:#778aa1}.today-health{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;padding:12px}.today-health-row{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:9px;border:1px solid rgba(148,163,184,.08);border-radius:9px;font-size:9.5px}.today-links{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px}.today-link{min-height:82px;padding:12px;border:1px solid var(--hq-border);border-radius:12px;background:var(--hq-panel);color:#f8fafc;text-decoration:none}.today-link strong{display:block;font-size:10.5px}.today-link small{display:block;margin-top:6px;color:#71849a;font-size:8.5px;line-height:1.4}.today-warning{padding:11px 13px;border:1px solid rgba(245,158,11,.3);border-radius:11px;background:rgba(245,158,11,.07);color:#fde68a;font-size:10px;line-height:1.45;margin-bottom:10px}
  @media(max-width:1050px){.today-grid{grid-template-columns:1fr}.today-metrics{grid-template-columns:repeat(2,1fr)}.today-links{grid-template-columns:repeat(2,1fr)}}
  @media(max-width:720px){.today-banner{grid-template-columns:1fr}.today-metrics{grid-template-columns:repeat(2,1fr);padding:9px}.today-metric{min-height:78px}.today-metric strong{font-size:18px}.today-health{grid-template-columns:1fr;padding:9px}.today-attention a{grid-template-columns:62px 1fr}.today-attention small{display:none}.today-links{grid-template-columns:1fr 1fr;gap:7px}.today-link{min-height:76px}}
  `}</style>

  {refreshError&&<div role="alert" className="today-warning">{refreshError}</div>}
  <section className="today-banner"><div><h2>Company status: <span style={{color:tone(overall)}}>{overall}</span></h2><p>{generatedAt?`Evidence generated ${new Date(String(generatedAt)).toLocaleString("en-KE")}. `:"No report timestamp is available. "}Unknown means evidence is unavailable, stale or insufficient; it never means zero or healthy.</p></div><Status value={overall}/></section>

  <HQPanel><SectionHead title="Pilot overview" state={report}/><div className="today-metrics">
   <Metric label="Daily active users" value={dau} note="Authoritative report only" href="/hq/analytics"/>
   <Metric label="Active schools" value={activeSchools} note="No inferred school counts" href="/hq/schools"/>
   <Metric label="Active teachers" value={activeTeachers} note="Pilot activity" href="/hq/users"/>
   <Metric label="Active students" value={activeStudents} note="Pilot activity" href="/hq/users"/>
   <Metric label="Active parents" value={activeParents} note="Pilot activity" href="/hq/users"/>
   <Metric label="Learning sessions" value={learningSessions} note="Activity, not effectiveness" href="/hq/analytics"/>
   <Metric label="Attendance rate" value={attendance===null?null:`${attendance}%`} note="Only when reported" href="/hq/analytics"/>
   <Metric label="Reconciled revenue" value={revenue===null?null:`KES ${fmt(revenue)}`} note="Never STK initiation" href="/hq/billing"/>
  </div></HQPanel>

  <div className="today-grid">
   <HQPanel><SectionHead title={`Needs Attention · ${attention.length}`} href="/hq/notifications"/>{attention.length?<div className="today-attention">{attention.map((x:Obj,i)=><Link href={x.href??"/hq/intelligence"} key={String(x.id??x.decision_key??i)}><i>{x.kind}</i><strong>{x.title??x.anomaly_key??x.decision_key??"Requires investigation"}</strong><small>{x.severity??x.priority??x.status??"Review"}</small></Link>)}</div>:report.status==="live"&&decisions.status==="live"&&workforce.status==="live"?<Empty>No currently surfaced critical incidents, findings, support cases, decisions or Worker anomalies.</Empty>:<Empty>Attention evidence is incomplete. This is <strong>Unknown</strong>, not “nothing needs attention”.</Empty>}</HQPanel>
   <HQPanel><SectionHead title="System health" state={health}/><div className="today-health">{Object.entries(healthMap).map(([label,value])=><div className="today-health-row" key={label}><span>{label}</span><Status value={value}/></div>)}</div></HQPanel>
  </div>

  <div className="today-grid">
   <HQPanel><SectionHead title="Worker Engine safety" state={workforce} href="/hq/workforce"/>{workforce.data?<div className="today-metrics"><Metric label="Runtime" value={workerSafe?"L0 / OFF":"REVIEW"}/><Metric label="Workers" value={n(workforce.data.counts?.workers)}/><Metric label="Review decisions" value={n(workforce.data.counts?.decisions_waiting)}/><Metric label="Open anomalies" value={n(workforce.data.counts?.open_anomalies)}/></div>:<Empty>Worker Engine safety evidence is unavailable. Do not infer safe operation from silence.</Empty>}</HQPanel>
   <HQPanel><SectionHead title="Payments" state={report} href="/hq/billing"/><div className="today-metrics"><Metric label="Attempts · 7d" value={paymentAttempts}/><Metric label="Settled · 7d" value={paymentSettled}/><Metric label="Failed · 7d" value={paymentFailures}/><Metric label="Revenue" value={revenue===null?null:`KES ${fmt(revenue)}`}/></div></HQPanel>
  </div>

  <div className="today-links">
   <Link className="today-link" href="/hq/intelligence"><strong>Investigate operations</strong><small>Incidents, failures, live operational state and evidence.</small></Link>
   <Link className="today-link" href="/hq/decisions"><strong>Decision Inbox</strong><small>{decisionItems.length?`${decisionItems.length} actionable decision(s) surfaced.`:"Review governed owner decisions."}</small></Link>
   <Link className="today-link" href="/hq/schools"><strong>Pilot schools</strong><small>Inspect school identity, activation and operating health.</small></Link>
   <Link className="today-link" href="/hq/analytics"><strong>Product & learning</strong><small>Funnels, retention, learning activity and evidence.</small></Link>
   <Link className="today-link" href="/hq/users"><strong>People</strong><small>Teacher, learner, parent and admin activation.</small></Link>
   <Link className="today-link" href="/hq/marketing"><strong>Growth</strong><small>Acquisition, activation and school pipeline.</small></Link>
   <Link className="today-link" href="/hq/workforce"><strong>Workforce</strong><small>Control Room, jobs, authority, evidence and failures.</small></Link>
   <Link className="today-link" href="/hq/security"><strong>Security & controls</strong><small>Owner controls, control health and governed safety state.</small></Link>
  </div>

  {workItems.length>0&&<div style={{marginTop:10}}><HQPanel><SectionHead title="Open operating work" href="/hq/intelligence"/><div className="today-attention">{workItems.slice(0,8).map((x:Obj,i)=><Link href="/hq/intelligence" key={String(x.id??i)}><i>{x.priority??"Work"}</i><strong>{x.title??"Operating work"}</strong><small>{x.status??"Open"}</small></Link>)}</div></HQPanel></div>}
 </HQPage><HQTwinDrawer open={twinOpen} onClose={()=>setTwinOpen(false)}/></>
}
