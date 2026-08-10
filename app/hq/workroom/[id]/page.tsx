"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { HQPage, HQPanel, HQ_THEME as C, hqButtonStyle } from "@/components/hq/HQShell"
import {
  actOnHQWorkroomItem, addHQWorkroomLink, addHQWorkroomUpdate, getHQWorkroomItem,
  type HQWorkItemLink, type HQWorkItemUpdate, type HQWorkroomAction, type HQWorkroomItem,
} from "@/lib/hq/operating"

const fieldStyle:React.CSSProperties={width:"100%",boxSizing:"border-box",border:`1px solid ${C.border}`,borderRadius:10,background:"rgba(255,255,255,.04)",color:C.text,padding:10,font:"inherit",fontSize:12}

const actionLabels:Record<HQWorkroomAction,string>={
  start:"Start work",submit_for_approval:"Submit for approval",authorize:"Authorize next step",
  request_correction:"Request correction",accept_verified:"Accept verified result",cancel:"Cancel work",
}

export default function HQWorkroomItemPage(){
  const params=useParams<{id:string}>();const id=Array.isArray(params.id)?params.id[0]:params.id
  const[data,setData]=useState<HQWorkroomItem|null>(null);const[loading,setLoading]=useState(true);const[busy,setBusy]=useState("");const[error,setError]=useState("");const[message,setMessage]=useState("")
  const[updateType,setUpdateType]=useState<HQWorkItemUpdate["update_type"]>("note");const[body,setBody]=useState("")
  const[linkType,setLinkType]=useState<HQWorkItemLink["link_type"]>("github_issue");const[linkLabel,setLinkLabel]=useState("");const[linkUrl,setLinkUrl]=useState("")
  const[action,setAction]=useState<HQWorkroomAction|null>(null);const[reason,setReason]=useState("")

  const refresh=useCallback(async()=>{if(!id)return;setError("");try{setData(await getHQWorkroomItem(id))}catch(cause){setError(cause instanceof Error?cause.message:"Workroom item could not be loaded.")}finally{setLoading(false)}},[id])
  useEffect(()=>{void refresh()},[refresh])

  async function addUpdate(){if(!data||!body.trim())return;setBusy("update");setError("");try{await addHQWorkroomUpdate(data.item.id,updateType,body.trim());setBody("");setMessage("Update recorded in the permanent work history.");await refresh()}catch(cause){setError(cause instanceof Error?cause.message:"Update could not be recorded.")}finally{setBusy("")}}
  async function addLink(){if(!data||!linkLabel.trim()||!linkUrl.trim())return;setBusy("link");setError("");try{await addHQWorkroomLink(data.item.id,linkType,linkLabel.trim(),linkUrl.trim());setLinkLabel("");setLinkUrl("");setMessage("Evidence link attached.");await refresh()}catch(cause){setError(cause instanceof Error?cause.message:"Link could not be attached.")}finally{setBusy("")}}
  async function applyAction(){if(!data||!action||reason.trim().length<3)return;setBusy("action");setError("");try{setData(await actOnHQWorkroomItem(data.item.id,action,reason.trim()));setMessage(`${actionLabels[action]} recorded.`);setAction(null);setReason("")}catch(cause){setError(cause instanceof Error?cause.message:"Action could not be completed.")}finally{setBusy("")}}

  if(loading&&!data)return <HQPage title="HQ Workroom" description="Loading accountable work…"><div style={{color:C.muted}}>Loading…</div></HQPage>
  if(!data)return <HQPage title="HQ Workroom" description="Work item unavailable"><div role="alert" style={{color:C.red}}>{error||"Work item not found."}</div></HQPage>
  const item=data.item;const closed=item.status==="resolved"||item.status==="cancelled";const verified=item.verification_status==="verified"||item.verification_status==="not_required"

  return <HQPage title={item.title} description={`${item.department_key} · ${item.work_type} · accountable workroom`} actions={<><Link href="/hq/workroom" style={{...hqButtonStyle,display:"inline-flex",alignItems:"center",textDecoration:"none"}}>Owner inbox</Link><button onClick={()=>void refresh()} style={hqButtonStyle}>Refresh</button></>}>
    {error&&<Notice color={C.red}>{error}</Notice>}{message&&<Notice color={C.green}>{message}</Notice>}
    <section style={{display:"grid",gridTemplateColumns:"minmax(0,1.6fr) minmax(280px,.8fr)",gap:12}} className="hq-workroom-grid">
      <div style={{display:"grid",gap:12,alignContent:"start"}}>
        <HQPanel title="Mission" description="The authoritative work record, not a separate conversation."><div style={{padding:15}}>
          <div style={{display:"flex",gap:7,flexWrap:"wrap"}}><Tag color={item.priority==="critical"?C.red:item.priority==="high"?C.amber:C.blue}>{item.priority}</Tag><Tag color={item.status==="waiting_approval"?C.amber:item.status==="resolved"?C.green:C.blue}>{item.status.replaceAll("_"," ")}</Tag>{item.verification_status&&<Tag color={item.verification_status==="failed"?C.red:item.verification_status==="verified"?C.green:C.muted}>verification {item.verification_status}</Tag>}</div>
          {item.summary&&<p style={{fontSize:12,lineHeight:1.6,color:C.muted}}>{item.summary}</p>}
          <dl style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,margin:"14px 0 0"}}><Fact term="Created" value={new Date(item.created_at).toLocaleString("en-KE")}/><Fact term="Updated" value={new Date(item.updated_at).toLocaleString("en-KE")}/><Fact term="Due" value={item.due_at?new Date(item.due_at).toLocaleString("en-KE"):"Not set"}/><Fact term="Owner" value={item.owner_id?"Assigned":"Unassigned"}/></dl>
          {(Object.keys(item.evidence||{}).length>0||item.action_taken||item.verification_evidence)&&<details style={{marginTop:14}}><summary style={{fontSize:11,color:C.blue,cursor:"pointer"}}>Structured evidence and actions</summary><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",fontSize:10,color:C.muted,lineHeight:1.5}}>{JSON.stringify({evidence:item.evidence,action_taken:item.action_taken,verification_evidence:item.verification_evidence},null,2)}</pre></details>}
        </div></HQPanel>

        <HQPanel title="Work history" description="Append-only updates, decisions and corrections."><div>{data.updates.length===0?<Empty>No updates recorded yet.</Empty>:data.updates.map((entry,index)=><article key={entry.id} style={{padding:14,borderTop:index?`1px solid ${C.border}`:0}}><div style={{display:"flex",gap:8,alignItems:"center"}}><Tag color={entry.update_type==="correction"?C.red:entry.update_type==="approval"?C.green:C.blue}>{entry.update_type}</Tag><time style={{marginLeft:"auto",fontSize:9.5,color:C.muted}}>{new Date(entry.created_at).toLocaleString("en-KE")}</time></div><p style={{margin:"8px 0 0",fontSize:12,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{entry.body}</p></article>)}</div></HQPanel>

        {!closed&&<HQPanel title="Add an update" description="Questions, evidence and handoffs stay attached to this mission."><div style={{padding:14,display:"grid",gap:8}}><select aria-label="Update type" value={updateType} onChange={event=>setUpdateType(event.target.value as HQWorkItemUpdate["update_type"])} style={fieldStyle}>{["note","question","answer","evidence","handoff"].map(value=><option key={value} value={value}>{value}</option>)}</select><textarea aria-label="Update" rows={5} value={body} onChange={event=>setBody(event.target.value)} placeholder="Record what changed, what is needed, or what evidence proves the result." style={{...fieldStyle,resize:"vertical"}}/><button onClick={()=>void addUpdate()} disabled={busy==="update"||!body.trim()} style={{...hqButtonStyle,color:C.green,justifySelf:"start"}}>{busy==="update"?"Recording…":"Record update"}</button></div></HQPanel>}
      </div>

      <aside style={{display:"grid",gap:12,alignContent:"start"}}>
        <HQPanel title="Owner action" description="Every consequential action requires a reason."><div style={{padding:14,display:"grid",gap:8}}>{closed?<Empty>This work is closed.</Empty>:<>{item.status==="open"&&<ActionButton onClick={()=>setAction("start")}>Start work</ActionButton>}{item.status!=="waiting_approval"&&<ActionButton onClick={()=>setAction("submit_for_approval")}>Submit for approval</ActionButton>}{item.status==="waiting_approval"&&<ActionButton onClick={()=>setAction("authorize")} color={C.green}>Authorize next step</ActionButton>}{item.status==="waiting_approval"&&verified&&<ActionButton onClick={()=>setAction("accept_verified")} color={C.green}>Accept verified result</ActionButton>}<ActionButton onClick={()=>setAction("request_correction")} color={C.amber}>Request correction</ActionButton><ActionButton onClick={()=>setAction("cancel")} color={C.red}>Cancel work</ActionButton></>}</div></HQPanel>

        <HQPanel title="Evidence links" description="GitHub, migrations, artifacts and runbooks."><div style={{padding:14,display:"grid",gap:8}}>{data.links.map(link=><a key={link.id} href={link.url} target="_blank" rel="noreferrer" style={{padding:10,border:`1px solid ${C.border}`,borderRadius:10,color:C.blue,textDecoration:"none",fontSize:11}}><strong style={{display:"block",color:C.text}}>{link.label}</strong>{link.link_type.replaceAll("_"," ")}</a>)}{data.links.length===0&&<div style={{fontSize:11,color:C.muted}}>No delivery evidence linked yet.</div>}{!closed&&<><select aria-label="Link type" value={linkType} onChange={event=>setLinkType(event.target.value as HQWorkItemLink["link_type"])} style={fieldStyle}>{["github_issue","github_pull_request","github_branch","github_commit","supabase_migration","artifact","evidence","runbook"].map(value=><option key={value} value={value}>{value.replaceAll("_"," ")}</option>)}</select><input aria-label="Link label" value={linkLabel} onChange={event=>setLinkLabel(event.target.value)} placeholder="Evidence label" style={fieldStyle}/><input aria-label="HTTPS URL" type="url" value={linkUrl} onChange={event=>setLinkUrl(event.target.value)} placeholder="https://…" style={fieldStyle}/><button onClick={()=>void addLink()} disabled={busy==="link"||!linkLabel.trim()||!linkUrl.trim()} style={{...hqButtonStyle,color:C.blue}}>Attach link</button></>}</div></HQPanel>

        <HQPanel title="Execution evidence" description={`${data.runs.length} run${data.runs.length===1?"":"s"} · ${data.handoffs.length} handoff${data.handoffs.length===1?"":"s"}`}><div>{data.runs.length===0&&data.handoffs.length===0?<Empty>No worker execution is linked.</Empty>:<>{data.runs.map(run=><div key={run.id} style={{padding:11,borderBottom:`1px solid ${C.border}`,fontSize:11}}><strong>{run.lane_key}</strong><div style={{color:run.status==="completed"?C.green:C.muted,marginTop:3}}>{run.status} · {run.authority_result||"authority pending"}</div></div>)}{data.handoffs.map(handoff=><div key={handoff.id} style={{padding:11,borderBottom:`1px solid ${C.border}`,fontSize:11}}><strong>{handoff.from_lane_key} → {handoff.to_lane_key}</strong><div style={{color:C.muted,marginTop:3}}>{handoff.status} · {handoff.reason}</div></div>)}</>}</div></HQPanel>
      </aside>
    </section>

    {action&&<div role="dialog" aria-modal="true" aria-labelledby="workroom-action-title" style={{position:"fixed",inset:0,zIndex:300,display:"grid",placeItems:"center",padding:18,background:"rgba(2,6,23,.82)"}}><div style={{width:"min(100%,500px)",padding:18,borderRadius:16,border:`1px solid ${C.border}`,background:C.panel}}><h2 id="workroom-action-title" style={{margin:"0 0 5px",fontSize:17}}>{actionLabels[action]}</h2><p style={{fontSize:11.5,color:C.muted,lineHeight:1.5}}>This action becomes part of the permanent mission history. Record the operational reason.</p><textarea autoFocus rows={5} value={reason} onChange={event=>setReason(event.target.value)} style={{...fieldStyle,resize:"vertical"}} placeholder="Reason and expected next result"/><div className="hq-action-row" style={{justifyContent:"flex-end",marginTop:10}}><button onClick={()=>{setAction(null);setReason("")}} style={hqButtonStyle}>Cancel</button><button onClick={()=>void applyAction()} disabled={busy==="action"||reason.trim().length<3} style={{...hqButtonStyle,color:C.green}}>{busy==="action"?"Recording…":"Confirm action"}</button></div></div></div>}
    <style jsx global>{`@media(max-width:800px){.hq-workroom-grid{grid-template-columns:1fr!important}}`}</style>
  </HQPage>
}

function Notice({color,children}:{color:string;children:React.ReactNode}){return <div role="status" style={{padding:11,borderRadius:10,border:`1px solid ${color}55`,color,background:`${color}12`,fontSize:11.5,marginBottom:10}}>{children}</div>}
function Tag({color,children}:{color:string;children:React.ReactNode}){return <span className="hq-status" style={{color}}>{children}</span>}
function Fact({term,value}:{term:string;value:string}){return <div><dt style={{fontSize:9.5,color:C.muted,textTransform:"uppercase",fontWeight:850}}>{term}</dt><dd style={{fontSize:11.5,margin:"4px 0 0"}}>{value}</dd></div>}
function ActionButton({children,onClick,color=C.text}:{children:React.ReactNode;onClick:()=>void;color?:string}){return <button onClick={onClick} style={{...hqButtonStyle,color,textAlign:"left"}}>{children}</button>}
function Empty({children}:{children:React.ReactNode}){return <div style={{padding:18,textAlign:"center",fontSize:11,color:C.muted}}>{children}</div>}
