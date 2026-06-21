"use client";
export const dynamic = "force-dynamic";

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

const deepspace = "#0a1628"
const accent    = "#10b981"
const violet    = "#8b5cf6"

type Mode = "choose" | "new-school" | "join-school" | "pending"

export default function AdminSignupPage() {
  const router = useRouter()

  const [mode,       setMode]      = useState<Mode>("choose")
  const [fullName,   setFullName]  = useState("")
  const [email,      setEmail]     = useState("")
  const [password,   setPassword]  = useState("")
  const [showPass,   setShowPass]  = useState(false)
  const [error,      setError]     = useState("")
  const [loading,    setLoading]   = useState(false)
  const [schoolName, setSchoolName] = useState("")
  // New school fields
  const [newSchoolName, setNewSchoolName] = useState("")
  const [county,        setCounty]        = useState("")
  // Join school fields
  const [joinCode, setJoinCode] = useState("")

  const inputStyle = {
    width: "100%", background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px",
    padding: "14px 16px", color: "#ffffff", fontSize: "15px",
    outline: "none", boxSizing: "border-box" as const,
  }
  const labelStyle = {
    display: "block", color: "rgba(255,255,255,0.5)", fontSize: "12px",
    fontWeight: "600", letterSpacing: "0.5px", marginBottom: "8px", textTransform: "uppercase" as const,
  }

  function slugify(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30)
  }

  async function handleNewSchool() {
    setError("")
    if (!fullName.trim())     { setError("Full name is required."); return }
    if (!email.trim())        { setError("Email is required."); return }
    if (password.length < 8)  { setError("Password must be at least 8 characters."); return }
    if (!newSchoolName.trim()) { setError("School name is required."); return }
    setLoading(true)
    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password })
      if (authError || !authData.user) throw new Error(authError?.message ?? "Sign up failed")
      if (!authData.session) throw new Error("An account with this email already exists. Please sign in instead.")

      const uid = authData.user.id
      const subdomain = slugify(newSchoolName) + "-" + Math.random().toString(36).slice(2,6)

      // 2. Create school + profile + school_members via RPC
      const { data: schoolId, error: rpcErr } = await supabase.rpc("create_school_with_admin", {
        p_user_id:    uid,
        p_full_name:  fullName.trim(),
        p_school_name: newSchoolName.trim(),
        p_subdomain:  subdomain,
        p_county:     county.trim() || null,
      })

      if (rpcErr) {
        await supabase.auth.signOut()
    document.cookie = 'vibe_role=; path=/; max-age=0'
        throw new Error(rpcErr.message)
      }

      setSchoolName(newSchoolName.trim())
      setMode("pending")
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong")
    } finally { setLoading(false) }
  }

  async function handleJoinSchool() {
    setError("")
    if (!fullName.trim())    { setError("Full name is required."); return }
    if (!email.trim())       { setError("Email is required."); return }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return }
    if (!joinCode.trim())    { setError("School join code is required."); return }
    setLoading(true)
    try {
      const code = joinCode.trim().toLowerCase()
      const { data: school, error: schoolErr } = await supabase
        .from("schools")
        .select("id, name, status")
        .eq("subdomain", code)
        .single()
      if (schoolErr || !school) throw new Error("Invalid school join code.")
      if (school.status === "suspended" || school.status === "closed")
        throw new Error("This school is no longer active.")

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(), password
      })
      if (authError || !authData.user) throw new Error(authError?.message ?? "Sign up failed")
      if (!authData.session) throw new Error("An account with this email already exists. Please sign in instead.")

      const { error: rpcErr } = await supabase.rpc("join_school_as_admin", {
        p_user_id:   authData.user.id,
        p_full_name: fullName.trim(),
        p_school_id: school.id,
      })
      if (rpcErr) {
        await supabase.auth.signOut()
    document.cookie = 'vibe_role=; path=/; max-age=0'
        throw new Error(rpcErr.message)
      }

      setSchoolName(school.name)
      setMode("pending")
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong")
    } finally { setLoading(false) }
  }

  // ── Pending screen ─────────────────────────────────────────────
  if (mode === "pending") {
    const waText  = encodeURIComponent(`Hello, I just registered as a VibeSchool admin.\nName: ${fullName}\nEmail: ${email}\nSchool: ${schoolName}`)
    const mailBody = encodeURIComponent(`Hello,\n\nI just registered as a VibeSchool admin.\n\nName: ${fullName}\nEmail: ${email}\nSchool: ${schoolName}\n\nPlease activate my account.`)
    return (
      <div style={{ minHeight: "100vh", background: deepspace, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <div style={{ width: "100%", maxWidth: "420px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "24px", padding: "48px 40px", textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>✅</div>
          <h1 style={{ color: "#ffffff", fontSize: "20px", fontWeight: "700", margin: "0 0 10px" }}>Account Created!</h1>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "13px", lineHeight: "1.6", margin: "0 0 8px" }}>
            Your account for <strong style={{ color: "rgba(255,255,255,0.7)" }}>{schoolName}</strong> is ready.
          </p>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "13px", lineHeight: "1.6", margin: "0 0 32px" }}>
            Reach out if you need help getting started:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <a href={`https://wa.me/254720614664?text=${waText}`} target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", background: "#25d366", borderRadius: "10px", padding: "14px", color: "#ffffff", fontSize: "14px", fontWeight: "700", textDecoration: "none" }}>
              <span style={{ fontSize: "18px" }}>💬</span> Chat on WhatsApp
            </a>
            <a href={`mailto:eduworldkenya@gmail.com?subject=VibeSchool Admin – ${schoolName}&body=${mailBody}`}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", padding: "14px", color: "rgba(255,255,255,0.8)", fontSize: "14px", fontWeight: "600", textDecoration: "none" }}>
              <span style={{ fontSize: "18px" }}>✉️</span> Email Us
            </a>
          </div>
          <button onClick={() => router.push("/admin/login")} style={{ marginTop: "24px", background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: "12px", cursor: "pointer" }}>
            Go to login
          </button>
        </div>
      </div>
    )
  }

  // ── Choose mode screen ─────────────────────────────────────────
  if (mode === "choose") {
    return (
      <div style={{ minHeight: "100vh", background: deepspace, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <div style={{ width: "100%", maxWidth: "420px" }}>
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <div style={{ width: "56px", height: "56px", background: `linear-gradient(135deg, ${accent}, ${violet})`, borderRadius: "16px", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>🏫</div>
            <h1 style={{ color: "#ffffff", fontSize: "22px", fontWeight: "700", margin: "0 0 6px" }}>Admin Registration</h1>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px", margin: 0 }}>How would you like to get started?</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <button onClick={() => setMode("new-school")} style={{ background: `linear-gradient(135deg, ${accent}22, ${accent}11)`, border: `1px solid ${accent}44`, borderRadius: "16px", padding: "20px", textAlign: "left", cursor: "pointer" }}>
              <div style={{ fontSize: "24px", marginBottom: "8px" }}>🆕</div>
              <div style={{ color: "#ffffff", fontSize: "15px", fontWeight: "700", marginBottom: "4px" }}>Register My School</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>First time on VibeSchool — create your school account</div>
            </button>
            <button onClick={() => setMode("join-school")} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", padding: "20px", textAlign: "left", cursor: "pointer" }}>
              <div style={{ fontSize: "24px", marginBottom: "8px" }}>🔑</div>
              <div style={{ color: "#ffffff", fontSize: "15px", fontWeight: "700", marginBottom: "4px" }}>Join Existing School</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>Your school is already on VibeSchool — use a join code</div>
            </button>
          </div>
          <p style={{ textAlign: "center", marginTop: "24px" }}>
            <span onClick={() => router.push("/admin/login")} style={{ color: "rgba(255,255,255,0.35)", fontSize: "13px", cursor: "pointer" }}>
              Already have an account? <span style={{ color: accent }}>Sign in</span>
            </span>
          </p>
        </div>
      </div>
    )
  }

  // ── Shared form wrapper ────────────────────────────────────────
  const isNew = mode === "new-school"
  const handleSubmit = isNew ? handleNewSchool : handleJoinSchool

  return (
    <div style={{ minHeight: "100vh", background: deepspace, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ position: "fixed", top: "-20%", left: "50%", transform: "translateX(-50%)", width: "600px", height: "600px", background: `radial-gradient(circle, ${violet}18 0%, transparent 70%)`, pointerEvents: "none" }} />
      <div style={{ width: "100%", maxWidth: "420px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "24px", padding: "40px", backdropFilter: "blur(12px)", position: "relative", zIndex: 1 }}>

        <button onClick={() => { setMode("choose"); setError("") }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: "13px", cursor: "pointer", marginBottom: "20px", padding: 0 }}>
          ‹ Back
        </button>

        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{ fontSize: "28px", marginBottom: "8px" }}>{isNew ? "🆕" : "🔑"}</div>
          <h1 style={{ color: "#ffffff", fontSize: "20px", fontWeight: "700", margin: "0 0 4px" }}>
            {isNew ? "Register My School" : "Join Existing School"}
          </h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px", margin: 0 }}>Principal & Headteacher Portal</p>
        </div>

        {error && (
          <div style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "10px", padding: "12px 16px", marginBottom: "20px", color: "#ef4444", fontSize: "13px" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={labelStyle}>Full Name</label>
            <input type="text" value={fullName} placeholder="Dr. Jane Mwangi" onChange={e => setFullName(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Email Address</label>
            <input type="email" value={email} placeholder="principal@school.ac.ke" onChange={e => setEmail(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Password</label>
            <div style={{ position: "relative" }}>
              <input type={showPass ? "text" : "password"} value={password} placeholder="Min 8 characters" onChange={e => setPassword(e.target.value)}
                style={{ ...inputStyle, paddingRight: "48px" }} />
              <button onClick={() => setShowPass(s => !s)} style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: "18px", cursor: "pointer", padding: 0 }}>
                {showPass ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          {isNew ? (
            <>
              <div>
                <label style={labelStyle}>School Name</label>
                <input type="text" value={newSchoolName} placeholder="e.g. Greenfields Primary School" onChange={e => setNewSchoolName(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>County <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span></label>
                <input type="text" value={county} placeholder="e.g. Nairobi" onChange={e => setCounty(e.target.value)} style={inputStyle} />
              </div>
            </>
          ) : (
            <div>
              <label style={labelStyle}>School Join Code</label>
              <input type="text" value={joinCode} placeholder="e.g. kwi-4821" onChange={e => setJoinCode(e.target.value)} style={{ ...inputStyle, letterSpacing: "1px" }} />
              <p style={{ color: "rgba(255,255,255,0.25)", fontSize: "11px", marginTop: "6px" }}>Get this code from your school's VibeSchool profile</p>
            </div>
          )}

          <button onClick={handleSubmit} disabled={loading}
            style={{ width: "100%", background: loading ? "rgba(16,185,129,0.4)" : `linear-gradient(135deg, ${accent}, #059669)`, border: "none", borderRadius: "10px", padding: "15px", color: "#ffffff", fontSize: "15px", fontWeight: "700", cursor: loading ? "not-allowed" : "pointer", marginTop: "6px" }}>
            {loading ? "Creating Account..." : isNew ? "Register My School" : "Join School"}
          </button>
        </div>

        <p style={{ textAlign: "center", marginTop: "20px", marginBottom: 0 }}>
          <span onClick={() => router.push("/admin/login")} style={{ color: "rgba(255,255,255,0.35)", fontSize: "13px", cursor: "pointer" }}>
            Already have an account? <span style={{ color: accent }}>Sign in</span>
          </span>
        </p>
      </div>
    </div>
  )
}
