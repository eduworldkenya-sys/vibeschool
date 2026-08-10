"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { HQPage, HQPanel, HQ_THEME as C, hqButtonStyle } from "@/components/hq/HQShell"
import { listHQDepartments, listHQWorkItems, type HQDepartment, type HQWorkItem } from "@/lib/hq/operating"

type View = "attention" | "approval" | "critical" | "active" | "closed"

const activeStatuses = new Set<HQWorkItem["status"]>(["open", "in_progress", "waiting_approval"])
const priorityRank: Record<HQWorkItem["priority"], number> = { critical: 0, high: 1, normal: 2, low: 3 }

function isOverdue(item: HQWorkItem) {
  return Boolean(item.due_at && activeStatuses.has(item.status) && new Date(item.due_at).getTime() < Date.now())
}

function needsAttention(item: HQWorkItem) {
  return item.status === "waiting_approval" || item.priority === "critical" || item.verification_status === "failed" || isOverdue(item)
}

function tone(item: HQWorkItem) {
  if (item.verification_status === "failed" || item.priority === "critical") return C.red
  if (item.status === "waiting_approval" || isOverdue(item)) return C.amber
  if (item.status === "resolved") return C.green
  return C.blue
}

export default function HQWorkroomPage() {
  const [items, setItems] = useState<HQWorkItem[]>([])
  const [departments, setDepartments] = useState<HQDepartment[]>([])
  const [view, setView] = useState<View>("attention")
  const [department, setDepartment] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const refresh = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [work, companyDepartments] = await Promise.all([listHQWorkItems(null, 300), listHQDepartments()])
      setItems(work)
      setDepartments(companyDepartments)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "HQ Workroom could not be loaded.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const counts = useMemo(() => ({
    attention: items.filter(needsAttention).length,
    approval: items.filter(item => item.status === "waiting_approval").length,
    critical: items.filter(item => item.priority === "critical" && activeStatuses.has(item.status)).length,
    overdue: items.filter(isOverdue).length,
    failed: items.filter(item => item.verification_status === "failed" && activeStatuses.has(item.status)).length,
  }), [items])

  const visible = useMemo(() => items
    .filter(item => !department || item.department_key === department)
    .filter(item => {
      if (view === "attention") return needsAttention(item)
      if (view === "approval") return item.status === "waiting_approval"
      if (view === "critical") return item.priority === "critical" && activeStatuses.has(item.status)
      if (view === "active") return activeStatuses.has(item.status)
      return item.status === "resolved" || item.status === "cancelled"
    })
    .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
  [department, items, view])

  return <HQPage title="HQ Workroom" description="Owner inbox · accountable work · evidence · decisions" actions={<button onClick={() => void refresh()} disabled={loading} style={hqButtonStyle}>{loading ? "Refreshing…" : "Refresh"}</button>}>
    {error && <div role="alert" style={{padding:12,borderRadius:11,border:"1px solid rgba(251,113,133,.35)",background:"rgba(251,113,133,.08)",color:"#fecdd3",fontSize:12,marginBottom:12}}>{error}</div>}

    <section aria-label="Owner inbox summary" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:9,marginBottom:14}}>
      <Metric label="Needs attention" value={counts.attention} color={counts.attention ? C.amber : C.green}/>
      <Metric label="Waiting approval" value={counts.approval} color={counts.approval ? C.amber : C.green}/>
      <Metric label="Critical" value={counts.critical} color={counts.critical ? C.red : C.green}/>
      <Metric label="Overdue" value={counts.overdue} color={counts.overdue ? C.red : C.green}/>
      <Metric label="Failed verification" value={counts.failed} color={counts.failed ? C.red : C.green}/>
    </section>

    <HQPanel title="Owner inbox" description="Only work that has a decision, risk, deadline or verification signal rises here.">
      <div style={{padding:12,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",borderBottom:`1px solid ${C.border}`}}>
        {(["attention","approval","critical","active","closed"] as const).map(option => <button key={option} onClick={() => setView(option)} aria-pressed={view === option} style={{...hqButtonStyle,minHeight:34,color:view === option ? C.green : C.muted,borderColor:view === option ? "rgba(52,211,153,.35)" : C.border}}>{option.replace("_", " ")}</button>)}
        <select aria-label="Filter by department" value={department} onChange={event => setDepartment(event.target.value)} style={{marginLeft:"auto",minHeight:36,borderRadius:9,border:`1px solid ${C.border}`,background:C.panel,color:C.text,padding:"0 10px",fontSize:11}}>
          <option value="">All departments</option>
          {departments.map(item => <option key={item.key} value={item.key}>{item.name}</option>)}
        </select>
      </div>

      {loading && items.length === 0 ? <Empty>Loading company work…</Empty> : visible.length === 0 ? <Empty>No work matches this inbox view.</Empty> : visible.map((item, index) => <article key={item.id} style={{padding:14,borderTop:index ? `1px solid ${C.border}` : 0}}>
        <div className="hq-mobile-stack">
          <div style={{minWidth:0}}>
            <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}>
              <span className="hq-status" style={{color:tone(item)}}>{item.priority}</span>
              <span className="hq-status" style={{color:item.status === "waiting_approval" ? C.amber : C.muted}}>{item.status.replaceAll("_", " ")}</span>
              <span style={{fontSize:10,color:C.muted}}>{item.department_key}</span>
              {isOverdue(item) && <span className="hq-status" style={{color:C.red}}>Overdue</span>}
              {item.verification_status && <span className="hq-status" style={{color:item.verification_status === "failed" ? C.red : item.verification_status === "verified" ? C.green : C.muted}}>Verification: {item.verification_status}</span>}
            </div>
            <h2 style={{fontSize:14,margin:"8px 0 0"}}>{item.title}</h2>
            {item.summary && <p style={{fontSize:11.5,lineHeight:1.55,color:C.muted,margin:"5px 0 0"}}>{item.summary}</p>}
            <div style={{fontSize:10,color:"rgba(255,255,255,.34)",marginTop:7}}>Updated {new Date(item.updated_at).toLocaleString("en-KE")}{item.due_at ? ` · Due ${new Date(item.due_at).toLocaleString("en-KE")}` : ""}</div>
          </div>
          <div className="hq-action-row">
            <Link href={`/hq/workroom/${item.id}`} style={{...hqButtonStyle,display:"inline-flex",alignItems:"center",textDecoration:"none",color:C.green}}>Open workroom</Link>
          </div>
        </div>
      </article>)}
    </HQPanel>
  </HQPage>
}

function Metric({label,value,color}:{label:string;value:number;color:string}) {
  return <div style={{padding:13,border:`1px solid ${C.border}`,borderRadius:13,background:C.panelSoft}}><div style={{fontSize:24,fontWeight:950,color}}>{value}</div><div style={{fontSize:10.5,color:C.muted,marginTop:3}}>{label}</div></div>
}

function Empty({children}:{children:React.ReactNode}) {
  return <div style={{padding:28,textAlign:"center",fontSize:12,color:C.muted}}>{children}</div>
}
