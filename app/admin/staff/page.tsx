"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

const accent  = "#10b981"
const dark    = "#1e1b4b"
const amber   = "#f59e0b"
const red     = "#ef4444"
const violet  = "#8b5cf6"
const bg      = "#f0f2f5"

// ─── Types ────────────────────────────────────────────────────────────────────
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
  id:            string
  staff_id:      string
  leave_type:    string
  start_date:    string
  end_date:      string
  days_requested: number
  reason:        string | null
  status:        string
  staff:         { full_name: string; designation: string | null }
}

interface Stats {
  total:    number
  active:   number
  onLeave:  number
  pending:  number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
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
  if (e === "permanent")  return "Permanent"
  if (e === "contract")   return "Contract"
  if (e === "part_time")  return "Part-time"
  if (e === "casual")     return "Casual"
  if (e === "volunteer")  return "Volunteer"
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

function isContractExpiringSoon(end: string | null): boolean {
  if (!end) return false
  const days = (new Date(end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  return days >= 0 && days <= 30
}

// ─── Shimmer ──────────────────────────────────────────────────────────────────
function Shimmer({ w = "100%", h = 16, r = 8 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "linear-gradient(90deg,#e5e7eb 25%,#d1d5db 50%,#e5e7eb 75%)",
      backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite",
    }} />
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg }: { msg: string }) {
  if (!msg) return null
  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      background: dark, color: "#fff", padding: "12px 24px", borderRadius: 40,
      fontSize: 13, fontWeight: 700, zIndex: 9999, whiteSpace: "nowrap",
      boxShadow: "0 4px 24px rgba(0,0,0,0.18)", animation: "fadeIn 0.2s ease",
    }}>{msg}</div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function StaffPage() {
  const router = useRouter()

  const [schoolId,  setSchoolId]  = useState("")
  const [adminId,   setAdminId]   = useState("")
  const [loading,   setLoading]   = useState(true)
  const [staff,     setStaff]     = useState<StaffMember[]>([])
  const [leaves,    setLeaves]    = useState<LeaveRequest[]>([])
  const [stats,     setStats]     = useState<Stats>({ total: 0, active: 0, onLeave: 0, pending: 0 })
  const [search,    setSearch]    = useState("")
  const [catFilter, setCatFilter] = useState("all")
  const [toast,     setToast]     = useState("")
  const [showAdd,   setShowAdd]   = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  const [form, setForm] = useState({
    full_name:       "",
    phone:           "",
    email:           "",
    staff_number:    "",
    national_id:     "",
    tsc_number:      "",
    category:        "teaching",
    employment_type: "permanent",
    designation:     "",
    department:      "",
    subject:         "",
    gender:          "",
    date_of_birth:   "",
    date_joined:     "",
    contract_start:  "",
    contract_end:    "",
    salary_grade:    "",
    next_of_kin_name:     "",
    next_of_kin_phone:    "",
    next_of_kin_relation: "",
  })

  const fireToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(""), 3000)
  }, [])

  useEffect(() => { bootstrap() }, [])

  async function bootstrap() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/admin/login"); return }
      setAdminId(user.id)

      const { data: p } = await supabase
        .from("profiles")
        .select("school_id")
        .eq("id", user.id)
        .single()

      if (!p?.school_id) { router.push("/admin/login"); return }
      setSchoolId(p.school_id)
      await loadAll(p.school_id)
    } catch {
      router.push("/admin/login")
    } finally {
      setLoading(false)
    }
  }

  async function loadAll(sid: string) {
    const [staffRes, leaveRes] = await Promise.all([
      supabase
        .from("staff")
        .select("id,full_name,phone,email,staff_number,category,employment_type,designation,department,subject,status,date_joined,contract_end,gender")
        .eq("school_id", sid)
        .is("deleted_at", null)
        .order("full_name"),
      supabase
        .from("staff_leave")
        .select("id,staff_id,leave_type,start_date,end_date,days_requested,reason,status,staff(full_name,designation)")
        .eq("school_id", sid)
        .eq("status", "pending")
        .is("deleted_at", null)
        .order("created_at"),
    ])

    const staffList  = (staffRes.data  ?? []) as StaffMember[]
    const leaveList  = (leaveRes.data  ?? []) as unknown as LeaveRequest[]

    setStaff(staffList)
    setLeaves(leaveList)
    setStats({
      total:   staffList.length,
      active:  staffList.filter(s => s.status === "active").length,
      onLeave: staffList.filter(s => s.status === "on_leave").length,
      pending: leaveList.length,
    })
  }

  async function handleApprove(leaveId: string, approve: boolean) {
    setApprovingId(leaveId)
    const { error } = await supabase
      .from("staff_leave")
      .update({
        status:      approve ? "approved" : "rejected",
        approved_by: adminId,
        approved_at: new Date().toISOString(),
        updated_at:  new Date().toISOString(),
      })
      .eq("id", leaveId)

    if (error) { fireToast("Something went wrong — try again."); setApprovingId(null); return }

    if (approve) {
      const leave = leaves.find(l => l.id === leaveId)
      if (leave) {
        await supabase
          .from("staff")
          .update({ status: "on_leave", updated_at: new Date().toISOString() })
          .eq("id", leave.staff_id)
      }
    }

    fireToast(approve ? "Leave approved." : "Leave rejected.")
    setApprovingId(null)
    await loadAll(schoolId)
  }

  async function handleAddStaff() {
    if (!form.full_name.trim()) { fireToast("Full name is required."); return }
    if (!form.category)         { fireToast("Category is required."); return }
    setSaving(true)

    const { error } = await supabase.from("staff").insert({
      school_id:            schoolId,
      full_name:            form.full_name.trim(),
      phone:                form.phone.trim()           || null,
      email:                form.email.trim()           || null,
      staff_number:         form.staff_number.trim()    || null,
      national_id:          form.national_id.trim()     || null,
      tsc_number:           form.tsc_number.trim()      || null,
      category:             form.category,
      employment_type:      form.employment_type,
      designation:          form.designation.trim()     || null,
      department:           form.department.trim()      || null,
      subject:              form.subject.trim()         || null,
      gender:               form.gender                 || null,
      date_of_birth:        form.date_of_birth          || null,
      date_joined:          form.date_joined            || null,
      contract_start:       form.contract_start         || null,
      contract_end:         form.contract_end           || null,
      salary_grade:         form.salary_grade.trim()    || null,
      next_of_kin_name:     form.next_of_kin_name.trim()     || null,
      next_of_kin_phone:    form.next_of_kin_phone.trim()    || null,
      next_of_kin_relation: form.next_of_kin_relation.trim() || null,
      status:               "active",
      created_at:           new Date().toISOString(),
      updated_at:           new Date().toISOString(),
    })

    setSaving(false)
    if (error) { fireToast("Something went wrong — try again."); return }

    fireToast("Staff member added.")
    setShowAdd(false)
    setForm({
      full_name: "", phone: "", email: "", staff_number: "", national_id: "",
      tsc_number: "", category: "teaching", employment_type: "permanent",
      designation: "", department: "", subject: "", gender: "",
      date_of_birth: "", date_joined: "", contract_start: "", contract_end: "",
      salary_grade: "", next_of_kin_name: "", next_of_kin_phone: "", next_of_kin_relation: "",
    })
    await loadAll(schoolId)
  }

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = staff.filter(s => {
    const matchSearch = s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (s.designation ?? "").toLowerCase().includes(search.toLowerCase())
    const matchCat = catFilter === "all" || s.category === catFilter
    return matchSearch && matchCat
  })

  // ── Input style ────────────────────────────────────────────────────────────
  const inp: React.CSSProperties = {
    width: "100%", borderRadius: 10, border: "1.5px solid #e5e7eb",
    padding: "10px 12px", fontSize: 13, color: dark,
    fontFamily: "inherit", outline: "none", background: "#fff",
    boxSizing: "border-box", marginBottom: 12,
  }

  const sel: React.CSSProperties = { ...inp, cursor: "pointer" }

  const label: React.CSSProperties = {
    fontSize: 11, color: "#9ca3af", fontWeight: 700,
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, display: "block",
  }

  if (loading) return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      {[1,2,3,4].map(i => <Shimmer key={i} h={72} r={16} />)}
    </div>
  )

  return (
    <div style={{ background: bg, minHeight: "100vh", padding: "0 0 80px" }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{transform:translateY(40px);opacity:0} to{transform:translateY(0);opacity:1} }
        * { box-sizing: border-box; }
      `}</style>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "20px 16px" }}>

        {/* ── HEADER ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: dark, letterSpacing: -0.5 }}>Staff</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>Human Resources</div>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            style={{ padding: "10px 20px", borderRadius: 12, border: "none", background: accent, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 14px rgba(16,185,129,0.35)" }}
          >
            + Add Staff
          </button>
        </div>

        {/* ── STATS ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Total",    value: stats.total,   color: dark   },
            { label: "Active",   value: stats.active,  color: accent },
            { label: "On Leave", value: stats.onLeave, color: amber  },
            { label: "Pending",  value: stats.pending, color: red    },
          ].map(s => (
            <div key={s.label} style={{ background: "#fff", borderRadius: 14, padding: "14px 12px", textAlign: "center", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: s.color, fontFamily: "monospace" }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── PENDING LEAVE REQUESTS ── */}
        {leaves.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 18, marginBottom: 16, border: "1px solid #e5e7eb", borderLeft: `4px solid ${amber}`, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: dark, marginBottom: 14 }}>
              🏖️ Leave Requests — {leaves.length} pending
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {leaves.map(l => (
                <div key={l.id} style={{ background: bg, borderRadius: 12, padding: "14px 16px", border: "1px solid #e5e7eb" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: dark }}>{l.staff?.full_name}</div>
                      <div style={{ fontSize: 11, color: "#9ca3af" }}>{l.staff?.designation ?? "Staff"}</div>
                    </div>
                    <div style={{ background: amber + "20", color: amber, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
                      {leaveTypeLabel(l.leave_type)}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
                    📅 {l.start_date} → {l.end_date} &nbsp;·&nbsp; {l.days_requested} day{l.days_requested > 1 ? "s" : ""}
                  </div>
                  {l.reason && (
                    <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10, fontStyle: "italic" }}>
                      "{l.reason}"
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => handleApprove(l.id, true)}
                      disabled={approvingId === l.id}
                      style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "none", background: approvingId === l.id ? "#d1d5db" : accent, color: "#fff", fontWeight: 700, fontSize: 13, cursor: approvingId === l.id ? "not-allowed" : "pointer", fontFamily: "inherit" }}
                    >
                      {approvingId === l.id ? "..." : "Approve"}
                    </button>
                    <button
                      onClick={() => handleApprove(l.id, false)}
                      disabled={approvingId === l.id}
                      style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "1.5px solid #e5e7eb", background: "#fff", color: red, fontWeight: 700, fontSize: 13, cursor: approvingId === l.id ? "not-allowed" : "pointer", fontFamily: "inherit" }}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CONTRACT EXPIRY ALERTS ── */}
        {staff.filter(s => isContractExpiringSoon(s.contract_end)).length > 0 && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 18, marginBottom: 16, border: "1px solid #e5e7eb", borderLeft: `4px solid ${red}`, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: dark, marginBottom: 12 }}>
              ⚠️ Contracts Expiring Soon
            </div>
            {staff.filter(s => isContractExpiringSoon(s.contract_end)).map(s => (
              <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: dark }}>{s.full_name}</div>
                <div style={{ fontSize: 12, color: red, fontWeight: 700 }}>Ends {s.contract_end}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── SEARCH + FILTER ── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search staff..."
            style={{ flex: 1, borderRadius: 10, border: "1.5px solid #e5e7eb", padding: "10px 14px", fontSize: 13, color: dark, fontFamily: "inherit", outline: "none", background: "#fff" }}
          />
        </div>

        {/* Category pills */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 2 }}>
          {["all","teaching","administrative","subordinate","support"].map(c => (
            <button
              key={c}
              onClick={() => setCatFilter(c)}
              style={{ flexShrink: 0, padding: "7px 16px", borderRadius: 20, border: "1.5px solid", borderColor: catFilter === c ? dark : "#e5e7eb", background: catFilter === c ? dark : "#fff", color: catFilter === c ? "#fff" : "#6b7280", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" }}
            >
              {c === "all" ? "All Staff" : categoryLabel(c)}
            </button>
          ))}
        </div>

        {/* ── STAFF LIST ── */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 24px", color: "#9ca3af", fontSize: 14 }}>
            {staff.length === 0 ? "No staff added yet. Add your first staff member." : "No staff match your search."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map(s => (
              <div key={s.id} style={{ background: "#fff", borderRadius: 16, padding: "16px 18px", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", animation: "fadeIn 0.2s ease" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: categoryColor(s.category) + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900, color: categoryColor(s.category), flexShrink: 0 }}>
                      {s.full_name[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: dark }}>{s.full_name}</div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 1 }}>{s.designation ?? categoryLabel(s.category)}</div>
                      {s.subject && <div style={{ fontSize: 11, color: "#9ca3af" }}>{s.subject}</div>}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: statusColor(s.status), background: statusColor(s.status) + "18", padding: "3px 10px", borderRadius: 20 }}>
                      {s.status.replace("_"," ")}
                    </div>
                    <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600 }}>
                      {employmentLabel(s.employment_type)}
                    </div>
                  </div>
                </div>

                {/* Bottom row */}
                <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 11, color: categoryColor(s.category), background: categoryColor(s.category) + "15", padding: "3px 10px", borderRadius: 20, fontWeight: 700 }}>
                    {categoryLabel(s.category)}
                  </div>
                  {s.phone && (
                    <a href={`tel:${s.phone}`} style={{ fontSize: 11, color: accent, fontWeight: 600, textDecoration: "none" }}>📞 {s.phone}</a>
                  )}
                  {s.contract_end && isContractExpiringSoon(s.contract_end) && (
                    <div style={{ fontSize: 11, color: red, fontWeight: 700 }}>⚠️ Contract ends {s.contract_end}</div>
                  )}
                  {s.date_joined && (
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>Joined {s.date_joined}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── ADD STAFF MODAL ── */}
      {showAdd && (
        <div
          onClick={() => setShowAdd(false)}
          style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: "28px 24px 48px", width: "100%", maxWidth: 640, maxHeight: "90vh", overflowY: "auto", animation: "slideUp 0.22s ease" }}
          >
            <div style={{ width: 40, height: 4, background: "#e5e7eb", borderRadius: 4, margin: "0 auto 24px" }} />
            <div style={{ fontSize: 18, fontWeight: 900, color: dark, marginBottom: 4 }}>Add Staff Member</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 24 }}>Fill in the details below. Required fields are marked.</div>

            {/* Personal */}
            <div style={{ fontSize: 12, fontWeight: 800, color: dark, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Personal Details</div>

            <span style={label}>Full Name *</span>
            <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="e.g. Jane Wanjiku" style={inp} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <span style={label}>Gender</span>
                <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))} style={sel}>
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <span style={label}>Date of Birth</span>
                <input type="date" value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} style={inp} />
              </div>
            </div>

            <span style={label}>Phone</span>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="e.g. 0712 345 678" style={inp} />

            <span style={label}>Email</span>
            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="e.g. jane@school.ac.ke" style={inp} />

            <span style={label}>National ID</span>
            <input value={form.national_id} onChange={e => setForm(f => ({ ...f, national_id: e.target.value }))} placeholder="ID Number" style={inp} />

            {/* Employment */}
            <div style={{ fontSize: 12, fontWeight: 800, color: dark, margin: "16px 0 12px", textTransform: "uppercase", letterSpacing: 0.5 }}>Employment Details</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <span style={label}>Category *</span>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={sel}>
                  <option value="teaching">Teaching</option>
                  <option value="administrative">Administrative</option>
                  <option value="subordinate">Subordinate</option>
                  <option value="support">Support</option>
                </select>
              </div>
              <div>
                <span style={label}>Employment Type *</span>
                <select value={form.employment_type} onChange={e => setForm(f => ({ ...f, employment_type: e.target.value }))} style={sel}>
                  <option value="permanent">Permanent</option>
                  <option value="contract">Contract</option>
                  <option value="part_time">Part-time</option>
                  <option value="casual">Casual</option>
                  <option value="volunteer">Volunteer</option>
                </select>
              </div>
            </div>

            <span style={label}>Designation / Title</span>
            <input value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} placeholder="e.g. Class Teacher, School Cook, Secretary" style={inp} />

            <span style={label}>Department</span>
            <input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="e.g. Sciences, Administration, Kitchen" style={inp} />

            {form.category === "teaching" && (
              <>
                <span style={label}>Subject Taught</span>
                <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="e.g. Mathematics" style={inp} />

                <span style={label}>TSC Number</span>
                <input value={form.tsc_number} onChange={e => setForm(f => ({ ...f, tsc_number: e.target.value }))} placeholder="TSC Number" style={inp} />
              </>
            )}

            <span style={label}>Staff Number</span>
            <input value={form.staff_number} onChange={e => setForm(f => ({ ...f, staff_number: e.target.value }))} placeholder="e.g. STF001" style={inp} />

            <span style={label}>Salary Grade</span>
            <input value={form.salary_grade} onChange={e => setForm(f => ({ ...f, salary_grade: e.target.value }))} placeholder="e.g. B5, C2" style={inp} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <span style={label}>Date Joined</span>
                <input type="date" value={form.date_joined} onChange={e => setForm(f => ({ ...f, date_joined: e.target.value }))} style={inp} />
              </div>
              <div>
                <span style={label}>Contract Start</span>
                <input type="date" value={form.contract_start} onChange={e => setForm(f => ({ ...f, contract_start: e.target.value }))} style={inp} />
              </div>
            </div>

            <span style={label}>Contract End Date</span>
            <input type="date" value={form.contract_end} onChange={e => setForm(f => ({ ...f, contract_end: e.target.value }))} style={inp} />

            {/* Next of Kin */}
            <div style={{ fontSize: 12, fontWeight: 800, color: dark, margin: "16px 0 12px", textTransform: "uppercase", letterSpacing: 0.5 }}>Next of Kin</div>

            <span style={label}>Name</span>
            <input value={form.next_of_kin_name} onChange={e => setForm(f => ({ ...f, next_of_kin_name: e.target.value }))} placeholder="e.g. John Kamau" style={inp} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <span style={label}>Phone</span>
                <input value={form.next_of_kin_phone} onChange={e => setForm(f => ({ ...f, next_of_kin_phone: e.target.value }))} placeholder="0712 000 000" style={inp} />
              </div>
              <div>
                <span style={label}>Relation</span>
                <input value={form.next_of_kin_relation} onChange={e => setForm(f => ({ ...f, next_of_kin_relation: e.target.value }))} placeholder="e.g. Spouse" style={inp} />
              </div>
            </div>

            <button
              onClick={handleAddStaff}
              disabled={saving}
              style={{ width: "100%", padding: 15, borderRadius: 12, border: "none", background: saving ? "#d1d5db" : accent, color: "#fff", fontWeight: 800, fontSize: 15, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: saving ? "none" : "0 4px 14px rgba(16,185,129,0.35)", marginTop: 8 }}
            >
              {saving ? "Adding..." : "Add Staff Member"}
            </button>
          </div>
        </div>
      )}

      <Toast msg={toast} />
    </div>
  )
}
