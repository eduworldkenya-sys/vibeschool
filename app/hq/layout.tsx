"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function HQLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace("/admin/login")
        return
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single()
      if (profile?.role !== "admin") {
        await supabase.auth.signOut()
        router.replace("/admin/login")
        return
      }
      setChecking(false)
    }
    check()
  }, [router])

  if (checking) {
    return (
      <div style={{ minHeight: "100dvh", background: "#0a1628", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: "40px", height: "40px", border: "3px solid rgba(16,185,129,0.2)", borderTop: "3px solid #10b981", borderRadius: "50%", margin: "0 auto 16px", animation: "spin 1s linear infinite" }} />
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>Verifying access...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return <>{children}</>
}
