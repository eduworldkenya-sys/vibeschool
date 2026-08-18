"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { supabase } from "@/lib/supabase"
import OfflineBar from "@/components/teacher/OfflineBar"
import { getTwinAuthorityContext, selectTwinRoleBinding } from "@/lib/twin/core"

const C = {
  hero:    "#0a1628",
  heroMid: "#0d2347",
  emerald: "#10b981",
  navy3:   "#0f5fa8",
  bg:      "#f0f4f8",
  border:  "#e2e8f0",
}

interface AdminProfile {
  name:       string
  schoolName: string
  schoolId:   string
  logoUrl:    string | null
}

function SvgHome({ col }: { col: string }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>
}
function SvgStudents({ col }: { col: string }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
}
function SvgStaff({ col }: { col: string }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
}
function SvgFinance({ col }: { col: string }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M6 15h2M10 15h4"/></svg>
}
function SvgAcademics({ col }: { col: string }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>
}
function SvgAttendance({ col }: { col: string }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
}
function SvgMeetings({ col }: { col: string }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
}
function SvgVisitors({ col }: { col: string }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
}
function SvgProjects({ col }: { col: string }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
}
function SvgConnect({ col }: { col: string }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
}
function SvgResources({ col }: { col: string }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
}
function SvgReports({ col }: { col: string }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
}
function SvgSettings({ col }: { col: string }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
}
function SvgSignOut({ col }: { col: string }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
}

function IconHome({ active }: { active: boolean }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? C.emerald : "#94a3b8"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>
}
function IconStudents({ active }: { active: boolean }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? C.emerald : "#94a3b8"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
}
function IconFinance({ active }: { active: boolean }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? C.emerald : "#94a3b8"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M6 15h2M10 15h4"/></svg>
}
function IconAcademics({ active }: { active: boolean }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? C.emerald : "#94a3b8"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>
}
function IconMore({ active }: { active: boolean }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? C.emerald : "#94a3b8"} strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
}

const NAV_GROUPS = [
  {
    label: "Main",
    items: [
      { id: "dashboard",  label: "School Hub",  Icon: SvgHome,       href: "/admin"               },
      { id: "students",   label: "Students",    Icon: SvgStudents,   href: "/admin/students"      },
      { id: "staff",      label: "Staff",       Icon: SvgStaff,      href: "/admin/staff"         },
      { id: "finance",    label: "Finance",     Icon: SvgFinance,    href: "/admin/finance"       },
      { id: "academics",  label: "Academics",   Icon: SvgAcademics,  href: "/admin/academics"     },
    ],
  },
  {
    label: "Daily Ops",
    items: [
      { id: "attendance", label: "Attendance",  Icon: SvgAttendance, href: "/admin/attendance"    },
      { id: "meetings",   label: "Meetings",    Icon: SvgMeetings,   href: "/admin/meetings"      },
      { id: "visitors",   label: "Visitors",    Icon: SvgVisitors,   href: "/admin/visitors"      },
    ],
  },
  {
    label: "Management",
    items: [
      { id: "projects",      label: "Projects",    Icon: SvgProjects,  href: "/admin/projects"      },
      { id: "communication", label: "VibeConnect", Icon: SvgConnect,   href: "/admin/communication" },
      { id: "resources",     label: "Resources",   Icon: SvgResources, href: "/admin/resources"     },
      { id: "reports",       label: "Reports",     Icon: SvgReports,   href: "/admin/reports"       },
    ],
  },
  {
    label: "System",
    items: [
      { id: "settings", label: "Settings", Icon: SvgSettings, href: "/admin/settings" },
    ],
  },
]

const NAV_ITEMS = NAV_GROUPS.flatMap(g => g.items)

const BOTTOM_NAV = [
  { label: "Home",      Icon: IconHome,      href: "/admin"           },
  { label: "Students",  Icon: IconStudents,  href: "/admin/students"  },
  { label: "Finance",   Icon: IconFinance,   href: "/admin/finance"   },
  { label: "Academics", Icon: IconAcademics, href: "/admin/academics" },
  { label: "More",      Icon: IconMore,      href: null               },
]

function SchoolAvatar({ logoUrl, name, size = 44 }: { logoUrl: string | null; name: string; size?: number }) {
  const initials = name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name}
        style={{ width: size, height: size, borderRadius: "12px", objectFit: "cover", border: "2px solid rgba(255,255,255,0.15)", flexShrink: 0 }}
        onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "12px",
      background: `linear-gradient(135deg, ${C.emerald}, ${C.navy3})`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.36, fontWeight: "800", color: "#ffffff",
      flexShrink: 0, letterSpacing: "-0.5px",
      border: "2px solid rgba(255,255,255,0.12)",
    }}>
      {initials}
    </div>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()

  const [profile,     setProfile] = useState<AdminProfile | null>(null)
  const [loading,     setLoading] = useState(true)
  const [sidebarOpen, setSidebar] = useState(false)
  const [mounted,     setMounted] = useState(false)

  const PUBLIC_ADMIN_PAGES = ["/admin/login", "/admin/signup", "/admin/reset-password"]
  const isPublicAdminPage = PUBLIC_ADMIN_PAGES.includes(pathname)

  useEffect(() => {
    setMounted(true)
    if (isPublicAdminPage) { setLoading(false); return }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: import('@supabase/supabase-js').AuthChangeEvent, session: import('@supabase/supabase-js').Session | null) => {
        if (event === "SIGNED_OUT") {
          router.push("/admin/login")
          return
        }
        // INITIAL_SESSION fires on refresh; SIGNED_IN fires after login. Both need loadProfile.
        if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED")) {
          loadProfile(session.user)
          return
        }
        if (event === "INITIAL_SESSION" && !session) {
          router.push("/admin/login")
          return
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(user: { id: string }) {
    try {
      const authority = await getTwinAuthorityContext()
      if (authority.userId !== user.id) throw new Error("Admin session identity changed during authority resolution.")
      const binding = selectTwinRoleBinding(authority, "admin")
      const schoolId = binding.schoolId
      if (!schoolId) throw new Error("Admin layout has no authorized school scope.")

      const [{ data: p, error: pError }, { data: school, error: schoolError }] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user.id).single(),
        supabase.from("schools").select("name, logo_url").eq("id", schoolId).single(),
      ])

      if (pError || !p) { router.push("/admin/login"); return }
      if (schoolError || !school) throw new Error(schoolError?.message || "Admin school could not be resolved.")

      setProfile({
        name: p.full_name ?? "Principal",
        schoolName: school.name ?? "VibeSchool Admin",
        schoolId,
        logoUrl: school.logo_url ?? null,
      })
    } catch (err) {
      console.error("AdminLayout authority error:", err)
      router.push("/admin/login")
    } finally {
      setLoading(false)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    document.cookie = 'vibe_role=; path=/; max-age=0'
    router.push("/admin/login")
  }

  if (isPublicAdminPage) return <>{children}</>

  if (loading || !mounted) {
    return (
      <div style={{ minHeight: "100vh", background: C.hero, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: "48px", height: "48px", border: `3px solid rgba(16,185,129,0.2)`, borderTop: `3px solid ${C.emerald}`, borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "13px" }}>Loading...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href)

  const currentPage = NAV_ITEMS.find(n => isActive(n.href))

  return (
    <div style={{
      minHeight: "100vh", background: C.bg,
      display: "flex", flexDirection: "column",
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>

      {sidebarOpen && (
        <div onClick={() => setSidebar(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 40, backdropFilter: "blur(4px)" }} />
      )}

      <aside style={{
        position: "fixed", top: 0, left: 0,
        transform: sidebarOpen ? "translateX(0)" : "translateX(-280px)",
        width: "270px", height: "100vh",
        background: `linear-gradient(180deg, ${C.hero} 0%, ${C.heroMid} 100%)`,
        zIndex: 50, display: "flex", flexDirection: "column",
        transition: "transform 0.3s cubic-bezier(.4,0,.2,1)",
      }}>
        <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)", position: "relative", flexShrink: 0 }}>
          <button
            onClick={() => setSidebar(false)}
            style={{
              position: "absolute", top: "14px", right: "14px",
              width: "30px", height: "30px", borderRadius: "8px",
              background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.6)", fontSize: "16px", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >✕</button>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <SchoolAvatar logoUrl={profile?.logoUrl ?? null} name={profile?.schoolName ?? "S"} size={48} />
            <div style={{ overflow: "hidden", flex: 1 }}>
              <div style={{ color: "#fff", fontSize: "14px", fontWeight: "700", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{profile?.schoolName}</div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px", marginTop: "3px" }}>{profile?.name}</div>
            </div>
            <button
              onClick={handleSignOut}
              title="Sign Out"
              style={{
                flexShrink: 0, width: "32px", height: "32px", borderRadius: "8px",
                border: "1px solid rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.12)",
                color: "#f87171", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <SvgSignOut col="#f87171" />
            </button>
          </div>
        </div>

        <nav style={{ padding: "10px 12px 32px", flex: 1, overflowY: "auto" }}>
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.label} style={{ marginBottom: gi < NAV_GROUPS.length - 1 ? "4px" : 0 }}>
              <div style={{ color: "rgba(255,255,255,0.28)", fontSize: "10px", fontWeight: "700", letterSpacing: "1.1px", textTransform: "uppercase", padding: "10px 12px 6px" }}>
                {group.label}
              </div>
              {group.items.map(item => {
                const active = isActive(item.href)
                const iconCol = active ? C.emerald : "rgba(255,255,255,0.6)"
                return (
                  <button
                    key={item.id}
                    onClick={() => { router.push(item.href); setSidebar(false) }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: "12px",
                      padding: "10px 12px", borderRadius: "10px", border: "none",
                      borderLeft: active ? `3px solid ${C.emerald}` : "3px solid transparent",
                      background: active ? "rgba(16,185,129,0.13)" : "transparent",
                      color: active ? C.emerald : "rgba(255,255,255,0.88)",
                      fontSize: "13.5px", fontWeight: active ? "700" : "500",
                      cursor: "pointer", textAlign: "left", marginBottom: "1px", transition: "all 0.15s ease",
                    }}
                  >
                    <span style={{ width: "22px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <item.Icon col={iconCol} />
                    </span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {active && <span style={{ color: C.emerald, fontSize: "16px", opacity: 0.8 }}>›</span>}
                  </button>
                )
              })}
              {gi < NAV_GROUPS.length - 1 && (
                <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", margin: "6px 12px 0" }} />
              )}
            </div>
          ))}
        </nav>


      </aside>

      <header style={{
        position: "sticky", top: 0, zIndex: 30,
        background: `linear-gradient(135deg, ${C.hero} 0%, ${C.heroMid} 100%)`,
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        padding: "0 16px", height: "60px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
      }}>
        <button
          onClick={() => setSidebar(s => !s)}
          style={{
            background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "10px", width: "38px", height: "38px",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>

        <span style={{ color: "#fff", fontSize: "15px", fontWeight: "700", flex: 1, paddingLeft: "4px" }}>
          {currentPage?.label ?? "Admin"}
        </span>

        <div
          onClick={() => setSidebar(true)}
          style={{
            display: "flex", alignItems: "center", gap: "8px",
            background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "20px", padding: "4px 12px 4px 4px", cursor: "pointer", maxWidth: "180px",
          }}
        >
          <SchoolAvatar logoUrl={profile?.logoUrl ?? null} name={profile?.schoolName ?? "S"} size={28} />
          <span style={{ color: "rgba(255,255,255,0.9)", fontSize: "12px", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {profile?.schoolName}
          </span>
        </div>
      </header>
      <OfflineBar />

      <main style={{
        flex: 1, padding: "20px 16px 90px", overflowX: "hidden",
        width: "100%", maxWidth: "900px", margin: "0 auto",
        background: C.bg, minHeight: "auto",
      }}>
        {children}
      </main>

      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0, height: "64px",
        background: "#ffffff", borderTop: `1px solid ${C.border}`,
        display: "flex", zIndex: 30, boxShadow: "0 -2px 16px rgba(0,0,0,0.07)",
      }}>
        {BOTTOM_NAV.map((n, i) => {
          const active = n.href ? isActive(n.href) : false
          const schoolLabel = i === 0 ? (profile?.schoolName?.split(" ")[0] ?? "Home") : n.label
          return (
            <button
              key={i}
              onClick={() => n.href ? router.push(n.href) : setSidebar(true)}
              style={{
                flex: 1, background: "none", border: "none",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: "4px", cursor: "pointer", padding: "8px 0", position: "relative",
              }}
            >
              {active && (
                <div style={{
                  position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
                  width: "32px", height: "3px", background: C.emerald, borderRadius: "0 0 6px 6px",
                }} />
              )}
              <n.Icon active={active} />
              <span style={{ fontSize: "10px", fontWeight: active ? "700" : "500", color: active ? C.hero : "#94a3b8", marginTop: "1px", maxWidth: "56px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }}>
                {schoolLabel}
              </span>
            </button>
          )
        })}
      </nav>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        * { box-sizing: border-box; margin: 0; }
        html, body { overflow-x: hidden; max-width: 100vw; }
        button:active { transform: scale(0.97); }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }
        input::placeholder { color: rgba(255,255,255,0.3); }
        select option { background: #1e293b; color: #fff; }
      `}</style>
    </div>
  )
}

