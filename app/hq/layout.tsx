"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { HQNavigation, HQStyles } from "@/components/hq/HQShell"
import HQOfflineStatus from "@/components/hq/HQOfflineStatus"
import { hqSupabase } from "@/lib/hq/supabase"
import "./hq-layout-fallback.css"

const PUBLIC_HQ_ROUTES = new Set(["/hq/login", "/hq/reset-password"])

export default function HQLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [allowed, setAllowed] = useState(PUBLIC_HQ_ROUTES.has(pathname))
  const [checking, setChecking] = useState(!PUBLIC_HQ_ROUTES.has(pathname))

  useEffect(() => {
    let mounted = true

    if (PUBLIC_HQ_ROUTES.has(pathname)) {
      setAllowed(true)
      setChecking(false)
      return () => { mounted = false }
    }

    async function verifyHQAccess() {
      setChecking(true)
      setAllowed(false)

      const { data: { user }, error: authError } = await hqSupabase.auth.getUser()
      if (!mounted) return
      if (authError || !user) {
        router.replace(`/hq/login?redirect=${encodeURIComponent(pathname)}`)
        return
      }

      const { data: access, error: accessError } = await hqSupabase.rpc("hq_check_owner_access", { p_surface: `${pathname}:client-layout` })
      if (!mounted) return
      const authorized = !accessError && Boolean((access as { allowed?: boolean } | null)?.allowed)

      if (!authorized) {
        await hqSupabase.auth.signOut({ scope: "local" })
        router.replace("/hq/login?denied=1")
        return
      }

      setAllowed(true)
      setChecking(false)
    }

    void verifyHQAccess()
    return () => { mounted = false }
  }, [pathname, router])

  if (PUBLIC_HQ_ROUTES.has(pathname)) return <>{children}</>

  if (checking || !allowed) {
    return <main style={{minHeight:"100dvh",display:"grid",placeItems:"center",background:"#07111f",color:"#f8fafc",fontFamily:"Inter,system-ui,sans-serif"}}>
      <div role="status" style={{fontSize:13,color:"rgba(255,255,255,.62)"}}>Verifying HQ owner authority…</div>
    </main>
  }

  return <>
    <HQStyles />
    <HQNavigation />
    <HQOfflineStatus />
    {children}
  </>
}
