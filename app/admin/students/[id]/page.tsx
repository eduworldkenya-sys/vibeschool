"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"

const deepspace = "#0a1628"
const accent    = "#10b981"
const amber     = "#f59e0b"
const violet    = "#8b5cf6"
const red       = "#ef4444"

type Tab = "overview" | "fees" | "attendance" | "parent"

interface StudentDetail {
  id:               string
  name:             string
  admission_number: string | null
  gender:           string | null
  date_of_birth:    string | null
  class_name:       string
  class_stream:     string
  class_id:         string | null
  joined_at:        string | null
}

interface ParentDetail {
  id:           string
  full_name:    string
  phone:        string | null
  relationship: string
  is_primary:   boolean
}

interface InvoiceRow {
  id:           string
  term:         string
  year:         number
  total_amount: number
  paid_amount:  number
  status:       string
  due_date:     string | null
}

interface PaymentRow {
  id:          string
  amount:      number
  method:      string
  reference:   string | null
  received_at: string
  receipt_number: string | null
}

interface AttendanceRow {
  date:   string
  status: string
}

export default function StudentDetailPage() {
  const router   = useRouter()
  const params   = useParams()
  const id       = params.id as string

  const [tab,        setTab]        = useState<Tab>("overview")
  const [student,    setStudent]    = useState<StudentDetail | null>(null)
  const [parents,    setParents]    = useState<ParentDetail[]>([])
  const [invoices,   setInvoices]   = useState<InvoiceRow[]>([])
  const [payments,   setPayments]   = useState<PaymentRow[]>([])
  const [attendance, setAttendance] = useState<AttendanceRow[]>([])
  const [loading,    setLoading]    = useState(true)
  const [schoolId,   setSchoolId]   = useState("")

  const [showPayModal,  setShowPayModal]  = useState(false)
  const [showInvModal,  setShowInvModal]  = useState(false)
  const [saving,        setSaving]        = useState(false)

  const [payForm, setPayForm] = useState({
    invoice_id: "",
    amount:     "",
    method:     "mpesa",
    reference:  "",
  })

  const [invForm, setInvForm] = useState({
    term:         "Term 1",
    year:         "2026",
    total_amount: "",
    due_date:     "",
  })

  useEffect(() => { bootstrap() }, [id])

  async function bootstrap() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/admin/login"); return }

      const { data: p } = await supabase
        .from("profiles")
        .select("school_id")
        .eq("id", user.id)
        .single()

      if (!p?.school_id) { router.push("/admin/login"); return }
      setSchoolId(p.school_id)

      await Promise.all([
        loadStudent(p.school_id),
        loadParents(),
        loadInvoices(p.school_id),
        loadAttendance(p.school_id),
      ])
    } finally {
      setLoading(false)
    }
  }

  async function loadStudent(sid: string) {
    const { data: s } = await supabase
      .from("students")
      .select("id, name, admission_number, gender, date_of_birth")
      .eq("id", id)
      .single()

    if (!s) return

    const { data: sc } = await supabase
      .from("student_classes")
      .select("joined_at, class_id, classes(name, stream)")
      .eq("student_id", id)
      .eq("school_id", sid)
      .eq("is_current", true)
      .single()

    setStudent({
      id:               s.id,
      name:             s.name,
      admission_number: s.admission_number,
      gender:           s.gender,
      date_of_birth:    s.date_of_birth,
      class_name:       (sc as any)?.classes?.name ?? "—",
      class_stream:     (sc as any)?.classes?.stream ?? "",
      class_id:         (sc as any)?.class_id ?? null,
      joined_at:        (sc as any)?.joined_at ?? null,
    })
  }

  async function loadParents() {
    const { data: links } = await supabase
      .from("parent_student_links")
      .select("parent_id, relationship, is_primary")
      .eq("student_id", id)

    if (!links || links.length === 0) return

    const parentIds = links.map((l: any) => l.parent_id)
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, phone")
      .in("id", parentIds)

    const rows: ParentDetail[] = (profiles ?? []).map((p: any) => {
      const link = links.find((l: any) => l.parent_id === p.id)
      return {
        id:           p.id,
        full_name:    p.full_name,
        phone:        p.phone,
        relationship: link?.relationship ?? "parent",
        is_primary:   link?.is_primary ?? false,
      }
    })

    setParents(rows)
  }

  async function loadInvoices(sid: string) {
    const { data: invs } = await supabase
      .from("finance_invoices")
      .select("id, term, year, total_amount, paid_amount, status, due_date")
      .eq("student_id", id)
      .eq("school_id", sid)
      .is("deleted_at", null)
      .order("year", { ascending: false })

    setInvoices(invs ?? [])

    if (invs && invs.length > 0) {
      const invIds = invs.map((i: any) => i.id)
      const { data: pays } = await supabase
        .from("finance_payments")
        .select("id, amount, method, reference, received_at, receipt_number")
        .in("invoice_id", invIds)
        .is("deleted_at", null)
        .order("received_at", { ascending: false })

      setPayments(pays ?? [])
    }
  }

  async function loadAttendance(sid: string) {
    const { data } = await supabase
      .from("attendance")
      .select("date, status")
      .eq("student_id", id)
      .eq("school_id", sid)
      .order("date", { ascending: false })
      .limit(90)

    setAttendance(data ?? [])
  }

  async function recordPayment() {
    if (!payForm.invoice_id || !payForm.amount) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const receiptNum = `REC-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`

      await supabase.from("finance_payments").insert({
        school_id:      schoolId,
        invoice_id:     payForm.invoice_id,
        student_id:     id,
        amount:         parseFloat(payForm.amount),
        method:         payForm.method,
        reference:      payForm.reference || null,
        receipt_number: receiptNum,
        received_by:    user?.id ?? null,
        received_at:    new Date().toISOString(),
      })

      setShowPayModal(false)
      setPayForm({ invoice_id: "", amount: "", method: "mpesa", reference: "" })
      await loadInvoices(schoolId)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  async function createInvoice() {
    if (!invForm.total_amount) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      await supabase.from("finance_invoices").insert({
        school_id:    schoolId,
        student_id:   id,
        class_id:     student?.class_id ?? null,
        term:         invForm.term,
        year:         parseInt(invForm.year),
        total_amount: parseFloat(invForm.total_amount),
        paid_amount:  0,
        status:       "issued",
        due_date:     invForm.due_date || null,
        created_by:   user?.id ?? null,
      })

      setShowInvModal(false)
      setInvForm({ term: "Term 1", year: "2026", total_amount: "", due_date: "" })
      await loadInvoices(schoolId)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const attendanceStats = {
    present: attendance.filter(a => a.status === "present").length,
    absent:  attendance.filter(a => a.status === "absent").length,
    late:    attendance.filter(a => a.status === "late").length,
    total:   attendance.length,
  }

  const attendancePct = attendanceStats.total > 0
    ? Math.round((attendanceStats.present / attendanceStats.total) * 100)
    : null

  const totalOwed = invoices.reduce((s, i) => s + i.total_amount, 0)
  const totalPaid = invoices.reduce((s, i) => s + i.paid_amount,  0)
  const balance   = totalOwed - totalPaid

  const feeColor = (status: string) =>
    status === "paid"    ? accent :
    status === "partial" ? amber  :
    status === "owing"   ? red    :
    status === "overdue" ? red    :
    "rgba(255,255,255,0.3)"

  const genderIcon = (g: string | null) =>
    g === "male" ? "👦" : g === "female" ? "👧" : "🧑"

  const formatDate = (d: string | null) => {
    if (!d) return "—"
    return new Date(d).toLocaleDateString("en-KE", {
      day: "numeric", month: "short", year: "numeric"
    })
  }

  const formatAge = (dob: string | null) => {
    if (!dob) return null
    const diff = Date.now() - new Date(dob).getTime()
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365))
  }

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {[1,2,3].map(i => (
          <div key={i} style={{
            height:       "100px",
            background:   "rgba(255,255,255,0.03)",
            borderRadius: "16px",
            animation:    "pulse 1.5s ease-in-out infinite",
          }} />
        ))}
        <style>{`@keyframes pulse{0%,100%{opacity:.4}50%{opacity:.8}}`}</style>
      </div>
    )
  }

  if (!student) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: "#94a3b8" }}>
        Student not found.
        <br />
        <button
          onClick={() => router.back()}
          style={{
            marginTop:    "16px",
            background:   accent,
            border:       "none",
            borderRadius: "10px",
            padding:      "10px 20px",
            color:        "#ffffff",
            cursor:       "pointer",
          }}
        >
          Go Back
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>

      {/* ── Back ── */}
      <button
        onClick={() => router.back()}
        style={{
          background:   "none",
          border:       "none",
          color:        "rgba(255,255,255,0.4)",
          fontSize:     "13px",
          cursor:       "pointer",
          marginBottom: "16px",
          padding:      0,
        }}
      >
        ← Back to Students
      </button>

      {/* ── Hero ── */}
      <div style={{
        background:    "#ffffff",
        border:        "1px solid #e2e8f0",
        borderRadius:  "20px",
        padding:       "24px",
        marginBottom:  "16px",
        backdropFilter:"blur(12px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{
            width:          "64px",
            height:         "64px",
            borderRadius:   "50%",
            background:     `linear-gradient(135deg, #0a1628, #312e81)`,
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            fontSize:       "28px",
            flexShrink:     0,
          }}>
            {genderIcon(student.gender)}
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{
              color:      "#ffffff",
              fontSize:   "22px",
              fontWeight: "800",
              margin:     "0 0 4px",
            }}>
              {student.name}
            </h1>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <span style={{ color: accent, fontSize: "13px", fontWeight: "600" }}>
                {student.class_name} {student.class_stream}
              </span>
              {student.admission_number && (
                <span style={{ color: "#94a3b8", fontSize: "13px" }}>
                  #{student.admission_number}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div style={{
          display:             "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap:                 "10px",
          marginTop:           "20px",
        }}>
          <div style={{
            background:   "#f8fafc",
            borderRadius: "12px",
            padding:      "12px",
            textAlign:    "center",
          }}>
            <div style={{ color: attendancePct !== null && attendancePct >= 80 ? accent : red, fontSize: "20px", fontWeight: "800" }}>
              {attendancePct !== null ? `${attendancePct}%` : "—"}
            </div>
            <div style={{ color: "#64748b", fontSize: "11px", marginTop: "2px" }}>
              Attendance
            </div>
          </div>
          <div style={{
            background:   "#f8fafc",
            borderRadius: "12px",
            padding:      "12px",
            textAlign:    "center",
          }}>
            <div style={{
              color:      balance > 0 ? red : accent,
              fontSize:   "16px",
              fontWeight: "800",
            }}>
              {balance > 0 ? `KES ${balance.toLocaleString()}` : "Clear"}
            </div>
            <div style={{ color: "#64748b", fontSize: "11px", marginTop: "2px" }}>
              Fee Balance
            </div>
          </div>
          <div style={{
            background:   "#f8fafc",
            borderRadius: "12px",
            padding:      "12px",
            textAlign:    "center",
          }}>
            <div style={{ color: parents.length > 0 ? accent : amber, fontSize: "20px", fontWeight: "800" }}>
              {parents.length > 0 ? "✓" : "✗"}
            </div>
            <div style={{ color: "#64748b", fontSize: "11px", marginTop: "2px" }}>
              Parent Linked
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{
        display:      "flex",
        gap:          "6px",
        marginBottom: "16px",
        overflowX:    "auto",
      }}>
        {(["overview", "fees", "attendance", "parent"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background:   tab === t ? accent : "rgba(255,255,255,0.05)",
              border:       "1px solid " + (tab === t ? accent : "rgba(255,255,255,0.1)"),
              borderRadius: "20px",
              padding:      "7px 16px",
              color:        tab === t ? "#ffffff" : "rgba(255,255,255,0.5)",
              fontSize:     "12px",
              fontWeight:   "600",
              cursor:       "pointer",
              whiteSpace:   "nowrap",
              textTransform:"capitalize",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ══ OVERVIEW TAB ══ */}
      {tab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

          {/* Personal Info */}
          <div style={{
            background:    "#ffffff",
            border:        "1px solid #e2e8f0",
            borderRadius:  "16px",
            padding:       "20px",
            backdropFilter:"blur(12px)",
          }}>
            <p style={{
              color:        "rgba(255,255,255,0.4)",
              fontSize:     "11px",
              fontWeight:   "700",
              letterSpacing:"1px",
              textTransform:"uppercase",
              margin:       "0 0 16px",
            }}>
              Personal Info
            </p>
            {[
              { label: "Full Name",       value: student.name },
              { label: "Gender",          value: student.gender ? student.gender.charAt(0).toUpperCase() + student.gender.slice(1) : "—" },
              { label: "Date of Birth",   value: formatDate(student.date_of_birth) },
              { label: "Age",             value: formatAge(student.date_of_birth) ? `${formatAge(student.date_of_birth)} years` : "—" },
              { label: "Admission No",    value: student.admission_number ?? "—" },
              { label: "Class",           value: `${student.class_name} ${student.class_stream}`.trim() },
              { label: "Enrolled",        value: formatDate(student.joined_at) },
            ].map(row => (
              <div key={row.label} style={{
                display:       "flex",
                justifyContent:"space-between",
                alignItems:    "center",
                padding:       "10px 0",
                borderBottom:  "1px solid rgba(255,255,255,0.04)",
              }}>
                <span style={{ color: "#64748b", fontSize: "13px" }}>
                  {row.label}
                </span>
                <span style={{ color: "#0f172a", fontSize: "13px", fontWeight: "600" }}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div style={{
            background:    "#ffffff",
            border:        "1px solid #e2e8f0",
            borderRadius:  "16px",
            padding:       "20px",
            backdropFilter:"blur(12px)",
          }}>
            <p style={{
              color:        "rgba(255,255,255,0.4)",
              fontSize:     "11px",
              fontWeight:   "700",
              letterSpacing:"1px",
              textTransform:"uppercase",
              margin:       "0 0 16px",
            }}>
              Quick Actions
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <button
                onClick={() => { setTab("fees"); setShowInvModal(true) }}
                style={{
                  background:   "rgba(16,185,129,0.08)",
                  border:       "1px solid rgba(16,185,129,0.2)",
                  borderRadius: "12px",
                  padding:      "12px 16px",
                  color:        accent,
                  fontSize:     "13px",
                  fontWeight:   "600",
                  cursor:       "pointer",
                  textAlign:    "left",
                }}
              >
                💰 Create Fee Invoice
              </button>
              <button
                onClick={() => { setTab("fees"); setShowPayModal(true) }}
                style={{
                  background:   "rgba(139,92,246,0.08)",
                  border:       "1px solid rgba(139,92,246,0.2)",
                  borderRadius: "12px",
                  padding:      "12px 16px",
                  color:        violet,
                  fontSize:     "13px",
                  fontWeight:   "600",
                  cursor:       "pointer",
                  textAlign:    "left",
                }}
              >
                💳 Record Payment
              </button>
              <button
                onClick={() => setTab("attendance")}
                style={{
                  background:   "rgba(245,158,11,0.08)",
                  border:       "1px solid rgba(245,158,11,0.2)",
                  borderRadius: "12px",
                  padding:      "12px 16px",
                  color:        amber,
                  fontSize:     "13px",
                  fontWeight:   "600",
                  cursor:       "pointer",
                  textAlign:    "left",
                }}
              >
                📋 View Attendance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ FEES TAB ══ */}
      {tab === "fees" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

          {/* Fee Summary */}
          <div style={{
            background:    "#ffffff",
            border:        "1px solid #e2e8f0",
            borderRadius:  "16px",
            padding:       "20px",
            backdropFilter:"blur(12px)",
          }}>
            <div style={{
              display:             "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap:                 "10px",
              marginBottom:        "16px",
            }}>
              {[
                { label: "Total Invoiced", value: `KES ${totalOwed.toLocaleString()}`,  color: "#0f172a" },
                { label: "Total Paid",     value: `KES ${totalPaid.toLocaleString()}`,  color: accent    },
                { label: "Balance",        value: `KES ${balance.toLocaleString()}`,    color: balance > 0 ? red : accent },
              ].map(s => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div style={{ color: s.color, fontSize: "15px", fontWeight: "800" }}>
                    {s.value}
                  </div>
                  <div style={{ color: "#64748b", fontSize: "11px", marginTop: "2px" }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => setShowInvModal(true)}
                style={{
                  flex:         1,
                  background:   "rgba(16,185,129,0.1)",
                  border:       "1px solid rgba(16,185,129,0.3)",
                  borderRadius: "10px",
                  padding:      "10px",
                  color:        accent,
                  fontSize:     "13px",
                  fontWeight:   "600",
                  cursor:       "pointer",
                }}
              >
                + Invoice
              </button>
              <button
                onClick={() => setShowPayModal(true)}
                disabled={invoices.length === 0}
                style={{
                  flex:         1,
                  background:   invoices.length === 0 ? "rgba(255,255,255,0.03)" : "rgba(139,92,246,0.1)",
                  border:       "1px solid " + (invoices.length === 0 ? "rgba(255,255,255,0.07)" : "rgba(139,92,246,0.3)"),
                  borderRadius: "10px",
                  padding:      "10px",
                  color:        invoices.length === 0 ? "rgba(255,255,255,0.2)" : violet,
                  fontSize:     "13px",
                  fontWeight:   "600",
                  cursor:       invoices.length === 0 ? "not-allowed" : "pointer",
                }}
              >
                + Payment
              </button>
            </div>
          </div>

          {/* Invoices */}
          {invoices.length === 0 ? (
            <div style={{
              textAlign: "center",
              padding:   "40px 20px",
              color:     "rgba(255,255,255,0.3)",
              fontSize:  "13px",
            }}>
              No invoices yet. Create the first invoice.
            </div>
          ) : (
            invoices.map(inv => {
              const invPayments = payments.filter(p =>
                payments.find(pp => pp.id === p.id)
              )
              return (
                <div key={inv.id} style={{
                  background:    "#ffffff",
                  border:        "1px solid #e2e8f0",
                  borderRadius:  "16px",
                  padding:       "16px",
                  backdropFilter:"blur(12px)",
                }}>
                  <div style={{
                    display:        "flex",
                    justifyContent: "space-between",
                    alignItems:     "center",
                    marginBottom:   "12px",
                  }}>
                    <div>
                      <div style={{ color: "#0f172a", fontSize: "14px", fontWeight: "700" }}>
                        {inv.term} {inv.year}
                      </div>
                      {inv.due_date && (
                        <div style={{ color: "#94a3b8", fontSize: "12px" }}>
                          Due {formatDate(inv.due_date)}
                        </div>
                      )}
                    </div>
                    <span style={{
                      background:   `rgba(${
                        inv.status === "paid"    ? "16,185,129"  :
                        inv.status === "partial" ? "245,158,11"  :
                        "239,68,68"
                      },0.1)`,
                      border:       "1px solid " + feeColor(inv.status),
                      borderRadius: "20px",
                      padding:      "3px 12px",
                      fontSize:     "11px",
                      fontWeight:   "700",
                      color:        feeColor(inv.status),
                      textTransform:"capitalize",
                    }}>
                      {inv.status}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div style={{
                    background:   "#f1f5f9",
                    borderRadius: "4px",
                    height:       "6px",
                    marginBottom: "10px",
                    overflow:     "hidden",
                  }}>
                    <div style={{
                      width:        `${Math.min(100, (inv.paid_amount / inv.total_amount) * 100)}%`,
                      height:       "100%",
                      background:   inv.status === "paid" ? accent : amber,
                      borderRadius: "4px",
                      transition:   "width 0.3s",
                    }} />
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b", fontSize: "12px" }}>
                      Paid: KES {inv.paid_amount.toLocaleString()}
                    </span>
                    <span style={{ color: "#64748b", fontSize: "12px" }}>
                      Total: KES {inv.total_amount.toLocaleString()}
                    </span>
                  </div>
                </div>
              )
            })
          )}

          {/* Payment history */}
          {payments.length > 0 && (
            <div style={{
              background:    "#ffffff",
              border:        "1px solid #e2e8f0",
              borderRadius:  "16px",
              padding:       "20px",
              backdropFilter:"blur(12px)",
            }}>
              <p style={{
                color:        "rgba(255,255,255,0.4)",
                fontSize:     "11px",
                fontWeight:   "700",
                letterSpacing:"1px",
                textTransform:"uppercase",
                margin:       "0 0 12px",
              }}>
                Payment History
              </p>
              {payments.map(pay => (
                <div key={pay.id} style={{
                  display:       "flex",
                  justifyContent:"space-between",
                  alignItems:    "center",
                  padding:       "10px 0",
                  borderBottom:  "1px solid rgba(255,255,255,0.04)",
                }}>
                  <div>
                    <div style={{ color: "#0f172a", fontSize: "13px", fontWeight: "600" }}>
                      KES {pay.amount.toLocaleString()}
                    </div>
                    <div style={{ color: "#94a3b8", fontSize: "11px" }}>
                      {pay.method.toUpperCase()} {pay.reference ? `· ${pay.reference}` : ""}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "#64748b", fontSize: "11px" }}>
                      {formatDate(pay.received_at)}
                    </div>
                    {pay.receipt_number && (
                      <div style={{ color: accent, fontSize: "11px" }}>
                        {pay.receipt_number}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ ATTENDANCE TAB ══ */}
      {tab === "attendance" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{
            background:    "#ffffff",
            border:        "1px solid #e2e8f0",
            borderRadius:  "16px",
            padding:       "20px",
            backdropFilter:"blur(12px)",
          }}>
            <div style={{
              display:             "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap:                 "10px",
              marginBottom:        "20px",
            }}>
              {[
                { label: "Present", value: attendanceStats.present, color: accent  },
                { label: "Absent",  value: attendanceStats.absent,  color: red     },
                { label: "Late",    value: attendanceStats.late,     color: amber   },
                { label: "Rate",    value: attendancePct !== null ? `${attendancePct}%` : "—", color: attendancePct !== null && attendancePct >= 80 ? accent : red },
              ].map(s => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div style={{ color: s.color, fontSize: "20px", fontWeight: "800" }}>
                    {s.value}
                  </div>
                  <div style={{ color: "#64748b", fontSize: "11px", marginTop: "2px" }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            {attendance.length === 0 ? (
              <div style={{ textAlign: "center", color: "#94a3b8", fontSize: "13px", padding: "20px 0" }}>
                No attendance records yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {attendance.slice(0, 30).map((a, i) => (
                  <div key={i} style={{
                    display:        "flex",
                    justifyContent: "space-between",
                    alignItems:     "center",
                    padding:        "8px 0",
                    borderBottom:   "1px solid rgba(255,255,255,0.04)",
                  }}>
                    <span style={{ color: "#64748b", fontSize: "13px" }}>
                      {formatDate(a.date)}
                    </span>
                    <span style={{
                      color:        a.status === "present" ? accent : a.status === "late" ? amber : red,
                      fontSize:     "12px",
                      fontWeight:   "600",
                      textTransform:"capitalize",
                    }}>
                      {a.status === "present" ? "✓" : a.status === "late" ? "⏰" : "✗"} {a.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ PARENT TAB ══ */}
      {tab === "parent" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {parents.length === 0 ? (
            <div style={{
              textAlign:  "center",
              padding:    "60px 20px",
              color:      "rgba(255,255,255,0.3)",
              fontSize:   "13px",
            }}>
              No parent linked to this student yet.
            </div>
          ) : (
            parents.map(parent => (
              <div key={parent.id} style={{
                background:    "#ffffff",
                border:        "1px solid #e2e8f0",
                borderRadius:  "16px",
                padding:       "20px",
                backdropFilter:"blur(12px)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "16px" }}>
                  <div style={{
                    width:          "48px",
                    height:         "48px",
                    borderRadius:   "50%",
                    background:     "linear-gradient(135deg, #0a1628, #312e81)",
                    display:        "flex",
                    alignItems:     "center",
                    justifyContent: "center",
                    fontSize:       "20px",
                  }}>
                    👤
                  </div>
                  <div>
                    <div style={{ color: "#0f172a", fontSize: "16px", fontWeight: "700" }}>
                      {parent.full_name}
                    </div>
                    <div style={{ color: "#64748b", fontSize: "12px", textTransform: "capitalize" }}>
                      {parent.relationship} {parent.is_primary ? "· Primary" : ""}
                    </div>
                  </div>
                </div>

                {parent.phone && (
                  <a
                    href={`tel:${parent.phone}`}
                    style={{
                      display:        "flex",
                      alignItems:     "center",
                      justifyContent: "center",
                      gap:            "8px",
                      background:     "rgba(16,185,129,0.1)",
                      border:         "1px solid rgba(16,185,129,0.3)",
                      borderRadius:   "12px",
                      padding:        "12px",
                      color:          accent,
                      fontSize:       "14px",
                      fontWeight:     "600",
                      textDecoration: "none",
                    }}
                  >
                    📞 Call {parent.phone}
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ══ CREATE INVOICE MODAL ══ */}
      {showInvModal && (
        <div style={{
          position:       "fixed",
          inset:          0,
          background:     "rgba(0,0,0,0.7)",
          backdropFilter: "blur(8px)",
          display:        "flex",
          alignItems:     "flex-end",
          justifyContent: "center",
          zIndex:         100,
        }}>
          <div style={{
            background:   "#0a1628",
            borderRadius: "24px 24px 0 0",
            padding:      "28px 24px 40px",
            width:        "100%",
            maxWidth:     "600px",
          }}>
            <div style={{
              display:        "flex",
              justifyContent: "space-between",
              alignItems:     "center",
              marginBottom:   "24px",
            }}>
              <h2 style={{ color: "#0f172a", fontSize: "18px", fontWeight: "800", margin: 0 }}>
                Create Invoice
              </h2>
              <button
                onClick={() => setShowInvModal(false)}
                style={{
                  background:   "#e2e8f0",
                  border:       "none",
                  borderRadius: "50%",
                  width:        "32px",
                  height:       "32px",
                  color:        "#ffffff",
                  fontSize:     "16px",
                  cursor:       "pointer",
                }}
              >
                ×
              </button>
            </div>

            {/* Term */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ color: "#64748b", fontSize: "12px", fontWeight: "600", display: "block", marginBottom: "6px" }}>
                Term
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                {["Term 1", "Term 2", "Term 3"].map(t => (
                  <button
                    key={t}
                    onClick={() => setInvForm(p => ({ ...p, term: t }))}
                    style={{
                      flex:         1,
                      background:   invForm.term === t ? accent : "rgba(255,255,255,0.06)",
                      border:       "1px solid " + (invForm.term === t ? accent : "rgba(255,255,255,0.1)"),
                      borderRadius: "10px",
                      padding:      "10px",
                      color:        invForm.term === t ? "#ffffff" : "rgba(255,255,255,0.5)",
                      fontSize:     "12px",
                      fontWeight:   "600",
                      cursor:       "pointer",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {[
              { label: "Year",         key: "year",         type: "number", placeholder: "2026"       },
              { label: "Total Amount (KES)", key: "total_amount", type: "number", placeholder: "15000" },
              { label: "Due Date",     key: "due_date",     type: "date",   placeholder: ""           },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: "16px" }}>
                <label style={{ color: "#64748b", fontSize: "12px", fontWeight: "600", display: "block", marginBottom: "6px" }}>
                  {f.label}
                </label>
                <input
                  type={f.type}
                  placeholder={f.placeholder}
                  value={(invForm as any)[f.key]}
                  onChange={e => setInvForm(p => ({ ...p, [f.key]: e.target.value }))}
                  style={{
                    width:        "100%",
                    background:   "#f1f5f9",
                    border:       "1px solid #e2e8f0",
                    borderRadius: "10px",
                    padding:      "10px 14px",
                    color:        "#ffffff",
                    fontSize:     "14px",
                    boxSizing:    "border-box",
                    outline:      "none",
                  }}
                />
              </div>
            ))}

            <button
              onClick={createInvoice}
              disabled={saving || !invForm.total_amount}
              style={{
                width:        "100%",
                background:   saving || !invForm.total_amount ? "rgba(16,185,129,0.4)" : accent,
                border:       "none",
                borderRadius: "12px",
                padding:      "14px",
                color:        "#ffffff",
                fontSize:     "15px",
                fontWeight:   "700",
                cursor:       saving || !invForm.total_amount ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Saving..." : "Create Invoice"}
            </button>
          </div>
        </div>
      )}

      {/* ══ RECORD PAYMENT MODAL ══ */}
      {showPayModal && (
        <div style={{
          position:       "fixed",
          inset:          0,
          background:     "rgba(0,0,0,0.7)",
          backdropFilter: "blur(8px)",
          display:        "flex",
          alignItems:     "flex-end",
          justifyContent: "center",
          zIndex:         100,
        }}>
          <div style={{
            background:   "#0a1628",
            borderRadius: "24px 24px 0 0",
            padding:      "28px 24px 40px",
            width:        "100%",
            maxWidth:     "600px",
          }}>
            <div style={{
              display:        "flex",
              justifyContent: "space-between",
              alignItems:     "center",
              marginBottom:   "24px",
            }}>
              <h2 style={{ color: "#0f172a", fontSize: "18px", fontWeight: "800", margin: 0 }}>
                Record Payment
              </h2>
              <button
                onClick={() => setShowPayModal(false)}
                style={{
                  background:   "#e2e8f0",
                  border:       "none",
                  borderRadius: "50%",
                  width:        "32px",
                  height:       "32px",
                  color:        "#ffffff",
                  fontSize:     "16px",
                  cursor:       "pointer",
                }}
              >
                ×
              </button>
            </div>

            {/* Invoice selector */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ color: "#64748b", fontSize: "12px", fontWeight: "600", display: "block", marginBottom: "6px" }}>
                Invoice
              </label>
              <select
                value={payForm.invoice_id}
                onChange={e => setPayForm(p => ({ ...p, invoice_id: e.target.value }))}
                style={{
                  width:        "100%",
                  background:   "#f1f5f9",
                  border:       "1px solid #e2e8f0",
                  borderRadius: "10px",
                  padding:      "10px 14px",
                  color:        "#ffffff",
                  fontSize:     "14px",
                  boxSizing:    "border-box",
                  outline:      "none",
                }}
              >
                <option value="">Select invoice</option>
                {invoices.filter(i => i.status !== "paid").map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.term} {inv.year} — Balance KES {(inv.total_amount - inv.paid_amount).toLocaleString()}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ color: "#64748b", fontSize: "12px", fontWeight: "600", display: "block", marginBottom: "6px" }}>
                Amount (KES)
              </label>
              <input
                type="number"
                placeholder="e.g. 5000"
                value={payForm.amount}
                onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))}
                style={{
                  width:        "100%",
                  background:   "#f1f5f9",
                  border:       "1px solid #e2e8f0",
                  borderRadius: "10px",
                  padding:      "10px 14px",
                  color:        "#ffffff",
                  fontSize:     "14px",
                  boxSizing:    "border-box",
                  outline:      "none",
                }}
              />
            </div>

            {/* Method */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ color: "#64748b", fontSize: "12px", fontWeight: "600", display: "block", marginBottom: "6px" }}>
                Payment Method
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                {["mpesa", "cash", "bank", "cheque"].map(m => (
                  <button
                    key={m}
                    onClick={() => setPayForm(p => ({ ...p, method: m }))}
                    style={{
                      flex:         1,
                      background:   payForm.method === m ? accent : "rgba(255,255,255,0.06)",
                      border:       "1px solid " + (payForm.method === m ? accent : "rgba(255,255,255,0.1)"),
                      borderRadius: "10px",
                      padding:      "8px 4px",
                      color:        payForm.method === m ? "#ffffff" : "rgba(255,255,255,0.5)",
                      fontSize:     "11px",
                      fontWeight:   "600",
                      cursor:       "pointer",
                      textTransform:"uppercase",
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Reference */}
            <div style={{ marginBottom: "24px" }}>
              <label style={{ color: "#64748b", fontSize: "12px", fontWeight: "600", display: "block", marginBottom: "6px" }}>
                Reference / Mpesa Code
              </label>
              <input
                type="text"
                placeholder="e.g. QK7X2Y3Z4A"
                value={payForm.reference}
                onChange={e => setPayForm(p => ({ ...p, reference: e.target.value }))}
                style={{
                  width:        "100%",
                  background:   "#f1f5f9",
                  border:       "1px solid #e2e8f0",
                  borderRadius: "10px",
                  padding:      "10px 14px",
                  color:        "#ffffff",
                  fontSize:     "14px",
                  boxSizing:    "border-box",
                  outline:      "none",
                }}
              />
            </div>

            <button
              onClick={recordPayment}
              disabled={saving || !payForm.invoice_id || !payForm.amount}
              style={{
                width:        "100%",
                background:   saving || !payForm.invoice_id || !payForm.amount ? "rgba(16,185,129,0.4)" : accent,
                border:       "none",
                borderRadius: "12px",
                padding:      "14px",
                color:        "#ffffff",
                fontSize:     "15px",
                fontWeight:   "700",
                cursor:       saving || !payForm.invoice_id || !payForm.amount ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Saving..." : "Record Payment"}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
