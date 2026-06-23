"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

const dark   = "#0a1628"
const accent = "#10b981"
const bg     = "#f0f2f5"
const red    = "#ef4444"
const amber  = "#f59e0b"
const violet = "#8b5cf6"

interface StaffMember {
  id:              string
  full_name:       string
  phone:           string | null
  email:           string | null
  staff_number:    string | null
  category:        string
  employment_type: string
  designation:     string | null
  department:      string | null
  subject:         string | null
  status:          string
  date_joined:     string | null
  contract_end:    string | null
  gender:          string | null
}

interface LeaveRequest {
  id:             string
  staff_id:       string
  leave_type:     string
  start_date:     string
  end_date:       string
  days_requested: number
  reason:         string | null
  status:         string
  staff:          { full_name: string; designation: string | null }
}

function categoryColor(c: string) {
  if (c === "teaching")       return accent
  if (c === "administrative") return violet
  if (c === "subordinate")    return amber
  return "#6b7280"
}

function categoryLabel(c: string) {
  if (c === "teaching")       return "Teaching"
  if (c === "administrative") return "Admin"
  if (c === "subordinate")    return "Subordinate"
  if (c === "support")        return "Support"
  return c
}

function employmentLabel(e: string) {
  if (e === "permanent") return "Permanent"
  if (e === "contract")  return "Contract"
  if (e === "part_time") return "Part-time"
  if (e === "casual")    return "Casual"
  if (e === "volunteer") return "Volunteer"
  return e
}

function statusColor(s: string) {
  if (s === "active")     return accent
  if (s === "on_leave")   return amber
  if (s === "suspended")  return red
  if (s === "terminated") return "#6b7280"
  return "#6b7280"
}

function leaveTypeLabel(t: string) {
  if (t === "annual")    return "Annual Leave"
  if (t === "sick")      return "Sick Leave"
  if (t === "maternity") return "Maternity"
  if (t === "paternity") return "Paternity"
  if (t === "emergency") return "Emergency"
  if (t === "unpaid")    return "Unpaid Leave"
  return t
}

function avatarGradient(c: string) {
  if (c === "teaching")       return "linear-gradient(135deg,#10b981,#059669)"
  if (c === "administrative") return "linear-gradient(135deg,#8b5cf6,#6d28d9)"
  if (c === "subordinate")    return "linear-gradient(135deg,#f59e0b,#d97706)"
  return "linear-gradient(135deg,#6b7280,#4b5563)"
}

function Toast({ msg }: { msg: string }) {
  if (!msg) return null
  return (
    <div style={{
      position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)",
      background: "#f0f4f8", color: "#111827", padding: "12px 24px", borderRadius: 40,
      fontSize: 13, fontWeight: 700, zIndex: 9999, whiteSpace: "nowrap",
      boxShadow: "0 4px 24px rgba(0,0,0,0.25)", animation: "fadeIn 0.2s ease",
    }}>{msg}</div>
  )
}

const SUBJECTS = [
  "Mathematics","English","Kiswahili","Biology","Chemistry",
  "Physics","History","Geography","CRE","IRE","Business Studies",
  "Agriculture","Computer Studies","Art & Design","Music","French",
]

function Shimmer() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 16px" }}>
      {[1,2,3,4].map(i => (
        <div key={i} style={{ background: "#fff", borderRadius: 16, padding: 18, border: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(90deg,#e5e7eb 25%,#d1d5db 50%,#e5e7eb 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite", flexShrink: 0 }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ height: 14, borderRadius: 6, background: "linear-gradient(90deg,#e5e7eb 25%,#d1d5db 50%,#e5e7eb 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite", width: "60%" }} />
              <div style={{ height: 11, borderRadius: 6, background: "linear-gradient(90deg,#e5e7eb 25%,#d1d5db 50%,#e5e7eb 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite", width: "40%" }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function StaffPage() {
  const router = useRouter()

  const [schoolId,    setSchoolId]    = useState("")
  const [adminId,     setAdminId]     = useState("")
  const [loading,     setLoading]     = useState(true)
  const [staff,       setStaff]       = useState<StaffMember[]>([])
  const [leaves,      setLeaves]      = useState<LeaveRequest[]>([])
  const [search,      setSearch]      = useState("")
  const [catFilter,   setCatFilter]   = useState("all")
  const [toast,       setToast]       = useState("")
  const [showAdd,     setShowAdd]     = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [leaveOpen,   setLeaveOpen]   = useState(false)
  const [expandedId,  setExpandedId]  = useState<string | null>(null)
  const [formStep,    setFormStep]    = useState(0)
  const [otherSubject, setOtherSubject] = useState(false)

  const [form, setForm] = useState({
    full_name: "", phone: "", email: "", staff_number: "", national_id: "",
    tsc_number: "", category: "teaching", employment_type: "permanent",
    designation: "", department: "", subject: "", gender: "",
    date_of_birth: "", date_joined: "", contract_start: "", contract_end: "",
    salary_grade: "", next_of_kin_name: "", next_of_kin_phone: "", next_of_kin_relation: "",
  })

  const fireToast = useCallback((msg: string) => {
    setToast(msg); setTimeout(() => setToast(""), 3000)
  }, [])

  useEffect(() => { bootstrap() }, [bootstrap])

  const bootstrap = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/admin/login"); return }
      setAdminId(user.id)
      const { data: p } = await supabase.from("profiles").select("school_id").eq("id", user.id).single()
      if (!p?.school_id) { router.push("/admin/login"); return }
      setSchoolId(p.school_id)
      await loadAll(p.school_id)
    } catch { router.push("/admin/login") }
    finally { setLoading(false) }
  }, [fireToast, router])

  async function loadAll(sid: string) {
    const [staffRes, leaveRes] = await Promise.all([
      supabase.from("staff")
        .select("id,full_name,phone,email,staff_number,category,employment_type,designation,department,subject,status,date_joined,contract_end,gender")
        .eq("school_id", sid).is("deleted_at", null).order("full_name"),
      // FIX #1: FK join hint staff:staff_id(...) so Supabase resolves the relation unambiguously
      // FIX #4: removed .is("deleted_at", null) — staff_leave table not confirmed to have this column
      supabase.from("staff_leave")
        .select("id,staff_id,leave_type,start_date,end_date,days_requested,reason,status,staff:staff_id(full_name,designation)")
        .eq("school_id", sid).eq("status", "pending").order("created_at"),
    ])
    setStaff((staffRes.data ?? []) as StaffMember[])
    setLeaves((leaveRes.data ?? []) as unknown as LeaveRequest[])
  }

  async function handleApprove(leaveId: string, approve: boolean) {
    setApprovingId(leaveId)
    const { error } = await supabase.from("staff_leave").update({
      status: approve ? "approved" : "rejected",
      approved_by: adminId, approved_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", leaveId)
    if (error) { fireToast("Something went wrong."); setApprovingId(null); return }
    if (approve) {
      const leave = leaves.find(l => l.id === leaveId)
      // FIX #3: added .eq("school_id", schoolId) — required on every update per DB rules
      if (leave) await supabase.from("staff").update({ status: "on_leave", updated_at: new Date().toISOString() }).eq("id", leave.staff_id).eq("school_id", schoolId)
    }
    fireToast(approve ? "Leave approved." : "Leave rejected.")
    setApprovingId(null)
    await loadAll(schoolId)
  }

  async function handleAddStaff() {
    if (!form.full_name.trim()) { fireToast("Full name is required."); return }
    setSaving(true)
    const { error } = await supabase.from("staff").insert({
      school_id: schoolId,
      full_name: form.full_name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      staff_number: form.staff_number.trim() || null,
      national_id: form.national_id.trim() || null,
      tsc_number: form.tsc_number.trim() || null,
      category: form.category,
      employment_type: form.employment_type,
      designation: form.designation.trim() || null,
      department: form.department.trim() || null,
      subject: form.subject.trim() || null,
      gender: form.gender || null,
      date_of_birth: form.date_of_birth || null,
      date_joined: form.date_joined || null,
      contract_start: form.contract_start || null,
      contract_end: form.contract_end || null,
      salary_grade: form.salary_grade.trim() || null,
      next_of_kin_name: form.next_of_kin_name.trim() || null,
      next_of_kin_phone: form.next_of_kin_phone.trim() || null,
      next_of_kin_relation: form.next_of_kin_relation.trim() || null,
      status: "active", created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    })
    setSaving(false)
    if (error) { fireToast("Something went wrong."); return }
    fireToast("Staff member added.")
    setShowAdd(false)
    setFormStep(0)
    setOtherSubject(false)
    setForm({ full_name: "", phone: "", email: "", staff_number: "", national_id: "", tsc_number: "", category: "teaching", employment_type: "permanent", designation: "", department: "", subject: "", gender: "", date_of_birth: "", date_joined: "", contract_start: "", contract_end: "", salary_grade: "", next_of_kin_name: "", next_of_kin_phone: "", next_of_kin_relation: "" })
    await loadAll(schoolId)
  }

  const filtered = staff.filter(s => {
    const matchSearch = s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (s.designation ?? "").toLowerCase().includes(search.toLowerCase())
    const matchCat = catFilter === "all" || s.category === catFilter
    return matchSearch && matchCat
  })

  const active  = staff.filter(s => s.status === "active").length
  const onLeave = staff.filter(s => s.status === "on_leave").length

  const inp: React.CSSProperties = {
    width: "100%", borderRadius: 10, border: "1.5px solid #e5e7eb",
    padding: "11px 14px", fontSize: 14, color: dark,
    fontFamily: "inherit", outline: "none", background: "#fafafa",
    boxSizing: "border-box", marginBottom: 14,
  }
  const sel: React.CSSProperties = { ...inp, cursor: "pointer" }
  const lbl: React.CSSProperties = {
    fontSize: 11, color: "#9ca3af", fontWeight: 700,
    textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 5, display: "block",
  }

  const steps = ["Personal", "Employment", "Next of Kin"]

  return (
    <div style={{ background: bg, minHeight: "100vh", paddingBottom: 100 }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{transform:translateY(60px);opacity:0} to{transform:translateY(0);opacity:1} }
        * { box-sizing: border-box; }
        input::placeholder { color: #9ca3af; }
      `}</style>

      {/* HERO HEADER */}
      <div style={{
        background: `linear-gradient(135deg, ${dark} 0%, #0d2347 100%)`,
        padding: "28px 20px 32px", position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -30, right: -30, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
        <div style={{ position: "absolute", bottom: -20, right: 40, width: 80, height: 80, borderRadius: "50%", background: "rgba(16,185,129,0.12)" }} />

        <div style={{ position: "relative" }}>
          {/* FIX #5: text colors corrected — was #111827 (black) on dark gradient, now white/muted */}
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", fontWeight: 600, marginBottom: 4, letterSpacing: 0.5 }}>HUMAN RESOURCES</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#ffffff", letterSpacing: -0.5, marginBottom: 6 }}>Staff</div>
          <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: accent }} />
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>{active} Active</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: amber }} />
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>{onLeave} On Leave</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#9ca3af" }} />
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>{staff.length} Total</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 16px" }}>

        {/* SEARCH */}
        <div style={{ marginTop: -18, marginBottom: 16, position: "relative" }}>
          <div style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", fontSize: 16, pointerEvents: "none" }}>🔍</div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or role..."
            style={{
              width: "100%", borderRadius: 14, border: "none",
              padding: "15px 16px 15px 44px", fontSize: 14, color: dark,
              fontFamily: "inherit", outline: "none", background: "#fff",
              boxShadow: "0 4px 20px rgba(0,0,0,0.10)",
            }}
          />
        </div>

        {/* LEAVE ALERT */}
        {leaves.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 14, marginBottom: 14, border: "1px solid #fde68a", overflow: "hidden", boxShadow: "0 2px 8px rgba(245,158,11,0.10)" }}>
            <div
              onClick={() => setLeaveOpen(o => !o)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: amber + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🏖️</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: dark }}>Leave Requests</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>{leaves.length} pending approval</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ background: amber, color: "#111827", fontSize: 12, fontWeight: 800, padding: "3px 10px", borderRadius: 20 }}>{leaves.length}</div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>{leaveOpen ? "▲" : "▼"}</div>
              </div>
            </div>
            {leaveOpen && (
              <div style={{ borderTop: "1px solid #fde68a", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                {leaves.map(l => (
                  <div key={l.id} style={{ background: bg, borderRadius: 12, padding: "14px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: dark }}>{l.staff?.full_name}</div>
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>{l.staff?.designation ?? "Staff"}</div>
                      </div>
                      <div style={{ background: amber + "25", color: amber, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
                        {leaveTypeLabel(l.leave_type)}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>
                      {l.start_date} → {l.end_date} · {l.days_requested} day{l.days_requested > 1 ? "s" : ""}
                    </div>
                    {l.reason && <div style={{ fontSize: 12, color: "#9ca3af", fontStyle: "italic", marginBottom: 10 }}>"{l.reason}"</div>}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => handleApprove(l.id, true)}
                        disabled={approvingId === l.id}
                        style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: approvingId === l.id ? "#d1d5db" : accent, color: "#111827", fontWeight: 700, fontSize: 13, cursor: approvingId === l.id ? "not-allowed" : "pointer", fontFamily: "inherit" }}
                      >
                        {approvingId === l.id ? "..." : "Approve"}
                      </button>
                      <button
                        onClick={() => handleApprove(l.id, false)}
                        disabled={approvingId === l.id}
                        style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1.5px solid #e5e7eb", background: "#fff", color: red, fontWeight: 700, fontSize: 13, cursor: approvingId === l.id ? "not-allowed" : "pointer", fontFamily: "inherit" }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
          </div>
        )}

        {/* CATEGORY PILLS */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
          {[
            { key: "all",            label: "All Staff" },
            { key: "teaching",       label: "Teaching"  },
            { key: "administrative", label: "Admin"     },
            { key: "subordinate",    label: "Support"   },
          ].map(c => (
            <button
              key={c.key}
              onClick={() => setCatFilter(c.key)}
              style={{
                flexShrink: 0, padding: "8px 18px", borderRadius: 22,
                border: catFilter === c.key ? "none" : "1.5px solid #e5e7eb",
                background: catFilter === c.key ? dark : "#fff",
                color: catFilter === c.key ? "#fff" : "#6b7280",
                fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                boxShadow: catFilter === c.key ? "0 2px 8px rgba(30,27,75,0.20)" : "none",
              }}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* STAFF LIST */}
        {loading ? <Shimmer /> : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 24px" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: dark, marginBottom: 6 }}>
              {staff.length === 0 ? "No staff yet" : "No results"}
            </div>
            <div style={{ fontSize: 13, color: "#9ca3af" }}>
              {staff.length === 0 ? "Tap + to add your first staff member" : "Try a different search or filter"}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map(s => {
              const isExpanded = expandedId === s.id
              return (
                <div
                  key={s.id}
                  onClick={() => setExpandedId(isExpanded ? null : s.id)}
                  style={{
                    background: "#fff", borderRadius: 16, overflow: "hidden",
                    border: "1px solid #e5e7eb",
                    boxShadow: isExpanded ? "0 4px 20px rgba(0,0,0,0.10)" : "0 1px 4px rgba(0,0,0,0.05)",
                    cursor: "pointer", animation: "fadeIn 0.2s ease",
                    borderLeft: `4px solid ${categoryColor(s.category)}`,
                  }}
                >
                  <div style={{ padding: "16px 16px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <div style={{
                          width: 48, height: 48, borderRadius: 14,
                          background: avatarGradient(s.category),
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 20, fontWeight: 900, color: "#ffffff", flexShrink: 0,
                          boxShadow: `0 4px 12px ${categoryColor(s.category)}40`,
                        }}>
                          {s.full_name[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: dark, letterSpacing: -0.2 }}>{s.full_name}</div>
                          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{s.designation ?? categoryLabel(s.category)}</div>
                          {s.subject && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{s.subject}</div>}
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                        <div style={{
                          fontSize: 11, fontWeight: 700,
                          color: statusColor(s.status),
                          background: statusColor(s.status) + "18",
                          padding: "4px 10px", borderRadius: 20,
                        }}>
                          {s.status.replace("_", " ")}
                        </div>
                        <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600 }}>
                          {employmentLabel(s.employment_type)}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{
                        fontSize: 11, fontWeight: 700,
                        color: categoryColor(s.category),
                        background: categoryColor(s.category) + "15",
                        padding: "3px 10px", borderRadius: 20,
                      }}>
                        {categoryLabel(s.category)}
                      </div>
                      {s.phone && (
                        
                          <a
                          href={`tel:${s.phone}`}
                          onClick={e => e.stopPropagation()}
                          style={{ fontSize: 12, color: accent, fontWeight: 600, textDecoration: "none" }}
                        >
                          📞 {s.phone}
                        </a>
                      )}
                      {s.department && (
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>{s.department}</div>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ borderTop: "1px solid #f3f4f6", padding: "14px 16px", background: "#fafafa", display: "flex", flexDirection: "column", gap: 8 }}>
                      {s.staff_number && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600 }}>Staff No.</span>
                          <span style={{ fontSize: 12, color: dark, fontWeight: 700 }}>{s.staff_number}</span>
                        </div>
                      )}
                      {s.email && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600 }}>Email</span>
                          <span style={{ fontSize: 12, color: dark, fontWeight: 700 }}>{s.email}</span>
                        </div>
                      )}
                      {s.date_joined && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600 }}>Joined</span>
                          <span style={{ fontSize: 12, color: dark, fontWeight: 700 }}>{s.date_joined}</span>
                        </div>
                      )}
                      {s.contract_end && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600 }}>Contract Ends</span>
                          <span style={{ fontSize: 12, color: red, fontWeight: 700 }}>{s.contract_end}</span>
                        </div>
                      )}
                      {s.gender && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600 }}>Gender</span>
                          <span style={{ fontSize: 12, color: dark, fontWeight: 700, textTransform: "capitalize" }}>{s.gender}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* FLOATING ADD BUTTON */}
      <button
        onClick={() => { setShowAdd(true); setFormStep(0); setOtherSubject(false) }}
        style={{
          position: "fixed", bottom: 28, right: 24, width: 58, height: 58,
          borderRadius: "50%", border: "none",
          background: `linear-gradient(135deg, ${accent}, #059669)`,
          color: "#111827", fontSize: 26, fontWeight: 900,
          cursor: "pointer", zIndex: 800,
          boxShadow: "0 6px 24px rgba(16,185,129,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        +
      </button>

      {/* ADD STAFF BOTTOM SHEET */}
      {showAdd && (
        <div
          onClick={() => setShowAdd(false)}
          style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: "24px 24px 0 0", padding: "24px 20px 48px", width: "100%", maxWidth: 640, maxHeight: "92vh", overflowY: "auto", animation: "slideUp 0.25s ease" }}
          >
            <div style={{ width: 40, height: 4, background: "#e5e7eb", borderRadius: 4, margin: "0 auto 20px" }} />

            <div style={{ fontSize: 20, fontWeight: 900, color: dark, marginBottom: 4 }}>Add Staff Member</div>
            <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 20 }}>Step {formStep + 1} of {steps.length} — {steps[formStep]}</div>

            <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
              {steps.map((_, i) => (
                <div key={i} style={{ flex: 1, height: 4, borderRadius: 4, background: i <= formStep ? accent : "#e5e7eb", transition: "background 0.3s" }} />
              ))}
            </div>

            {/* Step 0 — Personal */}
            {formStep === 0 && (
              <div>
                <span style={lbl}>Full Name *</span>
                <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="e.g. Jane Wanjiku" style={inp} />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <span style={lbl}>Gender</span>
                    <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))} style={sel}>
                      <option value="">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <span style={lbl}>Date of Birth</span>
                    <input type="date" value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} style={inp} />
                  </div>
                </div>

                <span style={lbl}>Phone</span>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="0712 345 678" style={inp} />

                <span style={lbl}>Email</span>
                <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@school.ac.ke" style={inp} />

                <span style={lbl}>National ID</span>
                <input value={form.national_id} onChange={e => setForm(f => ({ ...f, national_id: e.target.value }))} placeholder="ID Number" style={inp} />
              </div>
            )}

            {/* Step 1 — Employment */}
            {formStep === 1 && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <span style={lbl}>Category *</span>
                    <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={sel}>
                      <option value="teaching">Teaching</option>
                      <option value="administrative">Administrative</option>
                      <option value="subordinate">Subordinate</option>
                      <option value="support">Support</option>
                    </select>
                  </div>
                  <div>
                    <span style={lbl}>Employment Type</span>
                    <select value={form.employment_type} onChange={e => setForm(f => ({ ...f, employment_type: e.target.value }))} style={sel}>
                      <option value="permanent">Permanent</option>
                      <option value="contract">Contract</option>
                      <option value="part_time">Part-time</option>
                      <option value="casual">Casual</option>
                      <option value="volunteer">Volunteer</option>
                    </select>
                  </div>
                </div>

                <span style={lbl}>Designation / Title</span>
                <input value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} placeholder="e.g. Class Teacher, Secretary" style={inp} />

                <span style={lbl}>Department</span>
                <input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="e.g. Sciences, Administration" style={inp} />

                {form.category === "teaching" && (
                  <>
                    <span style={lbl}>Subject Taught</span>
                    <select
                      value={otherSubject ? "Other" : form.subject}
                      onChange={e => {
                        const v = e.target.value
                        if (v === "Other") { setOtherSubject(true); setForm(f => ({ ...f, subject: "" })) }
                        else { setOtherSubject(false); setForm(f => ({ ...f, subject: v })) }
                      }}
                      style={sel}
                    >
                      <option value="">Select subject</option>
                      {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                      <option value="Other">Other</option>
                    </select>
                    {otherSubject && (
                      <input
                        value={form.subject}
                        onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                        placeholder="Enter subject name"
                        style={inp}
                      />
                    )}
                    <span style={lbl}>TSC Number</span>
                    <input value={form.tsc_number} onChange={e => setForm(f => ({ ...f, tsc_number: e.target.value }))} placeholder="TSC Number" style={inp} />
                  </>
                )}

                <span style={lbl}>Staff Number</span>
                <input value={form.staff_number} onChange={e => setForm(f => ({ ...f, staff_number: e.target.value }))} placeholder="e.g. STF001" style={inp} />

                <span style={lbl}>Salary Grade</span>
                <input value={form.salary_grade} onChange={e => setForm(f => ({ ...f, salary_grade: e.target.value }))} placeholder="e.g. B5, C2" style={inp} />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <span style={lbl}>Date Joined</span>
                    <input type="date" value={form.date_joined} onChange={e => setForm(f => ({ ...f, date_joined: e.target.value }))} style={inp} />
                  </div>
                  <div>
                    <span style={lbl}>Contract Start</span>
                    <input type="date" value={form.contract_start} onChange={e => setForm(f => ({ ...f, contract_start: e.target.value }))} style={inp} />
                  </div>
                </div>

                <span style={lbl}>Contract End Date</span>
                <input type="date" value={form.contract_end} onChange={e => setForm(f => ({ ...f, contract_end: e.target.value }))} style={inp} />
              </div>
            )}

            {/* Step 2 — Next of Kin */}
            {formStep === 2 && (
              <div>
                <span style={lbl}>Full Name</span>
                <input value={form.next_of_kin_name} onChange={e => setForm(f => ({ ...f, next_of_kin_name: e.target.value }))} placeholder="e.g. John Kamau" style={inp} />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <span style={lbl}>Phone</span>
                    <input value={form.next_of_kin_phone} onChange={e => setForm(f => ({ ...f, next_of_kin_phone: e.target.value }))} placeholder="0712 000 000" style={inp} />
                  </div>
                  <div>
                    <span style={lbl}>Relation</span>
                    <input value={form.next_of_kin_relation} onChange={e => setForm(f => ({ ...f, next_of_kin_relation: e.target.value }))} placeholder="e.g. Spouse" style={inp} />
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              {formStep > 0 && (
                <button
                  onClick={() => setFormStep(s => s - 1)}
                  style={{ flex: 1, padding: 14, borderRadius: 12, border: "1.5px solid #e5e7eb", background: "#fff", color: dark, fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}
                >
                  Back
                </button>
              )}
              {formStep < steps.length - 1 ? (
                <button
                  onClick={() => {
                    if (formStep === 0 && !form.full_name.trim()) { fireToast("Full name is required."); return }
                    setFormStep(s => s + 1)
                  }}
                  style={{ flex: 1, padding: 14, borderRadius: 12, border: "none", background: "#f0f4f8", color: "#111827", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleAddStaff}
                  disabled={saving}
                  style={{ flex: 1, padding: 14, borderRadius: 12, border: "none", background: saving ? "#d1d5db" : accent, color: "#111827", fontWeight: 800, fontSize: 15, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: saving ? "none" : "0 4px 14px rgba(16,185,129,0.35)" }}
                >
                  {saving ? "Adding..." : "Add Staff Member"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <Toast msg={toast} />
    </div>
  )
}
