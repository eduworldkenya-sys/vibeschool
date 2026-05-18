"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { supabase } from "@/lib/supabase"

const accent = "#10b981"
const amber  = "#f59e0b"
const violet = "#8b5cf6"
const navy   = "#0a1628"
const navy2  = "#0d3b7a"
const navy3  = "#0f5fa8"

interface AdminProfile {
  name:       string
  schoolName: string
  schoolId:   string
}

const NAV_ITEMS = [
  { id: "dashboard",     label: "Hub",        icon: "⚡", href: "/admin" },
  { id: "students",      label: "Students",   icon: "🎓", href: "/admin/students" },
  { id: "staff",         label: "Staff",      icon: "👥", href: "/admin/staff" },
  { id: "finance",       label: "Finance",    icon: "💰", href: "/admin/finance" },
  { id: "academics",     label: "Academics",  icon: "📚", href: "/admin/academics" },
  { id: "attendance",    label: "Attendance", icon: "📋", href: "/admin/attendance" },
  { id: "meetings",      label: "Meetings",   icon: "🗓️", href: "/admin/meetings" },
  { id: "visitors",      label: "Visitors",   icon: "🚪", href: "/admin/visitors" },
  { id: "projects",      label: "Projects",   icon: "🚀", href: "/admin/projects" },
  { id: "communication", label: "Comms",      icon: "📢", href: "/admin/communication" },
  { id: "resources",     label: "Resources",  icon: "🏫", href: "/admin/resources" },
  { id: "reports",       label: "Reports",    icon: "📊", href: "/admin/reports" },
  { id: "settings",      label: "Settings",   icon: "⚙️", href: "/admin/settings" },
]

const BOTTOM_NAV = [
  { label: "Hub",      icon: "⚡", href: "/admin" },
  { label: "Students", icon: "🎓", href: "/admin/students" },
  { label: "Finance",  icon: "💰", href: "/admin/finance" },
  { label: "Academics",icon: "📚", href: "/admin/academics" },
  { label: "More",     icon: "☰",  href: null },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()

  const [profile, setProfile] = useState<AdminProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebar] = useState(false)
  const [mounted, setMounted] = useState(false)

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

  if (isLoginPage) return <>{children}</>

  if (loading || !mounted) {
    return (
      <div style={{ minHeight: "100vh", background: navy, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: "48px", height: "48px", border: `3px solid rgba(16,185,129,0.2)`, borderTop: `3px solid ${accent}`, borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>Loading...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href)

  return (
    <div style={{ minHeight: "100vh", background: "#f0f4f8", display: "flex", flexDirection: "column", fontFamily: "'Inter', sans-serif", opacity: mounted ? 1 : 0, transition: "opacity 0.3s ease" }}>

      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div onClick={() => setSidebar(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40, backdropFilter: "blur(2px)" }} />
      )}

      {/* SIDEBAR */}
      <aside style={{
        position:      "fixed",
        top:           0,
        left:          0,
        transform:     sidebarOpen ? "translateX(0)" : "translateX(-280px)",
        width:         "265px",
        height:        "100vh",
        background:    `linear-gradient(180deg, ${navy} 0%, ${navy2} 100%)`,
        zIndex:        50,
        display:       "flex",
        flexDirection: "column",
        transition:    "transform 0.3s cubic-bezier(.4,0,.2,1)",
        overflowY:     "auto",
      }}>
        {/* Sidebar header */}
        <div style={{ padding: "48px 20px 24px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: `linear-gradient(135deg, ${accent}, ${navy3})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flexShrink: 0 }}>🏫</div>
            <div style={{ overflow: "hidden" }}>
              <div style={{ color: "#fff", fontSize: "14px", fontWeight: "700", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{profile?.schoolName}</div>
              <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "11px", marginTop: "2px" }}>{profile?.name}</div>
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
                  width:        "100%",
                  display:      "flex",
                  alignItems:   "center",
                  gap:          "12px",
                  padding:      "12px 14px",
                  borderRadius: "10px",
                  border:       "none",
                  borderLeft:   active ? `3px solid ${accent}` : "3px solid transparent",
                  background:   active ? "rgba(16,185,129,0.12)" : "transparent",
                  color:        active ? accent : "rgba(255,255,255,0.6)",
                  fontSize:     "13px",
                  fontWeight:   active ? "700" : "400",
                  cursor:       "pointer",
                  textAlign:    "left",
                  marginBottom: "2px",
                  transition:   "all 0.15s ease",
                }}
              >
                <span style={{ fontSize: "16px", width: "20px", textAlign: "center" }}>{item.icon}</span>
                {item.label}
                {active && <span style={{ marginLeft: "auto", color: accent, fontSize: "16px" }}>›</span>}
              </button>
            )
          })}
        </nav>

        {/* Sign out */}
        <div style={{ padding: "16px 10px 32px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <button
            onClick={handleSignOut}
            style={{ width: "100%", padding: "11px 14px", borderRadius: "10px", border: "none", background: "rgba(239,68,68,0.12)", color: "#ef4444", fontSize: "13px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px" }}
          >
            <span>🚪</span> Sign Out
          </button>
        </div>
      </aside>

      {/* TOP HEADER */}
      <header style={{
        position:       "sticky",
        top:            0,
        zIndex:         30,
        background:     `linear-gradient(135deg, ${navy} 0%, ${navy2} 100%)`,
        borderBottom:   "1px solid rgba(255,255,255,0.08)",
        padding:        "0 20px",
        height:         "60px",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        gap:            "16px",
      }}>
        <button
          onClick={() => setSidebar(s => !s)}
          style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", width: "38px", height: "38px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "16px", color: "#fff", flexShrink: 0 }}
        >☰</button>

        <span style={{ color: "#fff", fontSize: "15px", fontWeight: "700", flex: 1 }}>
          {NAV_ITEMS.find(n => isActive(n.href))?.icon} {NAV_ITEMS.find(n => isActive(n.href))?.label ?? "Admin"}
        </span>

        <div style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "20px", padding: "6px 14px", color: accent, fontSize: "12px", fontWeight: "600", whiteSpace: "nowrap", maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis" }}>
          {profile?.schoolName}
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main style={{ flex: 1, padding: "20px 16px 90px", overflowX: "hidden", width: "100%", maxWidth: "900px", margin: "0 auto" }}>
        {children}
      </main>

      {/* BOTTOM NAV */}
      <nav style={{
        position:       "fixed",
        bottom:         0,
        left:           0,
        right:          0,
        height:         "64px",
        background:     "#fff",
        borderTop:      "1px solid #e2e8f0",
        display:        "flex",
        zIndex:         30,
        boxShadow:      "0 -4px 20px rgba(0,0,0,0.08)",
      }}>
        {BOTTOM_NAV.map((n, i) => {
          const active = n.href ? isActive(n.href) : false
          return (
            <button
              key={i}
              onClick={() => n.href ? router.push(n.href) : setSidebar(true)}
              style={{
                flex:          1,
                background:    "none",
                border:        "none",
                display:       "flex",
                flexDirection: "column",
                alignItems:    "center",
                justifyContent:"center",
                gap:           "3px",
                cursor:        "pointer",
                padding:       "8px 0",
              }}
            >
              <span style={{ fontSize: "20px" }}>{n.icon}</span>
              <span style={{ fontSize: "10px", fontWeight: "600", color: active ? navy3 : "#aab4c4" }}>{n.label}</span>
              {active && <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: navy3 }} />}
            </button>
          )
        })}
      </nav>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        * { box-sizing: border-box; margin: 0; }
        html, body { overflow-x: hidden; max-width: 100vw; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
      `}</style>
    </div>
  )
}
