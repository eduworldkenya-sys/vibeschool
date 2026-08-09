"use client"
export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

const hqSupabase = supabase as unknown as {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>
}

export default function HQResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [ready, setReady] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    void supabase.auth.getUser().then(({ data, error: userError }) => {
      if (!mounted) return
      if (userError || !data.user) {
        setError("This recovery link is invalid or has expired. Request a new link from HQ login.")
        return
      }
      setReady(true)
    })
    return () => { mounted = false }
  }, [])

  async function handleReset() {
    setError("")
    if (!ready) return setError("A valid recovery session is required.")
    if (password.length < 12) return setError("Use at least 12 characters for the new password.")
    if (password !== confirmPassword) return setError("Passwords do not match.")
    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError

      const { data: access, error: accessError } = await hqSupabase.rpc("hq_check_owner_access", { p_surface: "/hq/reset-password" })
      const allowed = !accessError && Boolean((access as { allowed?: boolean } | null)?.allowed)
      if (!allowed) {
        await supabase.auth.signOut()
        throw new Error("Password changed, but this account is not authorized for VibeSchool HQ.")
      }

      router.replace("/hq")
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Password could not be changed.")
      setLoading(false)
    }
  }

  return <main style={{minHeight:"100dvh",display:"grid",placeItems:"center",background:"#07111f",color:"#f8fafc",padding:24,fontFamily:"Inter,system-ui,sans-serif"}}>
    <section style={{width:"100%",maxWidth:420,border:"1px solid rgba(255,255,255,.1)",borderRadius:22,padding:32,background:"rgba(255,255,255,.035)"}}>
      <div style={{fontSize:11,fontWeight:900,letterSpacing:".12em",color:"#34d399",textTransform:"uppercase"}}>Secure recovery</div>
      <h1 style={{fontSize:28,margin:"8px 0 4px"}}>Set a new HQ password</h1>
      <p style={{fontSize:13,color:"rgba(255,255,255,.5)",margin:"0 0 26px"}}>The recovery session proves email access. HQ owner authority is verified separately before entry.</p>
      {error && <div role="alert" style={{padding:12,borderRadius:10,marginBottom:16,background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.25)",color:"#fca5a5",fontSize:12,lineHeight:1.5}}>{error}</div>}
      <label htmlFor="new-password" style={{fontSize:11,color:"rgba(255,255,255,.55)"}}>New password</label>
      <input id="new-password" value={password} onChange={e=>setPassword(e.target.value)} type="password" autoComplete="new-password" minLength={12} disabled={!ready||loading} style={{width:"100%",boxSizing:"border-box",margin:"7px 0 16px",padding:13,borderRadius:10,border:"1px solid rgba(255,255,255,.12)",background:"rgba(255,255,255,.05)",color:"white"}} />
      <label htmlFor="confirm-password" style={{fontSize:11,color:"rgba(255,255,255,.55)"}}>Confirm new password</label>
      <input id="confirm-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} onKeyDown={e=>{if(e.key==="Enter") void handleReset()}} type="password" autoComplete="new-password" minLength={12} disabled={!ready||loading} style={{width:"100%",boxSizing:"border-box",margin:"7px 0 22px",padding:13,borderRadius:10,border:"1px solid rgba(255,255,255,.12)",background:"rgba(255,255,255,.05)",color:"white"}} />
      <button disabled={!ready||loading} onClick={()=>void handleReset()} style={{width:"100%",padding:14,border:0,borderRadius:10,background:"#10b981",color:"#04110c",fontWeight:900,cursor:loading?"wait":"pointer",opacity:ready?1:.55}}>{loading?"Updating and verifying authority…":"Set password and enter HQ"}</button>
      <button type="button" onClick={()=>router.replace("/hq/login")} style={{width:"100%",marginTop:12,padding:10,border:0,background:"transparent",color:"rgba(255,255,255,.55)",fontWeight:800,cursor:"pointer"}}>Back to HQ login</button>
    </section>
  </main>
}
