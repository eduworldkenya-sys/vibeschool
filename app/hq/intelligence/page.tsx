"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { CSSProperties } from "react"
import { hqSupabase } from "@/lib/hq/supabase"
import { HQPage, HQPanel, HQ_THEME as C, hqButtonStyle } from "@/components/hq/HQShell"

type Report = Record<string, any>
const sb = hqSupabase as any
const fmt = (n: unknown) => typeof n === "number" ? new Intl.NumberFormat("en-KE", { maximumFractionDigits: 1 }).format(n) : String(n ?? "—")
const pct = (n: unknown) => typeof n === "number" ? `${(n * 100).toFixed(1)}%` : "—"

function Metric({ label, value, note, tone = C.green }: { label: string; value: unknown; note?: string; tone?: string }) {
  return <div style={{padding:14,border:`1px solid ${C.border}`,borderRadius:14,background:C.panelSoft}}><div style={{fontSize:23,fontWeight:950,color:tone}}>{fmt(value)}</div><div style={{fontSize:11,fontWeight:900,marginTop:5}}>{label}</div>{note&&<div style={{fontSize:10,color:C.muted,marginTop:4,lineHeight:1.45}}>{note}</div>}</div>
}
function Rows({ rows, empty="No evidence in this lane." }: { rows:any[]; empty?:string }) {
  if(!rows?.length)return <div style={{padding:14,color:C.muted,fontSize:11}}>{empty}</div>
  return <div>{rows.slice(0,12).map((row,i)=><div key={row.id??row.work_id??i} style={{padding:"11px 14px",borderTop:i?`1px solid ${C.border}`:0}}><div style={{fontSize:11.5,fontWeight:850}}>{row.title??row.finding??row.key??"Signal"}</div><div style={{fontSize:10.5,color:C.muted,marginTop:4,lineHeight:1.5}}>{row.explanation??row.why_it_matters??row.recommended_action??row.department??row.definition??""}</div></div>)}</div>
}

export default function HQIntelligencePage(){
  const [report,setReport]=useState<Report|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("")
  const refresh=useCallback(async()=>{setLoading(true);setError("");try{const {data,error}=await sb.rpc("hq_get_seven_day_owner_report");if(error)throw error;setReport(data as Report)}catch(e){setError(e instanceof Error?e.message:"Intelligence could not be loaded")}finally{setLoading(false)}},[])
  useEffect(()=>{void refresh()},[refresh])
  const d=report?.executive_dashboard??{},h=d.headline??{},comp=d.composition??{},growth=d.growth_vs_activation??{},er=d.engagement_vs_retention??{},finance=report?.finance??{},product=report?.product_engagement??{}
  const action=(d.action_required??[]) as any[],findings=(d.declining_kpis??[]) as any[],lineage=(d.metric_lineage??[]) as any[]
  const roleEntries=useMemo(()=>Object.entries(comp.accounts_by_role??{}).sort((a:any,b:any)=>b[1]-a[1]),[comp.accounts_by_role])
  if(loading&&!report)return <main className="hq-page" style={{display:"grid",placeItems:"center"}}>Loading company intelligence…</main>
  return <HQPage title="Decision Intelligence" description="Founder view · growth, learning, product, money, risk and accountable action" actions={<button onClick={()=>void refresh()} style={hqButtonStyle}>Refresh intelligence</button>}>
    {error&&<div role="alert" style={{padding:12,border:`1px solid ${C.red}`,borderRadius:12,color:C.red,marginBottom:14}}>{error}</div>}
    <section><div style={title}>Company pulse</div><div style={grid}><Metric label="DAU" value={h.dau}/><Metric label="WAU" value={h.wau} tone={C.blue}/><Metric label="MAU" value={h.mau} tone={C.violet}/><Metric label="7-day activation" value={pct(growth.activation_rate)} note={`${fmt(growth.activated_new_users_7d)} of ${fmt(growth.signups_7d)} new users activated`} tone={(growth.activation_rate??1)<.3?C.red:C.green}/><Metric label="D1 retention" value={pct(h.d1_retention)} tone={(h.d1_retention??1)<.2?C.amber:C.green}/><Metric label="D7 retention" value={pct(h.d7_retention)} tone={(h.d7_retention??1)<.15?C.amber:C.green}/><Metric label="Open work" value={h.open_work} tone={h.open_work?C.amber:C.green}/><Metric label="Founder findings" value={h.open_findings} tone={h.open_findings?C.red:C.green}/></div></section>
    <section style={{marginTop:24}}><div style={title}>What needs intervention</div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,360px),1fr))",gap:10}}><HQPanel title="Priority findings" description="Exceptions first — not a wall of metrics"><Rows rows={findings}/></HQPanel><HQPanel title="Accountable work" description="Owner, action and verification path"><Rows rows={action}/></HQPanel></div></section>
    <section style={{marginTop:24}}><div style={title}>Growth & retention</div><div style={grid}><Metric label="Signups · 7d" value={growth.signups_7d}/><Metric label="Activated · 7d" value={growth.activated_new_users_7d}/><Metric label="Activation rate" value={pct(growth.activation_rate)} tone={(growth.activation_rate??1)<.3?C.red:C.green}/><Metric label="D1 retained" value={er.retention?.retained_d1} note={`${fmt(er.retention?.eligible_d1)} eligible`}/><Metric label="D7 retained" value={er.retention?.retained_d7} note={`${fmt(er.retention?.eligible_d7)} eligible`}/><Metric label="D30 retained" value={er.retention?.retained_d30} note={`${fmt(er.retention?.eligible_d30)} eligible`}/></div></section>
    <section style={{marginTop:24}}><div style={title}>Audience composition</div><div style={grid}>{roleEntries.map(([role,count])=><Metric key={role} label={`${role} accounts`} value={count}/>)}</div></section>
    <section style={{marginTop:24}}><div style={title}>Learning & product evidence</div><div style={grid}><Metric label="Reading sessions · 7d" value={product.vibelearn?.reading_sessions}/><Metric label="Active reading seconds" value={product.vibelearn?.active_seconds}/><Metric label="Adaptive sessions" value={product.twin?.adaptive_sessions}/><Metric label="Twin sessions" value={product.twin?.twin_sessions}/><Metric label="VibeLab starts" value={product.vibelabs?.sessions_started}/><Metric label="VibeLab completions" value={product.vibelabs?.sessions_completed}/><Metric label="Published resources" value={comp.publications_by_status?.published}/><Metric label="Draft resources" value={comp.publications_by_status?.draft} tone={C.amber}/></div></section>
    <section style={{marginTop:24}}><div style={title}>Business truth</div><div style={grid}><Metric label="MRR" value={`KES ${fmt(finance.mrr)}`}/><Metric label="Cash received · 30d" value={`KES ${fmt(finance.cash_received_30d)}`}/><Metric label="Outstanding invoices" value={`KES ${fmt(finance.outstanding_invoices)}`} tone={finance.outstanding_invoices?C.amber:C.green}/><Metric label="Active subscriptions" value={finance.active_subscriptions}/><Metric label="New subscribers · 30d" value={finance.new_subscribers_30d}/><Metric label="Signup → paid" value={pct(finance.signup_to_subscription_conversion_30d)}/></div></section>
    <section style={{marginTop:24}}><div style={title}>Metric trust & provenance</div><HQPanel title="Certified metric definitions" description="Every executive number must have a definition and source"><Rows rows={lineage}/></HQPanel></section>
    <footer style={{marginTop:22,textAlign:"center",fontSize:10,color:C.muted}}>Generated {report?.generated_at?new Date(report.generated_at).toLocaleString("en-KE"):"—"} · source-backed · owner-gated</footer>
  </HQPage>
}
const grid:CSSProperties={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:9}
const title:CSSProperties={fontSize:10.5,fontWeight:950,color:"rgba(255,255,255,.4)",letterSpacing:".09em",textTransform:"uppercase",marginBottom:9}
