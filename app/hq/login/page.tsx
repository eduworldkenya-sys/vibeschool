"use client"
export const dynamic = "force-dynamic"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { hqSupabase } from "@/lib/hq/supabase"

const fieldStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  marginTop: 7,
  padding: "13px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,.12)",
  outline: "none",
  background: "rgba(255,255,255,.05)",
  color: "white",
  fontSize: 15,
}

export default function HQLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [recovering, setRecovering] = useState(false)
  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email])

  async function handleLogin() {
    setError(""); setMessage("")
    if (!normalizedEmail || !password) return setError("Email and password are required.")
    setLoading(true)
    try {
      const { data, error: authError } = await hqSupabase.auth.signInWithPassword({ email: normalizedEmail, password })
      if (authError || !data.user) throw new Error("Invalid email or password.")
      const { data: access, error: accessError } = await hqSupabase.rpc("hq_check_owner_access", { p_surface: "/hq/login" })
      const allowed = !accessError && Boolean((access as { allowed?: boolean } | null)?.allowed)
      if (!allowed) {
        await hqSupabase.auth.signOut({ scope: "local" })
        throw new Error("This account is not authorized for VibeSchool HQ.")
      }
      router.replace("/hq")
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "HQ access could not be verified.")
      setLoading(false)
    }
  }

  async function handleRecovery() {
    setError(""); setMessage("")
    if (!normalizedEmail) return setError("Enter your HQ email first.")
    setRecovering(true)
    try {
      const redirectTo = `${window.location.origin}/hq/reset-password`
      const { error: recoveryError } = await hqSupabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo })
      if (recoveryError) throw recoveryError
      setMessage("If this address is registered, a secure reset email has been sent. Open the newest message in the same browser and follow its link.")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Password recovery could not be started.")
    } finally {
      setRecovering(false)
    }
  }

  const busy = loading || recovering

  return <main style={{minHeight:"100dvh",display:"grid",placeItems:"center",background:"radial-gradient(circle at top,#10233d 0,#07111f 46%,#040a12 100%)",color:"#f8fafc",padding:"24px 16px",fontFamily:"Inter,system-ui,sans-serif"}}>
    <section style={{width:"100%",maxWidth:440,border:"1px solid rgba(255,255,255,.1)",borderRadius:24,padding:"clamp(22px,6vw,34px)",background:"rgba(7,17,31,.86)",boxShadow:"0 24px 80px rgba(0,0,0,.28)",backdropFilter:"blur(18px)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:22}}>
        <div aria-hidden="true" style={{width:38,height:38,borderRadius:12,display:"grid",placeItems:"center",background:"rgba(16,185,129,.12)",border:"1px solid rgba(52,211,153,.22)",color:"#6ee7b7",fontWeight:950}}>V</div>
        <div><div style={{fontSize:10.5,fontWeight:950,letterSpacing:".13em",color:"#34d399",textTransform:"uppercase"}}>Owner authority</div><div style={{fontSize:12,color:"rgba(255,255,255,.42)",marginTop:2}}>Protected administrative surface</div></div>
      </div>
      <h1 style={{fontSize:"clamp(27px,7vw,34px)",letterSpacing:"-.03em",margin:"0 0 7px"}}>Enter VibeSchool HQ</h1>
      <p style={{fontSize:13,lineHeight:1.6,color:"rgba(255,255,255,.52)",margin:"0 0 25px"}}>HQ uses its own isolated sign-in session. Student, Teacher, Parent and Admin sessions in this browser are not replaced by an HQ login attempt.</p>

      {error && <div role="alert" aria-live="assertive" style={{padding:12,borderRadius:11,marginBottom:16,background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.25)",color:"#fecaca",fontSize:12,lineHeight:1.5}}>{error}</div>}
      {message && <div role="status" aria-live="polite" style={{padding:12,borderRadius:11,marginBottom:16,background:"rgba(52,211,153,.08)",border:"1px solid rgba(52,211,153,.25)",color:"#bbf7d0",fontSize:12,lineHeight:1.55}}>{message}</div>}

      <label htmlFor="hq-email" style={{fontSize:11,fontWeight:800,color:"rgba(255,255,255,.62)"}}>Email</label>
      <input id="hq-email" value={email} onChange={e=>setEmail(e.target.value)} type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" autoComplete="email" disabled={busy} placeholder="owner@example.com" style={{...fieldStyle,marginBottom:17,opacity:busy?.72:1}} />

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}><label htmlFor="hq-password" style={{fontSize:11,fontWeight:800,color:"rgba(255,255,255,.62)"}}>Password</label><button type="button" onClick={()=>setShowPassword(v=>!v)} disabled={busy} style={{border:0,background:"transparent",padding:0,color:"#93c5fd",fontSize:10.5,fontWeight:800,cursor:"pointer"}}>{showPassword?"Hide":"Show"}</button></div>
      <input id="hq-password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!busy) void handleLogin()}} type={showPassword?"text":"password"} autoComplete="current-password" disabled={busy} style={{...fieldStyle,marginBottom:8,opacity:busy?.72:1}} />

      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:20}}><button type="button" disabled={busy} onClick={()=>void handleRecovery()} style={{border:0,background:"transparent",color:busy?"rgba(147,197,253,.45)":"#93c5fd",fontSize:11,fontWeight:850,cursor:busy?"default":"pointer",padding:"5px 0"}}>{recovering?"Sending secure link…":"Forgot password?"}</button></div>

      <button disabled={busy} onClick={()=>void handleLogin()} style={{width:"100%",padding:14,border:"1px solid rgba(16,185,129,.35)",borderRadius:12,background:busy?"rgba(16,185,129,.55)":"#10b981",color:"#03120c",fontWeight:950,fontSize:13.5,cursor:busy?"wait":"pointer",boxShadow:"0 12px 30px rgba(16,185,129,.13)"}}>{loading?"Verifying owner authority…":"Enter HQ"}</button>
      <div style={{display:"flex",gap:8,alignItems:"flex-start",marginTop:18,paddingTop:17,borderTop:"1px solid rgba(255,255,255,.07)",fontSize:10.5,lineHeight:1.5,color:"rgba(255,255,255,.36)"}}><span aria-hidden="true">●</span><span>Password recovery restores authentication only. HQ owner authority is still checked independently before access is allowed.</span></div>
    </section>
  </main>
}
