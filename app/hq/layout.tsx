"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { HQNavigation, HQStyles } from "@/components/hq/HQShell"
import HQGlobalSearch from "@/components/hq/HQGlobalSearch"
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
    <div className="hq-global-search-bridge hq-global-search-desktop"><HQGlobalSearch /></div>
    <div className="hq-global-search-bridge hq-global-search-mobile"><HQGlobalSearch compact /></div>
    <HQOfflineStatus />
    {children}
    <style jsx global>{`
      .hq-sidebar > button.hq-search-trigger { display:none !important; }
      .hq-sidebar > .hq-side-scroll { padding-top:54px !important; }
      .hq-mobile-search { display:none !important; }
      .hq-global-search-bridge { position:fixed; z-index:128; font-family:Inter,system-ui,sans-serif; }
      .hq-global-search-desktop { top:77px; left:14px; width:218px; }
      .hq-global-search-mobile { display:none; }
      .hq-sidebar.is-collapsed ~ .hq-global-search-desktop { width:48px; left:14px; }
      .hq-sidebar.is-collapsed ~ .hq-global-search-desktop .hq-search-trigger { width:48px; padding:0; justify-content:center; }
      .hq-sidebar.is-collapsed ~ .hq-global-search-desktop .hq-search-trigger span,
      .hq-sidebar.is-collapsed ~ .hq-global-search-desktop .hq-search-trigger kbd { display:none; }
      @media(max-width:980px) and (min-width:901px){.hq-global-search-desktop{width:180px}}
      @media(max-width:900px){
        .hq-sidebar > .hq-side-scroll { padding-top:0 !important; }
        .hq-global-search-desktop { display:none; }
        .hq-global-search-mobile { display:block; top:11px; right:96px; }
        .hq-global-search-mobile .hq-search-trigger.compact { width:40px; height:40px; min-height:40px; border:1px solid var(--hq-border); border-radius:10px; background:#0c1a2b; color:#dbeafe; }
      }
    `}</style>
  </>
}
