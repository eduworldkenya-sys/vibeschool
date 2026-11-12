"use client"
export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getAdminSchoolAuthority } from "@/lib/admin/authority"
import { nairobiDateStr } from "@/lib/time"

type Reason = "demonstrations" | "weather" | "strike" | "insecurity" | "health" | "other"
type Preview = {
  date: string
  scheduled_slots: number
  completed_lessons_preserved: number
  lessons_in_progress: number
  already_closed: boolean
  can_confirm: boolean
}
type Closure = {
  id: string
  exception_date: string
  label: string
  disruption_reason_code: string | null
  disruption_details: string | null
  suppress_ordinary_teaching: boolean
}
const reasons: Array<{value:Reason;label:string}> = [
  {value:"demonstrations",label:"Demonstrations / maandamano"},
  {value:"weather",label:"Floods or severe weather"},
  {value:"strike",label:"Industrial action"},
  {value:"insecurity",label:"Security concern"},
  {value:"health",label:"Health emergency"},
  {value:"other",label:"Other disruption"}
]
const inputStyle: React.CSSProperties = {
  width:"100%",padding:"11px 12px",border:"1px solid #cbd5e1",
  borderRadius:10,boxSizing:"border-box",fontSize:14,background:"#fff"
}
const buttonStyle: React.CSSProperties = {
  padding:"11px 15px",borderRadius:10,cursor:"pointer",fontWeight:700,
  border:"1px solid #0f766e",background:"#0f766e",color:"#fff"
}

function parsePreview(value: unknown): Preview {
  if (!value || typeof value!=="object"
      || !("date" in value) || typeof value.date!=="string"
      || !("scheduled_slots" in value) || typeof value.scheduled_slots!=="number"
      || !("completed_lessons_preserved" in value) || typeof value.completed_lessons_preserved!=="number"
      || !("lessons_in_progress" in value) || typeof value.lessons_in_progress!=="number"
      || !("already_closed" in value) || typeof value.already_closed!=="boolean"
      || !("can_confirm" in value) || typeof value.can_confirm!=="boolean") {
    throw new Error("Invalid school calendar preview response.")
  }
  return {
    date:value.date,
    scheduled_slots:value.scheduled_slots,
    completed_lessons_preserved:value.completed_lessons_preserved,
    lessons_in_progress:value.lessons_in_progress,
    already_closed:value.already_closed,
    can_confirm:value.can_confirm
  }
}

function parseAffectedCount(value: unknown, key: "affected_occurrences" | "restored_occurrences"): number {
  if (!value || typeof value!=="object" || !(key in value)
      || typeof value[key]!=="number" || !Number.isInteger(value[key])
      || value[key]<0) {
    throw new Error("Invalid school disruption confirmation response.")
  }
  return value[key]
}

export default function AdminSchoolDisruptionsPage() {
  const router = useRouter()
  const [schoolId,setSchoolId] = useState("")
  const [date,setDate] = useState(nairobiDateStr())
  const [reason,setReason] = useState<Reason>("demonstrations")
  const [details,setDetails] = useState("")
  const [preview,setPreview] = useState<Preview|null>(null)
  const [closures,setClosures] = useState<Closure[]>([])
  const [loading,setLoading] = useState(true)
  const [working,setWorking] = useState(false)
  const [error,setError] = useState("")
  const [success,setSuccess] = useState("")
  const [reopenId,setReopenId] = useState<string|null>(null)
  const [reopenExplanation,setReopenExplanation] = useState("")

  async function reload(id:string) {
    const {data,error:queryError} = await supabase.from("school_calendar_exceptions")
      .select("id,exception_date,label,disruption_reason_code,disruption_details,suppress_ordinary_teaching")
      .eq("school_id",id).eq("kind","closure")
      .order("exception_date",{ascending:false}).limit(30)
    if (queryError) throw queryError
    setClosures((data ?? []).filter(item=>item.disruption_reason_code) as Closure[])
  }

  useEffect(()=>{
    let active = true
    void (async()=>{
      try {
        const authority=await getAdminSchoolAuthority()
        if (!active) return
        setSchoolId(authority.schoolId)
        await reload(authority.schoolId)
      } catch (cause) {
        if (active) setError(cause instanceof Error?cause.message:"School calendar unavailable.")
      } finally {
        if (active) setLoading(false)
      }
    })()
    return ()=>{active=false}
  },[])

  function invalidatePreview() { setPreview(null);setError("");setSuccess("") }

  async function checkImpact() {
    if (!schoolId || !date || working) return
    setWorking(true);setError("");setSuccess("");setPreview(null)
    try {
      const {data,error:rpcError}=await supabase.rpc("admin_preview_school_disruption" as never,{
        p_school_id:schoolId,p_date:date
      } as never)
      if (rpcError) throw rpcError
      setPreview(parsePreview(data))
    } catch(cause) {
      setError(cause instanceof Error?cause.message:"Could not check affected lessons.")
    } finally {setWorking(false)}
  }

  async function record() {
    if (!schoolId || !preview?.can_confirm || preview.date!==date || working) return
    setWorking(true);setError("");setSuccess("")
    try {
      const {data,error:rpcError}=await supabase.rpc("admin_record_school_disruption" as never,{
        p_school_id:schoolId,p_date:date,p_reason_code:reason,p_details:details.trim()||null
      } as never)
      if (rpcError) throw rpcError
      const affected=parseAffectedCount(data,"affected_occurrences")
      setSuccess("Closure recorded. "+affected+" lessons preserved for recovery. Completed lessons were not changed.")
      setPreview(null)
      await reload(schoolId)
    } catch(cause) {
      setError(cause instanceof Error?cause.message:"Could not record closure.")
      setPreview(null)
    } finally {setWorking(false)}
  }

  async function reopen() {
    if (!schoolId || !reopenId || !reopenExplanation.trim() || working) return
    setWorking(true);setError("");setSuccess("")
    try {
      const {data,error:rpcError}=await supabase.rpc("admin_reopen_school_disruption" as never,{
        p_calendar_exception_id:reopenId,p_explanation:reopenExplanation.trim()
      } as never)
      if (rpcError) throw rpcError
      const restored=parseAffectedCount(data,"restored_occurrences")
      setSuccess("School day reopened. "+restored+" affected lesson records reconciled; past missed lessons remain visible.")
      setReopenId(null);setReopenExplanation("");setPreview(null)
      await reload(schoolId)
    } catch(cause) {
      setError(cause instanceof Error?cause.message:"Could not reopen the day.")
    } finally {setWorking(false)}
  }

  if (loading) return <main aria-busy="true">Loading school calendar…</main>
  return <main style={{maxWidth:830,margin:"0 auto",display:"grid",gap:16}}>
    <header>
      <button type="button" onClick={()=>router.back()} style={{background:"none",border:0,cursor:"pointer"}}>← Back</button>
      <h1 style={{fontSize:25,margin:"6px 0"}}>School disruptions</h1>
      <p style={{margin:0,color:"#475569",lineHeight:1.5}}>Record an unexpected full-day closure. The original timetable remains unchanged. Affected teaching is retained for recovery.</p>
    </header>
    {error&&<div role="alert" style={{padding:12,borderRadius:10,background:"#fef2f2",color:"#991b1b"}}>{error}</div>}
    {success&&<div role="status" style={{padding:12,borderRadius:10,background:"#ecfdf5",color:"#065f46"}}>{success}</div>}
    <section style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:16,padding:20,display:"grid",gap:14}}>
      <h2 style={{margin:0,fontSize:18}}>Record full-day closure</h2>
      <label style={{display:"grid",gap:6}}>School date (Africa/Nairobi)
        <input type="date" value={date} style={inputStyle} onChange={e=>{setDate(e.target.value);invalidatePreview()}}/>
      </label>
      <label style={{display:"grid",gap:6}}>Reason
        <select value={reason} style={inputStyle} onChange={e=>{setReason(e.target.value as Reason);invalidatePreview()}}>
          {reasons.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      <label style={{display:"grid",gap:6}}>Details (optional)
        <textarea rows={3} maxLength={2000} value={details} style={inputStyle} placeholder="What happened? Include the school-level decision and source." onChange={e=>{setDetails(e.target.value);invalidatePreview()}}/>
      </label>
      <p style={{margin:0,fontSize:13,color:"#475569"}}>For afternoon-only or selected-period closures, do not record a full-day closure. Partial-day handling is not yet supported here.</p>
      <button type="button" disabled={!schoolId||!date||working} onClick={()=>void checkImpact()} style={buttonStyle}>Check affected lessons</button>
      {preview&&<div style={{padding:14,border:"1px solid #cbd5e1",borderRadius:12,display:"grid",gap:7}}>
        <strong>Impact preview — {preview.date}</strong>
        <div>{preview.scheduled_slots} scheduled timetable periods</div>
        <div>{preview.completed_lessons_preserved} completed lessons will remain untouched</div>
        <div>{preview.lessons_in_progress} lessons currently in progress</div>
        {preview.already_closed&&<p role="alert">This day already has an active school closure.</p>}
        {!preview.can_confirm&&<p role="alert">Cannot confirm: existing closure or active teaching must be resolved.</p>}
        <button type="button" disabled={!preview.can_confirm||working||preview.date!==date}
          onClick={()=>void record()} style={buttonStyle}>Confirm school closure</button>
      </div>}
    </section>
    <section style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:16,padding:20,display:"grid",gap:12}}>
      <h2 style={{margin:0,fontSize:18}}>Recorded disruptions</h2>
      {closures.length===0?<p style={{color:"#64748b"}}>No recorded disruptions for this school.</p>:
        closures.map(item=><article key={item.id} style={{padding:"12px 0",borderTop:"1px solid #e2e8f0",display:"grid",gap:5}}>
          <strong>{item.exception_date} · {item.label}</strong>
          <small style={{color:"#475569"}}>{item.suppress_ordinary_teaching?"Closed":"Reopened"} · {item.disruption_details||"No additional details"}</small>
          {item.suppress_ordinary_teaching&&(
            reopenId!==item.id?
              <button type="button" style={{...buttonStyle,background:"#fff",color:"#0f766e",justifySelf:"start"}} onClick={()=>{setReopenId(item.id);setReopenExplanation("")}}>Reopen day</button>:
              <div style={{display:"grid",gap:8}}>
                <label style={{display:"grid",gap:5}}>Reason for reopening
                  <textarea rows={2} maxLength={2000} value={reopenExplanation} style={inputStyle}
                    onChange={e=>setReopenExplanation(e.target.value)}/>
                </label>
                <div style={{display:"flex",gap:8}}>
                  <button type="button" disabled={working||!reopenExplanation.trim()} style={buttonStyle} onClick={()=>void reopen()}>Confirm reopening</button>
                  <button type="button" style={{...buttonStyle,background:"white",color:"#0f766e"}} onClick={()=>setReopenId(null)}>Cancel</button>
                </div>
              </div>
          )}
        </article>)
      }
    </section>
  </main>
}
