"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import type { Database } from "@/lib/database.types"

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

const fmt  = (n: number) => `KES ${Number(n).toLocaleString("en-KE", { minimumFractionDigits: 0 })}`
const fmtK = (n: number) => n >= 1000000 ? `KES ${(n/1000000).toFixed(1)}M` : n >= 1000 ? `KES ${(n/1000).toFixed(0)}K` : fmt(n)

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px",
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "10px", color: "#111827", fontSize: "14px", outline: "none",
  boxSizing: "border-box",
}
const labelStyle: React.CSSProperties = {
  fontSize: "11px", color: "rgba(255,255,255,0.4)", marginBottom: "6px",
  display: "block", fontWeight: "600", letterSpacing: "0.5px", textTransform: "uppercase",
}

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
    open:    ["rgba(16,185,129,0.15)",  "#10b981"],
    closed:  ["rgba(239,68,68,0.15)",   "#ef4444"],
    locked:  ["rgba(239,68,68,0.2)",    "#ef4444"],
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

const Modal = ({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => (
  <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:100,
    display:"flex", alignItems:"flex-end", justifyContent:"center", backdropFilter:"blur(6px)" }}>
    <div style={{ background:"#0a1628", border:"1px solid rgba(255,255,255,0.08)",
      borderRadius:"24px 24px 0 0", padding:"24px 20px 40px", width:"100%",
      maxWidth:"540px", maxHeight:"92vh", overflowY:"auto", animation:"slideUp 0.3s ease" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"24px" }}>
        <h2 style={{ fontSize:"18px", fontWeight:"800", margin:0, color: "#111827" }}>{title}</h2>
        <button onClick={onClose} style={{ background:"#e2e8f0", border:"none",
          color:"#fff", width:"32px", height:"32px", borderRadius:"50%", cursor:"pointer",
          fontSize:"16px", display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
      </div>
      {children}
    </div>
  </div>
)

type Invoice =
  Database["public"]["Tables"]["finance_invoices"]["Row"]

interface InvoiceLine {
  id: string
  invoice_id: string
  description: string
  amount: number
  account_id: string
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

interface BankAccount {
  id: string
  name: string
  type: string
  is_active: boolean
}

interface Student {
  id: string
  name: string
  admission_number: string
}

interface Period {
  id: string
  term: string
  year: number
  status: string
}

export default function InvoiceDetailPage() {
  const router = useRouter()
  const { id } = useParams() as { id: string }

  const [schoolId, setSchoolId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [lines, setLines] = useState<InvoiceLine[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [student, setStudent] = useState<Student | null>(null)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [period, setPeriod] = useState<Period | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState({ msg: "", type: "success" })

  const [form, setForm] = useState({
    amount: "",
    method: "mpesa",
    bank_account_id: "",
    reference: "",
    notes: "",
  })

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type })
    setTimeout(() => setToast({ msg: "", type: "success" }), 3500)
  }

  const load = useCallback(async (sid: string) => {
    setLoading(true)
    try {
      const { data: inv } = await supabase
        .from("finance_invoices")
        .select("*")
        .eq("id", id)
        .eq("school_id", sid)
        .is("deleted_at", null)
        .single()

      if (!inv) { router.push("/admin/finance"); return }
      setInvoice(inv)

      const [{ data: linesData }, { data: paymentsData }, { data: studentData }, { data: bankData }, { data: periodData }] = await Promise.all([
        supabase.from("finance_invoice_lines").select("*").eq("invoice_id", id),
        supabase.from("finance_payments").select("*").eq("invoice_id", id).is("deleted_at", null).order("received_at", { ascending: false }),
        supabase.from("students").select("id,name,admission_number").eq("id", inv.student_id).single(),
        supabase.from("finance_bank_accounts").select("*").eq("school_id", sid).eq("is_active", true).is("deleted_at", null),
        supabase.from("finance_periods").select("*").eq("school_id", sid).eq("term", inv.term).eq("year", inv.year).single(),
      ])

      setLines(linesData ?? [])
      setPayments(paymentsData ?? [])
      setStudent(studentData ?? null)
      setBankAccounts(bankData ?? [])
      setPeriod(periodData ?? null)

      const balance = (inv.total_amount ?? 0) - (inv.paid_amount ?? 0)
      setForm(f => ({ ...f, amount: balance > 0 ? String(balance) : "" }))
    } catch (e) {
      showToast("Failed to load invoice", "error")
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/admin/login"); return }
      setCurrentUserId(user.id)
      const { data: p } = await supabase.from("profiles").select("school_id").eq("id", user.id).single()
      if (!p?.school_id) { router.push("/admin/login"); return }
      setSchoolId(p.school_id)
      await load(p.school_id)
    }
    init()
  }, [router, load])

  const isLocked = period?.status === "locked"
  const balance = (invoice?.total_amount ?? 0) - (invoice?.paid_amount ?? 0)
  const paidPct = invoice ? Math.min(100, ((invoice.paid_amount ?? 0) / (invoice.total_amount || 1)) * 100) : 0
  const isOverdue = invoice?.status === "overdue"
  const daysOverdue = invoice?.due_date
    ? Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / 86400000)
    : 0

  const handleSubmit = async () => {
    if (!invoice || !schoolId || !currentUserId) return
    const amt = parseFloat(form.amount)
    if (!amt || amt <= 0) { showToast("Enter a valid amount", "error"); return }
    if (amt > balance) { showToast("Amount exceeds balance", "error"); return }

    setSubmitting(true)
    try {
      // Get next receipt number
      const { data: seq } = await supabase
        .from("finance_receipt_sequences")
        .select("*")
        .eq("school_id", schoolId)
        .single()

      const nextNum = (seq?.last_number ?? 0) + 1
      const prefix = seq?.prefix ?? "REC"
      const receiptNumber = `${prefix}-${String(nextNum).padStart(5, "0")}`

      if (seq) {
        await supabase
          .from("finance_receipt_sequences")
          .update({ last_number: nextNum, updated_at: new Date().toISOString() })
          .eq("school_id", schoolId)
      } else {
        await supabase
          .from("finance_receipt_sequences")
          .insert({ school_id: schoolId, last_number: nextNum, prefix: "REC", updated_at: new Date().toISOString() })
      }

      const { error: payErr } = await supabase.from("finance_payments").insert({
        school_id: schoolId,
        invoice_id: invoice.id,
        student_id: invoice.student_id,
        amount: amt,
        method: form.method,
        bank_account_id: form.bank_account_id || null,
        reference: form.reference || null,
        receipt_number: receiptNumber,
        received_by: currentUserId,
        received_at: new Date().toISOString(),
        notes: form.notes || null,
      })

      if (payErr) throw payErr

      // Update invoice paid_amount
      const newPaid = (invoice.paid_amount ?? 0) + amt
      const newStatus = newPaid >= invoice.total_amount ? "paid" : newPaid > 0 ? "partial" : invoice.status
      await supabase
        .from("finance_invoices")
        .update({ paid_amount: newPaid, status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", invoice.id)

      // Notify primary parent
      const { data: link } = await supabase
        .from("parent_student_links")
        .select("parent_id")
        .eq("student_id", invoice.student_id)
        .eq("school_id", schoolId)
        .eq("is_primary", true)
        .single()

      if (link?.parent_id) {
        await supabase.from("notifications").insert({
          school_id: schoolId,
          user_id: link.parent_id,
          title: "Payment Received",
          body: `A payment of ${fmt(amt)} has been recorded for ${student?.name ?? "your child"}. Receipt: ${receiptNumber}.`,
          type: "payment",
          related_id: invoice.id,
          is_read: false,
        })
      }

      showToast(`Payment of ${fmt(amt)} recorded. Receipt: ${receiptNumber}`)
      setShowModal(false)
      await load(schoolId)
    } catch (e: any) {
      showToast(e?.message ?? "Failed to record payment", "error")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f0f4f8", color: "#111827", fontFamily: "system-ui, sans-serif", padding: "20px 16px 60px" }}>
      <style>{`
        @keyframes shimmer { 0% { background-position:200% 0 } 100% { background-position:-200% 0 } }
        @keyframes slideUp { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
        @keyframes fadeIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes pulse   { 0%,100% { opacity:1 } 50% { opacity:0.5 } }
        select option { background:#ffffff; color:#111827 }
        input[type=date]::-webkit-calendar-picker-indicator { filter: invert(1) opacity(0.4) }
        * { box-sizing: border-box }
      `}</style>

      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Back */}
        <button onClick={() => router.back()} style={{
          background:"none", border:"none", color: muted,
          fontSize:"13px", cursor:"pointer", display:"flex", alignItems:"center",
          gap:"6px", marginBottom:"20px", padding:0
        }}>← Back</button>

        {/* Lock banner */}
        {isLocked && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 12, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>🔒</span>
            <span style={{ fontSize: 13, color: red, fontWeight: 600 }}>
              This period is locked. Recording new payments is disabled.
            </span>
          </div>
        )}

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Skeleton h={100} />
            <Skeleton h={200} />
            <Skeleton h={150} />
          </div>
        ) : invoice ? (
          <div style={{ animation: "fadeIn 0.4s ease" }}>
            {/* Header card */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "20px", marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 12, color: muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Invoice</p>
                  <h1 style={{ margin: "4px 0 8px", fontSize: 22, fontWeight: 800 }}>{student?.name ?? "—"}</h1>
                  <p style={{ margin: 0, fontSize: 13, color: muted }}>Adm: {student?.admission_number ?? "—"}</p>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: muted }}>{invoice.term} {invoice.year}</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                  <StatusChip status={invoice.status} />
                  {isOverdue && daysOverdue > 0 && (
                    <span style={{ background: "rgba(239,68,68,0.15)", color: red, fontSize: 11, fontWeight: 700,
                      padding: "3px 10px", borderRadius: 20 }}>
                      {daysOverdue}d overdue
                    </span>
                  )}
                  <p style={{ margin: 0, fontSize: 12, color: muted }}>
                    Due: {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString("en-KE") : "—"}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ marginTop: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: muted }}>Paid: <strong style={{ color: accent }}>{fmt(invoice.paid_amount ?? 0)}</strong></span>
                  <span style={{ fontSize: 12, color: muted }}>Total: <strong style={{ color: "#111827" }}>{fmt(invoice.total_amount ?? 0)}</strong></span>
                </div>
                <div style={{ height: 8, background: "#f8fafc", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${paidPct}%`, background: paidPct >= 100 ? accent : amber,
                    borderRadius: 99, transition: "width 0.6s ease" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                  <span style={{ fontSize: 12, color: muted }}>{paidPct.toFixed(0)}% collected</span>
                  <span style={{ fontSize: 12, color: balance > 0 ? red : accent }}>
                    Balance: {fmt(balance)}
                  </span>
                </div>
              </div>
            </div>

            {/* Line items */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "20px", marginBottom: 16 }}>
              <h2 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700 }}>Invoice Lines</h2>
              {lines.length === 0 ? (
                <p style={{ color: muted, fontSize: 13, margin: 0 }}>No line items.</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", fontSize: 11, color: muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", paddingBottom: 10 }}>Description</th>
                      <th style={{ textAlign: "right", fontSize: 11, color: muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", paddingBottom: 10 }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, i) => (
                      <tr key={line.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "12px 0", fontSize: 14, color: "#111827" }}>{line.description}</td>
                        <td style={{ padding: "12px 0", fontSize: 14, color: "#111827", textAlign: "right" }}>{fmt(line.amount)}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "12px 0", fontSize: 14, fontWeight: 700, color: "#111827" }}>Total</td>
                      <td style={{ padding: "12px 0", fontSize: 14, fontWeight: 700, color: accent, textAlign: "right" }}>{fmt(invoice.total_amount)}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

            {/* Payment history */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "20px", marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Payment History</h2>
                <span style={{ fontSize: 12, color: muted }}>{payments.length} payment{payments.length !== 1 ? "s" : ""}</span>
              </div>
              {payments.length === 0 ? (
                <p style={{ color: muted, fontSize: 13, margin: 0 }}>No payments recorded yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {payments.map(pay => (
                    <div key={pay.id} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <MethodIcon method={pay.method} />
                          {pay.receipt_number && (
                            <span style={{ fontSize: 12, color: muted, fontFamily: "monospace" }}>{pay.receipt_number}</span>
                          )}
                        </div>
                        <span style={{ fontSize: 15, fontWeight: 700, color: accent }}>{fmt(pay.amount)}</span>
                      </div>
                      <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 12 }}>
                        {pay.reference && (
                          <span style={{ fontSize: 12, color: muted }}>Ref: <span style={{ color: "#111827" }}>{pay.reference}</span></span>
                        )}
                        {pay.received_at && (
                          <span style={{ fontSize: 12, color: muted }}>
                            {new Date(pay.received_at).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                      {pay.notes && (
                        <p style={{ margin: "6px 0 0", fontSize: 12, color: muted }}>{pay.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Record payment button */}
            {invoice.status !== "paid" && invoice.status !== "waived" && (
              <button
                onClick={() => !isLocked && setShowModal(true)}
                disabled={isLocked}
                style={{
                  width: "100%", padding: "15px", borderRadius: 14,
                  background: isLocked ? "#f8fafc" : accent,
                  color: isLocked ? muted : dark,
                  border: "none", fontSize: 15, fontWeight: 800,
                  cursor: isLocked ? "not-allowed" : "pointer",
                  transition: "opacity 0.2s",
                }}
              >
                {isLocked ? "🔒 Period Locked" : "Record Payment"}
              </button>
            )}
          </div>
        ) : (
          <p style={{ color: muted }}>Invoice not found.</p>
        )}
      </div>

      {/* Payment modal */}
      {showModal && invoice && (
        <Modal title="Record Payment" onClose={() => setShowModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={labelStyle}>Amount (KES)</label>
              <input
                type="number"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                style={inputStyle}
                placeholder={`Balance: ${fmt(balance)}`}
              />
            </div>
            <div>
              <label style={labelStyle}>Payment Method</label>
              <select
                value={form.method}
                onChange={e => setForm(f => ({ ...f, method: e.target.value }))}
                style={inputStyle}
              >
                <option value="mpesa">📱 M-Pesa</option>
                <option value="cash">💵 Cash</option>
                <option value="bank">🏦 Bank</option>
                <option value="cheque">📝 Cheque</option>
              </select>
            </div>
            {(form.method === "bank" || form.method === "mpesa") && bankAccounts.length > 0 && (
              <div>
                <label style={labelStyle}>Bank / Float Account</label>
                <select
                  value={form.bank_account_id}
                  onChange={e => setForm(f => ({ ...f, bank_account_id: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="">— Select account —</option>
                  {bankAccounts.map(ba => (
                    <option key={ba.id} value={ba.id}>{ba.name} ({ba.type})</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label style={labelStyle}>Reference / Transaction Code</label>
              <input
                type="text"
                value={form.reference}
                onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                style={inputStyle}
                placeholder="e.g. QHG7X2..."
              />
            </div>
            <div>
              <label style={labelStyle}>Notes (optional)</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                style={{ ...inputStyle, minHeight: 72, resize: "vertical" }}
                placeholder="Any additional notes..."
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                width: "100%", padding: "14px", borderRadius: 12,
                background: submitting ? "rgba(16,185,129,0.4)" : accent,
                color: dark, border: "none", fontSize: 15, fontWeight: 800,
                cursor: submitting ? "not-allowed" : "pointer", marginTop: 4,
              }}
            >
              {submitting ? "Recording…" : `Record Payment`}
            </button>
          </div>
        </Modal>
      )}

      {/* Toast */}
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
