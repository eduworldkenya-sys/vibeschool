'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

const deepspace = "#0a1628"
const accent    = "#10b981"
const violet    = "#8b5cf6"

export default function AdminSignupPage() {
  const router = useRouter()

  const [step,       setStep]      = useState<"form"|"pending">("form")
  const [fullName,   setFullName]  = useState("")
  const [email,      setEmail]     = useState("")
  const [password,   setPassword]  = useState("")
  const [joinCode,   setJoinCode]  = useState("")
  const [showPass,   setShowPass]  = useState(false)
  const [error,      setError]     = useState("")
  const [loading,    setLoading]   = useState(false)
  const [schoolName, setSchoolName] = useState("")

  async function handleSignup() {
    setError("")

    if (!fullName.trim())    { setError("Full name is required."); return }
    if (!email.trim())       { setError("Email is required."); return }
    if (!password)           { setError("Password is required."); return }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return }
    if (!joinCode.trim())    { setError("School join code is required."); return }

    setLoading(true)

    const code = joinCode.trim().toLowerCase()

    // 1. Validate join code
    const { data: school, error: schoolErr } = await supabase
      .from("schools")
      .select("id, name")
      .eq("subdomain", code)
      .single()

    if (schoolErr || !school) {
      setError("Invalid school join code. Please check with your school administrator.")
      setLoading(false)
      return
    }

    // 2. Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email:    email.trim().toLowerCase(),
      password,
    })

    if (authError || !authData.user) {
      setError(authError?.message || "Sign up failed. Please try again.")
      setLoading(false)
      return
    }

    // 3. Insert profile with pending_admin role
    const { error: profileError } = await supabase.from("profiles").insert({
      id:        authData.user.id,
      full_name: fullName.trim(),
      school_id: school.id,
      role:      "pending_admin",
    })

    if (profileError) {
      await supabase.auth.signOut()
      setError("Account setup failed. Please try again.")
      setLoading(false)
      return
    }

    setSchoolName(school.name)
    setLoading(false)
    setStep("pending")
  }

  // ── Pending screen ────────────────────────────────────────────
  if (step === "pending") {
    const waText = encodeURIComponent(
      `Hello, I just registered as a VibeSchool admin and need account approval.\nName: ${fullName}\nEmail: ${email}\nSchool: ${schoolName}`
    )
    const mailBody = encodeURIComponent(
      `Hello,\n\nI just registered as a VibeSchool admin and need account approval.\n\nName: ${fullName}\nEmail: ${email}\nSchool: ${schoolName}\n\nPlease activate my account.`
    )

    return (
      <div style={{
        minHeight:"100vh", background:deepspace, display:"flex",
        alignItems:"center", justifyContent:"center",
        fontFamily:"'Inter', sans-serif", padding:"24px",
      }}>
        <div style={{
          width:"100%", maxWidth:"420px",
          background:"rgba(255,255,255,0.03)",
          border:"1px solid rgba(255,255,255,0.08)",
          borderRadius:"24px", padding:"48px 40px", textAlign:"center",
        }}>
          <div style={{ fontSize:"48px", marginBottom:"16px" }}>⏳</div>
          <h1 style={{ color:"#ffffff", fontSize:"20px", fontWeight:"700", margin:"0 0 10px" }}>
            Account Pending Approval
          </h1>
          <p style={{ color:"rgba(255,255,255,0.45)", fontSize:"13px", lineHeight:"1.6", margin:"0 0 8px" }}>
            Your account for <strong style={{ color:"rgba(255,255,255,0.7)" }}>{schoolName}</strong> has been created.
          </p>
          <p style={{ color:"rgba(255,255,255,0.35)", fontSize:"13px", lineHeight:"1.6", margin:"0 0 32px" }}>
            Our team will verify and activate your access within 24 hours.
            Reach out to speed up approval:
          </p>

          <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
            <a
              href={`https://wa.me/254720614664?text=${waText}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display:"flex", alignItems:"center", justifyContent:"center",
                gap:"10px", background:"#25d366", borderRadius:"10px",
                padding:"14px", color:"#ffffff", fontSize:"14px",
                fontWeight:"700", textDecoration:"none",
              }}
            >
              <span style={{ fontSize:"18px" }}>💬</span> Chat on WhatsApp
            </a>

            <a
              href={`mailto:eduworldkenya@gmail.com?subject=VibeSchool Admin Approval – ${schoolName}&body=${mailBody}`}
              style={{
                display:"flex", alignItems:"center", justifyContent:"center",
                gap:"10px", background:"rgba(255,255,255,0.06)",
                border:"1px solid rgba(255,255,255,0.12)", borderRadius:"10px",
                padding:"14px", color:"rgba(255,255,255,0.8)", fontSize:"14px",
                fontWeight:"600", textDecoration:"none",
              }}
            >
              <span style={{ fontSize:"18px" }}>✉️</span> Email Us
            </a>
          </div>

          <button
            onClick={() => router.push("/admin/login")}
            style={{
              marginTop:"24px", background:"none", border:"none",
              color:"rgba(255,255,255,0.3)", fontSize:"12px", cursor:"pointer",
            }}
          >
            Back to login
          </button>
        </div>
      </div>
    )
  }

  // ── Signup form ───────────────────────────────────────────────
  return (
    <div style={{
      minHeight:"100vh", background:deepspace, display:"flex",
      alignItems:"center", justifyContent:"center",
      fontFamily:"'Inter', sans-serif", padding:"24px",
    }}>
      <div style={{
        position:"fixed", top:"-20%", left:"50%",
        transform:"translateX(-50%)", width:"600px", height:"600px",
        background:`radial-gradient(circle, ${violet}18 0%, transparent 70%)`,
        pointerEvents:"none",
      }} />

      <div style={{
        width:"100%", maxWidth:"420px",
        background:"rgba(255,255,255,0.03)",
        border:"1px solid rgba(255,255,255,0.08)",
        borderRadius:"24px", padding:"48px 40px",
        backdropFilter:"blur(12px)", position:"relative", zIndex:1,
      }}>
        <div style={{ textAlign:"center", marginBottom:"32px" }}>
          <div style={{
            width:"56px", height:"56px",
            background:`linear-gradient(135deg, ${accent}, ${violet})`,
            borderRadius:"16px", margin:"0 auto 16px",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:"24px",
          }}>🏫</div>
          <h1 style={{ color:"#ffffff", fontSize:"22px", fontWeight:"700", margin:"0 0 6px", letterSpacing:"-0.5px" }}>
            Admin Registration
          </h1>
          <p style={{ color:"rgba(255,255,255,0.4)", fontSize:"13px", margin:0 }}>
            Principal & Headteacher Portal
          </p>
        </div>

        {error && (
          <div style={{
            background:"rgba(239,68,68,0.12)",
            border:"1px solid rgba(239,68,68,0.3)",
            borderRadius:"10px", padding:"12px 16px",
            marginBottom:"20px", color:"#ef4444",
            fontSize:"13px", lineHeight:"1.5",
          }}>
            {error}
          </div>
        )}

        {/* Full Name */}
        <div style={{ marginBottom:"16px" }}>
          <label style={{ display:"block", color:"rgba(255,255,255,0.5)", fontSize:"12px", fontWeight:"600", letterSpacing:"0.5px", marginBottom:"8px", textTransform:"uppercase" }}>
            Full Name
          </label>
          <input
            type="text" value={fullName} autoComplete="name"
            placeholder="Dr. Jane Mwangi"
            onChange={e => setFullName(e.target.value)}
            style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"10px", padding:"14px 16px", color:"#ffffff", fontSize:"15px", outline:"none", boxSizing:"border-box" }}
          />
        </div>

        {/* Email */}
        <div style={{ marginBottom:"16px" }}>
          <label style={{ display:"block", color:"rgba(255,255,255,0.5)", fontSize:"12px", fontWeight:"600", letterSpacing:"0.5px", marginBottom:"8px", textTransform:"uppercase" }}>
            Email Address
          </label>
          <input
            type="email" value={email} autoComplete="email"
            placeholder="principal@school.ac.ke"
            onChange={e => setEmail(e.target.value)}
            style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"10px", padding:"14px 16px", color:"#ffffff", fontSize:"15px", outline:"none", boxSizing:"border-box" }}
          />
        </div>

        {/* Password with toggle */}
        <div style={{ marginBottom:"16px" }}>
          <label style={{ display:"block", color:"rgba(255,255,255,0.5)", fontSize:"12px", fontWeight:"600", letterSpacing:"0.5px", marginBottom:"8px", textTransform:"uppercase" }}>
            Password
          </label>
          <div style={{ position:"relative" }}>
            <input
              type={showPass ? "text" : "password"}
              value={password} autoComplete="new-password"
              placeholder="Min 8 characters"
              onChange={e => setPassword(e.target.value)}
              style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"10px", padding:"14px 48px 14px 16px", color:"#ffffff", fontSize:"15px", outline:"none", boxSizing:"border-box" }}
            />
            <button
              onClick={() => setShowPass(s => !s)}
              style={{ position:"absolute", right:"14px", top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"rgba(255,255,255,0.4)", fontSize:"18px", cursor:"pointer", padding:0 }}
            >
              {showPass ? "🙈" : "👁"}
            </button>
          </div>
        </div>

        {/* Join Code */}
        <div style={{ marginBottom:"28px" }}>
          <label style={{ display:"block", color:"rgba(255,255,255,0.5)", fontSize:"12px", fontWeight:"600", letterSpacing:"0.5px", marginBottom:"8px", textTransform:"uppercase" }}>
            School Join Code
          </label>
          <input
            type="text" value={joinCode} autoComplete="off"
            placeholder="e.g. kwi-4821"
            onChange={e => setJoinCode(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleSignup() }}
            style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"10px", padding:"14px 16px", color:"#ffffff", fontSize:"15px", outline:"none", boxSizing:"border-box", letterSpacing:"1px" }}
          />
          <p style={{ color:"rgba(255,255,255,0.25)", fontSize:"11px", marginTop:"6px" }}>
            Get this code from your school's VibeSchool profile
          </p>
        </div>

        <button
          onClick={handleSignup}
          disabled={loading}
          style={{
            width:"100%",
            background: loading ? "rgba(16,185,129,0.4)" : `linear-gradient(135deg, ${accent}, #059669)`,
            border:"none", borderRadius:"10px", padding:"15px",
            color:"#ffffff", fontSize:"15px", fontWeight:"700",
            cursor: loading ? "not-allowed" : "pointer", letterSpacing:"0.3px",
          }}
        >
          {loading ? "Creating Account..." : "Register as Admin"}
        </button>

        <p style={{ textAlign:"center", marginTop:"20px", marginBottom:0 }}>
          <span
            onClick={() => router.push("/admin/login")}
            style={{ color:"rgba(255,255,255,0.35)", fontSize:"13px", cursor:"pointer" }}
          >
            Already have an account?{" "}
            <span style={{ color: accent }}>Sign in</span>
          </span>
        </p>

        <p style={{ textAlign:"center", color:"rgba(255,255,255,0.2)", fontSize:"12px", marginTop:"24px", marginBottom:0 }}>
          VibeSchool · School Management System
        </p>
      </div>
    </div>
  )
}
