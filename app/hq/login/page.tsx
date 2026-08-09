"use client"
export const dynamic = "force-dynamic"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

const hqSupabase = supabase as unknown as {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>
}

export default function HQLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [recovering, setRecovering] = useState(false)

  async function handleLogin() {
    setError(""); setMessage("")
    if (!email.trim() || !password) return setError("Email and password are required.")
    setLoading(true)
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
      if (authError || !data.user) throw new Error("Invalid email or password.")
      const { data: access, error: accessError } = await hqSupabase.rpc("hq_check_owner_access", { p_surface: "/hq/login" })
      const allowed = !accessError && Boolean((access as { allowed?: boolean } | null)?.allowed)
      if (!allowed) { await supabase.auth.signOut(); throw new Error("This account is not authorized for VibeSchool HQ.") }
      router.replace("/hq"); router.refresh()
    } catch (e) { setError(e instanceof Error ? e.message : "HQ access could not be verified."); setLoading(false) }
  }

  async function handleRecovery() {
    setError(""); setMessage("")
    if (!email.trim()) return setError("Enter your owner email first.")
    setRecovering(true)
    try {
      const redirectTo = `${window.location.origin}/hq/reset-password`
      const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo })
      if (recoveryError) throw recoveryError
      setMessage("If this email is registered, a secure password-reset link has been sent. Check your inbox and spam folder.")
    } catch (e) { setError(e instanceof Error ? e.message : "Password recovery could not be started.") }
    finally { setRecovering(false) }
  }

  return <main style={{minHeight:"100dvh",display:"grid",placeItems:"center",background:"#07111f",color:"#f8fafc",padding:24,fontFamily:"Inter,system-ui,sans-serif"}}>
    <section style={{width:"100%",maxWidth:420,border:"1px solid rgba(255,255,255,.1)",borderRadius:22,padding:32,background:"rgba(255,255,255,.035)"}}>
      <div style={{fontSize:11,fontWeight:900,letterSpacing:".12em",color:"#34d399",textTransform:"uppercase"}}>Owner authority</div>
      <h1 style={{fontSize:28,margin:"8px 0 4px"}}>VibeSchool HQ</h1>
      <p style={{fontSize:13,color:"rgba(255,255,255,.5)",margin:"0 0 26px"}}>Authentication and platform-owner authority are both required.</p>
      {error && <div role="alert" style={{padding:12,borderRadius:10,marginBottom:16,background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.25)",color:"#fca5a5",fontSize:12}}>{error}</div>}
      {message && <div role="status" style={{padding:12,borderRadius:10,marginBottom:16,background:"rgba(52,211,153,.08)",border:"1px solid rgba(52,211,153,.25)",color:"#bbf7d0",fontSize:12,lineHeight:1.5}}>{message}</div>}
      <label htmlFor="hq-email" style={{fontSize:11,color:"rgba(255,255,255,.55)"}}>Email</label>
      <input id="hq-email" value={email} onChange={e=>setEmail(e.target.value)} type="email" autoComplete="email" style={{width:"100%",boxSizing:"border-box",margin:"7px 0 16px",padding:13,borderRadius:10,border:"1px solid rgba(255,255,255,.12)",background:"rgba(255,255,255,.05)",color:"white"}} />
      <label htmlFor="hq-password" style={{fontSize:11,color:"rgba(255,255,255,.55)"}}>Password</label>
      <input id="hq-password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>{if(e.key==="Enter") void handleLogin()}} type="password" autoComplete="current-password" style={{width:"100%",boxSizing:"border-box",margin:"7px 0 10px",padding:13,borderRadius:10,border:"1px solid rgba(255,255,255,.12)",background:"rgba(255,255,255,.05)",color:"white"}} />
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:18}}><button type="button" disabled={recovering||loading} onClick={()=>void handleRecovery()} style={{border:0,background:"transparent",color:"#60a5fa",fontSize:11,fontWeight:800,cursor:recovering?"wait":"pointer",padding:4}}>{recovering?"Sending reset link…":"Forgot password?"}</button></div>
      <button disabled={loading||recovering} onClick={()=>void handleLogin()} style={{width:"100%",padding:14,border:0,borderRadius:10,background:"#10b981",color:"#04110c",fontWeight:900,cursor:loading?"wait":"pointer"}}>{loading?"Verifying owner authority…":"Enter HQ"}</button>
    </section>
  </main>
}
