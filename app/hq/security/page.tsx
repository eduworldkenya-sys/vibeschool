"use client"

import { useCallback, useEffect, useState } from "react"
import { hqSupabase } from "@/lib/hq/supabase"
import { HQPage, HQPanel, HQ_THEME as C } from "@/components/hq/HQShell"

type Event={event_type:string;outcome:string;risk_score:number;created_at:string;actor_id:string|null;metadata:Record<string,unknown>}
export default function HQSecurityPage(){
 const [events,setEvents]=useState<Event[]>([]);const [error,setError]=useState("");const [loading,setLoading]=useState(true)
 const load=useCallback(async()=>{setError("");const {data,error}=await hqSupabase.rpc("hq_security_events",{p_limit:200});if(error){setError(error.message);return}setEvents((data||[]) as Event[])},[])
 useEffect(()=>{void(async()=>{await load();setLoading(false)})()},[load])
 const blocked=events.filter(e=>e.outcome==='blocked').length
 const risky=events.filter(e=>e.risk_score>=50).length
 return <HQPage title="Security & abuse" description="Monitor suspicious activity without exposing security telemetry to ordinary users." actions={<button onClick={()=>void load()} style={{padding:"9px 12px",borderRadius:9,border:`1px solid ${C.border}`,background:"transparent",color:C.text}}>Refresh</button>}>
  {error&&<div role="alert" style={{color:C.red,marginBottom:12}}>{error}</div>}
  <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10,marginBottom:16}}><HQPanel title="Events"><b style={{fontSize:28}}>{events.length}</b></HQPanel><HQPanel title="Blocked"><b style={{fontSize:28,color:C.red}}>{blocked}</b></HQPanel><HQPanel title="High risk"><b style={{fontSize:28,color:C.amber}}>{risky}</b></HQPanel></section>
  <HQPanel title="Recent security events">{loading?<div style={{padding:14,color:C.muted}}>Loading…</div>:events.length===0?<div style={{padding:14,color:C.muted}}>No security events yet.</div>:events.map((e,i)=><div key={`${e.created_at}-${i}`} style={{padding:"11px 0",borderTop:i?`1px solid ${C.border}`:"none",fontSize:12}}><b>{e.event_type}</b> · <span style={{color:e.outcome==='blocked'?C.red:C.muted}}>{e.outcome}</span> · risk {e.risk_score}<div style={{fontSize:10,color:C.muted,marginTop:3}}>{new Date(e.created_at).toLocaleString()} · {e.actor_id||"anonymous"}</div></div>)}</HQPanel>
 </HQPage>
}
