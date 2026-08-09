"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { HQPage, HQPanel, HQ_THEME as C, hqButtonStyle } from "@/components/hq/HQShell"
import { hqSupabase } from "@/lib/hq/supabase"

type SecurityUser = {
  id: string
  email: string | null
  phone: string | null
  full_name: string | null
  role: string | null
  created_at: string
  last_sign_in_at: string | null
  banned_until: string | null
  is_platform_owner: boolean
}

type SecurityEvent = {
  id: string
  event_type: string
  actor_user_id: string | null
  subject_user_id: string | null
  subject_email: string | null
  surface: string
  outcome: string
  metadata: Record<string, unknown> | null
  created_at: string
}

type SecurityAction = "send_recovery" | "revoke_sessions" | "lock" | "unlock"

const fieldStyle: React.CSSProperties = {
  minHeight: 42,
  width: "100%",
  boxSizing: "border-box",
  padding: "9px 11px",
  borderRadius: 10,
  border: `1px solid ${C.border}`,
  background: "rgba(255,255,255,.04)",
  color: C.text,
  outline: "none",
  font: "inherit",
  fontSize: 12,
}

function isLocked(user: SecurityUser) {
  if (!user.banned_until) return false
  return new Date(user.banned_until).getTime() > Date.now()
}

export default function HQSecurityPage() {
  const [query, setQuery] = useState("")
  const [users, setUsers] = useState<SecurityUser[]>([])
  const [events, setEvents] = useState<SecurityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const token = useCallback(async () => {
    const { data, error: sessionError } = await hqSupabase.auth.getSession()
    if (sessionError || !data.session?.access_token) throw new Error("HQ owner session is unavailable.")
    return data.session.access_token
  }, [])

  const load = useCallback(async (search = "") => {
    setLoading(true)
    setError("")
    try {
      const accessToken = await token()
      const response = await fetch(`/api/hq/security/users?q=${encodeURIComponent(search.trim())}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      })
      const body = await response.json() as { ok?: boolean; users?: SecurityUser[]; events?: SecurityEvent[]; error?: string }
      if (!response.ok || !body.ok) throw new Error(body.error || "Security state could not be loaded.")
      setUsers(body.users ?? [])
      setEvents(body.events ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Security state could not be loaded.")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { void load("") }, [load])

  async function act(user: SecurityUser, action: SecurityAction) {
    const labels: Record<SecurityAction, string> = {
      send_recovery: "send a password-recovery email",
      revoke_sessions: "revoke all active sessions",
      lock: "lock this account and revoke its sessions",
      unlock: "unlock this account",
    }
    if (!window.confirm(`Security & Identity will ${labels[action]} for ${user.email || user.id}. Continue?`)) return

    setActing(`${user.id}:${action}`)
    setError("")
    setMessage("")
    try {
      const accessToken = await token()
      const response = await fetch("/api/hq/security/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ action, userId: user.id }),
      })
      const body = await response.json() as { ok?: boolean; message?: string; error?: string }
      if (!response.ok || !body.ok) throw new Error(body.error || "Security action failed.")
      setMessage(body.message || "Security action completed.")
      await load(query)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Security action failed.")
    } finally {
      setActing(null)
    }
  }

  const summary = useMemo(() => ({
    users: users.length,
    locked: users.filter(isLocked).length,
    owners: users.filter(user => user.is_platform_owner).length,
    failed: events.filter(event => event.outcome === "failed" || event.outcome === "denied").length,
  }), [users, events])

  return <HQPage title="Security & Identity" description="Authentication, recovery, sessions, account controls and auditable identity operations">
    {error && <div role="alert" style={{padding:11,borderRadius:10,border:"1px solid rgba(251,113,133,.3)",background:"rgba(251,113,133,.08)",color:"#fecdd3",fontSize:11,marginBottom:12}}>{error}</div>}
    {message && <div role="status" style={{padding:11,borderRadius:10,border:"1px solid rgba(52,211,153,.25)",background:"rgba(52,211,153,.07)",color:"#bbf7d0",fontSize:11,marginBottom:12}}>{message}</div>}

    <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:9,marginBottom:14}}>
      {[["Users loaded",summary.users,C.blue],["Locked",summary.locked,C.amber],["Platform owners",summary.owners,C.green],["Denied / failed events",summary.failed,C.red]].map(([label,value,color])=><div key={String(label)} style={{padding:14,borderRadius:13,border:`1px solid ${C.border}`,background:C.panelSoft}}><div style={{fontSize:10,color:C.muted}}>{String(label)}</div><div style={{fontSize:22,fontWeight:950,color:String(color),marginTop:5}}>{String(value)}</div></div>)}
    </section>

    <HQPanel title="Account operations" description="Search Auth users. The platform owner is protected from lock/session-revocation actions on this surface.">
      <div style={{padding:14,borderBottom:`1px solid ${C.border}`}}>
        <form onSubmit={e=>{e.preventDefault();void load(query)}} style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto",gap:8}}>
          <input aria-label="Search accounts" placeholder="Search email, phone or user ID" value={query} onChange={e=>setQuery(e.target.value)} style={fieldStyle}/>
          <button type="submit" style={hqButtonStyle}>{loading?"Loading…":"Search"}</button>
        </form>
      </div>
      <div>
        {loading ? <div style={{padding:20,color:C.muted,fontSize:12}}>Loading authoritative Auth accounts…</div> : users.length===0 ? <div style={{padding:20,color:C.muted,fontSize:12}}>No matching accounts.</div> : users.map((user,index)=>{
          const locked=isLocked(user)
          return <div key={user.id} className="hq-mobile-stack" style={{padding:14,borderTop:index?`1px solid ${C.border}`:0,alignItems:"start"}}>
            <div style={{minWidth:0}}>
              <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}>
                <strong style={{fontSize:12,overflowWrap:"anywhere"}}>{user.email || user.phone || user.id}</strong>
                {user.role&&<span className="hq-status" style={{color:C.blue}}>{user.role}</span>}
                {user.is_platform_owner&&<span className="hq-status" style={{color:C.green}}>Platform owner</span>}
                {locked&&<span className="hq-status" style={{color:C.red}}>Locked</span>}
              </div>
              {user.full_name&&<div style={{fontSize:11,color:C.muted,marginTop:5}}>{user.full_name}</div>}
              <div style={{fontSize:9.5,color:"rgba(255,255,255,.32)",marginTop:6,overflowWrap:"anywhere"}}>ID {user.id}</div>
              <div style={{fontSize:9.5,color:C.muted,marginTop:4}}>Last sign-in {user.last_sign_in_at?new Date(user.last_sign_in_at).toLocaleString("en-KE"):"Never"}</div>
            </div>
            <div className="hq-action-row" style={{justifyContent:"flex-end"}}>
              <button disabled={Boolean(acting)||user.is_platform_owner} onClick={()=>void act(user,"send_recovery")} style={{...hqButtonStyle,opacity:user.is_platform_owner?.45:1}}>Send reset</button>
              <button disabled={Boolean(acting)||user.is_platform_owner} onClick={()=>void act(user,"revoke_sessions")} style={{...hqButtonStyle,opacity:user.is_platform_owner?.45:1}}>Revoke sessions</button>
              {locked ? <button disabled={Boolean(acting)||user.is_platform_owner} onClick={()=>void act(user,"unlock")} style={{...hqButtonStyle,color:C.green,opacity:user.is_platform_owner?.45:1}}>Unlock</button> : <button disabled={Boolean(acting)||user.is_platform_owner} onClick={()=>void act(user,"lock")} style={{...hqButtonStyle,color:C.red,opacity:user.is_platform_owner?.45:1}}>Lock</button>}
            </div>
          </div>
        })}
      </div>
    </HQPanel>

    <div style={{height:14}}/>
    <HQPanel title="Security audit ledger" description="Recent recovery, session and account-control events written by Security & Identity services.">
      <div>
        {events.length===0?<div style={{padding:20,color:C.muted,fontSize:12}}>No Security & Identity events recorded yet.</div>:events.map((event,index)=><div key={event.id} className="hq-mobile-stack" style={{padding:12,borderTop:index?`1px solid ${C.border}`:0}}><div><div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}><strong style={{fontSize:11}}>{event.event_type.replaceAll("_"," ")}</strong><span className="hq-status" style={{color:event.outcome==="failed"||event.outcome==="denied"?C.red:event.outcome==="completed"?C.green:C.amber}}>{event.outcome}</span></div><div style={{fontSize:10,color:C.muted,marginTop:4}}>{event.subject_email || event.subject_user_id || "No subject"}</div></div><div style={{fontSize:9.5,color:C.muted,textAlign:"right"}}>{new Date(event.created_at).toLocaleString("en-KE")}</div></div>)}
      </div>
    </HQPanel>
  </HQPage>
}
