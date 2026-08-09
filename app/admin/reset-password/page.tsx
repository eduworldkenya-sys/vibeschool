"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

const deepspace = "#0a1628"
const accent    = "#10b981"
const violet    = "#8b5cf6"

export default function ResetPasswordPage() {
  const router = useRouter()
  const redirectTimer = useRef<NodeJS.Timeout | null>(null)

  const [password,     setPassword]     = useState("")
  const [confirm,      setConfirm]      = useState("")
  const [showPass,     setShowPass]     = useState(false)
  const [error,        setError]        = useState("")
  const [loading,      setLoading]      = useState(false)
  const [done,         setDone]         = useState(false)
  const [validSession, setValidSession] = useState(false)
  const [checking,     setChecking]     = useState(true)

  useEffect(() => {
    let alive = true

    async function establishRecoverySession() {
      setChecking(true)
      setError("")
      try {
        const params = new URLSearchParams(window.location.search)
        const code = params.get("code")
        const flowId = params.get("sb_flow_id")

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
            code,
            flowId ? { flowId } : undefined,
          )
          if (exchangeError) throw exchangeError

          const cleanUrl = new URL(window.location.href)
          cleanUrl.searchParams.delete("code")
          cleanUrl.searchParams.delete("sb_flow_id")
          window.history.replaceState({}, "", cleanUrl.pathname + cleanUrl.search + cleanUrl.hash)
        }

        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) throw userError ?? new Error("Recovery session unavailable")

        if (!alive) return
        setValidSession(true)
      } catch {
        if (!alive) return
        setValidSession(false)
        setError("This reset link is invalid, expired, or already used. Request a new reset email from Admin sign in.")
      } finally {
        if (alive) setChecking(false)
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive) return
      if (event === "PASSWORD_RECOVERY" && session?.user) {
        setValidSession(true)
        setChecking(false)
        setError("")
      }
    })

    void establishRecoverySession()

    return () => {
      alive = false
      subscription.unsubscribe()
      if (redirectTimer.current) clearTimeout(redirectTimer.current)
    }
  }, [])

  async function handleReset() {
    setError("")
    if (!validSession) { setError("A valid password-recovery session is required."); return }
    if (!password.trim())     { setError("Enter a new password."); return }
    if (password.length < 12) { setError("Password must be at least 12 characters."); return }
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) { setError("Password must contain letters and a number."); return }
    if (password !== confirm) { setError("Passwords do not match."); return }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setLoading(false)
      setError("Could not update password. The recovery link may have expired or already been used.")
      return
    }

    await supabase.auth.signOut()
    document.cookie = 'vibe_role=; path=/; max-age=0'
    localStorage.removeItem('vs_role')
    setLoading(false)
    setDone(true)
    redirectTimer.current = setTimeout(() => router.replace("/admin/login"), 1800)
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

  return (
    <div style={{ minHeight: "100dvh", background: deepspace, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif", padding: "24px" }}>
      <style>{`input::placeholder { color: rgba(255,255,255,0.2); } input { font-family: inherit; }`}</style>

      <div style={{ position: "fixed", top: "-20%", left: "50%", transform: "translateX(-50%)", width: "600px", height: "600px", background: `radial-gradient(circle, ${violet}18 0%, transparent 70%)`, pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: "420px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "24px", padding: "48px 40px", backdropFilter: "blur(12px)", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ width: "56px", height: "56px", background: `linear-gradient(135deg, ${accent}, ${violet})`, borderRadius: "16px", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <h1 style={{ color: "#ffffff", fontSize: "22px", fontWeight: "700", margin: "0 0 6px", letterSpacing: "-0.5px" }}>Reset Admin Password</h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px", margin: 0 }}>Securely set a new password for your administrator account</p>
        </div>

        {checking ? (
          <p style={{ textAlign: "center", color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Verifying recovery link...</p>
        ) : done ? (
          <div style={{ textAlign: "center" }}>
            <p style={{ color: "#fff", fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Password updated</p>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Your recovery session has been closed. Returning to Admin sign in...</p>
          </div>
        ) : !validSession ? (
          <div style={{ textAlign: "center" }}>
            <p style={{ color: "#ef4444", fontSize: 14, marginBottom: 20 }}>{error || "This reset link is invalid or has expired."}</p>
            <button onClick={() => router.replace("/admin/login")} style={{ color: accent, background: "none", border: "none", fontSize: 14, cursor: "pointer", fontWeight: 600 }}>Request a new reset link</button>
          </div>
        ) : (
          <div>
            {error && <div style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "10px", padding: "12px 16px", marginBottom: "20px", color: "#ef4444", fontSize: "13px" }}>{error}</div>}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>New Password</label>
              <div style={{ position: "relative" }}>
                <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="12+ characters, letters and number" autoComplete="new-password" style={{ ...inputStyle, padding: "14px 48px 14px 16px" }} />
                <button type="button" onClick={() => setShowPass(s => !s)} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", padding: 0 }}>{showPass ? "Hide" : "Show"}</button>
              </div>
            </div>
            <div style={{ marginBottom: 28 }}>
              <label style={labelStyle}>Confirm Password</label>
              <input type={showPass ? "text" : "password"} value={confirm} onChange={e => setConfirm(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !loading) void handleReset() }} placeholder="Repeat password" autoComplete="new-password" style={inputStyle} />
            </div>
            <button onClick={() => void handleReset()} disabled={loading} style={{ width: "100%", background: loading ? "rgba(16,185,129,0.4)" : `linear-gradient(135deg, ${accent}, #059669)`, border: "none", borderRadius: "10px", padding: "15px", color: "#ffffff", fontSize: "15px", fontWeight: "700", cursor: loading ? "not-allowed" : "pointer" }}>{loading ? "Updating..." : "Set New Password"}</button>
          </div>
        )}

        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.15)", fontSize: "12px", marginTop: "28px", marginBottom: 0 }}>VibeSchool · Security & Identity</p>
      </div>
    </div>
  )
}
