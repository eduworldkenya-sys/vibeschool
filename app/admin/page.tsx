"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

const accent = "#10b981"
const amber  = "#f59e0b"
const violet = "#8b5cf6"
const navy   = "#0a1628"
const navy2  = "#0d3b7a"
const navy3  = "#0f5fa8"
const red    = "#ef4444"

interface DashStats {
  totalStudents:     number
  totalStaff:        number
  totalClasses:      number
  parentsLinked:     number
  presentToday:      number
  absentToday:       number
  feesCollectedTerm: number
  feesOutstanding:   number
  visitorsToday:     number
  meetingsToday:     number
  pendingLeave:      number
  activeProjects:    number
}

interface Alert {
  id:      string
  type:    "critical" | "warning" | "info"
  message: string
  action:  string
  href:    string
}

function StatCard({ icon, label, value, color, href, router }: any) {
  return (
    <button
      onClick={() => router.push(href)}
      style={{
        background:    "#fff",
        border:        "none",
        borderLeft:    `4px solid ${color}`,
        borderRadius:  "14px",
        padding:       "16px 14px",
        textAlign:     "left",
        cursor:        "pointer",
        boxShadow:     "0 2px 8px rgba(0,0,0,0.06)",
        transition:    "transform 0.15s, box-shadow 0.15s",
        width:         "100%",
      }}
    >
      <div style={{ fontSize: "22px", marginBottom: "8px" }}>{icon}</div>
      <div style={{ color, fontSize: "22px", fontWeight: "800", lineHeight: 1, fontFamily: "monospace" }}>{value}</div>
      <div style={{ color: "#8a96aa", fontSize: "11px", marginTop: "4px", fontWeight: "500" }}>{label}</div>
    </button>
  )
}

function SectionLabel({ children }: any) {
  return (
    <p style={{ color: "#6b7a99", fontSize: "11px", fontWeight: "700", letterSpacing: "1.2px", textTransform: "uppercase", margin: "0 0 10px" }}>
      {children}
    </p>
  )
}

export default function AdminDashboard() {
  const router = useRouter()

  const [stats, setStats]         = useState<DashStats | null>(null)
  const [alerts, setAlerts]       = useState<Alert[]>([])
  const [adminName, setAdminName] = useState<string>("")
  const [schoolName, setSchoolName] = useState<string>("")
  const [loading, setLoading]     = useState(true)
  const [now, setNow]             = useState(new Date())
  const [balanceHidden, setBalanceHidden] = useState(true)

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => { bootstrap() }, [])

  async function bootstrap() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/admin/login"); return }

      const { data: p } = await supabase
        .from("profiles")
        .select("full_name, school_id")
        .eq("id", user.id)
        .single()

      if (!p?.school_id) { router.push("/admin/login"); return }

      const { data: school } = await supabase
        .from("schools")
        .select("name")
        .eq("id", p.school_id)
        .single()

      setAdminName(p.full_name ?? "Principal")
      setSchoolName(school?.name ?? "School")
      await loadStats(p.school_id)
    } catch {
      router.push("/admin/login")
    } finally {
      setLoading(false)
    }
  }

  async function loadStats(sid: string) {
    const today = new Date().toISOString().split("T")[0]
    const [
      studentsRes, staffRes, classesRes, parentsRes,
      presentRes, absentRes, feesRes, feeStructRes,
      visitorsRes, meetingsRes, leaveRes, projectsRes,
    ] = await Promise.all([
      supabase.from("students").select("id", { count: "exact", head: true }).eq("school_id", sid),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("school_id", sid).eq("role", "teacher"),
      supabase.from("classes").select("id", { count: "exact", head: true }).eq("school_id", sid),
      supabase.from("parent_student_links").select("id", { count: "exact", head: true }).eq("school_id", sid),
      supabase.from("attendance").select("id", { count: "exact", head: true }).eq("school_id", sid).eq("date", today).eq("status", "present"),
      supabase.from("attendance").select("id", { count: "exact", head: true }).eq("school_id", sid).eq("date", today).eq("status", "absent"),
      supabase.from("finance_fee_payments").select("amount").eq("school_id", sid),
      supabase.from("finance_fee_structures").select("amount").eq("school_id", sid),
      supabase.from("admin_visitors").select("id", { count: "exact", head: true }).eq("school_id", sid).gte("time_in", today),
      supabase.from("admin_meetings").select("id", { count: "exact", head: true }).eq("school_id", sid).gte("scheduled_at", today + "T00:00:00").lte("scheduled_at", today + "T23:59:59"),
      supabase.from("admin_staff_leave").select("id", { count: "exact", head: true }).eq("school_id", sid).eq("status", "pending"),
      supabase.from("admin_projects").select("id", { count: "exact", head: true }).eq("school_id", sid).eq("status", "active"),
    ])

    const feesCollected = (feesRes.data ?? []).reduce((s: number, r: any) => s + (r.amount ?? 0), 0)
    const feesExpected  = (feeStructRes.data ?? []).reduce((s: number, r: any) => s + (r.amount ?? 0), 0)

    const s: DashStats = {
      totalStudents:     studentsRes.count ?? 0,
      totalStaff:        staffRes.count ?? 0,
      totalClasses:      classesRes.count ?? 0,
      parentsLinked:     parentsRes.count ?? 0,
      presentToday:      presentRes.count ?? 0,
      absentToday:       absentRes.count ?? 0,
      feesCollectedTerm: feesCollected,
      feesOutstanding:   Math.max(0, feesExpected - feesCollected),
      visitorsToday:     visitorsRes.count ?? 0,
      meetingsToday:     meetingsRes.count ?? 0,
      pendingLeave:      leaveRes.count ?? 0,
      activeProjects:    projectsRes.count ?? 0,
    }
    setStats(s)
    buildAlerts(s)
  }

  function buildAlerts(s: DashStats) {
    const list: Alert[] = []
    if (s.absentToday > 0)    list.push({ id: "absent",   type: s.absentToday > 10 ? "critical" : "warning", message: `${s.absentToday} student${s.absentToday > 1 ? "s" : ""} absent today`,                          action: "View", href: "/admin/attendance" })
    if (s.pendingLeave > 0)   list.push({ id: "leave",    type: "warning",  message: `${s.pendingLeave} staff leave request${s.pendingLeave > 1 ? "s" : ""} pending`,                                                  action: "Review", href: "/admin/staff" })
    if (s.feesOutstanding > 0)list.push({ id: "fees",     type: "info",     message: `KES ${s.feesOutstanding.toLocaleString()} outstanding fees`,                                                                      action: "View", href: "/admin/finance" })
    if (s.meetingsToday > 0)  list.push({ id: "meetings", type: "info",     message: `${s.meetingsToday} meeting${s.meetingsToday > 1 ? "s" : ""} today`,                                                              action: "View", href: "/admin/meetings" })
    setAlerts(list)
  }

  function greeting() {
    const h = now.getHours()
    if (h < 12) return "Good morning"
    if (h < 17) return "Good afternoon"
    return "Good evening"
  }

  function formatDate() {
    return now.toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
  }

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ height: "80px", background: "#fff", borderRadius: "14px", opacity: 0.5, animation: "pulse 1.5s ease-in-out infinite" }} />
        ))}
        <style>{`@keyframes pulse { 0%,100%{opacity:0.3} 50%{opacity:0.7} }`}</style>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* HERO GREETING CARD */}
      <div style={{
        background:    `linear-gradient(135deg, ${navy} 0%, ${navy2} 55%, ${navy3} 100%)`,
        borderRadius:  "20px",
        padding:       "24px 20px",
        position:      "relative",
        overflow:      "hidden",
        boxShadow:     "0 8px 32px rgba(10,22,40,0.18)",
      }}>
        {/* Decorative circles */}
        <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
        <div style={{ position: "absolute", top: 20, right: 20, width: 70, height: 70, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />

        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "13px", margin: "0 0 2px" }}>{greeting()},</p>
        <h1 style={{ color: "#fff", fontSize: "22px", fontWeight: "800", margin: "0 0 2px", letterSpacing: "-0.5px" }}>
          {adminName.split(" ")[0]} 👋
        </h1>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", margin: "0 0 20px" }}>{formatDate()}</p>

        {/* School summary card */}
        <div style={{
          background:   "rgba(255,255,255,0.08)",
          border:       "1px solid rgba(255,255,255,0.12)",
          borderRadius: "14px",
          padding:      "16px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px" }}>🏫</span>
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "12px" }}>{schoolName}</span>
            </div>
            <button
              onClick={() => setBalanceHidden(!balanceHidden)}
              style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "8px", padding: "4px 10px", color: "#fff", cursor: "pointer", fontSize: "12px" }}
            >{balanceHidden ? "👁️ Show" : "🙈 Hide"}</button>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "10px", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Fees Collected</p>
              <span style={{ color: accent, fontWeight: "700", fontSize: "15px" }}>
                {balanceHidden ? "KES ••••••" : `KES ${(stats?.feesCollectedTerm ?? 0).toLocaleString()}`}
              </span>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "10px", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Outstanding</p>
              <span style={{ color: red, fontWeight: "700", fontSize: "15px" }}>
                {balanceHidden ? "KES ••••••" : `KES ${(stats?.feesOutstanding ?? 0).toLocaleString()}`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ALERTS */}
      {alerts.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <SectionLabel>Needs Attention</SectionLabel>
          {alerts.map(a => {
            const c = a.type === "critical" ? red : a.type === "warning" ? amber : accent
            const rgb = a.type === "critical" ? "239,68,68" : a.type === "warning" ? "245,158,11" : "16,185,129"
            return (
              <div key={a.id} style={{ background: `rgba(${rgb},0.08)`, border: `1px solid rgba(${rgb},0.25)`, borderRadius: "12px", padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                <span style={{ color: c, fontSize: "13px", flex: 1 }}>
                  {a.type === "critical" ? "🔴" : a.type === "warning" ? "🟡" : "🟢"} {a.message}
                </span>
                <button onClick={() => router.push(a.href)} style={{ background: "rgba(255,255,255,0.9)", border: "none", borderRadius: "8px", padding: "5px 12px", color: navy, fontSize: "11px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap" }}>
                  {a.action} →
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* QUICK ACTIONS */}
      <div>
        <SectionLabel>Quick Actions</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
          {[
            { label: "Log Visitor",    icon: "🚪", href: "/admin/visitors" },
            { label: "Add Student",    icon: "➕", href: "/admin/students" },
            { label: "Record Payment", icon: "💳", href: "/admin/finance" },
            { label: "Attendance",     icon: "📋", href: "/admin/attendance" },
            { label: "Meeting",        icon: "🗓️", href: "/admin/meetings" },
            { label: "Announcement",   icon: "📢", href: "/admin/communication" },
          ].map(item => (
            <button
              key={item.label}
              onClick={() => router.push(item.href)}
              style={{ background: `linear-gradient(135deg, ${navy} 0%, ${navy2} 100%)`, border: "none", borderRadius: "14px", padding: "16px 8px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", cursor: "pointer", transition: "transform 0.15s" }}
            >
              <span style={{ fontSize: "22px" }}>{item.icon}</span>
              <span style={{ color: "#fff", fontSize: "10px", fontWeight: "600", textAlign: "center", lineHeight: 1.3 }}>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* SCHOOL AT A GLANCE */}
      <div>
        <SectionLabel>School at a Glance</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" }}>
          <StatCard icon="🎓" label="Total Students" value={(stats?.totalStudents ?? 0).toLocaleString()} color={accent}  href="/admin/students"  router={router} />
          <StatCard icon="👥" label="Total Staff"    value={(stats?.totalStaff ?? 0).toLocaleString()}    color={navy3}   href="/admin/staff"     router={router} />
          <StatCard icon="📚" label="Classes"        value={(stats?.totalClasses ?? 0).toLocaleString()}  color={amber}   href="/admin/academics" router={router} />
          <StatCard icon="👨‍👩‍👧" label="Parents Linked" value={(stats?.parentsLinked ?? 0).toLocaleString()} color={violet}  href="/admin/students"  router={router} />
        </div>
      </div>

      {/* TODAY */}
      <div>
        <SectionLabel>Today</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" }}>
          <StatCard icon="✅" label="Present"       value={(stats?.presentToday ?? 0).toLocaleString()}  color={accent}  href="/admin/attendance" router={router} />
          <StatCard icon="❌" label="Absent"        value={(stats?.absentToday ?? 0).toLocaleString()}   color={red}     href="/admin/attendance" router={router} />
          <StatCard icon="🚪" label="Visitors"      value={(stats?.visitorsToday ?? 0).toLocaleString()} color={amber}   href="/admin/visitors"   router={router} />
          <StatCard icon="🗓️" label="Meetings"      value={(stats?.meetingsToday ?? 0).toLocaleString()} color={violet}  href="/admin/meetings"   router={router} />
        </div>
      </div>

      {/* FINANCE & OPERATIONS */}
      <div>
        <SectionLabel>Finance &amp; Operations</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" }}>
          <StatCard icon="💰" label="Fees Collected"  value={`KES ${(stats?.feesCollectedTerm ?? 0).toLocaleString()}`} color={accent}  href="/admin/finance" router={router} />
          <StatCard icon="⚠️" label="Outstanding"     value={`KES ${(stats?.feesOutstanding ?? 0).toLocaleString()}`}   color={red}     href="/admin/finance" router={router} />
          <StatCard icon="🏖️" label="Pending Leave"   value={(stats?.pendingLeave ?? 0).toLocaleString()}               color={amber}   href="/admin/staff"   router={router} />
          <StatCard icon="🚀" label="Active Projects" value={(stats?.activeProjects ?? 0).toLocaleString()}              color={violet}  href="/admin/projects" router={router} />
        </div>
      </div>

    </div>
  )
}
