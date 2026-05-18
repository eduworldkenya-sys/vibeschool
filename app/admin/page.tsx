"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

// ─── Tokens ──────────────────────────────────────────────────────────────────
const C = {
  hero:      "#0a1628",
  heroMid:   "#0d2347",
  heroDeep:  "#0f3460",
  card:      "#ffffff",
  cardAlt:   "#f8fafc",
  bg:        "#f0f4f8",
  emerald:   "#10b981",
  amber:     "#f59e0b",
  violet:    "#8b5cf6",
  sky:       "#38bdf8",
  red:       "#ef4444",
  navy:      "#0a1628",
  text:      "#0f172a",
  textMuted: "#64748b",
  border:    "#e2e8f0",
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface VitalSign {
  key:      string
  label:    string
  value:    number
  total:    number
  color:    string
  href:     string
  suffix?:  string
  prefix?:  string
  alert?:   string
}

interface Briefing {
  id:      string
  level:   "critical" | "decide" | "fyi"
  message: string
  action:  string
  href:    string
}

interface DashData {
  adminName:        string
  schoolName:       string
  logoUrl:          string | null
  students:         number
  staff:            number
  classes:          number
  parents:          number
  presentToday:     number
  absentToday:      number
  staffPresentToday:number
  staffTotal:       number
  visitorsToday:    number
  meetingsToday:    number
  pendingLeave:     number
  activeProjects:   number
  feesCollected:    number
  feesExpected:     number
  announcements:    number
}

export default function AdminHub() {
  const router = useRouter()
  const [data,         setData]         = useState<DashData | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [balHidden,    setBalHidden]    = useState(true)
  const [now,          setNow]          = useState(new Date())
  const [schoolId,     setSchoolId]     = useState("")

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => { boot() }, [])

  async function boot() {
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

      const { data: school } = await supabase
        .from("schools")
        .select("name, logo_url")
        .eq("id", p.school_id)
        .single()

      await loadDash(p.school_id, p.full_name ?? "Principal", school)
    } catch {
      router.push("/admin/login")
    } finally {
      setLoading(false)
    }
  }

  async function loadDash(sid: string, name: string, school: any) {
    const today = new Date().toISOString().split("T")[0]

    const [
      s1, s2, s3, s4,
      s5, s6, s7, s8,
      s9, s10, s11, s12,
      s13, s14,
    ] = await Promise.all([
      supabase.from("students").select("id", { count: "exact", head: true }).eq("school_id", sid).is("deleted_at", null),
      supabase.from("staff").select("id", { count: "exact", head: true }).eq("school_id", sid).is("deleted_at", null),
      supabase.from("classes").select("id", { count: "exact", head: true }).eq("school_id", sid).is("deleted_at", null),
      supabase.from("parent_student_links").select("id", { count: "exact", head: true }).eq("school_id", sid),
      supabase.from("attendance").select("id", { count: "exact", head: true }).eq("school_id", sid).eq("date", today).eq("status", "present"),
      supabase.from("attendance").select("id", { count: "exact", head: true }).eq("school_id", sid).eq("date", today).eq("status", "absent"),
      supabase.from("staff_attendance").select("id", { count: "exact", head: true }).eq("school_id", sid).eq("date", today).eq("status", "present"),
      supabase.from("staff_attendance").select("id", { count: "exact", head: true }).eq("school_id", sid).eq("date", today),
      supabase.from("admin_visitors").select("id", { count: "exact", head: true }).eq("school_id", sid).gte("created_at", today),
      supabase.from("admin_meetings").select("id", { count: "exact", head: true }).eq("school_id", sid).gte("scheduled_at", today + "T00:00:00").lte("scheduled_at", today + "T23:59:59"),
      supabase.from("admin_staff_leave").select("id", { count: "exact", head: true }).eq("school_id", sid).eq("status", "pending"),
      supabase.from("admin_projects").select("id", { count: "exact", head: true }).eq("school_id", sid).eq("status", "active"),
      supabase.from("finance_fee_payments").select("amount").eq("school_id", sid),
      supabase.from("finance_fee_structures").select("amount").eq("school_id", sid),
    ])

    const collected = (s13.data ?? []).reduce((a: number, r: any) => a + (r.amount ?? 0), 0)
    const expected  = (s14.data ?? []).reduce((a: number, r: any) => a + (r.amount ?? 0), 0)

    setData({
      adminName:         name,
      schoolName:        school?.name ?? "School",
      logoUrl:           school?.logo_url ?? null,
      students:          s1.count  ?? 0,
      staff:             s2.count  ?? 0,
      classes:           s3.count  ?? 0,
      parents:           s4.count  ?? 0,
      presentToday:      s5.count  ?? 0,
      absentToday:       s6.count  ?? 0,
      staffPresentToday: s7.count  ?? 0,
      staffTotal:        s8.count  ?? 0,
      visitorsToday:     s9.count  ?? 0,
      meetingsToday:     s10.count ?? 0,
      pendingLeave:      s11.count ?? 0,
      activeProjects:    s12.count ?? 0,
      feesCollected:     collected,
      feesExpected:      expected,
      announcements:     0,
    })
  }

  // ─── Derived ─────────────────────────────────────────────────────────────
  const greeting = () => {
    const h = now.getHours()
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"
  }

  const dateStr = () => now.toLocaleDateString("en-KE", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  })

  const pct = (a: number, b: number) => b > 0 ? Math.round((a / b) * 100) : 0

  const briefings = (): Briefing[] => {
    if (!data) return []
    const list: Briefing[] = []

    if (data.absentToday > 10)
      list.push({ id: "absent-crit", level: "critical", message: `${data.absentToday} students absent — unusually high`, action: "Investigate", href: "/admin/attendance" })
    else if (data.absentToday > 0)
      list.push({ id: "absent", level: "decide", message: `${data.absentToday} student${data.absentToday > 1 ? "s" : ""} absent today`, action: "View", href: "/admin/attendance" })

    if (data.pendingLeave > 0)
      list.push({ id: "leave", level: "decide", message: `${data.pendingLeave} leave request${data.pendingLeave > 1 ? "s" : ""} awaiting your approval`, action: "Review", href: "/admin/staff" })

    if (data.meetingsToday > 0)
      list.push({ id: "meetings", level: "decide", message: `${data.meetingsToday} meeting${data.meetingsToday > 1 ? "s" : ""} scheduled today`, action: "View", href: "/admin/meetings" })

    if (data.staffTotal > 0 && data.staffPresentToday < data.staffTotal)
      list.push({ id: "staff-att", level: "decide", message: `${data.staffTotal - data.staffPresentToday} staff member${data.staffTotal - data.staffPresentToday > 1 ? "s" : ""} not yet marked`, action: "Mark", href: "/admin/attendance" })

    const outstanding = data.feesExpected - data.feesCollected
    if (outstanding > 0)
      list.push({ id: "fees", level: "fyi", message: `KES ${outstanding.toLocaleString()} outstanding fees this term`, action: "View", href: "/admin/finance" })

    if (data.visitorsToday > 0)
      list.push({ id: "visitors", level: "fyi", message: `${data.visitorsToday} visitor${data.visitorsToday > 1 ? "s" : ""} logged today`, action: "View", href: "/admin/visitors" })

    return list
  }

  const vitals = (): VitalSign[] => {
    if (!data) return []
    const studentAtt = pct(data.presentToday, data.students)
    const staffAtt   = pct(data.staffPresentToday, data.staffTotal)
    const feesPct    = pct(data.feesCollected, data.feesExpected)

    return [
      {
        key:   "attendance",
        label: "Student Attendance",
        value: data.presentToday,
        total: data.students,
        color: studentAtt >= 90 ? C.emerald : studentAtt >= 75 ? C.amber : C.red,
        href:  "/admin/attendance",
        alert: studentAtt < 75 ? "Below threshold" : undefined,
      },
      {
        key:   "staff",
        label: "Staff Present",
        value: data.staffPresentToday,
        total: data.staffTotal,
        color: staffAtt === 100 ? C.emerald : staffAtt >= 85 ? C.amber : C.red,
        href:  "/admin/staff",
        alert: staffAtt < 85 ? "Needs cover" : undefined,
      },
      {
        key:    "fees",
        label:  "Fee Collection",
        value:  data.feesCollected,
        total:  data.feesExpected,
        color:  feesPct >= 80 ? C.emerald : feesPct >= 60 ? C.amber : C.red,
        href:   "/admin/finance",
        prefix: "KES ",
        alert:  feesPct < 60 ? "Below target" : undefined,
      },
    ]
  }

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ height: "80px", background: "#e2e8f0", borderRadius: "16px", animation: "pulse 1.5s ease-in-out infinite", opacity: 0.6 }} />
      ))}
      <style>{`@keyframes pulse{0%,100%{opacity:.4}50%{opacity:.8}}`}</style>
    </div>
  )

  const b = briefings()
  const v = vitals()
  const criticals = b.filter(x => x.level === "critical")
  const decides   = b.filter(x => x.level === "decide")
  const fyis      = b.filter(x => x.level === "fyi")

  const feesPct = pct(data?.feesCollected ?? 0, data?.feesExpected ?? 0)

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* ── MORNING BRIEFING HERO ─────────────────────────────────────────── */}
      <div style={{
        background:   `linear-gradient(160deg, ${C.hero} 0%, ${C.heroMid} 60%, ${C.heroDeep} 100%)`,
        borderRadius: "24px",
        padding:      "24px 20px 20px",
        position:     "relative",
        overflow:     "hidden",
        boxShadow:    "0 8px 32px rgba(10,22,40,0.18)",
      }}>
        {/* Decorative circles */}
        <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.03)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -30, right: 60, width: 100, height: 100, borderRadius: "50%", background: "rgba(16,185,129,0.06)", pointerEvents: "none" }} />

        {/* Top row — greeting + show/hide */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
          <div>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "12px", margin: "0 0 3px", letterSpacing: "0.3px" }}>{greeting()},</p>
            <h1 style={{ color: "#fff", fontSize: "22px", fontWeight: "800", margin: "0 0 3px", letterSpacing: "-0.5px" }}>
              {data?.adminName?.split(" ")[0]} 👋
            </h1>
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "11px", margin: 0 }}>{dateStr()}</p>
          </div>
          <button
            onClick={() => setBalHidden(h => !h)}
            style={{
              background:   "rgba(255,255,255,0.08)",
              border:       "1px solid rgba(255,255,255,0.15)",
              borderRadius: "10px",
              padding:      "7px 14px",
              color:        "rgba(255,255,255,0.8)",
              fontSize:     "11px",
              fontWeight:   "600",
              cursor:       "pointer",
              letterSpacing:"0.3px",
            }}
          >
            {balHidden ? "👁 Show" : "🙈 Hide"}
          </button>
        </div>

        {/* Finance strip */}
        <div style={{
          background:   "rgba(255,255,255,0.06)",
          border:       "1px solid rgba(255,255,255,0.1)",
          borderRadius: "16px",
          padding:      "16px",
          display:      "flex",
          justifyContent: "space-around",
          alignItems:   "center",
          marginBottom: "20px",
        }}>
          {[
            { label: "Collected",    value: balHidden ? "••••••" : `KES ${(data?.feesCollected ?? 0).toLocaleString()}`, color: C.emerald },
            { label: "Outstanding",  value: balHidden ? "••••••" : `KES ${Math.max(0, (data?.feesExpected ?? 0) - (data?.feesCollected ?? 0)).toLocaleString()}`, color: C.red },
            { label: "Students",     value: String(data?.students ?? 0), color: C.amber },
          ].map((chip, i) => (
            <div key={chip.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
              <span style={{ color: chip.color, fontSize: "15px", fontWeight: "800", letterSpacing: "-0.3px" }}>{chip.value}</span>
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "10px", letterSpacing: "0.5px" }}>{chip.label}</span>
            </div>
          ))}
        </div>

        {/* Fee progress bar */}
        {(data?.feesExpected ?? 0) > 0 && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px" }}>Term fee collection</span>
              <span style={{ color: feesPct >= 80 ? C.emerald : feesPct >= 60 ? C.amber : C.red, fontSize: "11px", fontWeight: "700" }}>{feesPct}%</span>
            </div>
            <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: "99px", height: "6px", overflow: "hidden" }}>
              <div style={{
                height:       "100%",
                width:        `${Math.min(100, feesPct)}%`,
                background:   feesPct >= 80 ? C.emerald : feesPct >= 60 ? C.amber : C.red,
                borderRadius: "99px",
                transition:   "width 1s ease",
              }} />
            </div>
          </div>
        )}
      </div>

      {/* ── COMMAND CENTRE BRIEFING ───────────────────────────────────────── */}
      {b.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span style={{ color: C.textMuted, fontSize: "10px", fontWeight: "700", letterSpacing: "1.2px", textTransform: "uppercase" }}>Command Centre</span>
            <div style={{ flex: 1, height: "1px", background: C.border }} />
            <span style={{ background: C.hero, color: "#fff", fontSize: "10px", fontWeight: "700", borderRadius: "99px", padding: "2px 8px" }}>{b.length}</span>
          </div>

          {criticals.map(item => (
            <BriefingRow key={item.id} item={item} router={router} />
          ))}
          {decides.map(item => (
            <BriefingRow key={item.id} item={item} router={router} />
          ))}
          {fyis.map(item => (
            <BriefingRow key={item.id} item={item} router={router} />
          ))}
        </div>
      )}

      {/* ── SCHOOL VITAL SIGNS ────────────────────────────────────────────── */}
      <div>
        <SectionLabel>School Vital Signs</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {v.map(vital => (
            <VitalCard key={vital.key} vital={vital} router={router} />
          ))}
        </div>
      </div>

      {/* ── QUICK ACTIONS ─────────────────────────────────────────────────── */}
      <div>
        <SectionLabel>Quick Actions</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
          {[
            { label: "Log Visitor",  icon: "🚪", href: "/admin/visitors",      color: C.sky     },
            { label: "Add Student",  icon: "🎓", href: "/admin/students",       color: C.emerald },
            { label: "Payment",      icon: "💳", href: "/admin/finance",        color: C.amber   },
            { label: "Attendance",   icon: "📋", href: "/admin/attendance",     color: C.violet  },
            { label: "Meeting",      icon: "🗓️", href: "/admin/meetings",       color: C.sky     },
            { label: "Announce",     icon: "📢", href: "/admin/communication",  color: C.red     },
          ].map(item => (
            <button
              key={item.label}
              onClick={() => router.push(item.href)}
              style={{
                background:    C.card,
                border:        `1px solid ${C.border}`,
                borderRadius:  "16px",
                padding:       "16px 8px 14px",
                display:       "flex",
                flexDirection: "column",
                alignItems:    "center",
                gap:           "8px",
                cursor:        "pointer",
                boxShadow:     "0 1px 4px rgba(0,0,0,0.05)",
                transition:    "transform 0.15s ease, box-shadow 0.15s ease",
              }}
            >
              <div style={{
                width:          "42px",
                height:         "42px",
                borderRadius:   "12px",
                background:     `${item.color}18`,
                border:         `1px solid ${item.color}30`,
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
                fontSize:       "20px",
              }}>
                {item.icon}
              </div>
              <span style={{ color: C.text, fontSize: "11px", fontWeight: "600", textAlign: "center", lineHeight: 1.3 }}>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── SCHOOL OVERVIEW ───────────────────────────────────────────────── */}
      {[
        {
          title: "School",
          rows: [
            { label: "Students",  value: data?.students ?? 0,  color: C.emerald, href: "/admin/students"  },
            { label: "Staff",     value: data?.staff ?? 0,     color: C.sky,     href: "/admin/staff"     },
            { label: "Classes",   value: data?.classes ?? 0,   color: C.amber,   href: "/admin/academics" },
            { label: "Parents",   value: data?.parents ?? 0,   color: C.violet,  href: "/admin/students"  },
          ],
        },
        {
          title: "Today",
          rows: [
            { label: "Present",   value: data?.presentToday   ?? 0, color: C.emerald, href: "/admin/attendance" },
            { label: "Absent",    value: data?.absentToday    ?? 0, color: C.red,     href: "/admin/attendance" },
            { label: "Visitors",  value: data?.visitorsToday  ?? 0, color: C.amber,   href: "/admin/visitors"   },
            { label: "Meetings",  value: data?.meetingsToday  ?? 0, color: C.sky,     href: "/admin/meetings"   },
          ],
        },
        {
          title: "Operations",
          rows: [
            { label: "Leave Pending", value: data?.pendingLeave   ?? 0, color: C.amber,  href: "/admin/staff"    },
            { label: "Projects",      value: data?.activeProjects ?? 0, color: C.violet, href: "/admin/projects" },
          ],
        },
      ].map(section => (
        <div key={section.title}>
          <SectionLabel>{section.title}</SectionLabel>
          <div style={{ background: C.card, borderRadius: "18px", overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,0.06)", border: `1px solid ${C.border}` }}>
            {section.rows.map((row, idx) => (
              <button
                key={row.label}
                onClick={() => router.push(row.href)}
                style={{
                  width:          "100%",
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "space-between",
                  padding:        "14px 18px",
                  background:     "none",
                  border:         "none",
                  borderBottom:   idx < section.rows.length - 1 ? `1px solid ${C.border}` : "none",
                  cursor:         "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: row.color, flexShrink: 0 }} />
                  <span style={{ color: C.text, fontSize: "14px", fontWeight: "500" }}>{row.label}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ color: row.color, fontSize: "16px", fontWeight: "800", fontFamily: "monospace" }}>
                    {row.value.toLocaleString()}
                  </span>
                  <span style={{ color: "#cbd5e1", fontSize: "16px" }}>›</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}

    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      color:         "#94a3b8",
      fontSize:      "10px",
      fontWeight:    "700",
      letterSpacing: "1.2px",
      textTransform: "uppercase",
      margin:        "0 0 10px",
    }}>
      {children}
    </p>
  )
}

function BriefingRow({ item, router }: { item: Briefing; router: any }) {
  const cfg = {
    critical: { dot: "🔴", bg: "rgba(239,68,68,0.07)",  border: "rgba(239,68,68,0.2)",  color: "#ef4444", tag: "URGENT"  },
    decide:   { dot: "🟡", bg: "rgba(245,158,11,0.07)", border: "rgba(245,158,11,0.2)", color: "#f59e0b", tag: "DECIDE"  },
    fyi:      { dot: "🟢", bg: "rgba(16,185,129,0.07)", border: "rgba(16,185,129,0.2)", color: "#10b981", tag: "FYI"     },
  }[item.level]

  return (
    <div style={{
      background:   cfg.bg,
      border:       `1px solid ${cfg.border}`,
      borderRadius: "14px",
      padding:      "12px 14px",
      display:      "flex",
      alignItems:   "center",
      gap:          "10px",
    }}>
      <span style={{ fontSize: "14px", flexShrink: 0 }}>{cfg.dot}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ color: cfg.color, fontSize: "10px", fontWeight: "700", letterSpacing: "0.8px" }}>{cfg.tag}</span>
        <p style={{ color: "#334155", fontSize: "13px", margin: "2px 0 0", lineHeight: 1.4 }}>{item.message}</p>
      </div>
      <button
        onClick={() => router.push(item.href)}
        style={{
          background:   "#0a1628",
          border:       "none",
          borderRadius: "8px",
          padding:      "6px 12px",
          color:        "#fff",
          fontSize:     "11px",
          fontWeight:   "700",
          cursor:       "pointer",
          whiteSpace:   "nowrap",
          flexShrink:   0,
        }}
      >
        {item.action} →
      </button>
    </div>
  )
}

function VitalCard({ vital, router }: { vital: VitalSign; router: any }) {
  const pct = vital.total > 0 ? Math.min(100, Math.round((vital.value / vital.total) * 100)) : 0
  const isKES = !!vital.prefix

  return (
    <button
      onClick={() => router.push(vital.href)}
      style={{
        background:   "#ffffff",
        border:       "1px solid #e2e8f0",
        borderRadius: "18px",
        padding:      "16px 18px",
        width:        "100%",
        textAlign:    "left",
        cursor:       "pointer",
        boxShadow:    "0 1px 4px rgba(0,0,0,0.05)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
        <div>
          <p style={{ color: "#64748b", fontSize: "11px", fontWeight: "600", margin: "0 0 3px", letterSpacing: "0.5px" }}>{vital.label}</p>
          <p style={{ color: "#0f172a", fontSize: "18px", fontWeight: "800", margin: 0, fontFamily: "monospace" }}>
            {isKES
              ? `KES ${vital.value.toLocaleString()}`
              : `${vital.value.toLocaleString()} / ${vital.total.toLocaleString()}`
            }
          </p>
        </div>
        <div style={{
          background:   `${vital.color}18`,
          border:       `1px solid ${vital.color}40`,
          borderRadius: "99px",
          padding:      "4px 10px",
          color:        vital.color,
          fontSize:     "13px",
          fontWeight:   "800",
        }}>
          {pct}%
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ background: "#f1f5f9", borderRadius: "99px", height: "6px", overflow: "hidden" }}>
        <div style={{
          height:       "100%",
          width:        `${pct}%`,
          background:   vital.color,
          borderRadius: "99px",
          transition:   "width 1s ease",
        }} />
      </div>

      {vital.alert && (
        <p style={{ color: vital.color, fontSize: "11px", fontWeight: "600", margin: "8px 0 0" }}>
          ⚠ {vital.alert}
        </p>
      )}
    </button>
  )
}
