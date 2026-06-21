"use client";
export const dynamic = "force-dynamic";

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

const deepspace = "#0a1628"
const accent    = "#10b981"
const violet    = "#8b5cf6"

export default function HQLoginPage() {
  const router = useRouter()
  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [error,    setError]    = useState("")
  const [loading,  setLoading]  = useState(false)
  const [showPass, setShowPass] = useState(false)

  async function handleLogin() {
    setError("")
    if (!email.trim() || !password.trim()) { setError("Email and password are required."); return }
    setLoading(true)
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(), password,
      })
      if (authError || !data?.user) { setError("Invalid email or password."); setLoading(false); return }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single()
      if (profile?.role !== "admin") {
        setError("Access denied. Admins only.")
        await supabase.auth.signOut()
        setLoading(false)
        return
      }
      router.replace("/hq")
    } catch {
      setError("Something went wrong.")
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: "100dvh", background: deepspace, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif", padding: "24px" }}>
      <style>{`input::placeholder{color:rgba(255,255,255,0.2);}input{font-family:inherit;}`}</style>
      <div style={{ position: "fixed", top: "-20%", left: "50%", transform: "translateX(-50%)", width: "600px", height: "600px", background: `radial-gradient(circle,${violet}18 0%,transparent 70%)`, pointerEvents: "none" }} />
      <div style={{ width: "100%", maxWidth: "420px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "24px", padding: "48px 40px", backdropFilter: "blur(12px)", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ width: "56px", height: "56px", background: `linear-gradient(135deg,${accent},${violet})`, borderRadius: "16px", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h1 style={{ color: "#fff", fontSize: "22px", fontWeight: 700, margin: "0 0 6px", letterSpacing: "-0.5px" }}>VibeSchool HQ</h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px", margin: 0 }}>Staff access only</p>
        </div>

        {error && <div style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "10px", padding: "12px 16px", marginBottom: "20px", color: "#ef4444", fontSize: "13px" }}>{error}</div>}

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", color: "rgba(255,255,255,0.5)", fontSize: "12px", fontWeight: 600, letterSpacing: "0.5px", marginBottom: "8px", textTransform: "uppercase" as const }}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleLogin() }} placeholder="you@vibeschool.co.ke" style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "14px 16px", color: "#fff", fontSize: "15px", outline: "none", boxSizing: "border-box" as const }} />
        </div>

        <div style={{ marginBottom: "28px" }}>
          <label style={{ display: "block", color: "rgba(255,255,255,0.5)", fontSize: "12px", fontWeight: 600, letterSpacing: "0.5px", marginBottom: "8px", textTransform: "uppercase" as const }}>Password</label>
          <div style={{ position: "relative" }}>
            <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleLogin() }} placeholder="••••••••" style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "14px 48px 14px 16px", color: "#fff", fontSize: "15px", outline: "none", boxSizing: "border-box" as const }} />
            <button onClick={() => setShowPass(s => !s)} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}>
              {showPass ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
            </button>
          </div>
        </div>

        <button onClick={handleLogin} disabled={loading} style={{ width: "100%", background: loading ? "rgba(16,185,129,0.4)" : `linear-gradient(135deg,${accent},#059669)`, border: "none", borderRadius: "10px", padding: "15px", color: "#fff", fontSize: "15px", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}>
          {loading ? "Verifying..." : "Access HQ"}
        </button>

        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.15)", fontSize: "12px", marginTop: "28px", marginBottom: 0 }}>VibeSchool · Internal Staff Portal</p>
      </div>
    </div>
  )
}
