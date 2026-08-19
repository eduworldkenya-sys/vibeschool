"use client"
export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getAdminSchoolAuthority } from "@/lib/admin/authority"

export default function AdminProfilePage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [phone, setPhone] = useState<string | null>(null)
  const [school, setSchool] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => { void load() }, [])

  async function load() {
    setLoading(true)
    setError("")
    try {
      const authority = await getAdminSchoolAuthority()
      const [profileRes, schoolRes] = await Promise.all([
        supabase.from("profiles").select("full_name,phone").eq("id", authority.userId).single(),
        supabase.from("schools").select("name").eq("id", authority.schoolId).single(),
      ])
      if (profileRes.error) throw profileRes.error
      if (schoolRes.error) throw schoolRes.error
      setName(profileRes.data.full_name)
      setPhone(profileRes.data.phone)
      setSchool(schoolRes.data.name)
    } catch (cause) {
      console.error("Admin profile load failed", cause)
      setError(cause instanceof Error ? cause.message : "Account could not be loaded.")
    } finally {
      setLoading(false)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.replace("/admin/login")
  }

  if (loading) return <div aria-busy="true" style={{ minHeight: 220, borderRadius: 18, background: "#e2e8f0" }} />

  return (
    <main style={{ maxWidth: 680, margin: "0 auto", display: "grid", gap: 16 }}>
      <header><h1 style={{ margin: 0, fontSize: 24 }}>My account</h1><p style={{ color: "#64748b", margin: "5px 0 0" }}>Personal identity is separate from school authority.</p></header>
      {error && <div role="alert" style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", padding: 12, borderRadius: 12 }}>{error}</div>}
      <section style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, display: "grid", gap: 11 }}>
        <div><div style={{ color: "#64748b", fontSize: 12 }}>Name</div><strong>{name}</strong></div>
        <div><div style={{ color: "#64748b", fontSize: 12 }}>Phone</div><strong>{phone || "Not provided"}</strong></div>
        <div><div style={{ color: "#64748b", fontSize: 12 }}>Authorized school</div><strong>{school}</strong></div>
        <p style={{ color: "#64748b", fontSize: 12, lineHeight: 1.5, margin: 0 }}>Changing profile metadata cannot grant another school, teacher/student authority, HQ ownership or service-role access. Those relationships come from backend-authoritative membership and ownership records.</p>
      </section>
      <button onClick={() => void signOut()} style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", borderRadius: 12, padding: 12, fontWeight: 760, cursor: "pointer" }}>Sign out</button>
    </main>
  )
}
