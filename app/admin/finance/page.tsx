"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

const deepspace = "#0a0a14"
const accent    = "#10b981"
const amber     = "#f59e0b"
const red       = "#ef4444"
const violet    = "#8b5cf6"
const surface   = "rgba(255,255,255,0.03)"
const border    = "rgba(255,255,255,0.08)"
const muted     = "rgba(255,255,255,0.4)"
const white     = "#ffffff"

type Tab = "overview" | "invoices" | "payments" | "expenses"

interface BankAccount {
  id:              string
  name:            string
  type:            string
  current_balance: number
  is_active:       boolean
}

interface InvoiceRow {
  id:           string
  student_id:   string
  student_name: string
  term:         string
  year:         number
  status:       string
  total_amount: number
  paid_amount:  number
  due_date:     string | null
  created_at:   string
}

interface PaymentRow {
  id:             string
  student_id:     string
  student_name:   string
  amount:         number
  method:         string
  reference:      string | null
  receipt_number: string | null
  received_at:    string
  notes:          string | null
}

interface ExpenseRow {
  id:           string
  amount:       number
  description:  string
  vendor:       string | null
  paid_via:     string | null
  expense_date: string
  created_at:   string
}

interface PeriodRow {
  id:     string
  term:   string
  year:   number
  status: string
}

interface Summary {
  totalInvoiced:   number
  totalCollected:  number
  totalOutstanding: number
  totalExpenses:   number
  overdueCount:    number
  cashPosition:    number
}

function Skeleton({ h = 48, w = "100%" }: { h?: number; w?: string }) {
  return (
    <div style={{
      height:          h,
      width:           w,
      borderRadius:    10,
      background:      "linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.08) 50%,rgba(255,255,255,0.04) 75%)",
      backgroundSize:  "200% 100%",
      animation:       "shimmer 1.4s infinite",
    }} />
  )
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    paid:    { bg: "rgba(16,185,129,0.15)", color: accent,  label: "Paid" },
    partial: { bg: "rgba(245,158,11,0.15)", color: amber,   label: "Partial" },
    issued:  { bg: "rgba(139,92,246,0.15)", color: violet,  label: "Issued" },
    overdue: { bg: "rgba(239,68,68,0.15)",  color: red,     label: "Overdue" },
    draft:   { bg: "rgba(255,255,255,0.06)",color: muted,   label: "Draft" },
    waived:  { bg: "rgba(255,255,255,0.06)",color: muted,   label: "Waived" },
    open:    { bg: "rgba(16,185,129,0.15)", color: accent,  label: "Open" },
    closed:  { bg: "rgba(239,68,68,0.15)",  color: red,     label: "Closed" },
    locked:  { bg: "rgba(239,68,68,0.2)",   color: red,     label: "Locked" },
  }
  const s = map[status] ?? { bg: "rgba(255,255,255,0.06)", color: muted, label: status }
  return (
    <span style={{
      background:   s.bg,
      color:        s.color,
      fontSize:     "11px",
      fontWeight:   "600",
      padding:      "3px 10px",
      borderRadius: "20px",
      whiteSpace:   "nowrap",
    }}>
      {s.label}
    </span>
  )
}

function MethodChip({ method }: { method: string }) {
  const map: Record<string, string> = {
    mpesa:  "#10b981",
    cash:   "#f59e0b",
    bank:   "#8b5cf6",
    cheque: "#6b7280",
  }
  return (
    <span style={{
      background:   `${map[method] ?? "#6b7280"}22`,
      color:        map[method] ?? muted,
      fontSize:     "11px",
      fontWeight:   "600",
      padding:      "3px 10px",
      borderRadius: "20px",
      textTransform:"uppercase",
    }}>
      {method}
    </span>
  )
}

function AgingBadge({ dueDate, status }: { dueDate: string | null; status: string }) {
  if (status === "paid" || status === "waived") return null
  if (!dueDate) return null
  const days = Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000)
  if (days <= 0) return null
  const color = days > 90 ? red : days > 60 ? "#f97316" : days > 30 ? amber : muted
  return (
    <span style={{ color, fontSize: "11px", fontWeight: "600" }}>
      {days}d overdue
    </span>
  )
}

export default function FinancePage() {
  const router = useRouter()

  const [tab,        setTab]        = useState<Tab>("overview")
  const [schoolId,   setSchoolId]   = useState("")
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [toast,      setToast]      = useState("")

  const [accounts,   setAccounts]   = useState<BankAccount[]>([])
  const [invoices,   setInvoices]   = useState<InvoiceRow[]>([])
  const [payments,   setPayments]   = useState<PaymentRow[]>([])
  const [expenses,   setExpenses]   = useState<ExpenseRow[]>([])
  const [periods,    setPeriods]    = useState<PeriodRow[]>([])
  const [summary,    setSummary]    = useState<Summary>({
    totalInvoiced: 0, totalCollected: 0, totalOutstanding: 0,
    totalExpenses: 0, overdueCount: 0, cashPosition: 0,
  })

  const [showPayModal,  setShowPayModal]  = useState(false)
  const [showExpModal,  setShowExpModal]  = useState(false)

  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  const currentTerm = currentMonth <= 4 ? "Term 1" : currentMonth <= 8 ? "Term 2" : "Term 3"

  const [payForm, setPayForm] = useState({
    invoice_id:      "",
    student_id:      "",
    amount:          "",
    method:          "mpesa",
    reference:       "",
    notes:           "",
    bank_account_id: "",
  })

  const [expForm, setExpForm] = useState({
    description:     "",
    amount:          "",
    vendor:          "",
    paid_via:        "mpesa",
    expense_date:    new Date().toISOString().split("T")[0],
    bank_account_id: "",
  })

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(""), 3500)
  }

  const load = useCallback(async (sid: string) => {
    setLoading(true)
    try {
      const [
        accRes,
        invRes,
        payRes,
        expRes,
        perRes,
      ] = await Promise.all([
        supabase
          .from("finance_bank_accounts")
          .select("id,name,type,current_balance,is_active")
          .eq("school_id", sid)
          .eq("is_active", true)
          .is("deleted_at", null),

        supabase
          .from("finance_invoices")
          .select("id,student_id,term,year,status,total_amount,paid_amount,due_date,created_at")
          .eq("school_id", sid)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(100),

        supabase
          .from("finance_payments")
          .select("id,student_id,amount,method,reference,receipt_number,received_at,notes,invoice_id")
          .eq("school_id", sid)
          .is("deleted_at", null)
          .order("received_at", { ascending: false })
          .limit(50),

        supabase
          .from("finance_expenses")
          .select("id,amount,description,vendor,paid_via,expense_date,created_at")
          .eq("school_id", sid)
          .is("deleted_at", null)
          .order("expense_date", { ascending: false })
          .limit(50),

        supabase
          .from("finance_periods")
          .select("id,term,year,status")
          .eq("school_id", sid)
          .order("year", { ascending: false }),
      ])

      const rawInvoices = invRes.data ?? []
      const rawPayments = payRes.data ?? []

      // Collect unique student IDs from invoices and payments
      const studentIds = Array.from(new Set([
        ...rawInvoices.map((i: { student_id: string }) => i.student_id),
        ...rawPayments.map((p: { student_id: string }) => p.student_id),
      ])).filter(Boolean)

      let studentMap: Record<string, string> = {}
      if (studentIds.length > 0) {
        const { data: studs } = await supabase
          .from("students")
          .select("id,name")
          .in("id", studentIds)
        ;(studs ?? []).forEach((s: { id: string; name: string }) => {
          studentMap[s.id] = s.name
        })
      }

      const invoiceRows: InvoiceRow[] = rawInvoices.map((i: {
        id: string; student_id: string; term: string; year: number;
        status: string; total_amount: number; paid_amount: number;
        due_date: string | null; created_at: string
      }) => ({
        ...i,
        student_name: studentMap[i.student_id] ?? "Unknown",
      }))

      const paymentRows: PaymentRow[] = rawPayments.map((p: {
        id: string; student_id: string; amount: number; method: string;
        reference: string | null; receipt_number: string | null;
        received_at: string; notes: string | null
      }) => ({
        ...p,
        student_name: studentMap[p.student_id] ?? "Unknown",
      }))

      const expenseRows: ExpenseRow[] = expRes.data ?? []
      const accountRows: BankAccount[] = accRes.data ?? []
      const periodRows: PeriodRow[]    = perRes.data ?? []

      // Summary calculations
      const termInvoices = invoiceRows.filter(
        i => i.term === currentTerm && i.year === currentYear
      )
      const totalInvoiced    = termInvoices.reduce((s, i) => s + Number(i.total_amount), 0)
      const totalCollected   = termInvoices.reduce((s, i) => s + Number(i.paid_amount),  0)
      const totalOutstanding = totalInvoiced - totalCollected
      const now = Date.now()
      const overdueCount = invoiceRows.filter(i =>
        i.due_date &&
        new Date(i.due_date).getTime() < now &&
        i.status !== "paid" &&
        i.status !== "waived"
      ).length
      const termExpenses = expenseRows
        .filter(e => {
          const d = new Date(e.expense_date)
          const m = d.getMonth() + 1
          const t = m <= 4 ? "Term 1" : m <= 8 ? "Term 2" : "Term 3"
          return t === currentTerm && d.getFullYear() === currentYear
        })
        .reduce((s, e) => s + Number(e.amount), 0)
      const cashPosition = accountRows.reduce((s, a) => s + Number(a.current_balance), 0)

      setAccounts(accountRows)
      setInvoices(invoiceRows)
      setPayments(paymentRows)
      setExpenses(expenseRows)
      setPeriods(periodRows)
      setSummary({
        totalInvoiced,
        totalCollected,
        totalOutstanding,
        totalExpenses: termExpenses,
        overdueCount,
        cashPosition,
      })
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [currentTerm, currentYear])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/admin/login"); return }
      const { data: p } = await supabase
        .from("profiles")
        .select("school_id")
        .eq("id", user.id)
        .single()
      if (!p?.school_id) { router.push("/admin/login"); return }
      setSchoolId(p.school_id)
      await load(p.school_id)
    }
    init()
  }, [router, load])

  // Check if current period is open
  const currentPeriod = periods.find(
    p => p.term === currentTerm && p.year === currentYear
  )
  const periodLocked = currentPeriod?.status === "locked" || currentPeriod?.status === "closed"

  async function handleRecordPayment() {
    if (periodLocked) {
      showToast(`${currentTerm} ${currentYear} is ${currentPeriod?.status} — cannot post`)
      return
    }
    if (!payForm.invoice_id || !payForm.amount || !payForm.student_id) {
      showToast("Select invoice and enter amount")
      return
    }
    setSaving(true)
    try {
      const { data: pay, error } = await supabase
        .from("finance_payments")
        .insert({
          school_id:       schoolId,
          invoice_id:      payForm.invoice_id,
          student_id:      payForm.student_id,
          amount:          Number(payForm.amount),
          method:          payForm.method,
          reference:       payForm.reference || null,
          notes:           payForm.notes || null,
          bank_account_id: payForm.bank_account_id || null,
          received_at:     new Date().toISOString(),
        })
        .select("id")
        .single()

      if (error) throw error

      // Notify parent via notifications table
      const { data: link } = await supabase
        .from("parent_student_links")
        .select("parent_id")
        .eq("student_id", payForm.student_id)
        .eq("is_primary", true)
        .single()

      if (link?.parent_id && pay?.id) {
        const inv = invoices.find(i => i.id === payForm.invoice_id)
        const stuName = inv?.student_name ?? "your child"
        await supabase.from("notifications").insert({
          school_id:  schoolId,
          user_id:    link.parent_id,
          title:      "Fee Payment Received",
          body:       `KES ${Number(payForm.amount).toLocaleString()} received for ${stuName}. Ref: ${payForm.reference || "N/A"}. Tap to view receipt.`,
          type:       "fee_payment",
          related_id: pay.id,
        })
      }

      showToast("Payment recorded successfully")
      setShowPayModal(false)
      setPayForm({ invoice_id: "", student_id: "", amount: "", method: "mpesa", reference: "", notes: "", bank_account_id: "" })
      await load(schoolId)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to record payment"
      showToast(msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleRecordExpense() {
    if (periodLocked) {
      showToast(`${currentTerm} ${currentYear} is ${currentPeriod?.status} — cannot post`)
      return
    }
    if (!expForm.description || !expForm.amount) {
      showToast("Enter description and amount")
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase
        .from("finance_expenses")
        .insert({
          school_id:       schoolId,
          amount:          Number(expForm.amount),
          description:     expForm.description,
          vendor:          expForm.vendor || null,
          paid_via:        expForm.paid_via,
          expense_date:    expForm.expense_date,
          bank_account_id: expForm.bank_account_id || null,
        })

      if (error) throw error

      showToast("Expense recorded")
      setShowExpModal(false)
      setExpForm({ description: "", amount: "", vendor: "", paid_via: "mpesa", expense_date: new Date().toISOString().split("T")[0], bank_account_id: "" })
      await load(schoolId)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to record expense"
      showToast(msg)
    } finally {
      setSaving(false)
    }
  }

  const fmt = (n: number) => `KES ${n.toLocaleString("en-KE", { minimumFractionDigits: 0 })}`

  const inputStyle: React.CSSProperties = {
    width:        "100%",
    padding:      "11px 14px",
    background:   "rgba(255,255,255,0.05)",
    border:       `1px solid ${border}`,
    borderRadius: "10px",
    color:        white,
    fontSize:     "14px",
    outline:      "none",
  }

  const labelStyle: React.CSSProperties = {
    fontSize:     "12px",
    color:        muted,
    marginBottom: "6px",
    display:      "block",
  }

  // Invoice select options — unpaid only
  const unpaidInvoices = invoices.filter(i => i.status !== "paid" && i.status !== "waived")

  return (
    <div style={{ color: white, fontFamily: "'Inter', sans-serif" }}>

      <style>{`
        @keyframes shimmer {
          0%   { background-position:  200% 0 }
          100% { background-position: -200% 0 }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px) }
          to   { opacity: 1; transform: translateY(0) }
        }
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(40px) }
          to   { opacity: 1; transform: translateX(0) }
        }
        select option { background: #1a1a2e; color: #fff; }
      `}</style>

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position:     "fixed",
          bottom:       "24px",
          right:        "20px",
          background:   accent,
          color:        white,
          padding:      "12px 20px",
          borderRadius: "12px",
          fontSize:     "13px",
          fontWeight:   "600",
          zIndex:       200,
          animation:    "toastIn 0.3s ease",
          maxWidth:     "300px",
          boxShadow:    "0 8px 24px rgba(0,0,0,0.4)",
        }}>
          {toast}
        </div>
      )}

      {/* ── Header ── */}
      <div style={{
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        marginBottom:   "24px",
        flexWrap:       "wrap",
        gap:            "12px",
      }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "700", margin: 0 }}>Finance</h1>
          <p style={{ fontSize: "13px", color: muted, margin: "4px 0 0" }}>
            {currentTerm} {currentYear}
            {currentPeriod && (
              <span style={{
                marginLeft:   "10px",
                background:   currentPeriod.status === "open" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                color:        currentPeriod.status === "open" ? accent : red,
                fontSize:     "11px",
                fontWeight:   "600",
                padding:      "2px 10px",
                borderRadius: "20px",
              }}>
                {currentPeriod.status.toUpperCase()}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => setShowExpModal(true)}
            style={{
              padding:      "10px 18px",
              borderRadius: "10px",
              border:       `1px solid ${border}`,
              background:   surface,
              color:        white,
              fontSize:     "13px",
              fontWeight:   "600",
              cursor:       "pointer",
            }}
          >
            + Expense
          </button>
          <button
            onClick={() => setShowPayModal(true)}
            style={{
              padding:      "10px 18px",
              borderRadius: "10px",
              border:       "none",
              background:   accent,
              color:        white,
              fontSize:     "13px",
              fontWeight:   "600",
              cursor:       "pointer",
            }}
          >
            + Payment
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{
        display:      "flex",
        gap:          "4px",
        marginBottom: "24px",
        background:   surface,
        padding:      "4px",
        borderRadius: "12px",
        border:       `1px solid ${border}`,
        overflowX:    "auto",
      }}>
        {(["overview", "invoices", "payments", "expenses"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex:         1,
              padding:      "9px 16px",
              borderRadius: "9px",
              border:       "none",
              background:   tab === t ? "rgba(16,185,129,0.15)" : "transparent",
              color:        tab === t ? accent : muted,
              fontSize:     "13px",
              fontWeight:   tab === t ? "600" : "400",
              cursor:       "pointer",
              whiteSpace:   "nowrap",
              textTransform:"capitalize",
              transition:   "all 0.15s ease",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════
          OVERVIEW TAB
      ══════════════════════════════════════════ */}
      {tab === "overview" && (
        <div style={{ animation: "slideUp 0.3s ease" }}>

          {/* Summary cards */}
          <div style={{
            display:             "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap:                 "12px",
            marginBottom:        "24px",
          }}>
            {loading ? (
              [1,2,3,4,5,6].map(i => <Skeleton key={i} h={90} />)
            ) : (
              <>
                {[
                  { label: "Cash Position",  value: fmt(summary.cashPosition),    color: accent,  icon: "🏦" },
                  { label: "Invoiced",        value: fmt(summary.totalInvoiced),   color: violet,  icon: "📄" },
                  { label: "Collected",       value: fmt(summary.totalCollected),  color: accent,  icon: "✅" },
                  { label: "Outstanding",     value: fmt(summary.totalOutstanding),color: amber,   icon: "⏳" },
                  { label: "Expenses",        value: fmt(summary.totalExpenses),   color: red,     icon: "💸" },
                  { label: "Overdue",         value: `${summary.overdueCount} invoices`, color: red, icon: "🚨" },
                ].map(card => (
                  <div key={card.label} style={{
                    background:   surface,
                    border:       `1px solid ${border}`,
                    borderRadius: "14px",
                    padding:      "16px",
                  }}>
                    <div style={{ fontSize: "20px", marginBottom: "8px" }}>{card.icon}</div>
                    <div style={{ fontSize: "11px", color: muted, marginBottom: "4px" }}>{card.label}</div>
                    <div style={{ fontSize: "15px", fontWeight: "700", color: card.color }}>{card.value}</div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Collection progress */}
          {!loading && summary.totalInvoiced > 0 && (
            <div style={{
              background:   surface,
              border:       `1px solid ${border}`,
              borderRadius: "14px",
              padding:      "20px",
              marginBottom: "24px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                <span style={{ fontSize: "13px", fontWeight: "600" }}>
                  {currentTerm} Collection Progress
                </span>
                <span style={{ fontSize: "13px", color: accent, fontWeight: "700" }}>
                  {Math.round((summary.totalCollected / summary.totalInvoiced) * 100)}%
                </span>
              </div>
              <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: "999px", height: "8px" }}>
                <div style={{
                  width:        `${Math.min(100, (summary.totalCollected / summary.totalInvoiced) * 100)}%`,
                  height:       "8px",
                  borderRadius: "999px",
                  background:   `linear-gradient(90deg, ${accent}, #34d399)`,
                  transition:   "width 0.6s ease",
                }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px" }}>
                <span style={{ fontSize: "11px", color: muted }}>Collected {fmt(summary.totalCollected)}</span>
                <span style={{ fontSize: "11px", color: amber }}>Outstanding {fmt(summary.totalOutstanding)}</span>
              </div>
            </div>
          )}

          {/* Bank accounts */}
          <div style={{
            background:   surface,
            border:       `1px solid ${border}`,
            borderRadius: "14px",
            padding:      "20px",
            marginBottom: "24px",
          }}>
            <div style={{ fontSize: "13px", fontWeight: "600", marginBottom: "16px" }}>
              Cash Position
            </div>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {[1,2,3].map(i => <Skeleton key={i} h={44} />)}
              </div>
            ) : accounts.length === 0 ? (
              <p style={{ fontSize: "13px", color: muted, textAlign: "center", padding: "16px 0" }}>
                No bank accounts configured
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {accounts.map(acc => (
                  <div key={acc.id} style={{
                    display:        "flex",
                    alignItems:     "center",
                    justifyContent: "space-between",
                    padding:        "12px 14px",
                    background:     "rgba(255,255,255,0.03)",
                    borderRadius:   "10px",
                    border:         `1px solid ${border}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "18px" }}>
                        {acc.type === "mpesa" ? "📱" : acc.type === "bank" ? "🏦" : "💵"}
                      </span>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: "600" }}>{acc.name}</div>
                        <div style={{ fontSize: "11px", color: muted, textTransform: "capitalize" }}>{acc.type}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: "15px", fontWeight: "700", color: accent }}>
                      {fmt(Number(acc.current_balance))}
                    </div>
                  </div>
                ))}
                <div style={{
                  display:        "flex",
                  justifyContent: "space-between",
                  padding:        "12px 14px",
                  borderTop:      `1px solid ${border}`,
                  marginTop:      "4px",
                }}>
                  <span style={{ fontSize: "13px", fontWeight: "700" }}>Total</span>
                  <span style={{ fontSize: "15px", fontWeight: "700", color: accent }}>
                    {fmt(summary.cashPosition)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Period status */}
          <div style={{
            background:   surface,
            border:       `1px solid ${border}`,
            borderRadius: "14px",
            padding:      "20px",
          }}>
            <div style={{ fontSize: "13px", fontWeight: "600", marginBottom: "16px" }}>
              Accounting Periods
            </div>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {[1,2,3].map(i => <Skeleton key={i} h={40} />)}
              </div>
            ) : periods.length === 0 ? (
              <p style={{ fontSize: "13px", color: muted, textAlign: "center", padding: "16px 0" }}>
                No periods configured
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {periods.slice(0, 6).map(p => (
                  <div key={p.id} style={{
                    display:        "flex",
                    alignItems:     "center",
                    justifyContent: "space-between",
                    padding:        "10px 14px",
                    background:     "rgba(255,255,255,0.02)",
                    borderRadius:   "10px",
                  }}>
                    <span style={{ fontSize: "13px" }}>{p.term} {p.year}</span>
                    <StatusChip status={p.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          INVOICES TAB
      ══════════════════════════════════════════ */}
      {tab === "invoices" && (
        <div style={{ animation: "slideUp 0.3s ease" }}>
          <div style={{
            background:   surface,
            border:       `1px solid ${border}`,
            borderRadius: "14px",
            overflow:     "hidden",
          }}>
            {loading ? (
              <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {[1,2,3,4,5].map(i => <Skeleton key={i} h={64} />)}
              </div>
            ) : invoices.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 20px" }}>
                <div style={{ fontSize: "32px", marginBottom: "12px" }}>📄</div>
                <p style={{ fontSize: "14px", color: muted }}>No invoices yet</p>
              </div>
            ) : (
              invoices.map((inv, idx) => (
                <div key={inv.id} style={{
                  padding:      "14px 18px",
                  borderBottom: idx < invoices.length - 1 ? `1px solid ${border}` : "none",
                  display:      "flex",
                  alignItems:   "center",
                  gap:          "12px",
                  flexWrap:     "wrap",
                }}>
                  <div style={{ flex: 1, minWidth: "120px" }}>
                    <div style={{ fontSize: "13px", fontWeight: "600" }}>{inv.student_name}</div>
                    <div style={{ fontSize: "11px", color: muted, marginTop: "2px" }}>
                      {inv.term} {inv.year}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", minWidth: "100px" }}>
                    <div style={{ fontSize: "13px", fontWeight: "600" }}>{fmt(Number(inv.total_amount))}</div>
                    <div style={{ fontSize: "11px", color: muted }}>
                      Paid {fmt(Number(inv.paid_amount))}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-end" }}>
                    <StatusChip status={inv.status} />
                    <AgingBadge dueDate={inv.due_date} status={inv.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          PAYMENTS TAB
      ══════════════════════════════════════════ */}
      {tab === "payments" && (
        <div style={{ animation: "slideUp 0.3s ease" }}>
          <div style={{
            background:   surface,
            border:       `1px solid ${border}`,
            borderRadius: "14px",
            overflow:     "hidden",
          }}>
            {loading ? (
              <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {[1,2,3,4,5].map(i => <Skeleton key={i} h={64} />)}
              </div>
            ) : payments.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 20px" }}>
                <div style={{ fontSize: "32px", marginBottom: "12px" }}>💳</div>
                <p style={{ fontSize: "14px", color: muted }}>No payments recorded yet</p>
              </div>
            ) : (
              payments.map((pay, idx) => (
                <div key={pay.id} style={{
                  padding:      "14px 18px",
                  borderBottom: idx < payments.length - 1 ? `1px solid ${border}` : "none",
                  display:      "flex",
                  alignItems:   "center",
                  gap:          "12px",
                  flexWrap:     "wrap",
                }}>
                  <div style={{ flex: 1, minWidth: "120px" }}>
                    <div style={{ fontSize: "13px", fontWeight: "600" }}>{pay.student_name}</div>
                    <div style={{ fontSize: "11px", color: muted, marginTop: "2px" }}>
                      {pay.receipt_number ?? "No receipt no."}
                      {pay.reference ? ` · ${pay.reference}` : ""}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: accent }}>
                      {fmt(Number(pay.amount))}
                    </div>
                    <div style={{ fontSize: "11px", color: muted, marginTop: "2px" }}>
                      {new Date(pay.received_at).toLocaleDateString("en-KE")}
                    </div>
                  </div>
                  <MethodChip method={pay.method} />
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          EXPENSES TAB
      ══════════════════════════════════════════ */}
      {tab === "expenses" && (
        <div style={{ animation: "slideUp 0.3s ease" }}>
          <div style={{
            background:   surface,
            border:       `1px solid ${border}`,
            borderRadius: "14px",
            overflow:     "hidden",
          }}>
            {loading ? (
              <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {[1,2,3,4,5].map(i => <Skeleton key={i} h={64} />)}
              </div>
            ) : expenses.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 20px" }}>
                <div style={{ fontSize: "32px", marginBottom: "12px" }}>💸</div>
                <p style={{ fontSize: "14px", color: muted }}>No expenses recorded yet</p>
              </div>
            ) : (
              expenses.map((exp, idx) => (
                <div key={exp.id} style={{
                  padding:      "14px 18px",
                  borderBottom: idx < expenses.length - 1 ? `1px solid ${border}` : "none",
                  display:      "flex",
                  alignItems:   "center",
                  gap:          "12px",
                  flexWrap:     "wrap",
                }}>
                  <div style={{ flex: 1, minWidth: "120px" }}>
                    <div style={{ fontSize: "13px", fontWeight: "600" }}>{exp.description}</div>
                    <div style={{ fontSize: "11px", color: muted, marginTop: "2px" }}>
                      {exp.vendor ? `${exp.vendor} · ` : ""}
                      {new Date(exp.expense_date).toLocaleDateString("en-KE")}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: red }}>
                      {fmt(Number(exp.amount))}
                    </div>
                    {exp.paid_via && <MethodChip method={exp.paid_via} />}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          RECORD PAYMENT MODAL
      ══════════════════════════════════════════ */}
      {showPayModal && (
        <div style={{
          position:       "fixed",
          inset:          0,
          background:     "rgba(0,0,0,0.75)",
          zIndex:         100,
          display:        "flex",
          alignItems:     "flex-end",
          justifyContent: "center",
          backdropFilter: "blur(4px)",
        }}>
          <div style={{
            background:   "#0f0f1a",
            border:       `1px solid ${border}`,
            borderRadius: "20px 20px 0 0",
            padding:      "24px 20px 36px",
            width:        "100%",
            maxWidth:     "520px",
            maxHeight:    "90vh",
            overflowY:    "auto",
            animation:    "slideUp 0.3s ease",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "17px", fontWeight: "700", margin: 0 }}>Record Payment</h2>
              <button
                onClick={() => setShowPayModal(false)}
                style={{ background: "none", border: "none", color: muted, fontSize: "22px", cursor: "pointer" }}
              >
                ×
              </button>
            </div>

            {periodLocked && (
              <div style={{
                background:   "rgba(239,68,68,0.1)",
                border:       `1px solid rgba(239,68,68,0.3)`,
                borderRadius: "10px",
                padding:      "12px 14px",
                marginBottom: "16px",
                fontSize:     "13px",
                color:        red,
              }}>
                ⚠ {currentTerm} {currentYear} is {currentPeriod?.status}. Cannot post new transactions.
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={labelStyle}>Invoice *</label>
                <select
                  value={payForm.invoice_id}
                  onChange={e => {
                    const inv = invoices.find(i => i.id === e.target.value)
                    setPayForm(f => ({
                      ...f,
                      invoice_id: e.target.value,
                      student_id: inv?.student_id ?? "",
                      amount: inv ? String(Number(inv.total_amount) - Number(inv.paid_amount)) : "",
                    }))
                  }}
                  style={{ ...inputStyle, appearance: "none" }}
                >
                  <option value="">Select invoice</option>
                  {unpaidInvoices.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.student_name} — {i.term} {i.year} — Outstanding {fmt(Number(i.total_amount) - Number(i.paid_amount))}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Amount (KES) *</label>
                <input
                  type="number"
                  value={payForm.amount}
                  onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Method *</label>
                <select
                  value={payForm.method}
                  onChange={e => setPayForm(f => ({ ...f, method: e.target.value }))}
                  style={{ ...inputStyle, appearance: "none" }}
                >
                  <option value="mpesa">Mpesa</option>
                  <option value="cash">Cash</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Reference / Transaction Code</label>
                <input
                  type="text"
                  value={payForm.reference}
                  onChange={e => setPayForm(f => ({ ...f, reference: e.target.value }))}
                  placeholder="e.g. QK7X2Y3Z4A"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Bank Account</label>
                <select
                  value={payForm.bank_account_id}
                  onChange={e => setPayForm(f => ({ ...f, bank_account_id: e.target.value }))}
                  style={{ ...inputStyle, appearance: "none" }}
                >
                  <option value="">Select account (optional)</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Notes</label>
                <input
                  type="text"
                  value={payForm.notes}
                  onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional notes"
                  style={inputStyle}
                />
              </div>

              <button
                onClick={handleRecordPayment}
                disabled={saving || periodLocked}
                style={{
                  width:        "100%",
                  padding:      "14px",
                  borderRadius: "12px",
                  border:       "none",
                  background:   saving || periodLocked ? "rgba(16,185,129,0.4)" : accent,
                  color:        white,
                  fontSize:     "15px",
                  fontWeight:   "700",
                  cursor:       saving || periodLocked ? "not-allowed" : "pointer",
                  marginTop:    "4px",
                }}
              >
                {saving ? "Recording..." : "Record Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          RECORD EXPENSE MODAL
      ══════════════════════════════════════════ */}
      {showExpModal && (
        <div style={{
          position:       "fixed",
          inset:          0,
          background:     "rgba(0,0,0,0.75)",
          zIndex:         100,
          display:        "flex",
          alignItems:     "flex-end",
          justifyContent: "center",
          backdropFilter: "blur(4px)",
        }}>
          <div style={{
            background:   "#0f0f1a",
            border:       `1px solid ${border}`,
            borderRadius: "20px 20px 0 0",
            padding:      "24px 20px 36px",
            width:        "100%",
            maxWidth:     "520px",
            maxHeight:    "90vh",
            overflowY:    "auto",
            animation:    "slideUp 0.3s ease",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "17px", fontWeight: "700", margin: 0 }}>Record Expense</h2>
              <button
                onClick={() => setShowExpModal(false)}
                style={{ background: "none", border: "none", color: muted, fontSize: "22px", cursor: "pointer" }}
              >
                ×
              </button>
            </div>

            {periodLocked && (
              <div style={{
                background:   "rgba(239,68,68,0.1)",
                border:       `1px solid rgba(239,68,68,0.3)`,
                borderRadius: "10px",
                padding:      "12px 14px",
                marginBottom: "16px",
                fontSize:     "13px",
                color:        red,
              }}>
                ⚠ {currentTerm} {currentYear} is {currentPeriod?.status}. Cannot post new transactions.
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={labelStyle}>Description *</label>
                <input
                  type="text"
                  value={expForm.description}
                  onChange={e => setExpForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. Chalk and stationery"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Amount (KES) *</label>
                <input
                  type="number"
                  value={expForm.amount}
                  onChange={e => setExpForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Vendor</label>
                <input
                  type="text"
                  value={expForm.vendor}
                  onChange={e => setExpForm(f => ({ ...f, vendor: e.target.value }))}
                  placeholder="Supplier name (optional)"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Paid Via *</label>
                <select
                  value={expForm.paid_via}
                  onChange={e => setExpForm(f => ({ ...f, paid_via: e.target.value }))}
                  style={{ ...inputStyle, appearance: "none" }}
                >
                  <option value="mpesa">Mpesa</option>
                  <option value="cash">Cash</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Date *</label>
                <input
                  type="date"
                  value={expForm.expense_date}
                  onChange={e => setExpForm(f => ({ ...f, expense_date: e.target.value }))}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Bank Account</label>
                <select
                  value={expForm.bank_account_id}
                  onChange={e => setExpForm(f => ({ ...f, bank_account_id: e.target.value }))}
                  style={{ ...inputStyle, appearance: "none" }}
                >
                  <option value="">Select account (optional)</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleRecordExpense}
                disabled={saving || periodLocked}
                style={{
                  width:        "100%",
                  padding:      "14px",
                  borderRadius: "12px",
                  border:       "none",
                  background:   saving || periodLocked ? "rgba(239,68,68,0.4)" : red,
                  color:        white,
                  fontSize:     "15px",
                  fontWeight:   "700",
                  cursor:       saving || periodLocked ? "not-allowed" : "pointer",
                  marginTop:    "4px",
                }}
              >
                {saving ? "Recording..." : "Record Expense"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
