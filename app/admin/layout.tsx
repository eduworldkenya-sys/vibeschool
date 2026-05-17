"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { supabase } from "@/lib/supabase"

const dark      = "#1e1b4b"
const deepspace = "#0a0a14"
const accent    = "#10b981"
const amber     = "#f59e0b"
const violet    = "#8b5cf6"

interface AdminProfile {
  name:       string
  schoolName: string
  schoolId:   string
}

const NAV_ITEMS = [
  { id: "dashboard",     label: "Hub",           icon: "⚡", href: "/admin" },
  { id: "students",      label: "Students",      icon: "🎓", href: "/admin/students" },
  { id: "staff",         label: "Staff",         icon: "👥", href: "/admin/staff" },
  { id: "finance",       label: "Finance",       icon: "💰", href: "/admin/finance" },
  { id: "academics",     label: "Academics",     icon: "📚", href: "/admin/academics" },
  { id: "attendance",    label: "Attendance",    icon: "📋", href: "/admin/attendance" },
  { id: "meetings",      label: "Meetings",      icon: "🗓️", href: "/admin/meetings" },
  { id: "visitors",      label: "Visitors",      icon: "🚪", href: "/admin/visitors" },
  { id: "projects",      label: "Projects",      icon: "🚀", href: "/admin/projects" },
  { id: "communication", label: "Comms",         icon: "📢", href: "/admin/communication" },
  { id: "resources",     label: "Resources",     icon: "🏫", href: "/admin/resources" },
  { id: "reports",       label: "Reports",       icon: "📊", href: "/admin/reports" },
  { id: "settings",      label: "Settings",      icon: "⚙️", href: "/admin/settings" },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()

  const [profile, setProfile]     = useState<AdminProfile | null>(null)
  const [loading, setLoading]     = useState(true)
  const [sidebarOpen, setSidebar] = useState(false)
  const [mounted, setMounted]     = useState(false)

  // Hide layout on login page
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
        .select("name")
        .eq("id", p.school_id)
        .single()

      setProfile({
        name:       p.full_name ?? "Principal",
        schoolName: school?.name ?? "School",
        schoolId:   p.school_id,
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

  // Login page — render children only, no shell
  if (isLoginPage) return <>{children}</>

  // Loading state
  if (loading || !mounted) {
    return (
      <div style={{
        minHeight:      "100vh",
        background:     deepspace,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width:        "48px",
            height:       "48px",
            border:       `3px solid rgba(16,185,129,0.2)`,
            borderTop:    `3px solid ${accent}`,
            borderRadius: "50%",
            animation:    "spin 1s linear infinite",
            margin:       "0 auto 16px",
          }} />
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>
            Loading Command Center...
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href)

  return (
    <div style={{
      minHeight:  "100vh",
      background: deepspace,
      display:    "flex",
      fontFamily: "'Inter', sans-serif",
      opacity:    mounted ? 1 : 0,
      transition: "opacity 0.4s ease",
    }}>

      {/* ── Sidebar overlay (mobile) ── */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebar(false)}
          style={{
            position:   "fixed",
            inset:      0,
            background: "rgba(0,0,0,0.6)",
            zIndex:     40,
            backdropFilter: "blur(2px)",
          }}
        />
      )}

      {/* ── SIDEBAR ── */}
      <aside style={{
        position:       "fixed",
        top:            0,
        left:           sidebarOpen ? 0 : "-280px",
        width:          "260px",
        height:         "100vh",
        background:     "rgba(255,255,255,0.02)",
        borderRight:    "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(12px)",
        zIndex:         50,
        display:        "flex",
        flexDirection:  "column",
        transition:     "left 0.3s ease",
        overflowY:      "auto",
      }}>

        {/* School identity */}
        <div style={{
          padding:      "24px 20px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{
            display:       "flex",
            alignItems:    "center",
            gap:           "12px",
            marginBottom:  "4px",
          }}>
            <div style={{
              width:          "40px",
              height:         "40px",
              background:     `linear-gradient(135deg, ${accent}, ${violet})`,
              borderRadius:   "12px",
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              fontSize:       "18px",
              flexShrink:     0,
            }}>
              🏫
            </div>
            <div style={{ overflow: "hidden" }}>
              <div style={{
                color:        "#ffffff",
                fontSize:     "13px",
                fontWeight:   "700",
                whiteSpace:   "nowrap",
                overflow:     "hidden",
                textOverflow: "ellipsis",
              }}>
                {profile?.schoolName}
              </div>
              <div style={{
                color:     "rgba(255,255,255,0.35)",
                fontSize:  "11px",
                marginTop: "2px",
              }}>
                {profile?.name}
              </div>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav style={{ padding: "12px 10px", flex: 1 }}>
          {NAV_ITEMS.map(item => {
            const active = isActive(item.href)
            return (
              <button
                key={item.id}
                onClick={() => { router.push(item.href); setSidebar(false) }}
                style={{
                  width:         "100%",
                  display:       "flex",
                  alignItems:    "center",
                  gap:           "12px",
                  padding:       "11px 14px",
                  borderRadius:  "10px",
                  border:        "none",
                  background:    active
                    ? `rgba(16,185,129,0.12)`
                    : "transparent",
                  color:         active
                    ? accent
                    : "rgba(255,255,255,0.5)",
                  fontSize:      "13px",
                  fontWeight:    active ? "600" : "400",
                  cursor:        "pointer",
                  textAlign:     "left",
                  marginBottom:  "2px",
                  transition:    "all 0.15s ease",
                  borderLeft:    active
                    ? `3px solid ${accent}`
                    : "3px solid transparent",
                }}
              >
                <span style={{ fontSize: "16px", width: "20px", textAlign: "center" }}>
                  {item.icon}
                </span>
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* Sign out */}
        <div style={{
          padding:    "16px 10px",
          borderTop:  "1px solid rgba(255,255,255,0.06)",
        }}>
          <button
            onClick={handleSignOut}
            style={{
              width:        "100%",
              padding:      "11px 14px",
              borderRadius: "10px",
              border:       "none",
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

      {/* ── MAIN CONTENT ── */}
      <div style={{
        flex:        1,
        display:     "flex",
        flexDirection:"column",
        minHeight:   "100vh",
        marginLeft:  0,
      }}>

        {/* Top bar */}
        <header style={{
          position:       "sticky",
          top:            0,
          zIndex:         30,
          background:     "rgba(10,10,20,0.9)",
          backdropFilter: "blur(12px)",
          borderBottom:   "1px solid rgba(255,255,255,0.06)",
          padding:        "0 20px",
          height:         "60px",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          gap:            "16px",
        }}>

          {/* Hamburger */}
          <button
            onClick={() => setSidebar(s => !s)}
            style={{
              background:   "rgba(255,255,255,0.05)",
              border:       "1px solid rgba(255,255,255,0.08)",
              borderRadius: "8px",
              width:        "38px",
              height:       "38px",
              display:      "flex",
              alignItems:   "center",
              justifyContent:"center",
              cursor:       "pointer",
              fontSize:     "16px",
              color:        "#ffffff",
              flexShrink:   0,
            }}
          >
            ☰
          </button>

          {/* Page title */}
          <div style={{ flex: 1 }}>
            <span style={{
              color:      "#ffffff",
              fontSize:   "15px",
              fontWeight: "600",
            }}>
              {NAV_ITEMS.find(n => isActive(n.href))?.label ?? "Admin"}
            </span>
          </div>

          {/* School name chip */}
          <div style={{
            background:   "rgba(16,185,129,0.1)",
            border:       "1px solid rgba(16,185,129,0.2)",
            borderRadius: "20px",
            padding:      "6px 14px",
            color:        accent,
            fontSize:     "12px",
            fontWeight:   "600",
            whiteSpace:   "nowrap",
            maxWidth:     "160px",
            overflow:     "hidden",
            textOverflow: "ellipsis",
          }}>
            {profile?.schoolName}
          </div>
        </header>

        {/* Page content */}
        <main style={{
          flex:    1,
          padding: "24px 20px",
        }}>
          {children}
        </main>

      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        input::placeholder { color: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  )
}
