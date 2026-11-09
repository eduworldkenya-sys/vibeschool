"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { hqSupabase } from "@/lib/hq/supabase"

type BatchResult = {
  ok?: boolean
  published?: boolean
  batch_count?: number
  results?: Array<{index:number;topic:string;validation:{valid?:boolean;published?:boolean;issues?:string[];title?:string;assignment_id?:string}}>
}
const api = hqSupabase as any

export default function OriginalTopicBatchPublisher() {
  const [owner,setOwner]=useState<boolean|null>(null)
  const [raw,setRaw]=useState("")
  const [preview,setPreview]=useState<BatchResult|null>(null)
  const [validatedRaw,setValidatedRaw]=useState("")
  const [approved,setApproved]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState("")
  const [published,setPublished]=useState<BatchResult|null>(null)
  useEffect(()=>{
    let active=true
    void api.rpc("is_platform_owner").then(({data,error:failure}:{data:unknown;error:unknown})=>{
      if(active)setOwner(!failure&&data===true)
    })
    return()=>{active=false}
  },[])
  const parsed=useMemo(()=>{
    if(!raw.trim())return {papers:null as unknown[]|null,error:""}
    try {
      const candidate:unknown=JSON.parse(raw)
      const value=Array.isArray(candidate)?candidate:(candidate && typeof candidate==="object" && "papers" in candidate?(candidate as {papers:unknown}).papers:null)
      if(!Array.isArray(value)||value.length<1||value.length>20)return {papers:null,error:"The batch must contain between 1 and 20 five-question sets."}
      const validShapes=value.every(item=>{
        if(!item||typeof item!=="object")return false
        const paper=item as Record<string,unknown>
        return paper.grade==="Grade 9"&&paper.subject==="Mathematics"&&Array.isArray(paper.items)&&paper.items.length===5
      })
      return validShapes?{papers:value,error:""}:{papers:null,error:"Each set needs Grade 9 Mathematics and exactly five questions."}
    } catch {return {papers:null,error:"Upload a valid JSON batch file."}}
  },[raw])
  const passed=Boolean(preview?.ok && preview?.results?.length===parsed.papers?.length &&
    preview.results.every(item=>item.validation?.valid===true))
  const canPublish=Boolean(owner&&passed&&approved&&validatedRaw===raw&&!busy&&!published)
  function onText(value:string) {
    setRaw(value);setPreview(null);setValidatedRaw("");setApproved(false);setError("");setPublished(null)
  }
  async function loadFile(file?:File) {
    if(!file)return
    if(file.size>350000){setError("Choose a JSON file smaller than 350 KB.");return}
    try{onText(await file.text())}catch{setError("File could not be read.")}
  }
  async function run(publish:boolean) {
    if(owner!==true||!parsed.papers||busy||publish&&!canPublish)return
    setBusy(true);setError("")
    try {
      const {data,error:failure}=await api.rpc("hq_publish_original_topic_batch",{
        p_papers:parsed.papers,p_publish:publish,p_approved:publish&&approved,
      })
      if(failure)throw new Error(failure.message||"Batch operation failed.")
      const result=data as BatchResult
      if(!result?.ok)throw new Error("The server did not approve this batch.")
      if(publish){
        if(result.published!==true||result.results?.some(row=>row.validation?.published!==true))
          throw new Error("Not all sets were confirmed published.")
        setPublished(result)
      }else{
        setPreview(result);setValidatedRaw(raw);setApproved(false)
      }
    }catch(cause){setError(cause instanceof Error?cause.message:"Batch operation failed.")}
    finally{setBusy(false)}
  }
  const surface:React.CSSProperties={border:"1px solid #d7e2f0",background:"#fff",borderRadius:16,padding:18}
  const button:React.CSSProperties={border:0,borderRadius:10,padding:"12px 18px",minHeight:46,fontWeight:800,background:"#183b6b",color:"#fff",cursor:"pointer"}
  return <main style={{minHeight:"100vh",background:"#f6f8fc",color:"#17243b",padding:"24px 14px 100px"}}>
    <div style={{maxWidth:900,margin:"auto",display:"grid",gap:14}}>
      <header>
        <Link href="/hq/exams/publish" style={{fontSize:13,color:"#1d4ed8"}}>← Original publisher</Link>
        <p style={{fontSize:12,fontWeight:800,letterSpacing:1.3}}>HQ · QUESTION BANK</p>
        <h1 style={{fontSize:27,margin:"8px 0"}}>Batch publish Topic Practice</h1>
        <p style={{color:"#53657c",lineHeight:1.5}}>Publish original Grade 9 Mathematics questions in sets of five. Every set uses the existing canonical publisher and receives its own untimed practice assignment.</p>
      </header>
      {owner===null&&<section role="status" style={surface}>Checking owner access…</section>}
      {owner===false&&<section role="alert" style={surface}>Only an active platform owner can publish original batches.</section>}
      {owner===true&&<>
        <section style={surface}>
          <label style={{display:"block",fontWeight:800,marginBottom:10}} htmlFor="batch-file">Upload a reviewed batch JSON</label>
          <input id="batch-file" type="file" accept=".json,application/json" onChange={e=>void loadFile(e.target.files?.[0])}/>
          <label style={{display:"block",fontWeight:700,margin:"14px 0 7px"}} htmlFor="batch-json">Or paste the JSON</label>
          <textarea id="batch-json" rows={9} value={raw} spellCheck={false} onChange={e=>onText(e.target.value)}
            placeholder='{"papers":[{"id":"...","grade":"Grade 9","subject":"Mathematics","items":[...]}]}'
            style={{width:"100%",boxSizing:"border-box",border:"1px solid #b8c8dd",borderRadius:10,padding:12,font:"12px/1.5 Consolas, monospace"}}/>
          {parsed.error&&<p role="alert" style={{color:"#b91c1c"}}>{parsed.error}</p>}
          {parsed.papers&&<p>{parsed.papers.length} five-question sets · {parsed.papers.length*5} proposed questions</p>}
          <button disabled={!parsed.papers||busy} style={{...button,opacity:!parsed.papers||busy ? 0.5 : 1}} onClick={()=>void run(false)}>{busy?"Validating…":"Validate all sets"}</button>
        </section>
        {preview&&<section style={surface}>
          <h2 style={{fontSize:19}}>Validation {passed?"passed":"requires corrections"}</h2>
          <p>{preview.results?.filter(row=>row.validation?.valid).length??0} of {preview.batch_count??0} sets accepted.</p>
          <div style={{display:"grid",gap:8,maxHeight:420,overflowY:"auto"}}>
            {preview.results?.map(row=><div key={row.index} style={{padding:10,border:"1px solid #e2e8f0",borderRadius:9}}>
              <strong>{row.index}. {row.topic}</strong>
              <span style={{marginLeft:10,color:row.validation?.valid?"#166534":"#b91c1c"}}>{row.validation?.valid?"Valid":"Not ready"}</span>
              {row.validation?.issues?.length? <p style={{color:"#b91c1c",fontSize:12}}>{row.validation.issues.join(" · ")}</p>:null}
            </div>)}
          </div>
          {passed&&<>
            <p style={{fontSize:13,color:"#475569"}}>Publishing requires reviewed original content and correct answer keys. KICD outcome mapping remains provisional until independently verified. Existing learner attempts will not be altered.</p>
            <label style={{display:"flex",alignItems:"flex-start",gap:10}}>
              <input type="checkbox" checked={approved} onChange={e=>setApproved(e.target.checked)} style={{width:20,height:20}}/>
              <span>I have reviewed all answers, explanations, curriculum labels and rights, and approve publication of these original provisional questions.</span>
            </label>
            <button disabled={!canPublish} style={{...button,marginTop:14,background:"#166534",opacity:canPublish?1:.5}} onClick={()=>void run(true)}>Publish {parsed.papers?.length} sets</button>
          </>}
        </section>}
        {error&&<section role="alert" style={{...surface,color:"#b91c1c"}}>{error}</section>}
        {published&&<section role="status" style={{...surface,borderColor:"#16a34a"}}>
          <h2>Batch published</h2>
          <p>{published.results?.length} sets confirmed. Learners can find ready topics under Learn → Topic Practice.</p>
          <Link href="/student/vibelearn/topic-practice">Open Topic Practice</Link>
        </section>}
      </>}
    </div>
  </main>
}
