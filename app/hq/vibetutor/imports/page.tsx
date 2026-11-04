"use client"

import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from "react"
import { HQPage, HQPanel, HQ_THEME as C, hqButtonStyle } from "@/components/hq/HQShell"
import { hqSupabase } from "@/lib/hq/supabase"

type Lead = {
  id: string; full_name: string; phone: string | null; email: string | null
  county: string | null; town: string | null; levels: string[]; subjects: string[]
  source_name: string; source_url: string | null; consent_status: string
  verification_status: string; created_at: string
}
const inputStyle: CSSProperties = { width: "100%", minHeight: 42, padding: "9px 11px", borderRadius: 9, border: "1px solid " + C.border, background: C.panelSoft, color: C.text, fontSize: 13 }
const labelStyle: CSSProperties = { display: "grid", gap: 6, color: C.muted, fontSize: 11, fontWeight: 700 }
const headers = ["full_name","phone","email","county","town","levels","subjects","qualifications","experience_years","teaching_mode","rate_kes","availability","source_name","source_url","source_notes"]

function csvRows(text: string): Record<string,string>[] {
  const lines: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false
  for (let i=0;i<text.length;i++) {
    const ch=text[i]
    if (ch === '"' && quoted && text[i+1] === '"') { cell += '"'; i++ }
    else if (ch === '"') quoted = !quoted
    else if (ch === ',' && !quoted) { row.push(cell.trim()); cell="" }
    else if ((ch === '\n' || ch === '\r') && !quoted) { if(ch==='\r' && text[i+1]==='\n') i++; row.push(cell.trim()); cell=""; if(row.some(Boolean)) lines.push(row); row=[] }
    else cell += ch
  }
  row.push(cell.trim()); if(row.some(Boolean)) lines.push(row)
  if(lines.length<2) throw new Error("CSV contains no data rows.")
  const keys=lines[0].map(x=>x.toLowerCase().replace(/^\uFEFF/,""))
  if(!keys.includes("full_name") || !keys.includes("source_name")) throw new Error("CSV must include full_name and source_name columns.")
  return lines.slice(1).map(values=>Object.fromEntries(keys.map((key,i)=>[key,values[i]||""])))
}
function payload(row: Record<string,string>) {
  const name=(row.full_name||"").trim(), source=(row.source_name||"").trim()
  if(name.length<2 || !source) throw new Error("Every row needs a full name and source name.")
  const mode=["online","physical","either"].includes(row.teaching_mode) ? row.teaching_mode : "either"
  const years=row.experience_years?.trim() ? Number(row.experience_years) : null
  const rate=row.rate_kes?.trim() ? Number(row.rate_kes) : null
  if(years!==null && (!Number.isFinite(years)||years<0||years>80)) throw new Error("Experience must be between 0 and 80 years.")
  if(rate!==null && (!Number.isInteger(rate)||rate<=0)) throw new Error("Rate must be a positive whole number.")
  const split=(value:string|undefined)=>(value||"").split(/[;|]/).map(x=>x.trim()).filter(Boolean)
  return {full_name:name,phone:row.phone?.trim()||null,email:row.email?.trim().toLowerCase()||null,county:row.county?.trim()||null,town:row.town?.trim()||null,levels:split(row.levels),subjects:split(row.subjects),qualifications:row.qualifications?.trim()||null,experience_years:years,teaching_mode:mode,rate_kes:rate,availability:row.availability?.trim()||null,source_name:source,source_url:row.source_url?.trim()||null,source_notes:row.source_notes?.trim()||null,consent_status:"not_contacted",verification_status:"unverified"}
}

export default function VibeTutorImportsHQ() {
  const [allowed,setAllowed]=useState<boolean|null>(null)
  const [rows,setRows]=useState<Lead[]>([])
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState("")
  const [notice,setNotice]=useState("")
  const [filter,setFilter]=useState("all")
  const [draft,setDraft]=useState({full_name:"",phone:"",email:"",county:"",town:"",levels:"",subjects:"",qualifications:"",experience_years:"",teaching_mode:"either",rate_kes:"",availability:"",source_name:"",source_url:"",source_notes:""})
  const loadRows=useCallback(async()=>{
    const {data,error}=await hqSupabase.from("vibetutor_imports").select("id,full_name,phone,email,county,town,levels,subjects,source_name,source_url,consent_status,verification_status,created_at").order("created_at",{ascending:false}).limit(500)
    if(error) throw new Error("Private tutor register unavailable. The database migration may not yet be installed.")
    setRows((data||[]) as Lead[])
  },[])
  useEffect(()=>{
    let live=true
    const run=async()=>{
      try {
        const {data:identity,error:authError}=await hqSupabase.auth.getUser()
        if(authError||!identity.user) throw new Error("HQ sign-in is required.")
        const {data:owner,error:ownerError}=await hqSupabase.rpc("is_platform_owner")
        if(ownerError||owner!==true) throw new Error("Platform owner authority is required.")
        if(live) setAllowed(true)
        await loadRows()
      } catch(reason) { if(live){setAllowed(false);setError(reason instanceof Error?reason.message:"HQ access could not be verified.")} }
      finally { if(live) setLoading(false) }
    }
    void run(); return ()=>{live=false}
  },[loadRows])
  async function save(event:FormEvent){
    event.preventDefault(); if(busy||allowed!==true)return
    setBusy(true);setError("");setNotice("")
    try {
      const data=payload({...draft,levels:draft.levels.replace(/,/g,";"),subjects:draft.subjects.replace(/,/g,";")})
      const {error}=await hqSupabase.from("vibetutor_imports").insert(data)
      if(error) throw new Error("Tutor lead was not saved. Check the fields and try again.")
      setDraft({full_name:"",phone:"",email:"",county:"",town:"",levels:"",subjects:"",qualifications:"",experience_years:"",teaching_mode:"either",rate_kes:"",availability:"",source_name:"",source_url:"",source_notes:""})
      await loadRows();setNotice("Tutor lead saved privately. It is not published on VibeTutor.")
    } catch(reason){setError(reason instanceof Error?reason.message:"Could not save tutor lead.")}
    finally{setBusy(false)}
  }
  async function importFile(file?:File){
    if(!file||busy||allowed!==true)return
    setBusy(true);setError("");setNotice("")
    try{
      const parsed=csvRows(await file.text())
      if(parsed.length>500)throw new Error("Import a maximum of 500 records at a time.")
      const data=parsed.map(payload)
      const {error}=await hqSupabase.from("vibetutor_imports").insert(data)
      if(error)throw new Error("Batch was not saved. Check for invalid fields or duplicate records.")
      await loadRows();setNotice(data.length+" tutor leads imported privately. None were published.")
    }catch(reason){setError(reason instanceof Error?reason.message:"CSV import failed.")}
    finally{setBusy(false)}
  }
  function template(){
    const sample=["Jane Doe,0712345678,jane@example.com,Nairobi,Westlands,Grade 7;Grade 8,Mathematics;English,BEd,5,either,800,Weekday evenings,WhatsApp group,,Collected from group admin"]
    const blob=new Blob([headers.join(",")+"\n"+sample.join("\n")],{type:"text/csv;charset=utf-8"})
    const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="vibetutor-tutor-import-template.csv";a.click();URL.revokeObjectURL(url)
  }
  const shown=filter==="all"?rows:rows.filter(r=>r.consent_status===filter)
  const update=(key:string,value:string)=>setDraft(current=>({...current,[key]:value}))
  return <HQPage title="Tutor Imports" description="Private staging register for tutor leads collected from external sources. Imported records are never public listings.">
    {allowed===false&&<HQPanel title="Access restricted"><p role="alert">{error||"Platform owner access required."}</p></HQPanel>}
    {allowed===true&&<>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:14}}>
        {[["Imported leads",rows.length],["Consent granted",rows.filter(r=>r.consent_status==="granted").length],["Not contacted",rows.filter(r=>r.consent_status==="not_contacted").length],["Verified",rows.filter(r=>r.verification_status==="verified").length]].map(([name,value])=><div key={String(name)} style={{padding:14,borderRadius:12,border:"1px solid "+C.border,background:C.panel}}><div style={{fontSize:10,color:C.muted}}>{name}</div><strong style={{display:"block",fontSize:24,color:C.text,marginTop:5}}>{value}</strong></div>)}
      </div>
      <HQPanel title="Add a tutor lead" description="Record the source and keep imported information private until the tutor confirms it.">
        <form onSubmit={save} style={{padding:14,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(185px,1fr))",gap:11}}>
          {([["full_name","Full name *"],["phone","Phone"],["email","Email"],["county","County"],["town","Town / area"],["levels","Levels (comma separated)"],["subjects","Subjects (comma separated)"],["qualifications","Qualifications"],["experience_years","Years experience"],["rate_kes","Rate (KES/hour)"],["availability","Availability"],["source_name","Source name *"],["source_url","Source URL"],["source_notes","Source notes"]] as const).map(([key,title])=><label key={key} style={{...labelStyle,gridColumn:key==="source_notes"?"1 / -1":undefined}}>{title}{key==="source_notes"?<textarea style={{...inputStyle,minHeight:70}} value={draft[key]} onChange={e=>update(key,e.target.value)}/>:<input style={inputStyle} required={key==="full_name"||key==="source_name"} type={key==="email"?"email":key==="source_url"?"url":key==="experience_years"||key==="rate_kes"?"number":"text"} min={key==="experience_years"||key==="rate_kes"?"0":undefined} value={draft[key]} onChange={e=>update(key,e.target.value)}/>}</label>)}
          <label style={labelStyle}>Teaching mode<select style={inputStyle} value={draft.teaching_mode} onChange={e=>update("teaching_mode",e.target.value)}><option value="either">Either</option><option value="online">Online</option><option value="physical">In person</option></select></label>
          <div style={{gridColumn:"1 / -1"}}><button type="submit" disabled={busy} style={{...hqButtonStyle,background:"#1d4ed8",borderColor:"#2563eb"}}>{busy?"Saving…":"Save private lead"}</button></div>
        </form>
      </HQPanel>
      <HQPanel title="Spreadsheet import" description="Download the CSV template. Separate multiple levels and subjects with semicolons. Required columns: full_name and source_name.">
        <div style={{padding:14,display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
          <button type="button" onClick={template} style={hqButtonStyle}>Download CSV template</button>
          <label style={{...hqButtonStyle,display:"inline-flex",alignItems:"center",gap:8}}>Choose CSV file<input type="file" accept=".csv,text/csv" disabled={busy} onChange={e=>{void importFile(e.target.files?.[0]);e.currentTarget.value=""}} style={{maxWidth:190,fontSize:11}}/></label>
          {busy&&<span role="status" style={{fontSize:12,color:C.muted}}>Saving…</span>}
        </div>
      </HQPanel>
      <HQPanel title="Imported tutor leads" description="Private HQ records only. Consent and identity checks are required before any tutor is invited to create a public profile.">
        <div style={{padding:12}}><label style={{...labelStyle,maxWidth:220}}>Filter by consent<select style={inputStyle} value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All records</option><option value="not_contacted">Not contacted</option><option value="requested">Consent requested</option><option value="granted">Consent granted</option><option value="declined">Declined</option></select></label><span style={{display:"block",fontSize:11,color:C.muted,marginTop:8}}>{shown.length} shown · latest 500</span></div>
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:720}}><thead><tr>{["Tutor","Location","Subjects / levels","Source","Consent","Verification"].map(x=><th key={x} style={{padding:10,textAlign:"left",color:C.muted,borderBottom:"1px solid "+C.border}}>{x}</th>)}</tr></thead><tbody>{shown.map(row=><tr key={row.id}><td style={{padding:10,borderBottom:"1px solid "+C.border,color:C.text}}><strong>{row.full_name}</strong><div style={{fontSize:10,color:C.muted}}>{row.phone||row.email||"No contact detail"}</div></td><td style={{padding:10,borderBottom:"1px solid "+C.border,color:C.muted}}>{[row.town,row.county].filter(Boolean).join(", ")||"—"}</td><td style={{padding:10,borderBottom:"1px solid "+C.border,color:C.muted}}>{[...(row.subjects||[]),...(row.levels||[])].join(", ")||"—"}</td><td style={{padding:10,borderBottom:"1px solid "+C.border,color:C.muted}}>{row.source_name}{row.source_url&&<div><a href={row.source_url} target="_blank" rel="noreferrer" style={{color:"#93c5fd"}}>Open source</a></div>}</td><td style={{padding:10,borderBottom:"1px solid "+C.border,color:C.text}}>{row.consent_status.replace("_"," ")}</td><td style={{padding:10,borderBottom:"1px solid "+C.border,color:C.text}}>{row.verification_status}</td></tr>)}</tbody></table>{!shown.length&&<p style={{padding:18,color:C.muted,fontSize:12}}>No imported tutor leads in this view yet.</p>}</div>
      </HQPanel>
    </>}
    {loading&&<p role="status" style={{color:C.muted}}>Verifying HQ access and loading tutor register…</p>}
    {error&&allowed!==false&&<p role="alert" style={{color:C.red,marginTop:12}}>{error}</p>}
    {notice&&<p role="status" style={{color:C.green,marginTop:12}}>{notice}</p>}
  </HQPage>
}
