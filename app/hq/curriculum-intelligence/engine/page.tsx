"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

type Target = { id:string; label:string; subject:string|null; grade:string|null; cadence:string; enabled:boolean; last_checked_at:string|null; next_check_at:string|null }
type Run = { id:string; watch_target_id:string|null; status:string; trigger_type:string; started_at:string; completed_at:string|null; model:string|null; search_requests:number; proposals_created:number; sources_found:number; summary:string|null; error:string|null }
type Proposal = { id:string; title:string; status:string; editorial_status:string; chapter_id:string|null; curriculum_relevance:string; verification_status:string }
type RegenJob = { id:string; proposal_id:string; job_type:string; status:string; result:any; last_error:string|null; created_at:string; completed_at:string|null }

const C={bg:"#0a1628",panel:"#0f1d33",line:"rgba(255,255,255,.08)",text:"#fff",muted:"rgba(255,255,255,.48)",accent:"#10b981",amber:"#f59e0b",red:"#ef4444",blue:"#3b82f6",violet:"#8b5cf6"}

export default function CurriculumIntelligenceEnginePage(){
  const router=useRouter()
  const [targets,setTargets]=useState<Target[]>([])
  const [runs,setRuns]=useState<Run[]>([])
  const [proposals,setProposals]=useState<Proposal[]>([])
  const [jobs,setJobs]=useState<RegenJob[]>([])
  const [busy,setBusy]=useState<string|null>(null)
  const [message,setMessage]=useState("")
  const [error,setError]=useState("")

  const load=useCallback(async()=>{
    const [t,r,p,j]=await Promise.all([
      supabase.from("curriculum_intelligence_watch_targets").select("id,label,subject,grade,cadence,enabled,last_checked_at,next_check_at").order("created_at"),
      supabase.from("curriculum_intelligence_runs").select("id,watch_target_id,status,trigger_type,started_at,completed_at,model,search_requests,proposals_created,sources_found,summary,error").order("started_at",{ascending:false}).limit(30),
      supabase.from("curriculum_intelligence_proposals").select("id,title,status,editorial_status,chapter_id,curriculum_relevance,verification_status").order("generated_at",{ascending:false}).limit(50),
      supabase.from("curriculum_intelligence_regeneration_jobs").select("id,proposal_id,job_type,status,result,last_error,created_at,completed_at").order("created_at",{ascending:false}).limit(50),
    ])
    if(t.error||r.error||p.error||j.error) setError(t.error?.message||r.error?.message||p.error?.message||j.error?.message||"Could not load engine state")
    else { setTargets((t.data||[]) as Target[]); setRuns((r.data||[]) as Run[]); setProposals((p.data||[]) as Proposal[]); setJobs((j.data||[]) as RegenJob[]) }
  },[])

  useEffect(()=>{void load()},[load])

  async function runResearch(targetId?:string){
    setBusy(targetId||"next"); setError(""); setMessage("")
    const {data,error:fnError}=await supabase.functions.invoke("curriculum-intelligence-research",{body:targetId?{targetId}:{}})
    if(fnError) setError(fnError.message)
    else if(data?.ok===false) setError(data.error||"Research run failed")
    else setMessage(`${data?.status||"completed"}${data?.target?.label?` · ${data.target.label}`:""}${data?.proposalId?" · draft sent to review inbox":""}`)
    await load(); setBusy(null)
  }

  async function prepareEditorial(proposalId:string){
    setBusy(`editorial:${proposalId}`); setError(""); setMessage("")
    const {data,error:fnError}=await supabase.functions.invoke("curriculum-intelligence-editorial",{body:{proposal_id:proposalId}})
    if(fnError) setError(fnError.message); else if(data?.error) setError(data.error); else setMessage(`Editorial ${data?.status||"completed"} · ${proposalId.slice(0,8)}`)
    await load(); setBusy(null)
  }

  async function enqueueRegeneration(proposalId:string){
    setBusy(`enqueue:${proposalId}`); setError(""); setMessage("")
    const {data,error:rpcError}=await supabase.rpc("hq_enqueue_curriculum_intelligence_regeneration",{p_proposal_id:proposalId})
    if(rpcError) setError(rpcError.message); else setMessage(`${Number(data||0)} regeneration jobs queued`)
    await load(); setBusy(null)
  }

  async function runNextRegeneration(proposalId?:string){
    setBusy(`regen:${proposalId||"next"}`); setError(""); setMessage("")
    const {data,error:fnError}=await supabase.functions.invoke("curriculum-intelligence-regenerate",{body:proposalId?{proposal_id:proposalId}:{}})
    if(fnError) setError(fnError.message); else if(data?.error) setError(data.error); else setMessage(`Regeneration ${data?.status||"completed"}${data?.job_type?` · ${data.job_type}`:""}`)
    await load(); setBusy(null)
  }

  const statusColor=(s:string)=>s==="completed"||s==="prepared"||s==="applied"?C.accent:s==="failed"||s==="rejected"?C.red:s==="no_change"||s==="duplicate"?C.blue:C.amber

  return <div style={{minHeight:"100dvh",background:C.bg,color:C.text,fontFamily:"Inter,system-ui,sans-serif"}}>
    <header style={{position:"sticky",top:0,zIndex:20,background:"rgba(10,22,40,.96)",borderBottom:`1px solid ${C.line}`,padding:"14px 18px"}}>
      <div style={{maxWidth:1100,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
        <div><button onClick={()=>router.push("/hq/curriculum-intelligence")} style={{border:0,background:"transparent",color:C.muted,padding:0,cursor:"pointer"}}>← Curriculum Intelligence</button><h1 style={{margin:"4px 0 0",fontSize:20}}>Content Production Engine</h1><div style={{fontSize:12,color:C.muted}}>Research → editorial patch → approval/apply → regenerate → QA. Never auto-publish.</div></div>
        <div style={{display:"flex",gap:8}}><button disabled={!!busy} onClick={()=>void runNextRegeneration()} style={{border:`1px solid ${C.line}`,borderRadius:10,padding:"10px 12px",background:"transparent",color:C.text,fontWeight:800,cursor:busy?"wait":"pointer"}}>Run next regeneration</button><button disabled={!!busy} onClick={()=>void runResearch()} style={{border:0,borderRadius:10,padding:"10px 14px",background:C.accent,color:"#052e22",fontWeight:900,cursor:busy?"wait":"pointer"}}>Run next research</button></div>
      </div>
    </header>
    <main style={{maxWidth:1100,margin:"0 auto",padding:18}}>
      {error&&<div style={{border:`1px solid ${C.red}55`,background:`${C.red}16`,padding:12,borderRadius:12,color:"#fecaca",marginBottom:12}}>{error}</div>}
      {message&&<div style={{border:`1px solid ${C.accent}55`,background:`${C.accent}12`,padding:12,borderRadius:12,color:"#bbf7d0",marginBottom:12}}>{message}</div>}

      <section style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:14,padding:14,marginBottom:16}}>
        <div style={{fontWeight:850,marginBottom:4}}>Watch targets</div><div style={{fontSize:11,color:C.muted,marginBottom:10}}>Run a target directly, or let the engine choose the most overdue enabled target.</div>
        {targets.map(t=><div key={t.id} style={{display:"grid",gridTemplateColumns:"1fr auto",gap:12,alignItems:"center",padding:"11px 0",borderTop:`1px solid ${C.line}`}}><div><div style={{fontSize:13,fontWeight:750}}>{t.label}</div><div style={{fontSize:10.5,color:C.muted,marginTop:3}}>{[t.grade,t.subject,t.cadence].filter(Boolean).join(" · ")} · {t.last_checked_at?`last ${new Date(t.last_checked_at).toLocaleString()}`:"never checked"}</div></div><button disabled={!t.enabled||!!busy} onClick={()=>void runResearch(t.id)} style={{border:`1px solid ${C.line}`,background:"rgba(255,255,255,.04)",color:t.enabled?C.text:C.muted,borderRadius:9,padding:"8px 10px",fontSize:11,fontWeight:800,cursor:!t.enabled||busy?"not-allowed":"pointer"}}>{busy===t.id?"Researching…":"Run"}</button></div>)}
      </section>

      <section style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:14,padding:14,marginBottom:16}}>
        <div style={{fontWeight:850}}>Editorial pipeline</div><div style={{fontSize:11,color:C.muted,marginBottom:8}}>Prepare exact canonical patches. Applied proposals can then enqueue downstream regeneration.</div>
        {proposals.length===0?<div style={{color:C.muted,padding:"14px 0"}}>No proposals.</div>:proposals.map(p=><div key={p.id} style={{padding:"11px 0",borderTop:`1px solid ${C.line}`,display:"grid",gridTemplateColumns:"1fr auto",gap:10,alignItems:"center"}}><div><div style={{fontSize:12.5,fontWeight:800}}>{p.title}</div><div style={{fontSize:10.5,color:C.muted,marginTop:3}}>{p.status.replaceAll("_"," ")} · editorial {p.editorial_status.replaceAll("_"," ")} · {p.curriculum_relevance} · {p.verification_status}</div></div><div style={{display:"flex",gap:6}}>{p.chapter_id&&p.editorial_status!=="prepared"&&p.status!=="rejected"&&<button disabled={!!busy} onClick={()=>void prepareEditorial(p.id)} style={{border:`1px solid ${C.violet}55`,background:`${C.violet}12`,color:"#ddd6fe",borderRadius:8,padding:"7px 9px",fontSize:10.5,fontWeight:800}}>Prepare patch</button>}{p.status==="applied"&&<button disabled={!!busy} onClick={()=>void enqueueRegeneration(p.id)} style={{border:`1px solid ${C.accent}55`,background:`${C.accent}12`,color:"#bbf7d0",borderRadius:8,padding:"7px 9px",fontSize:10.5,fontWeight:800}}>Queue regeneration</button>}</div></div>)}
      </section>

      <section style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:14,padding:14,marginBottom:16}}>
        <div style={{fontWeight:850}}>Regeneration & QA</div><div style={{fontSize:11,color:C.muted,marginBottom:8}}>Teacher notes, assessments, project review, VibeLab impact and chapter QA after an approved content change.</div>
        {jobs.length===0?<div style={{color:C.muted,padding:"14px 0"}}>No regeneration jobs queued.</div>:jobs.map(j=><div key={j.id} style={{padding:"10px 0",borderTop:`1px solid ${C.line}`}}><div style={{display:"flex",justifyContent:"space-between",gap:8}}><strong style={{fontSize:12}}>{j.job_type.replaceAll("_"," ")}</strong><span style={{fontSize:10,fontWeight:850,color:statusColor(j.status)}}>{j.status}</span></div>{j.result&&<div style={{fontSize:10.5,color:C.muted,marginTop:4}}>{j.job_type==="qa"?`QA ${j.result.pass?"PASS":"REVIEW"}${j.result.issues?.length?` · ${j.result.issues.join(", ")}`:""}`:j.job_type==="vibelab_review"?`${j.result.interactive_count||0} interactive(s) · ${j.result.review_required?"review required":"no impact"}`:j.job_type==="assessment"?`${j.result.count||0} source-grounded question candidate(s) · moderation required`:j.job_type==="project_brief"?"manual/context review retained":"derivative regenerated"}</div>}</div>)}
      </section>

      <section style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:14,padding:14}}><div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",marginBottom:8}}><div><div style={{fontWeight:850}}>Recent research runs</div><div style={{fontSize:11,color:C.muted}}>Every search attempt is recorded.</div></div><button onClick={()=>void load()} style={{border:`1px solid ${C.line}`,background:"transparent",color:C.text,borderRadius:8,padding:"7px 9px",cursor:"pointer"}}>Refresh</button></div>{runs.length===0?<div style={{color:C.muted,padding:"14px 0",fontSize:12}}>No engine runs yet.</div>:runs.map(r=><div key={r.id} style={{padding:"11px 0",borderTop:`1px solid ${C.line}`}}><div style={{display:"flex",justifyContent:"space-between",gap:8}}><strong style={{fontSize:12}}>{r.status.replaceAll("_"," ")}</strong><span style={{fontSize:10,fontWeight:850,color:statusColor(r.status)}}>{new Date(r.started_at).toLocaleString()}</span></div><div style={{fontSize:10.5,color:C.muted,marginTop:4}}>{r.search_requests} searches · {r.sources_found} sources · {r.proposals_created} proposals{r.model?` · ${r.model}`:""}</div>{(r.summary||r.error)&&<div style={{fontSize:11.5,lineHeight:1.5,marginTop:5,color:r.error?"#fecaca":C.text}}>{r.error||r.summary}</div>}</div>)}</section>
    </main>
  </div>
}
