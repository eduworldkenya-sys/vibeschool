"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

const dark      = "#1e1b4b"
const deepspace = "#0a0a14"
const accent    = "#10b981"
const amber     = "#f59e0b"
const violet    = "#8b5cf6"

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState("")
  const [password, setPassword] = useState("")
  const [error, setError]       = useState("")
  const [loading, setLoading]   = useState(false)

  async function handleLogin() {
    setError("")
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.")
      return
    }
    setLoading(true)

    try {
      // 1. Sign in
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (authError || !authData.user) {
        setError("Invalid email or password.")
        setLoading(false)
        return
      }

      // 2. Check role and school
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, school_id, full_name")
        .eq("id", authData.user.id)
        .single()

      if (profileError || !profile) {
        setError("Profile not found. Contact support.")
        await supabase.auth.signOut()
        setLoading(false)
        return
      }

      if (profile.role !== "admin") {
        setError("Access denied. This portal is for school administrators only.")
        await supabase.auth.signOut()
        setLoading(false)
        return
      }

      if (!profile.school_id) {
        setError("No school assigned to this account. Contact support.")
        await supabase.auth.signOut()
        setLoading(false)
        return
      }

      // 3. All good — go to dashboard
      router.push("/admin")

    } catch (err) {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleLogin()
  }

  return (
    <div style={{
      minHeight:       "100vh",
      background:      deepspace,
      display:         "flex",
      alignItems:      "center",
      justifyContent:  "center",
      fontFamily:      "'Inter', sans-serif",
      padding:         "24px",
    }}>

      {/* Ambient glow */}
      <div style={{
        position:     "fixed",
        top:          "-20%",
        left:         "50%",
        transform:    "translateX(-50%)",
        width:        "600px",
        height:       "600px",
        background:   `radial-gradient(circle, ${violet}18 0%, transparent 70%)`,
        pointerEvents:"none",
      }} />

      <div style={{
        width:           "100%",
        maxWidth:        "420px",
        background:      "rgba(255,255,255,0.03)",
        border:          "1px solid rgba(255,255,255,0.08)",
        borderRadius:    "24px",
        padding:         "48px 40px",
        backdropFilter:  "blur(12px)",
        position:        "relative",
        zIndex:          1,
      }}>

        {/* Logo mark */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{
            width:          "56px",
            height:         "56px",
            background:     `linear-gradient(135deg, ${accent}, ${violet})`,
            borderRadius:   "16px",
            margin:         "0 auto 16px",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            fontSize:       "24px",
          }}>
            🏫
          </div>
          <h1 style={{
            color:      "#ffffff",
            fontSize:   "22px",
            fontWeight: "700",
            margin:     "0 0 6px",
            letterSpacing: "-0.5px",
          }}>
            VibeSchool Admin
          </h1>
          <p style={{
            color:    "rgba(255,255,255,0.4)",
            fontSize: "13px",
            margin:   0,
          }}>
            Principal & Headteacher Portal
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background:   "rgba(239,68,68,0.12)",
            border:       "1px solid rgba(239,68,68,0.3)",
            borderRadius: "10px",
            padding:      "12px 16px",
            marginBottom: "20px",
            color:        "#ef4444",
            fontSize:     "13px",
            lineHeight:   "1.5",
          }}>
            {error}
          </div>
        )}

        {/* Email */}
        <div style={{ marginBottom: "16px" }}>
          <label style={{
            display:      "block",
            color:        "rgba(255,255,255,0.5)",
            fontSize:     "12px",
            fontWeight:   "600",
            letterSpacing:"0.5px",
            marginBottom: "8px",
            textTransform:"uppercase",
          }}>
            Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="principal@school.ac.ke"
            style={{
              width:         "100%",
              background:    "rgba(255,255,255,0.05)",
              border:        "1px solid rgba(255,255,255,0.1)",
              borderRadius:  "10px",
              padding:       "14px 16px",
              color:         "#ffffff",
              fontSize:      "15px",
              outline:       "none",
              boxSizing:     "border-box",
              transition:    "border-color 0.2s",
            }}
            onFocus={e => e.target.style.borderColor = accent}
            onBlur={e  => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
          />
        </div>

        {/* Password */}
        <div style={{ marginBottom: "28px" }}>
          <label style={{
            display:      "block",
            color:        "rgba(255,255,255,0.5)",
            fontSize:     "12px",
            fontWeight:   "600",
            letterSpacing:"0.5px",
            marginBottom: "8px",
            textTransform:"uppercase",
          }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="••••••••"
            style={{
              width:        "100%",
              background:   "rgba(255,255,255,0.05)",
              border:       "1px solid rgba(255,255,255,0.1)",
              borderRadius: "10px",
              padding:      "14px 16px",
              color:        "#ffffff",
              fontSize:     "15px",
              outline:      "none",
              boxSizing:    "border-box",
              transition:   "border-color 0.2s",
            }}
            onFocus={e => e.target.style.borderColor = accent}
            onBlur={e  => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width:         "100%",
            background:    loading
              ? "rgba(16,185,129,0.4)"
              : `linear-gradient(135deg, ${accent}, #059669)`,
            border:        "none",
            borderRadius:  "10px",
            padding:       "15px",
            color:         "#ffffff",
            fontSize:      "15px",
            fontWeight:    "700",
            cursor:        loading ? "not-allowed" : "pointer",
            letterSpacing: "0.3px",
            transition:    "opacity 0.2s",
          }}
        >
          {loading ? "Signing in..." : "Enter Command Center"}
        </button>

        {/* Footer */}
        <p style={{
          textAlign: "center",
          color:     "rgba(255,255,255,0.2)",
          fontSize:  "12px",
          marginTop: "28px",
          marginBottom: 0,
        }}>
          VibeSchool · School Management System
        </p>

      </div>
    </div>
  )
}
