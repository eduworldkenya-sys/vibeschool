"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

const deepspace = "#0a1628"
const accent    = "#10b981"
const violet    = "#8b5cf6"

export default function AdminLoginPage() {
  const router = useRouter()
  const [email,        setEmail]        = useState("")
  const [password,     setPassword]     = useState("")
  const [error,        setError]        = useState("")
  const [loading,      setLoading]      = useState(false)
  const [showPass,     setShowPass]     = useState(false)
  const [resetMode,    setResetMode]    = useState(false)
  const [resetEmail,   setResetEmail]   = useState("")
  const [resetLoading, setResetLoading] = useState(false)
  const [resetSent,    setResetSent]    = useState(false)

  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    let alive = true

    async function checkSession() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { if (alive) setCheckingSession(false); return }

      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!alive) return
      if (data?.role === 'admin') { window.location.href = '/admin'; return }
      setCheckingSession(false)
    }

    checkSession()
    return () => { alive = false }
  }, [])

  async function handleLogin() {
    setError("")
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.")
      return
    }
    setLoading(true)
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      if (authError || !data?.user) {
        setError("Invalid email or password.")
        setLoading(false)
        return
      }
      const { data: roleData } = await supabase.rpc('get_my_role')
      if (roleData !== "admin") {
        setError("Access denied. You do not have administrator privileges.")
        await supabase.auth.signOut()
    document.cookie = 'vibe_role=; path=/; max-age=0'
        setLoading(false)
        return
      }
      document.cookie = `vibe_role=admin; path=/; max-age=3600; samesite=lax${location.protocol === 'https:' ? '; secure' : ''}`
      localStorage.setItem('vs_role', 'admin')
      window.location.href = "/admin"
      return
    } catch {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  async function handleForgotPassword() {
    setError("")
    if (!resetEmail.trim()) { setError("Enter your email address."); return }
    setResetLoading(true)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      resetEmail.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/admin/reset-password` }
    )
    setResetLoading(false)
    if (resetError) {
      setError("Could not send reset email. Check the address and try again.")
      return
    }
    setResetSent(true)
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px",
    padding: "14px 16px", color: "#ffffff", fontSize: "15px",
    outline: "none", boxSizing: "border-box", fontFamily: "inherit",
  }
  const labelStyle: React.CSSProperties = {
    display: "block", color: "rgba(255,255,255,0.5)", fontSize: "12px",
    fontWeight: "600", letterSpacing: "0.5px", marginBottom: "8px",
    textTransform: "uppercase",
  }

  if (checkingSession) {
    return (
      <div style={{ minHeight: "100dvh", background: deepspace, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, border: "3px solid rgba(255,255,255,0.1)", borderTop: "3px solid #10b981", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ minHeight: "100dvh", background: deepspace, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif", padding: "24px" }}>
      <style>{`input::placeholder { color: rgba(255,255,255,0.2); } input { font-family: inherit; }`}</style>

      <div style={{ position: "fixed", top: "-20%", left: "50%", transform: "translateX(-50%)", width: "600px", height: "600px", background: `radial-gradient(circle, ${violet}18 0%, transparent 70%)`, pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: "420px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "24px", padding: "48px 40px", backdropFilter: "blur(12px)", position: "relative", zIndex: 1 }}>

        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ width: "56px", height: "56px", background: `linear-gradient(135deg, ${accent}, ${violet})`, borderRadius: "16px", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <h1 style={{ color: "#ffffff", fontSize: "22px", fontWeight: "700", margin: "0 0 6px", letterSpacing: "-0.5px" }}>VibeSchool Admin</h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px", margin: 0 }}>Principal & Headteacher Portal</p>
        </div>

        {error && (
          <div style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "10px", padding: "12px 16px", marginBottom: "20px", color: "#ef4444", fontSize: "13px", lineHeight: "1.5" }}>
            {error}
          </div>
        )}

        {resetMode ? (
          resetSent ? (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              </div>
              <p style={{ color: "#fff", fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Check your email</p>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 24 }}>
                Reset link sent to <strong style={{ color: "rgba(255,255,255,0.7)" }}>{resetEmail}</strong>
              </p>
              <button onClick={() => { setResetMode(false); setResetSent(false); setResetEmail("") }} style={{ color: accent, background: "none", border: "none", fontSize: 14, cursor: "pointer", fontWeight: 600 }}>
                Back to sign in
              </button>
            </div>
          ) : (
            <div>
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>
                Enter your admin email and we'll send a reset link.
              </p>
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Email Address</label>
                <input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleForgotPassword() }} placeholder="principal@school.ac.ke" style={inputStyle} />
              </div>
              <button onClick={handleForgotPassword} disabled={resetLoading} style={{ width: "100%", background: resetLoading ? "rgba(16,185,129,0.4)" : `linear-gradient(135deg, ${accent}, #059669)`, border: "none", borderRadius: "10px", padding: "15px", color: "#fff", fontSize: "15px", fontWeight: "700", cursor: resetLoading ? "not-allowed" : "pointer" }}>
                {resetLoading ? "Sending..." : "Send Reset Link"}
              </button>
              <p style={{ textAlign: "center", marginTop: 20 }}>
                <button onClick={() => { setResetMode(false); setError("") }} style={{ color: "rgba(255,255,255,0.35)", background: "none", border: "none", fontSize: 13, cursor: "pointer" }}>
                  Back to sign in
                </button>
              </p>
            </div>
          )
        ) : (
          <div>
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>Email Address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleLogin() }} placeholder="principal@school.ac.ke" autoComplete="email" style={inputStyle} />
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={labelStyle}>Password</label>
              <div style={{ position: "relative" }}>
                <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleLogin() }} placeholder="••••••••" autoComplete="current-password" style={{ ...inputStyle, padding: "14px 48px 14px 16px" }} />
                <button onClick={() => setShowPass(s => !s)} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}>
                  {showPass ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>

            <div style={{ textAlign: "right", marginBottom: "24px" }}>
              <button onClick={() => { setResetMode(true); setResetEmail(email); setError("") }} style={{ background: "none", border: "none", color: accent, fontSize: "13px", cursor: "pointer", fontWeight: 600, padding: 0 }}>
                Forgot password?
              </button>
            </div>

            <button onClick={handleLogin} disabled={loading} style={{ width: "100%", background: loading ? "rgba(16,185,129,0.4)" : `linear-gradient(135deg, ${accent}, #059669)`, border: "none", borderRadius: "10px", padding: "15px", color: "#ffffff", fontSize: "15px", fontWeight: "700", cursor: loading ? "not-allowed" : "pointer", letterSpacing: "0.3px" }}>
              {loading ? "Signing in..." : "Enter Command Center"}
            </button>

            <p style={{ textAlign: "center", marginTop: "24px", marginBottom: 0 }}>
              <span onClick={() => router.push("/admin/signup")} style={{ color: "rgba(255,255,255,0.35)", fontSize: "13px", cursor: "pointer" }}>
                New admin? <span style={{ color: accent }}>Register here</span>
              </span>
            </p>
          </div>
        )}

        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.15)", fontSize: "12px", marginTop: "28px", marginBottom: 0 }}>
          VibeSchool · School Management System
        </p>
      </div>
    </div>
  )
}
