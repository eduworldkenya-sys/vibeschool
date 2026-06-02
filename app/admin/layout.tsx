"use client";

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { supabase } from "@/lib/supabase"
import OfflineBar from "@/components/teacher/OfflineBar"

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

const NAV_GROUPS = [
  {
    label: "Main",
    items: [
      { id: "dashboard",  label: "School Hub",  icon: "🏠", href: "/admin"               },
      { id: "students",   label: "Students",    icon: "🎓", href: "/admin/students"      },
      { id: "staff",      label: "Staff",       icon: "👥", href: "/admin/staff"         },
      { id: "finance",    label: "Finance",     icon: "💰", href: "/admin/finance"       },
      { id: "academics",  label: "Academics",   icon: "📚", href: "/admin/academics"     },
    ],
  },
  {
    label: "Daily Ops",
    items: [
      { id: "attendance", label: "Attendance",  icon: "📋", href: "/admin/attendance"    },
      { id: "meetings",   label: "Meetings",    icon: "🗓️", href: "/admin/meetings"      },
      { id: "visitors",   label: "Visitors",    icon: "🚪", href: "/admin/visitors"      },
    ],
  },
  {
    label: "Management",
    items: [
      { id: "projects",      label: "Projects",   icon: "🚀", href: "/admin/projects"      },
      { id: "communication", label: "VibeConnect", icon: "💬", href: "/admin/communication" },
      { id: "resources",     label: "Resources",  icon: "🏫", href: "/admin/resources"     },
      { id: "reports",       label: "Reports",    icon: "📊", href: "/admin/reports"       },
    ],
  },
  {
    label: "System",
    items: [
      { id: "settings", label: "Settings", icon: "⚙️", href: "/admin/settings" },
    ],
  },
]

const NAV_ITEMS = NAV_GROUPS.flatMap(g => g.items)

const BOTTOM_NAV = [
  { label: "Home",      icon: "🏠", href: "/admin"           },
  { label: "Students",  icon: "🎓", href: "/admin/students"  },
  { label: "Finance",   icon: "💰", href: "/admin/finance"   },
  { label: "Academics", icon: "📚", href: "/admin/academics" },
  { label: "More",      icon: "☰",  href: null               },
]

function SchoolAvatar({ logoUrl, name, size = 44 }: { logoUrl: string | null; name: string; size?: number }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map(w => w[0])
    .join("")
    .toUpperCase()

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name}
        style={{
          width:        size,
          height:       size,
          borderRadius: "12px",
          objectFit:    "cover",
          border:       "2px solid rgba(255,255,255,0.15)",
          flexShrink:   0,
        }}
        onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
      />
    )
  }

  return (
    <div style={{
      width:          size,
      height:         size,
      borderRadius:   "12px",
      background:     `linear-gradient(135deg, ${C.emerald}, ${C.navy3})`,
      display:        "flex",
      alignItems:     "center",
      justifyContent: "center",
      fontSize:       size * 0.36,
      fontWeight:     "800",
      color:          "#ffffff",
      flexShrink:     0,
      letterSpacing:  "-0.5px",
      border:         "2px solid rgba(255,255,255,0.12)",
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

  const isLoginPage = pathname === "/admin/login"

  useEffect(() => {
    setMounted(true)
    if (isLoginPage) { setLoading(false); return }
    loadProfile()
  }, [isLoginPage])

  async function loadProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/admin/login"); return }

      const { data: p } = await supabase
        .from("profiles")
        .select("full_name, school_id, role")
        .eq("id", user.id)
        .single()

      if (!p || p.role !== "admin") { router.push("/admin/login"); return }

      const { data: school } = await supabase
        .from("schools")
        .select("name, logo_url")
        .eq("id", p.school_id)
        .single()

      setProfile({
        name:       p.full_name ?? "Principal",
        schoolName: school?.name ?? "School",
        schoolId:   p.school_id,
        logoUrl:    school?.logo_url ?? null,
      })
    } catch {
      router.push("/admin/login")
    } finally {
      setLoading(false)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/admin/login")
  }

  if (isLoginPage) return <>{children}</>

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
      minHeight:     "100vh",
      background:    C.bg,
      display:       "flex",
      flexDirection: "column",
      fontFamily:    "'Inter', -apple-system, sans-serif",
      opacity:       mounted ? 1 : 0,
      transition:    "opacity 0.3s ease",
    }}>

      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebar(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 40, backdropFilter: "blur(4px)" }}
        />
      )}

      {/* ── SIDEBAR ──────────────────────────────────────────────────────── */}
      <aside style={{
        position:      "fixed",
        top:           0,
        left:          0,
        transform:     sidebarOpen ? "translateX(0)" : "translateX(-280px)",
        width:         "270px",
        height:        "100vh",
        background:    `linear-gradient(180deg, ${C.hero} 0%, ${C.heroMid} 100%)`,
        zIndex:        50,
        display:       "flex",
        flexDirection: "column",
        transition:    "transform 0.3s cubic-bezier(.4,0,.2,1)",
        overflowY:     "auto",
      }}>

        {/* School identity + close button */}
        <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)", position: "relative" }}>
          {/* Close button */}
          <button
            onClick={() => setSidebar(false)}
            style={{
              position:       "absolute",
              top:            "14px",
              right:          "14px",
              width:          "30px",
              height:         "30px",
              borderRadius:   "8px",
              background:     "rgba(255,255,255,0.08)",
              border:         "1px solid rgba(255,255,255,0.12)",
              color:          "rgba(255,255,255,0.6)",
              fontSize:       "16px",
              cursor:         "pointer",
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              lineHeight:     1,
            }}
          >✕</button>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <SchoolAvatar logoUrl={profile?.logoUrl ?? null} name={profile?.schoolName ?? "S"} size={48} />
            <div style={{ overflow: "hidden", flex: 1 }}>
              <div style={{ color: "#fff", fontSize: "14px", fontWeight: "700", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {profile?.schoolName}
              </div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px", marginTop: "3px" }}>
                {profile?.name}
              </div>
            </div>
          </div>
        </div>

        {/* Grouped Nav */}
        <nav style={{ padding: "10px 12px", flex: 1 }}>
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.label} style={{ marginBottom: gi < NAV_GROUPS.length - 1 ? "6px" : 0 }}>
              {/* Group label */}
              <div style={{
                color:         "rgba(255,255,255,0.28)",
                fontSize:      "10px",
                fontWeight:    "700",
                letterSpacing: "1.1px",
                textTransform: "uppercase",
                padding:       "10px 12px 6px",
              }}>
                {group.label}
              </div>

              {group.items.map(item => {
                const active = isActive(item.href)
                return (
                  <button
                    key={item.id}
                    onClick={() => { router.push(item.href); setSidebar(false) }}
                    style={{
                      width:        "100%",
                      display:      "flex",
                      alignItems:   "center",
                      gap:          "12px",
                      padding:      "11px 14px",
                      borderRadius: "10px",
                      border:       "none",
                      borderLeft:   active ? `3px solid ${C.emerald}` : "3px solid transparent",
                      background:   active ? "rgba(16,185,129,0.13)" : "transparent",
                      color:        active ? C.emerald : "rgba(255,255,255,0.88)",
                      fontSize:     "13.5px",
                      fontWeight:   active ? "700" : "500",
                      cursor:       "pointer",
                      textAlign:    "left",
                      marginBottom: "1px",
                      transition:   "all 0.15s ease",
                    }}
                  >
                    <span style={{ fontSize: "16px", width: "22px", textAlign: "center", flexShrink: 0 }}>{item.icon}</span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {active && <span style={{ color: C.emerald, fontSize: "16px", opacity: 0.8 }}>›</span>}
                  </button>
                )
              })}

              {/* Divider between groups */}
              {gi < NAV_GROUPS.length - 1 && (
                <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", margin: "6px 12px 0" }} />
              )}
            </div>
          ))}
        </nav>

        {/* Sign out */}
        <div style={{ padding: "12px 12px 16px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <button
            onClick={handleSignOut}
            style={{
              width:        "100%",
              padding:      "12px 14px",
              borderRadius: "10px",
              border:       "1px solid rgba(239,68,68,0.2)",
              background:   "rgba(239,68,68,0.08)",
              color:        "#ef4444",
              fontSize:     "13px",
              fontWeight:   "600",
              cursor:       "pointer",
              display:      "flex",
              alignItems:   "center",
              gap:          "10px",
            }}
          >
            <span>🚪</span> Sign Out
          </button>
        </div>
      </aside>

      {/* ── TOP HEADER ───────────────────────────────────────────────────── */}
      <header style={{
        position:       "sticky",
        top:            0,
        zIndex:         30,
        background:     `linear-gradient(135deg, ${C.hero} 0%, ${C.heroMid} 100%)`,
        borderBottom:   "1px solid rgba(255,255,255,0.07)",
        padding:        "0 16px",
        height:         "60px",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        gap:            "12px",
      }}>
        {/* Hamburger */}
        <button
          onClick={() => setSidebar(s => !s)}
          style={{
            background:     "rgba(255,255,255,0.08)",
            border:         "1px solid rgba(255,255,255,0.12)",
            borderRadius:   "10px",
            width:          "38px",
            height:         "38px",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            cursor:         "pointer",
            fontSize:       "16px",
            color:          "#fff",
            flexShrink:     0,
          }}
        >☰</button>

        {/* Page title */}
        <span style={{ color: "#fff", fontSize: "15px", fontWeight: "700", flex: 1, paddingLeft: "4px" }}>
          {currentPage?.icon} {currentPage?.label ?? "Admin"}
        </span>

        {/* School badge */}
        <div
          onClick={() => setSidebar(true)}
          style={{
            display:      "flex",
            alignItems:   "center",
            gap:          "8px",
            background:   "rgba(255,255,255,0.07)",
            border:       "1px solid rgba(255,255,255,0.12)",
            borderRadius: "20px",
            padding:      "4px 12px 4px 4px",
            cursor:       "pointer",
            maxWidth:     "180px",
          }}
        >
          <SchoolAvatar logoUrl={profile?.logoUrl ?? null} name={profile?.schoolName ?? "S"} size={28} />
          <span style={{
            color:        "rgba(255,255,255,0.9)",
            fontSize:     "12px",
            fontWeight:   "600",
            overflow:     "hidden",
            textOverflow: "ellipsis",
            whiteSpace:   "nowrap",
          }}>
            {profile?.schoolName}
          </span>
        </div>
      </header>
      <OfflineBar />

      {/* ── MAIN ─────────────────────────────────────────────────────────── */}
      <main style={{
        flex:      1,
        padding:   "20px 16px 90px",
        overflowX: "hidden",
        width:     "100%",
        maxWidth:  "900px",
        margin:    "0 auto",
        background: C.bg,
        minHeight:  "auto",
      }}>
        {children}
      </main>

      {/* ── BOTTOM NAV ───────────────────────────────────────────────────── */}
      <nav style={{
        position:   "fixed",
        bottom:     0,
        left:       0,
        right:      0,
        height:     "64px",
        background: "#ffffff",
        borderTop:  `1px solid ${C.border}`,
        display:    "flex",
        zIndex:     30,
        boxShadow:  "0 -4px 24px rgba(0,0,0,0.08)",
      }}>
        {BOTTOM_NAV.map((n, i) => {
          const active = n.href ? isActive(n.href) : false
          return (
            <button
              key={i}
              onClick={() => n.href ? router.push(n.href) : setSidebar(true)}
              style={{
                flex:           1,
                background:     "none",
                border:         "none",
                display:        "flex",
                flexDirection:  "column",
                alignItems:     "center",
                justifyContent: "center",
                gap:            "3px",
                cursor:         "pointer",
                padding:        "8px 0",
                position:       "relative",
              }}
            >
              {active && (
                <div style={{
                  position:     "absolute",
                  top:          0,
                  left:         "50%",
                  transform:    "translateX(-50%)",
                  width:        "36px",
                  height:       "3px",
                  background:   C.emerald,
                  borderRadius: "0 0 6px 6px",
                }} />
              )}
              <span style={{ fontSize: "22px", lineHeight: 1 }}>{n.icon}</span>
              <span style={{
                fontSize:   "10px",
                fontWeight: "600",
                color:      active ? C.hero : "#aab4c4",
                marginTop:  "1px",
              }}>
                {n.label}
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
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
        input::placeholder { color: rgba(255,255,255,0.3); }
        select option { background: #1e293b; color: #fff; }
      `}</style>
    </div>
  )
}
