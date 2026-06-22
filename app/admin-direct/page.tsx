"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

export default function AdminDirectAccess() {
  const [status, setStatus] = useState<"checking" | "ok" | "denied" | "error">("checking")
  const [detail, setDetail] = useState("")

  useEffect(() => {
    let alive = true
    async function check() {
      try {
        const { data: { user }, error: userErr } = await supabase.auth.getUser()
        if (!alive) return
        if (userErr || !user) {
          setStatus("denied")
          setDetail("No active session. Sign in first, then return to this page.")
          return
        }

        const { data: p, error: pErr } = await supabase
          .from("profiles")
          .select("role, full_name")
          .eq("id", user.id)
          .single()

        if (!alive) return
        if (pErr || !p) {
          setStatus("error")
          setDetail("Could not read profile: " + JSON.stringify(pErr))
          return
        }
        if (p.role !== "admin") {
          setStatus("denied")
          setDetail("Signed in, but role is '" + p.role + "', not admin.")
          return
        }

        setStatus("ok")
        setDetail(p.full_name ?? "Admin")
      } catch (e: any) {
        if (!alive) return
        setStatus("error")
        setDetail(String(e))
      }
    }
    check()
    return () => { alive = false }
  }, [])

  if (status === "checking") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif" }}>
        Checking session…
      </div>
    )
  }

  if (status === "ok") {
    return (
      <div style={{ minHeight: "100vh", padding: 24, fontFamily: "sans-serif" }}>
        <div style={{ background: "#d1fae5", border: "1px solid #10b981", borderRadius: 12, padding: 16, marginBottom: 24 }}>
          ✅ Signed in as <strong>{detail}</strong> (admin). This is a temporary direct-access page that bypasses the normal /admin layout's auth redirect, which currently has a bug.
        </div>
        <iframe
          src="/admin?bypass=1"
          style={{ width: "100%", height: "85vh", border: "1px solid #e2e8f0", borderRadius: 12 }}
          title="Admin Dashboard"
        />
        <p style={{ marginTop: 12, color: "#64748b", fontSize: 13 }}>
          If the dashboard above also redirects you away, that confirms the bug is inside the dashboard's own auth check, not just the routing around it — tell your developer this exact result.
        </p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", padding: 24 }}>
      <div style={{ background: "#fee2e2", border: "1px solid #ef4444", borderRadius: 12, padding: 20, maxWidth: 480 }}>
        <strong>{status === "denied" ? "Access denied" : "Error"}</strong>
        <p style={{ marginTop: 8 }}>{detail}</p>
      </div>
    </div>
  )
}
