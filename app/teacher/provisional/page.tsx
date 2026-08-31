"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"

type Claim = {
  reference_code?: string
  status?: "pending" | "needs_information" | "approved" | "rejected"
  school_name?: string
  requested_levels?: string[]
  review_note?: string | null
  review_target_hours?: number
  created_at?: string
}

type PersonalClass = { id: string; grade: string; stream: string; subject: string; promoted_at: string | null }

export default function ProvisionalTeacherWorkspace() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [claim, setClaim] = useState<Claim>({})
  const [classes, setClasses] = useState<PersonalClass[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    Promise.all([
      supabase.rpc("get_my_teacher_school_claim"),
      supabase.from("provisional_teacher_classes").select("id,grade,stream,subject,promoted_at").order("created_at"),
    ]).then(([claimResult, classResult]) => {
      if (!active) return
      if (claimResult.error) setError("Claim status could not be loaded. Quote PROVISIONAL-STATUS when contacting support.")
      else setClaim((claimResult.data || {}) as Claim)
      if (!classResult.error) setClasses((classResult.data || []) as PersonalClass[])
      setLoading(false)
    })
    return () => { active = false }
  }, [searchParams])

  async function signOut() {
    await supabase.auth.signOut()
    router.replace("/login/teacher")
  }

  const status = claim.status || "pending"
  const reference = claim.reference_code || searchParams.get("reference") || "Loading…"

  return <main style={{ minHeight: "100dvh", background: "#070b14", color: "#f8fafc", padding: 18, fontFamily: "system-ui" }}>
    <section style={{ width: "min(760px,100%)", margin: "24px auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div><small style={{ color: "#c8a84b", fontWeight: 900, letterSpacing: 1.2 }}>TEACHER OS · PROVISIONAL</small><h1 style={{ margin: "5px 0 0", fontSize: 27 }}>Your workspace is open</h1></div>
        <button type="button" onClick={() => void signOut()} style={quietButton}>Sign out</button>
      </header>

      <section style={{ ...card, borderColor: status === "needs_information" ? "#f59e0b" : "#334155" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
          <div><small style={label}>SCHOOL CLAIM</small><h2 style={{ margin: "6px 0" }}>{claim.school_name || "School verification"}</h2><p style={{ color: "#94a3b8", margin: 0 }}>Reference <strong style={{ color: "#fff" }}>{reference}</strong></p></div>
          <span style={{ padding: "7px 10px", borderRadius: 999, background: "#172033", color: status === "needs_information" ? "#fbbf24" : "#86efac", fontSize: 12, fontWeight: 900 }}>{status.replaceAll("_", " ").toUpperCase()}</span>
        </div>
        {loading ? <p style={{ color: "#94a3b8" }}>Checking claim status…</p> : <p style={{ color: "#cbd5e1", lineHeight: 1.6 }}>Review target: within {claim.review_target_hours || 24} hours. Until approval, school records, learners and staff information remain locked.</p>}
        {claim.review_note && <p role="alert" style={{ background: "#3b2207", color: "#fde68a", padding: 12, borderRadius: 10 }}>Reviewer request: {claim.review_note}</p>}
        {error && <p role="alert" style={{ color: "#fca5a5" }}>{error}</p>}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><Link href="/teacher/onboarding/school" style={linkButton}>Review school claim</Link><a href="https://wa.me/254728232157?text=Hello%20VibeSchool%2C%20I%20need%20help%20with%20teacher%20school%20claim%20" style={quietLink} target="_blank" rel="noreferrer">Contact support</a></div>
      </section>

      <section style={{ ...card, marginTop: 14 }}>
        <small style={label}>PERSONAL SETUP</small><h2 style={{ margin: "6px 0" }}>Prepare your classes now</h2>
        <p style={{ color: "#cbd5e1", lineHeight: 1.6 }}>Create Form 1–4, Grade 10–12 or primary/JSS classes without receiving school authority. They will be promoted into the verified school after approval.</p>
        <Link href="/teacher/onboarding/class" style={linkButton}>Add a class</Link>
        {classes.length > 0 && <div style={{ display: "grid", gap: 8, marginTop: 16 }}>{classes.map(item => <div key={item.id} style={{ background: "#111827", border: "1px solid #253047", borderRadius: 11, padding: 12 }}><strong>{item.grade}{item.stream ? ` · ${item.stream}` : ""}</strong><span style={{ display: "block", color: "#94a3b8", fontSize: 13, marginTop: 3 }}>{item.subject}{item.promoted_at ? " · Connected to school" : " · Personal draft"}</span></div>)}</div>}
      </section>

      <section style={{ ...card, marginTop: 14 }}>
        <small style={label}>AVAILABLE WITHOUT SCHOOL DATA</small>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginTop: 12 }}>
          {[["Explore curriculum","/read"],["Prepare class setup","/teacher/onboarding/class"],["School claim status","/teacher/onboarding/school"]].map(([title,href]) => <Link key={title} href={href} style={{ ...quietLink, background: "#111827", padding: 14 }}>{title} →</Link>)}
        </div>
      </section>
    </section>
  </main>
}

const card: React.CSSProperties = { background: "#0d1422", border: "1px solid #27344b", borderRadius: 18, padding: 20, boxShadow: "0 18px 48px rgba(0,0,0,.22)" }
const label: React.CSSProperties = { color: "#c8a84b", fontWeight: 900, fontSize: 10, letterSpacing: 1.1 }
const linkButton: React.CSSProperties = { display: "inline-block", background: "#16a34a", color: "#fff", textDecoration: "none", padding: "11px 14px", borderRadius: 10, fontWeight: 850, fontSize: 13 }
const quietButton: React.CSSProperties = { border: "1px solid #334155", background: "transparent", color: "#cbd5e1", padding: "9px 12px", borderRadius: 10, fontWeight: 750 }
const quietLink: React.CSSProperties = { display: "inline-block", border: "1px solid #334155", color: "#cbd5e1", textDecoration: "none", padding: "10px 13px", borderRadius: 10, fontWeight: 750, fontSize: 13 }
