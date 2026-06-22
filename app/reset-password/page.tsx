"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"

const deepspace = "#0a1628"
const accent    = "#10b981"
const violet    = "#8b5cf6"

const ROLE_BACK: Record<string, string> = {
  admin:   "/admin/login",
  teacher: "/?role=teacher",
  parent:  "/?role=parent",
  student: "/?role=student",
}
const ROLE_LABELS: Record<string, string> = {
  admin: "admin account", teacher: "teacher account",
  parent: "parent account", student: "student account",
}

function ResetContent() {
  const router        = useRouter()
  const params        = useSearchParams()
  const role          = params.get("role") ?? "admin"
  const redirectTimer = useRef<NodeJS.Timeout | null>(null)
  const backUrl       = ROLE_BACK[role] ?? "/"
  const roleLabel     = ROLE_LABELS[role] ?? "account"

  const [password,     setPassword]     = useState("")
  const [confirm,      setConfirm]      = useState("")
  const [showPass,     setShowPass]     = useState(false)
  const [error,        setError]        = useState("")
  const [loading,      setLoading]      = useState(false)
  const [done,         setDone]         = useState(false)
  const [validSession, setValidSession] = useState(false)
  const [checking,     setChecking]     = useState(true)

  useEffect(() => {
    const fallback = setTimeout(() => { setValidSession(false); setChecking(false) }, 4000)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: import("@supabase/supabase-js").AuthChangeEvent) => {
      if (event === "PASSWORD_RECOVERY") { clearTimeout(fallback); setValidSession(true); setChecking(false) }
      else if (event === "SIGNED_OUT")   { clearTimeout(fallback); setValidSession(false); setChecking(false) }
    })
    return () => { subscription.unsubscribe(); clearTimeout(fallback); if (redirectTimer.current) clearTimeout(redirectTimer.current) }
  }, [])

  async function handleReset() {
    setError("")
    if (!password.trim())     { setError("Enter a new password."); return }
    if (password.length < 8)  { setError("Password must be at least 8 characters."); return }
    if (password !== confirm)  { setError("Passwords do not match."); return }
    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (updateError) { setError("Could not update password. The link may have expired."); return }
    setDone(true)
    redirectTimer.current = setTimeout(() => router.replace(backUrl), 3000)
  }

  const inputStyle: React.CSSProperties = {
    width:"100%", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)",
    borderRadius:"10px", padding:"14px 16px", color:"#ffffff", fontSize:"15px",
    outline:"none", boxSizing:"border-box", fontFamily:"inherit",
  }
  const labelStyle: React.CSSProperties = {
    display:"block", color:"rgba(255,255,255,0.5)", fontSize:"12px",
    fontWeight:"600", letterSpacing:"0.5px", marginBottom:"8px", textTransform:"uppercase",
  }

  return (
    <div style={{ minHeight:"100dvh", background:deepspace, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Inter',sans-serif", padding:"24px" }}>
      <style>{`input::placeholder{color:rgba(255,255,255,0.2)}input{font-family:inherit}`}</style>
      <div style={{ position:"fixed", top:"-20%", left:"50%", transform:"translateX(-50%)", width:"600px", height:"600px", background:`radial-gradient(circle,${violet}18 0%,transparent 70%)`, pointerEvents:"none" }} />
      <div style={{ width:"100%", maxWidth:"420px", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:"24px", padding:"48px 40px", backdropFilter:"blur(12px)", position:"relative", zIndex:1 }}>
        <div style={{ textAlign:"center", marginBottom:"32px" }}>
          <div style={{ width:"56px", height:"56px", background:`linear-gradient(135deg,${accent},${violet})`, borderRadius:"16px", margin:"0 auto 16px", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <h1 style={{ color:"#ffffff", fontSize:"22px", fontWeight:"700", margin:"0 0 6px", letterSpacing:"-0.5px" }}>Reset Password</h1>
          <p style={{ color:"rgba(255,255,255,0.4)", fontSize:"13px", margin:0 }}>Set a new password for your {roleLabel}</p>
        </div>

        {checking ? (
          <p style={{ textAlign:"center", color:"rgba(255,255,255,0.3)", fontSize:14 }}>Verifying security session...</p>
        ) : done ? (
          <div style={{ textAlign:"center" }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom:16 }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <p style={{ color:"#fff", fontWeight:700, fontSize:16, marginBottom:8 }}>Password updated!</p>
            <p style={{ color:"rgba(255,255,255,0.4)", fontSize:13 }}>Redirecting you to sign in...</p>
          </div>
        ) : !validSession ? (
          <div style={{ textAlign:"center" }}>
            <p style={{ color:"#ef4444", fontSize:14, marginBottom:20 }}>This reset link is invalid or has expired.</p>
            <button onClick={() => router.replace(backUrl)} style={{ color:accent, background:"none", border:"none", fontSize:14, cursor:"pointer", fontWeight:600 }}>Back to sign in</button>
          </div>
        ) : (
          <div>
            {error && <div style={{ background:"rgba(239,68,68,0.12)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:"10px", padding:"12px 16px", marginBottom:"20px", color:"#ef4444", fontSize:"13px" }}>{error}</div>}
            <div style={{ marginBottom:16 }}>
              <label style={labelStyle}>New Password</label>
              <div style={{ position:"relative" }}>
                <input type={showPass?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Min 8 characters" style={{ ...inputStyle, padding:"14px 48px 14px 16px" }} />
                <button onClick={()=>setShowPass(s=>!s)} style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"rgba(255,255,255,0.4)", cursor:"pointer", padding:0, display:"flex", alignItems:"center" }}>
                  {showPass
                    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>
            <div style={{ marginBottom:28 }}>
              <label style={labelStyle}>Confirm Password</label>
              <input type={showPass?"text":"password"} value={confirm} onChange={e=>setConfirm(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")handleReset()}} placeholder="Repeat password" style={inputStyle} />
            </div>
            <button onClick={handleReset} disabled={loading} style={{ width:"100%", background:loading?"rgba(16,185,129,0.4)":`linear-gradient(135deg,${accent},#059669)`, border:"none", borderRadius:"10px", padding:"15px", color:"#ffffff", fontSize:"15px", fontWeight:"700", cursor:loading?"not-allowed":"pointer" }}>
              {loading ? "Updating..." : "Set New Password"}
            </button>
            <p style={{ textAlign:"center", marginTop:20 }}>
              <button onClick={()=>router.replace(backUrl)} style={{ color:"rgba(255,255,255,0.35)", background:"none", border:"none", fontSize:13, cursor:"pointer" }}>Back to sign in</button>
            </p>
          </div>
        )}
        <p style={{ textAlign:"center", color:"rgba(255,255,255,0.15)", fontSize:"12px", marginTop:"28px", marginBottom:0 }}>VibeSchool · School Management System</p>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return <Suspense><ResetContent /></Suspense>
}
