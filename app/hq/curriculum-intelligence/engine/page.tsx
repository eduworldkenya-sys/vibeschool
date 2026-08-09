"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

type Target = { id:string; label:string; subject:string|null; grade:string|null; cadence:string; enabled:boolean; last_checked_at:string|null; next_check_at:string|null }
type Run = { id:string; watch_target_id:string|null; status:string; trigger_type:string; started_at:string; completed_at:string|null; model:string|null; search_requests:number; proposals_created:number; sources_found:number; summary:string|null; error:string|null }

const C={bg:"#0a1628",panel:"#0f1d33",line:"rgba(255,255,255,.08)",text:"#fff",muted:"rgba(255,255,255,.48)",accent:"#10b981",amber:"#f59e0b",red:"#ef4444",blue:"#3b82f6"}

export default function CurriculumIntelligenceEnginePage(){
  const router=useRouter()
  const [targets,setTargets]=useState<Target[]>([])
  const [runs,setRuns]=useState<Run[]>([])
  const [busy,setBusy]=useState<string|null>(null)
  const [message,setMessage]=useState("")
  const [error,setError]=useState("")

  const load=useCallback(async()=>{
    const [t,r]=await Promise.all([
      supabase.from("curriculum_intelligence_watch_targets").select("id,label,subject,grade,cadence,enabled,last_checked_at,next_check_at").order("created_at"),
      supabase.from("curriculum_intelligence_runs").select("id,watch_target_id,status,trigger_type,started_at,completed_at,model,search_requests,proposals_created,sources_found,summary,error").order("started_at",{ascending:false}).limit(30),
    ])
    if(t.error||r.error) setError(t.error?.message||r.error?.message||"Could not load engine state")
    else { setTargets((t.data||[]) as Target[]); setRuns((r.data||[]) as Run[]) }
  },[])

  useEffect(()=>{void load()},[load])

  async function run(targetId?:string){
    setBusy(targetId||"next"); setError(""); setMessage("")
    const {data,error:fnError}=await supabase.functions.invoke("curriculum-intelligence-research",{body:targetId?{targetId}:{}})
    if(fnError) setError(fnError.message)
    else if(data?.ok===false) setError(data.error||"Research run failed")
    else {
      const label=data?.target?.label?` · ${data.target.label}`:""
      setMessage(`${data?.status||"completed"}${label}${data?.proposalId?" · draft sent to review inbox":""}`)
      await load()
    }
    setBusy(null)
  }

  const statusColor=(s:string)=>s==="completed"?C.accent:s==="failed"?C.red:s==="no_change"||s==="duplicate"?C.blue:C.amber

  return <div style={{minHeight:"100dvh",background:C.bg,color:C.text,fontFamily:"Inter,system-ui,sans-serif"}}>
    <header style={{position:"sticky",top:0,zIndex:20,background:"rgba(10,22,40,.96)",borderBottom:`1px solid ${C.line}`,padding:"14px 18px"}}>
      <div style={{maxWidth:1000,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
        <div><button onClick={()=>router.push("/hq/curriculum-intelligence")} style={{border:0,background:"transparent",color:C.muted,padding:0,cursor:"pointer"}}>← Curriculum Intelligence</button><h1 style={{margin:"4px 0 0",fontSize:20}}>Research Engine</h1><div style={{fontSize:12,color:C.muted}}>Search → verify → compare → draft. Never auto-publish.</div></div>
        <button disabled={!!busy} onClick={()=>void run()} style={{border:0,borderRadius:10,padding:"10px 14px",background:C.accent,color:"#052e22",fontWeight:900,cursor:busy?"wait":"pointer"}}>{busy==="next"?"Researching…":"Run next research"}</button>
      </div>
    </header>
    <main style={{maxWidth:1000,margin:"0 auto",padding:18}}>
      {error&&<div style={{border:`1px solid ${C.red}55`,background:`${C.red}16`,padding:12,borderRadius:12,color:"#fecaca",marginBottom:12}}>{error}</div>}
      {message&&<div style={{border:`1px solid ${C.accent}55`,background:`${C.accent}12`,padding:12,borderRadius:12,color:"#bbf7d0",marginBottom:12}}>{message}</div>}

      <section style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:14,padding:14,marginBottom:16}}>
        <div style={{fontWeight:850,marginBottom:4}}>Watch targets</div><div style={{fontSize:11,color:C.muted,marginBottom:10}}>Run one target directly, or let Run next choose the most overdue enabled target.</div>
        {targets.map(t=><div key={t.id} style={{display:"grid",gridTemplateColumns:"1fr auto",gap:12,alignItems:"center",padding:"11px 0",borderTop:`1px solid ${C.line}`}}>
          <div><div style={{fontSize:13,fontWeight:750}}>{t.label}</div><div style={{fontSize:10.5,color:C.muted,marginTop:3}}>{[t.grade,t.subject,t.cadence].filter(Boolean).join(" · ")} · {t.last_checked_at?`last ${new Date(t.last_checked_at).toLocaleString()}`:"never checked"}</div></div>
          <button disabled={!t.enabled||!!busy} onClick={()=>void run(t.id)} style={{border:`1px solid ${C.line}`,background:"rgba(255,255,255,.04)",color:t.enabled?C.text:C.muted,borderRadius:9,padding:"8px 10px",fontSize:11,fontWeight:800,cursor:!t.enabled||busy?"not-allowed":"pointer"}}>{busy===t.id?"Researching…":"Run"}</button>
        </div>)}
      </section>

      <section style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:14,padding:14}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",marginBottom:8}}><div><div style={{fontWeight:850}}>Recent engine runs</div><div style={{fontSize:11,color:C.muted}}>Every search attempt is recorded, including no-change and failed runs.</div></div><button onClick={()=>void load()} style={{border:`1px solid ${C.line}`,background:"transparent",color:C.text,borderRadius:8,padding:"7px 9px",cursor:"pointer"}}>Refresh</button></div>
        {runs.length===0?<div style={{color:C.muted,padding:"14px 0",fontSize:12}}>No engine runs yet.</div>:runs.map(r=><div key={r.id} style={{padding:"11px 0",borderTop:`1px solid ${C.line}`}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:8}}><strong style={{fontSize:12}}>{r.status.replaceAll("_"," ")}</strong><span style={{fontSize:10,fontWeight:850,color:statusColor(r.status)}}>{new Date(r.started_at).toLocaleString()}</span></div>
          <div style={{fontSize:10.5,color:C.muted,marginTop:4}}>{r.search_requests} searches · {r.sources_found} sources · {r.proposals_created} proposals{r.model?` · ${r.model}`:""}</div>
          {(r.summary||r.error)&&<div style={{fontSize:11.5,lineHeight:1.5,marginTop:5,color:r.error?"#fecaca":C.text}}>{r.error||r.summary}</div>}
        </div>)}
      </section>
    </main>
  </div>
}
