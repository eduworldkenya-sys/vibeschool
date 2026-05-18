"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

const deepspace = "#0a1628"
const accent    = "#10b981"
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
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email:    email.trim().toLowerCase(),
        password,
      })

      if (authError || !data?.user) {
        setError("Invalid email or password.")
        setLoading(false)
        return
      }

      // Go straight to dashboard — no role check for now
      router.replace("/admin")

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
      minHeight:      "100vh",
      background:     deepspace,
      display:        "flex",
      alignItems:     "center",
      justifyContent: "center",
      fontFamily:     "'Inter', sans-serif",
      padding:        "24px",
    }}>

      <div style={{
        position:      "fixed",
        top:           "-20%",
        left:          "50%",
        transform:     "translateX(-50%)",
        width:         "600px",
        height:        "600px",
        background:    `radial-gradient(circle, ${violet}18 0%, transparent 70%)`,
        pointerEvents: "none",
      }} />

      <div style={{
        width:          "100%",
        maxWidth:       "420px",
        background:     "rgba(255,255,255,0.03)",
        border:         "1px solid rgba(255,255,255,0.08)",
        borderRadius:   "24px",
        padding:        "48px 40px",
        backdropFilter: "blur(12px)",
        position:       "relative",
        zIndex:         1,
      }}>

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
            color:         "#ffffff",
            fontSize:      "22px",
            fontWeight:    "700",
            margin:        "0 0 6px",
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

        <div style={{ marginBottom: "16px" }}>
          <label style={{
            display:       "block",
            color:         "rgba(255,255,255,0.5)",
            fontSize:      "12px",
            fontWeight:    "600",
            letterSpacing: "0.5px",
            marginBottom:  "8px",
            textTransform: "uppercase",
          }}>
            Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="principal@school.ac.ke"
            autoComplete="email"
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
            }}
          />
        </div>

        <div style={{ marginBottom: "28px" }}>
          <label style={{
            display:       "block",
            color:         "rgba(255,255,255,0.5)",
            fontSize:      "12px",
            fontWeight:    "600",
            letterSpacing: "0.5px",
            marginBottom:  "8px",
            textTransform: "uppercase",
          }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="••••••••"
            autoComplete="current-password"
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
            }}
          />
        </div>

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
          }}
        >
          {loading ? "Signing in..." : "Enter Command Center"}
        </button>

        <p style={{
          textAlign:    "center",
          color:        "rgba(255,255,255,0.2)",
          fontSize:     "12px",
          marginTop:    "28px",
          marginBottom: 0,
        }}>
          VibeSchool · School Management System
        </p>

      </div>
    </div>
  )
}
