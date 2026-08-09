"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function HQLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [state, setState] = useState<"checking" | "allowed" | "denied">("checking")
  const isLogin = pathname === "/hq/login"

  useEffect(() => {
    if (isLogin) {
      setState("allowed")
      return
    }

    let active = true
    async function verify() {
      const { data: auth } = await supabase.auth.getUser()
      if (!active) return
      if (!auth.user) {
        router.replace("/hq/login")
        return
      }

      const { data, error } = await supabase.rpc("is_platform_owner")
      if (!active) return
      if (error || data !== true) {
        setState("denied")
        return
      }
      setState("allowed")
    }
    void verify()
    return () => { active = false }
  }, [isLogin, router])

  if (state === "checking") {
    return <div style={{ minHeight: "100dvh", background: "#0a1628", color: "rgba(255,255,255,.65)", display: "grid", placeItems: "center", fontFamily: "Inter,system-ui,sans-serif" }}>Verifying HQ authority…</div>
  }

  if (state === "denied") {
    return (
      <div style={{ minHeight: "100dvh", background: "#0a1628", color: "white", display: "grid", placeItems: "center", padding: 24, fontFamily: "Inter,system-ui,sans-serif" }}>
        <div style={{ maxWidth: 440 }}>
          <h1 style={{ marginBottom: 8 }}>HQ access required</h1>
          <p style={{ color: "rgba(255,255,255,.55)", lineHeight: 1.6 }}>This control plane is restricted to registered Vibeschool platform owners. School-admin access does not grant HQ publishing authority.</p>
          <button onClick={async () => { await supabase.auth.signOut(); router.replace("/hq/login") }} style={{ marginTop: 12, border: 0, borderRadius: 10, padding: "12px 16px", fontWeight: 800, cursor: "pointer" }}>Return to HQ login</button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
