"use client"
export const dynamic = "force-dynamic"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function HQLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    setError("")
    if (!email.trim() || !password) return setError("Email and password are required.")
    setLoading(true)
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
      if (authError || !data.user) throw new Error("Invalid email or password.")

      const { data: access, error: accessError } = await supabase.rpc("hq_check_owner_access", { p_surface: "/hq/login" })
      const allowed = !accessError && Boolean((access as { allowed?: boolean } | null)?.allowed)
      if (!allowed) {
        await supabase.auth.signOut()
        throw new Error("This account is not authorized for VibeSchool HQ.")
      }

      router.replace("/hq")
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "HQ access could not be verified.")
      setLoading(false)
    }
  }

  return <main style={{minHeight:"100dvh",display:"grid",placeItems:"center",background:"#07111f",color:"#f8fafc",padding:24,fontFamily:"Inter,system-ui,sans-serif"}}>
    <section style={{width:"100%",maxWidth:420,border:"1px solid rgba(255,255,255,.1)",borderRadius:22,padding:32,background:"rgba(255,255,255,.035)"}}>
      <div style={{fontSize:11,fontWeight:900,letterSpacing:".12em",color:"#34d399",textTransform:"uppercase"}}>Owner authority</div>
      <h1 style={{fontSize:28,margin:"8px 0 4px"}}>VibeSchool HQ</h1>
      <p style={{fontSize:13,color:"rgba(255,255,255,.5)",margin:"0 0 26px"}}>Authentication and platform-owner authority are both required.</p>
      {error && <div style={{padding:12,borderRadius:10,marginBottom:16,background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.25)",color:"#fca5a5",fontSize:12}}>{error}</div>}
      <label style={{fontSize:11,color:"rgba(255,255,255,.55)"}}>Email</label>
      <input value={email} onChange={e=>setEmail(e.target.value)} type="email" autoComplete="email" style={{width:"100%",margin:"7px 0 16px",padding:13,borderRadius:10,border:"1px solid rgba(255,255,255,.12)",background:"rgba(255,255,255,.05)",color:"white"}} />
      <label style={{fontSize:11,color:"rgba(255,255,255,.55)"}}>Password</label>
      <input value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>{if(e.key==="Enter") void handleLogin()}} type="password" autoComplete="current-password" style={{width:"100%",margin:"7px 0 22px",padding:13,borderRadius:10,border:"1px solid rgba(255,255,255,.12)",background:"rgba(255,255,255,.05)",color:"white"}} />
      <button disabled={loading} onClick={()=>void handleLogin()} style={{width:"100%",padding:14,border:0,borderRadius:10,background:"#10b981",color:"#04110c",fontWeight:900,cursor:loading?"wait":"pointer"}}>{loading?"Verifying owner authority…":"Enter HQ"}</button>
    </section>
  </main>
}
