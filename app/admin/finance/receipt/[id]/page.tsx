"use client";

import { useState, useEffect, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"

const dark    = "#0a1628"
const accent  = "#10b981"
const amber   = "#f59e0b"
const red     = "#ef4444"
const violet  = "#8b5cf6"
const blue    = "#3b82f6"
const surface = "rgba(255,255,255,0.03)"
const card    = "rgba(255,255,255,0.05)"
const border  = "#e2e8f0"
const muted   = "rgba(255,255,255,0.4)"
const white   = "#ffffff"

const fmt = (n: number) => `KES ${Number(n).toLocaleString("en-KE", { minimumFractionDigits: 0 })}`

function Skeleton({ h = 48 }: { h?: number }) {
  return (
    <div style={{
      height: h, borderRadius: 12,
      background: "linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.09) 50%,rgba(255,255,255,0.04) 75%)",
      backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite",
    }} />
  )
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    paid:    ["rgba(16,185,129,0.15)",  "#10b981"],
    partial: ["rgba(245,158,11,0.15)",  "#f59e0b"],
    issued:  ["rgba(139,92,246,0.15)",  "#8b5cf6"],
    overdue: ["rgba(239,68,68,0.15)",   "#ef4444"],
    draft:   ["#f8fafc", "rgba(255,255,255,0.4)"],
    waived:  ["#f8fafc", "rgba(255,255,255,0.4)"],
  }
  const [bg, color] = map[status] ?? ["#f8fafc", "rgba(255,255,255,0.4)"]
  return (
    <span style={{ background: bg, color, fontSize: "11px", fontWeight: "700",
      padding: "3px 12px", borderRadius: "20px", whiteSpace: "nowrap", letterSpacing: "0.3px" }}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function MethodIcon({ method }: { method: string }) {
  const map: Record<string, [string, string]> = {
    mpesa:  ["📱", "#10b981"],
    cash:   ["💵", "#f59e0b"],
    bank:   ["🏦", "#3b82f6"],
    cheque: ["📝", "rgba(255,255,255,0.4)"],
  }
  const [icon, color] = map[method] ?? ["💳", "rgba(255,255,255,0.4)"]
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:"5px",
      background:`${color}18`, color, fontSize:"11px", fontWeight:"700",
      padding:"3px 10px", borderRadius:"20px", textTransform:"uppercase" }}>
      {icon} {method}
    </span>
  )
}

interface Payment {
  id: string
  invoice_id: string
  student_id: string
  amount: number
  method: string
  reference: string
  receipt_number: string
  received_at: string
  notes: string
  bank_account_id: string
}

interface Invoice {
  id: string
  student_id: string
  term: string
  year: number
  due_date: string
  status: string
  total_amount: number
  paid_amount: number
}

interface Student {
  id: string
  name: string
  admission_number: string
}

interface School {
  id: string
  name: string
}

export default function ReceiptPage() {
  const router = useRouter()
  const { id } = useParams() as { id: string }

  const [payment, setPayment] = useState<Payment | null>(null)
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [student, setStudent] = useState<Student | null>(null)
  const [school, setSchool] = useState<School | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState({ msg: "", type: "success" })

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type })
    setTimeout(() => setToast({ msg: "", type: "success" }), 3500)
  }

  const load = useCallback(async (schoolId: string) => {
    setLoading(true)
    try {
      const { data: pay, error: payErr } = await supabase
        .from("finance_payments")
        .select("*")
        .eq("id", id)
        .eq("school_id", schoolId)
        .single()

      if (payErr || !pay) { showToast("Payment not found", "error"); setLoading(false); return }
      setPayment(pay)

      const [{ data: inv }, { data: stu }, { data: sch }] = await Promise.all([
        supabase.from("finance_invoices").select("*").eq("id", pay.invoice_id).single(),
        supabase.from("students").select("id,name,admission_number").eq("id", pay.student_id).single(),
        supabase.from("schools").select("id,name").eq("id", schoolId).single(),
      ])

      setInvoice(inv ?? null)
      setStudent(stu ?? null)
      setSchool(sch ?? null)
    } catch (e) {
      showToast("Failed to load receipt", "error")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/admin/login"); return }
      const { data: p } = await supabase.from("profiles").select("school_id").eq("id", user.id).single()
      if (!p?.school_id) { router.push("/admin/login"); return }
      await load(p.school_id)
    }
    init()
  }, [router, load])

  const balance = invoice ? (invoice.total_amount ?? 0) - (invoice.paid_amount ?? 0) : 0
  const receivedDate = payment?.received_at
    ? new Date(payment.received_at).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—"

  return (
    <div style={{ minHeight: "100vh", background: "#f0f4f8", color: "#111827", fontFamily: "system-ui, sans-serif", padding: "20px 16px 60px" }}>
      <style>{`
        @keyframes shimmer { 0% { background-position:200% 0 } 100% { background-position:-200% 0 } }
        @keyframes slideUp { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
        @keyframes fadeIn  { from { opacity:0 } to { opacity:1 } }
        * { box-sizing: border-box }

        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; color: #000 !important; }
          .receipt-card {
            border: 1px solid #ddd !important;
            background: #fff !important;
            color: #000 !important;
            box-shadow: none !important;
          }
          .receipt-label { color: #666 !important; }
          .receipt-value { color: #000 !important; }
          .receipt-divider { border-color: #ddd !important; }
          .receipt-school { color: #000 !important; }
          .receipt-heading { color: #000 !important; }
          .receipt-amount { color: #10b981 !important; }
          .receipt-balance { color: #ef4444 !important; }
        }
      `}</style>

      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        {/* Back — hidden on print */}
        <button className="no-print" onClick={() => router.back()} style={{
          background:"none", border:"none", color: muted,
          fontSize:"13px", cursor:"pointer", display:"flex", alignItems:"center",
          gap:"6px", marginBottom:"20px", padding:0
        }}>← Back</button>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Skeleton h={60} />
            <Skeleton h={300} />
          </div>
        ) : payment && invoice ? (
          <div style={{ animation: "fadeIn 0.4s ease" }}>
            <div className="receipt-card" style={{
              background: "#ffffff", border: "1px solid #e2e8f0",
              borderRadius: 20, overflow: "hidden",
            }}>
              {/* Header stripe */}
              <div style={{ background: `linear-gradient(135deg, ${accent}22, ${blue}22)`, padding: "28px 24px", textAlign: "center", borderBottom: "1px solid #e2e8f0" }}>
                <p className="receipt-school" style={{ margin: "0 0 4px", fontSize: 13, color: muted, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700 }}>
                  {school?.name ?? "School"}
                </p>
                <h1 className="receipt-heading" style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 900, letterSpacing: "2px", textTransform: "uppercase", color: "#111827" }}>
                  Official Receipt
                </h1>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 20, padding: "4px 14px" }}>
                  <span style={{ fontSize: 11, color: accent, fontWeight: 700, fontFamily: "monospace", letterSpacing: "1px" }}>
                    {payment.receipt_number ?? "—"}
                  </span>
                </div>
              </div>

              {/* Body */}
              <div style={{ padding: "24px" }}>
                {/* Date */}
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
                  <span className="receipt-label" style={{ fontSize: 12, color: muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Date</span>
                  <span className="receipt-value" style={{ fontSize: 13, color: "#111827", fontWeight: 600 }}>{receivedDate}</span>
                </div>

                <hr className="receipt-divider" style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: "0 0 20px" }} />

                {/* Student */}
                <p style={{ margin: "0 0 4px", fontSize: 11, color: muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Student</p>
                <p style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800, color: "#111827" }}>{student?.name ?? "—"}</p>
                <p style={{ margin: "0 0 20px", fontSize: 13, color: muted }}>Adm No: {student?.admission_number ?? "—"}</p>

                <hr className="receipt-divider" style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: "0 0 20px" }} />

                {/* Invoice info */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
                  <Row label="Term / Year" value={`${invoice.term} ${invoice.year}`} />
                  <Row label="Invoice Status">
                    <StatusChip status={invoice.status} />
                  </Row>
                  <Row label="Payment Method">
                    <MethodIcon method={payment.method} />
                  </Row>
                  {payment.reference && (
                    <Row label="Reference" value={payment.reference} mono />
                  )}
                </div>

                <hr className="receipt-divider" style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: "0 0 20px" }} />

                {/* Amounts */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
                  <Row label="Invoice Total" value={fmt(invoice.total_amount)} />
                  <Row label="Amount Paid" valueColor={accent} value={fmt(payment.amount)} large />
                  <Row label="Balance Remaining" valueColor={balance <= 0 ? accent : red} value={fmt(Math.max(0, balance))} />
                </div>

                {payment.notes && (
                  <>
                    <hr className="receipt-divider" style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: "0 0 16px" }} />
                    <p style={{ margin: 0, fontSize: 12, color: muted }}><strong style={{ color: "#111827" }}>Notes:</strong> {payment.notes}</p>
                  </>
                )}

                {/* Footer */}
                <div style={{ marginTop: 24, textAlign: "center", paddingTop: 20, borderTop: "1px solid #e2e8f0" }}>
                  <p style={{ margin: 0, fontSize: 11, color: muted }}>This is an official receipt. Please retain for your records.</p>
                </div>
              </div>
            </div>

            {/* Print button */}
            <button
              className="no-print"
              onClick={() => window.print()}
              style={{
                width: "100%", marginTop: 16, padding: "15px",
                borderRadius: 14, background: accent, color: dark,
                border: "none", fontSize: 15, fontWeight: 800,
                cursor: "pointer",
              }}
            >
              🖨️ Print Receipt
            </button>
          </div>
        ) : (
          <p style={{ color: muted }}>Receipt not found.</p>
        )}
      </div>

      {toast.msg && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: toast.type === "error" ? "rgba(239,68,68,0.95)" : "rgba(16,185,129,0.95)",
          color: "#111827", padding: "12px 24px", borderRadius: 12, fontSize: 14, fontWeight: 600,
          zIndex: 200, animation: "slideUp 0.3s ease", whiteSpace: "nowrap", maxWidth: "90vw",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

function Row({
  label, value, valueColor, mono, large, children
}: {
  label: string
  value?: string
  valueColor?: string
  mono?: boolean
  large?: boolean
  children?: React.ReactNode
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
      <span className="receipt-label" style={{ fontSize: 12, color: muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</span>
      {children ? children : (
        <span className="receipt-value" style={{
          fontSize: large ? 18 : 13,
          fontWeight: large ? 800 : 600,
          color: valueColor ?? white,
          fontFamily: mono ? "monospace" : undefined,
        }}>{value}</span>
      )}
    </div>
  )
}
