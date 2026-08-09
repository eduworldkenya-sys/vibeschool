"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

const deepspace = "#0a1628"
const accent = "#10b981"
const violet = "#8b5cf6"

export default function ResetPasswordPage() {
  const router = useRouter()
  const redirectTimer = useRef<NodeJS.Timeout | null>(null)
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [validSession, setValidSession] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let alive = true
    async function establishRecoverySession() {
      setChecking(true); setError("")
      try {
        const params = new URLSearchParams(window.location.search)
        const code = params.get("code")
        const flowId = params.get("sb_flow_id")
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined)
          if (exchangeError) throw exchangeError
          const cleanUrl = new URL(window.location.href)
          cleanUrl.searchParams.delete("code"); cleanUrl.searchParams.delete("sb_flow_id")
          window.history.replaceState({}, "", cleanUrl.pathname + cleanUrl.search + cleanUrl.hash)
        }
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) throw userError ?? new Error("Recovery session unavailable")
        if (alive) setValidSession(true)
      } catch {
        if (alive) { setValidSession(false); setError("This reset link is invalid, expired, or already used. Request a new reset email from Admin sign in.") }
      } finally { if (alive) setChecking(false) }
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (alive && event === "PASSWORD_RECOVERY" && session?.user) { setValidSession(true); setChecking(false); setError("") }
    })
    void establishRecoverySession()
    return () => { alive = false; subscription.unsubscribe(); if (redirectTimer.current) clearTimeout(redirectTimer.current) }
  }, [])

  async function handleReset() {
    setError("")
    if (!validSession) { setError("A valid password-recovery session is required."); return }
    if (!password.trim()) { setError("Enter a new password."); return }
    if (password.length < 12) { setError("Password must be at least 12 characters."); return }
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) { setError("Password must contain letters and a number."); return }
    if (password !== confirm) { setError("Passwords do not match."); return }
    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) { setLoading(false); setError("Could not update password. The recovery link may have expired or already been used."); return }
    await supabase.auth.signOut()
    document.cookie = "vibe_role=; path=/; max-age=0"
    localStorage.removeItem("vs_role")
    setLoading(false); setDone(true)
    redirectTimer.current = setTimeout(() => router.replace("/admin/login"), 1800)
  }

  const inputStyle: React.CSSProperties = { width:"100%", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"10px", padding:"14px 16px", color:"#fff", fontSize:"15px", outline:"none", boxSizing:"border-box", fontFamily:"inherit" }
  const labelStyle: React.CSSProperties = { display:"block", color:"rgba(255,255,255,0.5)", fontSize:"12px", fontWeight:"600", letterSpacing:"0.5px", marginBottom:"8px", textTransform:"uppercase" }

  return <div style={{minHeight:"100dvh",background:deepspace,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Inter', sans-serif",padding:"24px"}}>
    <div style={{width:"100%",maxWidth:"420px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"24px",padding:"48px 40px"}}>
      <div style={{textAlign:"center",marginBottom:"32px"}}><div style={{width:56,height:56,background:`linear-gradient(135deg, ${accent}, ${violet})`,borderRadius:16,margin:"0 auto 16px",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:24}}>🔒</div><h1 style={{color:"#fff",fontSize:22,margin:"0 0 6px"}}>Reset Admin Password</h1><p style={{color:"rgba(255,255,255,.4)",fontSize:13}}>Securely set a new password for your administrator account</p></div>
      {checking ? <p style={{textAlign:"center",color:"rgba(255,255,255,.5)"}}>Verifying recovery link...</p> : done ? <div style={{textAlign:"center"}}><p style={{color:"#fff",fontWeight:700}}>Password updated</p><p style={{color:"rgba(255,255,255,.4)",fontSize:13}}>Recovery session closed. Returning to Admin sign in...</p></div> : !validSession ? <div style={{textAlign:"center"}}><p style={{color:"#ef4444",fontSize:14}}>{error || "This reset link is invalid or has expired."}</p><button onClick={()=>router.replace("/admin/login")} style={{color:accent,background:"none",border:"none",cursor:"pointer"}}>Request a new reset link</button></div> : <div>
        {error && <div style={{color:"#ef4444",marginBottom:16}}>{error}</div>}
        <div style={{marginBottom:16}}><label style={labelStyle}>New Password</label><input type={showPass?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" placeholder="12+ characters, letters and number" style={inputStyle}/></div>
        <div style={{marginBottom:12}}><label style={labelStyle}>Confirm Password</label><input type={showPass?"text":"password"} value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password" style={inputStyle}/></div>
        <button type="button" onClick={()=>setShowPass(v=>!v)} style={{background:"none",border:"none",color:"rgba(255,255,255,.5)",marginBottom:20,cursor:"pointer"}}>{showPass?"Hide passwords":"Show passwords"}</button>
        <button onClick={()=>void handleReset()} disabled={loading} style={{width:"100%",background:accent,border:"none",borderRadius:10,padding:15,color:"#fff",fontWeight:700,cursor:loading?"not-allowed":"pointer"}}>{loading?"Updating...":"Set New Password"}</button>
      </div>}
      <p style={{textAlign:"center",color:"rgba(255,255,255,.15)",fontSize:12,marginTop:28}}>VibeSchool · Security & Identity</p>
    </div>
  </div>
}
