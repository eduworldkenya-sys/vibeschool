"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

const deepspace = "#0a0a14"
const accent    = "#10b981"
const amber     = "#f59e0b"
const violet    = "#8b5cf6"

interface DashStats {
  totalStudents:    number
  totalStaff:       number
  totalClasses:     number
  parentsLinked:    number
  presentToday:     number
  absentToday:      number
  feesCollectedTerm: number
  feesOutstanding:  number
  visitorsToday:    number
  meetingsToday:    number
  pendingLeave:     number
  activeProjects:   number
}

interface Alert {
  id:      string
  type:    "critical" | "warning" | "info"
  message: string
  action:  string
  href:    string
}

export default function AdminDashboard() {
  const router = useRouter()

  const [stats, setStats]       = useState<DashStats | null>(null)
  const [alerts, setAlerts]     = useState<Alert[]>([])
  const [schoolId, setSchoolId] = useState<string>("")
  const [adminName, setAdminName] = useState<string>("")
  const [loading, setLoading]   = useState(true)
  const [now, setNow]           = useState(new Date())

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

      setSchoolId(p.school_id)
      setAdminName(p.full_name ?? "Principal")

      await loadStats(p.school_id)
    } catch {
      router.push("/admin/login")
    } finally {
      setLoading(false)
    }
  }

  async function loadStats(sid: string) {
    const today = new Date().toISOString().split("T")[0]

    // Run all queries in parallel
    const [
      studentsRes,
      staffRes,
      classesRes,
      parentsRes,
      presentRes,
      absentRes,
      feesRes,
      visitorsRes,
      meetingsRes,
      leaveRes,
      projectsRes,
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
    const feesExpected  = (feesRes.data ?? []).reduce((s: number, r: any) => s + (r.amount ?? 0), 0)

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

    if (s.absentToday > 0) list.push({
      id:      "absent",
      type:    s.absentToday > 10 ? "critical" : "warning",
      message: `${s.absentToday} student${s.absentToday > 1 ? "s" : ""} absent today`,
      action:  "View Attendance",
      href:    "/admin/attendance",
    })

    if (s.pendingLeave > 0) list.push({
      id:      "leave",
      type:    "warning",
      message: `${s.pendingLeave} staff leave request${s.pendingLeave > 1 ? "s" : ""} awaiting approval`,
      action:  "Review",
      href:    "/admin/staff",
    })

    if (s.feesOutstanding > 0) list.push({
      id:      "fees",
      type:    "info",
      message: `KES ${s.feesOutstanding.toLocaleString()} in outstanding fees this term`,
      action:  "View Finance",
      href:    "/admin/finance",
    })

    if (s.meetingsToday > 0) list.push({
      id:      "meetings",
      type:    "info",
      message: `${s.meetingsToday} meeting${s.meetingsToday > 1 ? "s" : ""} scheduled today`,
      action:  "View Meetings",
      href:    "/admin/meetings",
    })

    if (s.parentsLinked < s.totalStudents * 0.7) list.push({
      id:      "parents",
      type:    "warning",
      message: "Less than 70% of students have a linked parent account",
      action:  "View Students",
      href:    "/admin/students",
    })

    setAlerts(list)
  }

  function greeting() {
    const h = now.getHours()
    if (h < 12) return "Good morning"
    if (h < 17) return "Good afternoon"
    return "Good evening"
  }

  function formatDate() {
    return now.toLocaleDateString("en-KE", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    })
  }

  const alertColor = (type: Alert["type"]) =>
    type === "critical" ? "#ef4444" :
    type === "warning"  ? amber :
    accent

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{
            height:       "80px",
            background:   "rgba(255,255,255,0.03)",
            borderRadius: "16px",
            animation:    "pulse 1.5s ease-in-out infinite",
          }} />
        ))}
        <style>{`@keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} }`}</style>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>

      {/* ── Greeting ── */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{
          color:         "#ffffff",
          fontSize:      "24px",
          fontWeight:    "800",
          margin:        "0 0 4px",
          letterSpacing: "-0.5px",
        }}>
          {greeting()}, {adminName.split(" ")[0]} 👋
        </h1>
        <p style={{
          color:    "rgba(255,255,255,0.35)",
          fontSize: "13px",
          margin:   0,
        }}>
          {formatDate()}
        </p>
      </div>

      {/* ── Alerts ── */}
      {alerts.length > 0 && (
        <div style={{ marginBottom: "28px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <p style={{
            color:        "rgba(255,255,255,0.4)",
            fontSize:     "11px",
            fontWeight:   "700",
            letterSpacing:"1px",
            textTransform:"uppercase",
            margin:       "0 0 4px",
          }}>
            Needs Your Attention
          </p>
          {alerts.map(a => (
            <div
              key={a.id}
              style={{
                background:    `rgba(${
                  a.type === "critical" ? "239,68,68" :
                  a.type === "warning"  ? "245,158,11" :
                  "16,185,129"
                },0.08)`,
                border:        `1px solid rgba(${
                  a.type === "critical" ? "239,68,68" :
                  a.type === "warning"  ? "245,158,11" :
                  "16,185,129"
                },0.2)`,
                borderRadius:  "12px",
                padding:       "14px 16px",
                display:       "flex",
                alignItems:    "center",
                justifyContent:"space-between",
                gap:           "12px",
              }}
            >
              <span style={{
                color:    alertColor(a.type),
                fontSize: "13px",
                flex:     1,
              }}>
                {a.type === "critical" ? "🔴" : a.type === "warning" ? "🟡" : "🟢"} {a.message}
              </span>
              <button
                onClick={() => router.push(a.href)}
                style={{
                  background:   "rgba(255,255,255,0.08)",
                  border:       "none",
                  borderRadius: "8px",
                  padding:      "6px 12px",
                  color:        "#ffffff",
                  fontSize:     "12px",
                  fontWeight:   "600",
                  cursor:       "pointer",
                  whiteSpace:   "nowrap",
                }}
              >
                {a.action} →
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Key Stats Grid ── */}
      <p style={{
        color:        "rgba(255,255,255,0.4)",
        fontSize:     "11px",
        fontWeight:   "700",
        letterSpacing:"1px",
        textTransform:"uppercase",
        margin:       "0 0 12px",
      }}>
        School At A Glance
      </p>

      <div style={{
        display:             "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap:                 "12px",
        marginBottom:        "28px",
      }}>
        {[
          { label: "Total Students",    value: stats?.totalStudents ?? 0,    icon: "🎓", color: accent,  href: "/admin/students" },
          { label: "Total Staff",       value: stats?.totalStaff ?? 0,       icon: "👥", color: violet,  href: "/admin/staff" },
          { label: "Classes",           value: stats?.totalClasses ?? 0,     icon: "📚", color: amber,   href: "/admin/academics" },
          { label: "Parents Linked",    value: stats?.parentsLinked ?? 0,    icon: "👨‍👩‍👧", color: accent,  href: "/admin/students" },
        ].map(item => (
          <button
            key={item.label}
            onClick={() => router.push(item.href)}
            style={{
              background:     "rgba(255,255,255,0.03)",
              border:         "1px solid rgba(255,255,255,0.07)",
              borderRadius:   "16px",
              padding:        "20px 16px",
              backdropFilter: "blur(12px)",
              cursor:         "pointer",
              textAlign:      "left",
              transition:     "border-color 0.2s",
            }}
          >
            <div style={{ fontSize: "22px", marginBottom: "10px" }}>{item.icon}</div>
            <div style={{
              color:      "#ffffff",
              fontSize:   "28px",
              fontWeight: "800",
              fontFamily: "monospace",
              lineHeight: 1,
            }}>
              {item.value.toLocaleString()}
            </div>
            <div style={{
              color:     "rgba(255,255,255,0.4)",
              fontSize:  "12px",
              marginTop: "4px",
            }}>
              {item.label}
            </div>
          </button>
        ))}
      </div>

      {/* ── Today's Snapshot ── */}
      <p style={{
        color:        "rgba(255,255,255,0.4)",
        fontSize:     "11px",
        fontWeight:   "700",
        letterSpacing:"1px",
        textTransform:"uppercase",
        margin:       "0 0 12px",
      }}>
        Today
      </p>

      <div style={{
        display:             "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap:                 "12px",
        marginBottom:        "28px",
      }}>
        {[
          { label: "Present Today",    value: stats?.presentToday ?? 0,   icon: "✅", color: accent,            href: "/admin/attendance" },
          { label: "Absent Today",     value: stats?.absentToday ?? 0,    icon: "❌", color: "#ef4444",          href: "/admin/attendance" },
          { label: "Visitors Today",   value: stats?.visitorsToday ?? 0,  icon: "🚪", color: amber,             href: "/admin/visitors" },
          { label: "Meetings Today",   value: stats?.meetingsToday ?? 0,  icon: "🗓️", color: violet,            href: "/admin/meetings" },
        ].map(item => (
          <button
            key={item.label}
            onClick={() => router.push(item.href)}
            style={{
              background:     "rgba(255,255,255,0.03)",
              border:         `1px solid rgba(255,255,255,0.07)`,
              borderRadius:   "16px",
              padding:        "20px 16px",
              backdropFilter: "blur(12px)",
              cursor:         "pointer",
              textAlign:      "left",
            }}
          >
            <div style={{ fontSize: "22px", marginBottom: "10px" }}>{item.icon}</div>
            <div style={{
              color:      item.color,
              fontSize:   "28px",
              fontWeight: "800",
              fontFamily: "monospace",
              lineHeight: 1,
            }}>
              {item.value.toLocaleString()}
            </div>
            <div style={{
              color:     "rgba(255,255,255,0.4)",
              fontSize:  "12px",
              marginTop: "4px",
            }}>
              {item.label}
            </div>
          </button>
        ))}
      </div>

      {/* ── Finance & Operations ── */}
      <p style={{
        color:        "rgba(255,255,255,0.4)",
        fontSize:     "11px",
        fontWeight:   "700",
        letterSpacing:"1px",
        textTransform:"uppercase",
        margin:       "0 0 12px",
      }}>
        Finance & Operations
      </p>

      <div style={{
        display:             "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap:                 "12px",
        marginBottom:        "28px",
      }}>
        {[
          { label: "Fees Collected",   value: `KES ${(stats?.feesCollectedTerm ?? 0).toLocaleString()}`, icon: "💰", color: accent,   href: "/admin/finance" },
          { label: "Outstanding Fees", value: `KES ${(stats?.feesOutstanding ?? 0).toLocaleString()}`,   icon: "⚠️", color: amber,    href: "/admin/finance" },
          { label: "Pending Leave",    value: stats?.pendingLeave ?? 0,                                   icon: "🏖️", color: violet,   href: "/admin/staff" },
          { label: "Active Projects",  value: stats?.activeProjects ?? 0,                                 icon: "🚀", color: accent,   href: "/admin/projects" },
        ].map(item => (
          <button
            key={item.label}
            onClick={() => router.push(item.href)}
            style={{
              background:     "rgba(255,255,255,0.03)",
              border:         "1px solid rgba(255,255,255,0.07)",
              borderRadius:   "16px",
              padding:        "20px 16px",
              backdropFilter: "blur(12px)",
              cursor:         "pointer",
              textAlign:      "left",
            }}
          >
            <div style={{ fontSize: "22px", marginBottom: "10px" }}>{item.icon}</div>
            <div style={{
              color:      item.color,
              fontSize:   typeof item.value === "string" ? "18px" : "28px",
              fontWeight: "800",
              fontFamily: "monospace",
              lineHeight: 1,
            }}>
              {item.value}
            </div>
            <div style={{
              color:     "rgba(255,255,255,0.4)",
              fontSize:  "12px",
              marginTop: "4px",
            }}>
              {item.label}
            </div>
          </button>
        ))}
      </div>

      {/* ── Quick Actions ── */}
      <p style={{
        color:        "rgba(255,255,255,0.4)",
        fontSize:     "11px",
        fontWeight:   "700",
        letterSpacing:"1px",
        textTransform:"uppercase",
        margin:       "0 0 12px",
      }}>
        Quick Actions
      </p>

      <div style={{
        display:             "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap:                 "10px",
      }}>
        {[
          { label: "Log Visitor",       icon: "🚪", href: "/admin/visitors" },
          { label: "Record Payment",    icon: "💳", href: "/admin/finance" },
          { label: "Schedule Meeting",  icon: "🗓️", href: "/admin/meetings" },
          { label: "Add Student",       icon: "➕", href: "/admin/students" },
          { label: "Approve Leave",     icon: "✅", href: "/admin/staff" },
          { label: "Send Announcement", icon: "📢", href: "/admin/communication" },
        ].map(item => (
          <button
            key={item.label}
            onClick={() => router.push(item.href)}
            style={{
              background:     "rgba(255,255,255,0.03)",
              border:         "1px solid rgba(255,255,255,0.07)",
              borderRadius:   "12px",
              padding:        "14px 16px",
              display:        "flex",
              alignItems:     "center",
              gap:            "10px",
              color:          "rgba(255,255,255,0.7)",
              fontSize:       "13px",
              fontWeight:     "500",
              cursor:         "pointer",
              textAlign:      "left",
              transition:     "all 0.15s ease",
            }}
          >
            <span style={{ fontSize: "18px" }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

    </div>
  )
}
