"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

const dark    = "#0a1628"
const accent  = "#10b981"
const amber   = "#f59e0b"
const red     = "#ef4444"
const violet  = "#8b5cf6"
const blue    = "#3b82f6"
const border  = "#e2e8f0"
const muted   = "#6b7280"
const white   = "#ffffff"
const card    = "#ffffff"
const surface = "#f8fafc"

type Tab = "overview" | "invoices" | "payments" | "expenses"

interface BankAccount {
  id:              string
  name:            string
  type:            string
  current_balance: number | null
  is_active:       boolean | null
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
  created_at:   string | null
}

interface PaymentRow {
  id:             string
  student_id:     string
  student_name:   string
  amount:         number
  method:         string
  reference:      string | null
  receipt_number: string | null
  received_at:    string | null
  notes:          string | null
}

interface ExpenseRow {
  id:           string
  amount:       number
  description:  string
  vendor:       string | null
  paid_via:     string | null
  expense_date: string
}

interface PeriodRow {
  id:     string
  term:   string
  year:   number
  status: string
}

interface Summary {
  totalInvoiced:    number
  totalCollected:   number
  totalOutstanding: number
  totalExpenses:    number
  overdueCount:     number
  cashPosition:     number
  collectionRate:   number
}

function getTerm(month: number): string {
  return month <= 4 ? "Term 1" : month <= 8 ? "Term 2" : "Term 3"
}

function Skeleton({ h = 48 }: { h?: number }) {
  return (
    <div style={{
      height:         h,
      borderRadius:   12,
      background:     "linear-gradient(90deg,#e5e7eb 25%,#d1d5db 50%,#e5e7eb 75%)",
      backgroundSize: "200% 100%",
      animation:      "shimmer 1.4s infinite",
    }} />
  )
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    paid:    ["rgba(16,185,129,0.15)",  accent],
    partial: ["rgba(245,158,11,0.15)",  amber],
    issued:  ["rgba(139,92,246,0.15)",  violet],
    overdue: ["rgba(239,68,68,0.15)",   red],
    draft:   ["#f8fafc", muted],
    waived:  ["#f8fafc", muted],
    open:    ["rgba(16,185,129,0.15)",  accent],
    closed:  ["rgba(239,68,68,0.15)",   red],
    locked:  ["rgba(239,68,68,0.2)",    red],
  }
  const [bg, color] = map[status] ?? ["#f8fafc", muted]
  const label = status.charAt(0).toUpperCase() + status.slice(1)
  return (
    <span style={{ background: bg, color, fontSize: "11px", fontWeight: "700", padding: "3px 12px", borderRadius: "20px", whiteSpace: "nowrap", letterSpacing: "0.3px" }}>
      {label}
    </span>
  )
}

function MethodIcon({ method }: { method: string }) {
  const map: Record<string, [string, string]> = {
    mpesa:  ["📱", accent],
    cash:   ["💵", amber],
    bank:   ["🏦", blue],
    cheque: ["📝", muted],
  }
  const [icon, color] = map[method] ?? ["💳", muted]
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: `${color}18`, color, fontSize: "11px", fontWeight: "700", padding: "3px 10px", borderRadius: "20px", textTransform: "uppercase" }}>
      {icon} {method}
    </span>
  )
}

function AgingBadge({ dueDate, status }: { dueDate: string | null; status: string }) {
  if (status === "paid" || status === "waived" || !dueDate) return null
  const days = Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000)
  if (days <= 0) return null
  const color = days > 90 ? red : days > 60 ? "#f97316" : days > 30 ? amber : muted
  return <span style={{ color, fontSize: "11px", fontWeight: "700" }}>{days}d overdue</span>
}

function AgingBar({ invoices }: { invoices: InvoiceRow[] }) {
  const now    = Date.now()
  const unpaid = invoices.filter(i => i.status !== "paid" && i.status !== "waived" && i.due_date)
  const buckets = [
    { label: "Current", color: accent,    count: unpaid.filter(i => new Date(i.due_date!).getTime() >= now).length },
    { label: "1-30d",   color: amber,     count: unpaid.filter(i => { const d = Math.floor((now - new Date(i.due_date!).getTime()) / 86400000); return d > 0 && d <= 30 }).length },
    { label: "31-60d",  color: "#f97316", count: unpaid.filter(i => { const d = Math.floor((now - new Date(i.due_date!).getTime()) / 86400000); return d > 30 && d <= 60 }).length },
    { label: "61-90d",  color: red,       count: unpaid.filter(i => { const d = Math.floor((now - new Date(i.due_date!).getTime()) / 86400000); return d > 60 && d <= 90 }).length },
    { label: "90d+",    color: "#7f1d1d", count: unpaid.filter(i => Math.floor((now - new Date(i.due_date!).getTime()) / 86400000) > 90).length },
  ]
  const total = unpaid.length || 1
  return (
    <div>
      <div style={{ display: "flex", gap: "3px", height: "8px", borderRadius: "99px", overflow: "hidden", marginBottom: "10px" }}>
        {buckets.map(b => (
          b.count > 0 ? (
            <div key={b.label} style={{ flex: b.count / total, background: b.color, transition: "flex 0.6s ease" }} />
          ) : null
        ))}
      </div>
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        {buckets.map(b => (
          <div key={b.label} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: b.color }} />
            <span style={{ fontSize: "11px", color: muted }}>{b.label}</span>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#111827" }}>{b.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function FinancePage() {
  const router = useRouter()

  const [tab,      setTab]      = useState<Tab>("overview")
  const [schoolId, setSchoolId] = useState("")
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [toast,    setToast]    = useState({ msg: "", type: "success" })
  const [search,   setSearch]   = useState("")

  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [periods,  setPeriods]  = useState<PeriodRow[]>([])
  const [summary,  setSummary]  = useState<Summary>({
    totalInvoiced: 0, totalCollected: 0, totalOutstanding: 0,
    totalExpenses: 0, overdueCount: 0, cashPosition: 0, collectionRate: 0,
  })

  const [showPayModal, setShowPayModal] = useState(false)
  const [showExpModal, setShowExpModal] = useState(false)

  const currentYear  = useMemo(() => new Date().getFullYear(),  [])
  const currentMonth = useMemo(() => new Date().getMonth() + 1, [])
  const currentTerm  = useMemo(() => getTerm(currentMonth),     [currentMonth])

  const [payForm, setPayForm] = useState({
    invoice_id: "", student_id: "", amount: "",
    method: "mpesa", reference: "", notes: "", bank_account_id: "",
  })
  const [expForm, setExpForm] = useState({
    description: "", amount: "", vendor: "", paid_via: "mpesa",
    expense_date: new Date().toISOString().split("T")[0], bank_account_id: "",
  })

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type })
    setTimeout(() => setToast({ msg: "", type: "success" }), 3500)
  }

  const load = useCallback(async (sid: string) => {
    setLoading(true)
    try {
      const [accRes, invRes, payRes, expRes, perRes] = await Promise.all([
        supabase.from("finance_bank_accounts").select("id,name,type,current_balance,is_active").eq("school_id", sid).eq("is_active", true).is("deleted_at", null),
        supabase.from("finance_invoices").select("id,student_id,term,year,status,total_amount,paid_amount,due_date,created_at").eq("school_id", sid).is("deleted_at", null).order("created_at", { ascending: false }).limit(200),
        supabase.from("finance_payments").select("id,student_id,amount,method,reference,receipt_number,received_at,notes").eq("school_id", sid).is("deleted_at", null).order("received_at", { ascending: false }).limit(100),
        supabase.from("finance_expenses").select("id,amount,description,vendor,paid_via,expense_date").eq("school_id", sid).is("deleted_at", null).order("expense_date", { ascending: false }).limit(100),
        supabase.from("finance_periods").select("id,term,year,status").eq("school_id", sid).order("year", { ascending: false }),
      ])

      const rawInv = invRes.data ?? []
      const rawPay = payRes.data ?? []

      const studentIds = Array.from(new Set([
        ...rawInv.map((i: { student_id: string }) => i.student_id),
        ...rawPay.map((p: { student_id: string }) => p.student_id),
      ])).filter(Boolean)

      const studentMap: Record<string, string> = {}
      if (studentIds.length > 0) {
        const { data: studs } = await supabase.from("students").select("id,name").in("id", studentIds)
        ;(studs ?? []).forEach((s: { id: string; name: string }) => { studentMap[s.id] = s.name })
      }

      const invoiceRows: InvoiceRow[] = rawInv.map(i => ({
        ...i,
        student_name: studentMap[i.student_id] ?? "Unknown",
      }))

      const paymentRows: PaymentRow[] = rawPay.map(p => ({
        ...p,
        student_name: studentMap[p.student_id] ?? "Unknown",
      }))

      const accountRows: BankAccount[] = accRes.data ?? []
      const expenseRows: ExpenseRow[]  = expRes.data ?? []
      const periodRows:  PeriodRow[]   = perRes.data ?? []

      const termInv          = invoiceRows.filter(i => i.term === currentTerm && i.year === currentYear)
      const totalInvoiced    = termInv.reduce((s, i) => s + Number(i.total_amount), 0)
      const totalCollected   = termInv.reduce((s, i) => s + Number(i.paid_amount),  0)
      const totalOutstanding = totalInvoiced - totalCollected
      const collectionRate   = totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 100) : 0
      const now              = Date.now()
      const overdueCount     = invoiceRows.filter(i =>
        i.due_date && new Date(i.due_date).getTime() < now &&
        i.status !== "paid" && i.status !== "waived"
      ).length
      const totalExpenses = expenseRows.filter(e => {
        const d = new Date(e.expense_date)
        const m = d.getMonth() + 1
        return getTerm(m) === currentTerm && d.getFullYear() === currentYear
      }).reduce((s, e) => s + Number(e.amount), 0)
      const cashPosition = accountRows.reduce((s, a) => s + Number(a.current_balance), 0)

      setAccounts(accountRows)
      setInvoices(invoiceRows)
      setPayments(paymentRows)
      setExpenses(expenseRows)
      setPeriods(periodRows)
      setSummary({ totalInvoiced, totalCollected, totalOutstanding, totalExpenses, overdueCount, cashPosition, collectionRate })
    } catch (e) { console.error(e); setToast({ msg: 'Something went wrong. Please try again.', type: 'error' }) }
    finally { setLoading(false) }
  }, [currentTerm, currentYear])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/admin/login"); return }
      const { data: p } = await supabase.from("profiles").select("school_id").eq("id", user.id).single()
      if (!p?.school_id) { router.push("/admin/login"); return }
      setSchoolId(p.school_id)
      await load(p.school_id)
    }
    init()
  }, [router, load])

  const currentPeriod = periods.find(p => p.term === currentTerm && p.year === currentYear)
  const periodMissing = !currentPeriod
  const periodLocked  = !currentPeriod || currentPeriod.status === "locked" || currentPeriod.status === "closed"

  async function handleRecordPayment() {
    if (periodLocked) {
      showToast(periodMissing ? `No period for ${currentTerm} ${currentYear} — ask admin to create one` : `${currentTerm} ${currentYear} is ${currentPeriod?.status} — cannot post`, "error")
      return
    }
    if (!payForm.invoice_id)                       { showToast("Select an invoice", "error"); return }
    if (!payForm.student_id)                       { showToast("Invoice missing student — re-select", "error"); return }
    if (!payForm.amount || Number(payForm.amount) <= 0) { showToast("Enter a valid amount", "error"); return }
    setSaving(true)
    try {
      const { data: pay, error } = await supabase
        .from("finance_payments")
        .insert({
          school_id: schoolId, invoice_id: payForm.invoice_id, student_id: payForm.student_id,
          amount: Number(payForm.amount), method: payForm.method,
          reference: payForm.reference || null, notes: payForm.notes || null,
          bank_account_id: payForm.bank_account_id || null,
          received_at: new Date().toISOString(),
        })
        .select("id").single()
      if (error) throw error
      const { data: link } = await supabase.from("parent_student_links").select("parent_id").eq("student_id", payForm.student_id).eq("is_primary", true).single()
      if (link?.parent_id && pay?.id) {
        const inv = invoices.find(i => i.id === payForm.invoice_id)
        await supabase.from("notifications").insert({
          school_id: schoolId, user_id: link.parent_id,
          title: "Fee Payment Received",
          body: `KES ${Number(payForm.amount).toLocaleString()} received for ${inv?.student_name ?? "your child"}. Ref: ${payForm.reference || "N/A"}. Tap to view receipt.`,
          type: "fee_payment", related_id: pay.id,
        })
      }
      showToast("Payment recorded — parent notified")
      setShowPayModal(false)
      setPayForm({ invoice_id: "", student_id: "", amount: "", method: "mpesa", reference: "", notes: "", bank_account_id: "" })
      await load(schoolId)
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Failed to record payment", "error")
    } finally { setSaving(false) }
  }

  async function handleRecordExpense() {
    if (periodLocked) {
      showToast(periodMissing ? `No period for ${currentTerm} ${currentYear} — ask admin to create one` : `${currentTerm} ${currentYear} is ${currentPeriod?.status} — cannot post`, "error")
      return
    }
    if (!expForm.description)                       { showToast("Enter a description", "error"); return }
    if (!expForm.amount || Number(expForm.amount) <= 0) { showToast("Enter a valid amount", "error"); return }
    setSaving(true)
    try {
      const { error } = await supabase.from("finance_expenses").insert({
        school_id: schoolId, amount: Number(expForm.amount), description: expForm.description,
        vendor: expForm.vendor || null, paid_via: expForm.paid_via,
        expense_date: expForm.expense_date, bank_account_id: expForm.bank_account_id || null,
      })
      if (error) throw error
      showToast("Expense recorded")
      setShowExpModal(false)
      setExpForm({ description: "", amount: "", vendor: "", paid_via: "mpesa", expense_date: new Date().toISOString().split("T")[0], bank_account_id: "" })
      await load(schoolId)
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Failed to record expense", "error")
    } finally { setSaving(false) }
  }

  const fmt  = (n: number) => `KES ${Number(n).toLocaleString("en-KE", { minimumFractionDigits: 0 })}`
  const fmtK = (n: number) => n >= 1000000 ? `KES ${(n/1000000).toFixed(1)}M` : n >= 1000 ? `KES ${(n/1000).toFixed(0)}K` : fmt(n)

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 14px",
    background: "#f8fafc", border: "1px solid #e2e8f0",
    borderRadius: "10px", color: "#111827",
    fontSize: "14px", outline: "none", boxSizing: "border-box",
  }

  const labelStyle: React.CSSProperties = {
    fontSize: "11px", color: "#6b7280",
    marginBottom: "6px", display: "block",
    fontWeight: "600", letterSpacing: "0.5px", textTransform: "uppercase",
  }

  const unpaidInvoices   = invoices.filter(i => i.status !== "paid" && i.status !== "waived")
  const filteredInvoices = invoices.filter(i => !search || i.student_name.toLowerCase().includes(search.toLowerCase()) || i.term.toLowerCase().includes(search.toLowerCase()))
  const filteredPayments = payments.filter(p => !search || p.student_name.toLowerCase().includes(search.toLowerCase()) || (p.reference ?? "").toLowerCase().includes(search.toLowerCase()) || (p.receipt_number ?? "").toLowerCase().includes(search.toLowerCase()))
  const filteredExpenses = expenses.filter(e => !search || e.description.toLowerCase().includes(search.toLowerCase()) || (e.vendor ?? "").toLowerCase().includes(search.toLowerCase()))

  const Modal = ({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center", backdropFilter: "blur(6px)" }}>
      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "24px 24px 0 0", padding: "24px 20px 40px", width: "100%", maxWidth: "540px", maxHeight: "92vh", overflowY: "auto", animation: "slideUp 0.3s ease" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "800", margin: 0, color: "#111827" }}>{title}</h2>
          <button onClick={onClose} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", color: "#111827", width: "32px", height: "32px", borderRadius: "50%", cursor: "pointer", fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center" }}>x</button>
        </div>
        {periodLocked && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "12px", padding: "12px 16px", marginBottom: "20px", fontSize: "13px", color: red, display: "flex", gap: "8px", alignItems: "center" }}>
            <span>🔒</span>
            <span>{periodMissing ? `No period for ${currentTerm} ${currentYear}. Ask admin to create one.` : `${currentTerm} ${currentYear} is ${currentPeriod?.status}. Unlock to post.`}</span>
          </div>
        )}
        {children}
      </div>
    </div>
  )

  return (
    <div style={{ color: "#111827", fontFamily: "'Inter', sans-serif", maxWidth: "900px" }}>
      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
        @keyframes slideUp { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
        @keyframes fadeIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes pulse   { 0%,100% { opacity:1 } 50% { opacity:0.5 } }
        select option { background:#ffffff; color:#111827 }
        input[type=date]::-webkit-calendar-picker-indicator { filter: invert(1) opacity(0.4) }
        input::placeholder { color: #9ca3af }
      `}</style>

      {toast.msg && (
        <div style={{ position: "fixed", bottom: "88px", right: "16px", zIndex: 300, background: toast.type === "error" ? red : accent, color: "#111827", padding: "14px 22px", borderRadius: "14px", fontSize: "13px", fontWeight: "700", animation: "slideUp 0.3s ease", boxShadow: "0 12px 40px rgba(0,0,0,0.5)", maxWidth: "320px", display: "flex", alignItems: "center", gap: "10px" }}>
          <span>{toast.type === "error" ? "!" : "✓"}</span>
          {toast.msg}
        </div>
      )}

      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "14px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px" }}>
              <h1 style={{ fontSize: "24px", fontWeight: "800", margin: 0, letterSpacing: "-0.5px" }}>Finance</h1>
              {currentPeriod ? (
                <span style={{ background: currentPeriod.status === "open" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)", color: currentPeriod.status === "open" ? accent : red, fontSize: "11px", fontWeight: "700", padding: "4px 12px", borderRadius: "20px", letterSpacing: "0.5px" }}>
                  {currentPeriod.status === "open" ? "OPEN" : `🔒 ${currentPeriod.status.toUpperCase()}`}
                </span>
              ) : (
                <span style={{ background: "rgba(239,68,68,0.15)", color: red, fontSize: "11px", fontWeight: "700", padding: "4px 12px", borderRadius: "20px" }}>NO PERIOD</span>
              )}
            </div>
            <p style={{ fontSize: "12px", color: muted, margin: 0 }}>{currentTerm} {currentYear} · School financial command center</p>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {[
              { label: "Generate", href: "/admin/finance/invoices/generate" },
              { label: "Mpesa",    href: "/admin/finance/reconciliation"     },
              { label: "Reports",  href: "/admin/finance/reports"            },
              { label: "Approvals", href: "/admin/finance/approvals"          },
            ].map(btn => (
              <button key={btn.label} onClick={() => router.push(btn.href)} style={{ padding: "9px 14px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "#f8fafc", color: "#374151", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>
                {btn.label}
              </button>
            ))}
            <button onClick={() => setShowExpModal(true)} style={{ padding: "9px 16px", borderRadius: "10px", border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: red, fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>
              + Expense
            </button>
            <button onClick={() => setShowPayModal(true)} style={{ padding: "9px 18px", borderRadius: "10px", border: "none", background: `linear-gradient(135deg, ${accent}, #059669)`, color: "#111827", fontSize: "13px", fontWeight: "700", cursor: "pointer", boxShadow: "0 4px 16px rgba(16,185,129,0.25)" }}>
              + Payment
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: "10px", marginBottom: "20px" }}>
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} h={88} />)}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: "10px", marginBottom: "20px" }}>
          {[
            { label: "Cash Position", value: fmtK(summary.cashPosition),    sub: `${accounts.length} account${accounts.length !== 1 ? "s" : ""}`, icon: "🏦", color: accent,  glow: "rgba(16,185,129,0.1)"  },
            { label: "Collected",     value: fmtK(summary.totalCollected),   sub: `${summary.collectionRate}% rate`,    icon: "✅", color: accent,  glow: "rgba(16,185,129,0.08)" },
            { label: "Outstanding",   value: fmtK(summary.totalOutstanding), sub: `of ${fmtK(summary.totalInvoiced)}`,  icon: "⏳", color: amber,   glow: "rgba(245,158,11,0.08)" },
            { label: "Expenses",      value: fmtK(summary.totalExpenses),    sub: `${currentTerm} spend`,               icon: "💸", color: red,     glow: "rgba(239,68,68,0.08)"  },
            { label: "Overdue",       value: `${summary.overdueCount}`,      sub: "invoices past due",                  icon: "🚨", color: summary.overdueCount > 0 ? red : muted, glow: summary.overdueCount > 0 ? "rgba(239,68,68,0.08)" : "transparent" },
            { label: "Net Position",  value: fmtK(summary.cashPosition - summary.totalExpenses), sub: "cash minus expenses", icon: "📈", color: (summary.cashPosition - summary.totalExpenses) >= 0 ? accent : red, glow: "rgba(139,92,246,0.08)" },
          ].map(kpi => (
            <div key={kpi.label} style={{ background: kpi.glow, border: "1px solid #e2e8f0", borderRadius: "14px", padding: "16px 14px" }}>
              <div style={{ fontSize: "20px", marginBottom: "8px" }}>{kpi.icon}</div>
              <div style={{ fontSize: "10px", color: muted, fontWeight: "600", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: "4px" }}>{kpi.label}</div>
              <div style={{ fontSize: "16px", fontWeight: "800", color: kpi.color, letterSpacing: "-0.3px" }}>{kpi.value}</div>
              <div style={{ fontSize: "10px", color: muted, marginTop: "2px" }}>{kpi.sub}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: "2px", marginBottom: "20px", background: "#ffffff", padding: "4px", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
        {(["overview","invoices","payments","expenses"] as Tab[]).map(t => (
          <button key={t} onClick={() => { setTab(t); setSearch("") }} style={{ flex: 1, padding: "10px 8px", borderRadius: "10px", border: "none", background: tab === t ? "rgba(16,185,129,0.15)" : "transparent", color: tab === t ? accent : "#6b7280", fontSize: "12px", fontWeight: tab === t ? "700" : "500", cursor: "pointer", whiteSpace: "nowrap", textTransform: "capitalize", transition: "all 0.15s ease" }}>
            {t === "overview" ? "Overview" : t === "invoices" ? `Invoices${invoices.length > 0 ? ` (${invoices.length})` : ""}` : t === "payments" ? "Payments" : "Expenses"}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div style={{ animation: "fadeIn 0.3s ease", display: "flex", flexDirection: "column", gap: "16px" }}>

          {!loading && periodMissing && (
            <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "14px", padding: "16px 18px", display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <span style={{ fontSize: "20px" }}>⚠️</span>
              <div>
                <div style={{ fontSize: "13px", fontWeight: "700", color: red, marginBottom: "2px" }}>No accounting period for {currentTerm} {currentYear}</div>
                <div style={{ fontSize: "12px", color: muted }}>Payments and expenses cannot be posted until a period is created.</div>
              </div>
            </div>
          )}

          {!loading && summary.totalInvoiced > 0 && (
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: "700", marginBottom: "3px" }}>{currentTerm} Collection</div>
                  <div style={{ fontSize: "11px", color: muted }}>Invoiced {fmt(summary.totalInvoiced)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "28px", fontWeight: "800", color: summary.collectionRate >= 80 ? accent : summary.collectionRate >= 50 ? amber : red, lineHeight: 1 }}>{summary.collectionRate}%</div>
                  <div style={{ fontSize: "10px", color: muted, marginTop: "2px" }}>collected</div>
                </div>
              </div>
              <div style={{ background: "#f8fafc", borderRadius: "99px", height: "10px", marginBottom: "12px", overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, summary.collectionRate)}%`, height: "100%", borderRadius: "99px", transition: "width 0.8s ease", background: summary.collectionRate >= 80 ? `linear-gradient(90deg, ${accent}, #34d399)` : summary.collectionRate >= 50 ? `linear-gradient(90deg, ${amber}, #fbbf24)` : `linear-gradient(90deg, ${red}, #f87171)` }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "12px", color: accent, fontWeight: "600" }}>✓ {fmt(summary.totalCollected)} collected</span>
                <span style={{ fontSize: "12px", color: amber, fontWeight: "600" }}>⏳ {fmt(summary.totalOutstanding)} outstanding</span>
              </div>
            </div>
          )}

          {!loading && invoices.length > 0 && (
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div style={{ fontSize: "13px", fontWeight: "700" }}>Invoice Aging</div>
                <button onClick={() => setTab("invoices")} style={{ background: "none", border: "none", color: accent, fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>View all</button>
              </div>
              <AgingBar invoices={invoices} />
            </div>
          )}

          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "20px" }}>
            <div style={{ fontSize: "13px", fontWeight: "700", marginBottom: "16px" }}>Cash Position</div>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>{[1,2,3].map(i => <Skeleton key={i} h={52} />)}</div>
            ) : accounts.length === 0 ? (
              <p style={{ fontSize: "13px", color: muted, textAlign: "center", padding: "20px 0" }}>No bank accounts configured</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {accounts.map(acc => (
                  <div key={acc.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: acc.type === "mpesa" ? "rgba(16,185,129,0.15)" : acc.type === "bank" ? "rgba(59,130,246,0.15)" : "rgba(245,158,11,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>
                        {acc.type === "mpesa" ? "📱" : acc.type === "bank" ? "🏦" : "💵"}
                      </div>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: "600" }}>{acc.name}</div>
                        <div style={{ fontSize: "11px", color: muted, textTransform: "capitalize" }}>{acc.type}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: "16px", fontWeight: "800", color: Number(acc.current_balance) >= 0 ? accent : red }}>{fmt(Number(acc.current_balance))}</div>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", borderTop: "1px solid #e2e8f0", marginTop: "4px" }}>
                  <span style={{ fontSize: "13px", fontWeight: "800" }}>Total</span>
                  <span style={{ fontSize: "18px", fontWeight: "800", color: accent }}>{fmt(summary.cashPosition)}</span>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <div style={{ fontSize: "12px", fontWeight: "700" }}>Recent Payments</div>
                <button onClick={() => setTab("payments")} style={{ background: "none", border: "none", color: accent, fontSize: "11px", cursor: "pointer" }}>all</button>
              </div>
              {loading ? <Skeleton h={120} /> : payments.slice(0,4).length === 0 ? (
                <p style={{ fontSize: "12px", color: muted, textAlign: "center", padding: "12px 0" }}>None yet</p>
              ) : payments.slice(0,4).map(p => (
                <div key={p.id} style={{ marginBottom: "10px" }}>
                  <div style={{ fontSize: "12px", fontWeight: "600", marginBottom: "1px" }}>{p.student_name}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "11px", color: muted }}>{p.received_at
  ? new Date(p.received_at).toLocaleDateString("en-KE", {
      day: "numeric",
      month: "short",
    })
  : "—"}</span>
                    <span style={{ fontSize: "12px", fontWeight: "700", color: accent }}>{fmtK(Number(p.amount))}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <div style={{ fontSize: "12px", fontWeight: "700" }}>Recent Expenses</div>
                <button onClick={() => setTab("expenses")} style={{ background: "none", border: "none", color: accent, fontSize: "11px", cursor: "pointer" }}>all</button>
              </div>
              {loading ? <Skeleton h={120} /> : expenses.slice(0,4).length === 0 ? (
                <p style={{ fontSize: "12px", color: muted, textAlign: "center", padding: "12px 0" }}>None yet</p>
              ) : expenses.slice(0,4).map(e => (
                <div key={e.id} style={{ marginBottom: "10px" }}>
                  <div style={{ fontSize: "12px", fontWeight: "600", marginBottom: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.description}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "11px", color: muted }}>{e.vendor ?? new Date(e.expense_date).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}</span>
                    <span style={{ fontSize: "12px", fontWeight: "700", color: red }}>{fmtK(Number(e.amount))}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "20px" }}>
            <div style={{ fontSize: "13px", fontWeight: "700", marginBottom: "16px" }}>Accounting Periods</div>
            {loading ? <Skeleton h={100} /> : periods.length === 0 ? (
              <p style={{ fontSize: "13px", color: muted, textAlign: "center", padding: "16px 0" }}>No periods configured</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {periods.slice(0,6).map(p => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: p.term === currentTerm && p.year === currentYear ? "rgba(16,185,129,0.06)" : surface, borderRadius: "10px", border: p.term === currentTerm && p.year === currentYear ? "1px solid rgba(16,185,129,0.2)" : "1px solid transparent" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      {p.term === currentTerm && p.year === currentYear && <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: accent, animation: "pulse 2s infinite" }} />}
                      <span style={{ fontSize: "13px", fontWeight: p.term === currentTerm && p.year === currentYear ? "700" : "400" }}>{p.term} {p.year}</span>
                    </div>
                    <StatusChip status={p.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "invoices" && (
        <div style={{ animation: "fadeIn 0.3s ease" }}>
          <div style={{ marginBottom: "14px", display: "flex", gap: "10px", alignItems: "center" }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student or term..." style={inputStyle} />
            {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", color: muted, cursor: "pointer", fontSize: "18px" }}>x</button>}
          </div>
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", overflow: "hidden" }}>
            {loading ? (
              <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>{[1,2,3,4,5].map(i => <Skeleton key={i} h={68} />)}</div>
            ) : filteredInvoices.length === 0 ? (
              <div style={{ textAlign: "center", padding: "56px 20px" }}>
                <div style={{ fontSize: "36px", marginBottom: "12px" }}>📄</div>
                <p style={{ fontSize: "14px", color: muted, fontWeight: "600" }}>No invoices found</p>
                <p style={{ fontSize: "12px", color: muted, marginTop: "4px" }}>Create invoices from the student profile</p>
              </div>
            ) : (
              filteredInvoices.map((inv, idx) => (
                <div key={inv.id} style={{ padding: "16px 18px", borderBottom: idx < filteredInvoices.length - 1 ? `1px solid ${border}` : "none", display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", cursor: "pointer" }} onClick={() => router.push(`/admin/finance/invoices/${inv.id}`)}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: inv.status === "paid" ? "rgba(16,185,129,0.15)" : inv.status === "partial" ? "rgba(245,158,11,0.15)" : "rgba(139,92,246,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: 0 }}>
                    {inv.status === "paid" ? "✅" : inv.status === "partial" ? "⏳" : "📄"}
                  </div>
                  <div style={{ flex: 1, minWidth: "120px" }}>
                    <div style={{ fontSize: "13px", fontWeight: "700", marginBottom: "2px" }}>{inv.student_name}</div>
                    <div style={{ fontSize: "11px", color: muted }}>{inv.term} {inv.year}</div>
                  </div>
                  <div style={{ textAlign: "right", minWidth: "100px" }}>
                    <div style={{ fontSize: "14px", fontWeight: "800" }}>{fmt(Number(inv.total_amount))}</div>
                    <div style={{ fontSize: "11px", color: muted }}>Paid {fmt(Number(inv.paid_amount))}</div>
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

      {tab === "payments" && (
        <div style={{ animation: "fadeIn 0.3s ease" }}>
          <div style={{ marginBottom: "14px", display: "flex", gap: "10px", alignItems: "center" }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student, reference, receipt..." style={inputStyle} />
            {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", color: muted, cursor: "pointer", fontSize: "18px" }}>x</button>}
          </div>
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", overflow: "hidden" }}>
            {loading ? (
              <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>{[1,2,3,4,5].map(i => <Skeleton key={i} h={68} />)}</div>
            ) : filteredPayments.length === 0 ? (
              <div style={{ textAlign: "center", padding: "56px 20px" }}>
                <div style={{ fontSize: "36px", marginBottom: "12px" }}>💳</div>
                <p style={{ fontSize: "14px", color: muted, fontWeight: "600" }}>No payments recorded yet</p>
                <button onClick={() => setShowPayModal(true)} style={{ marginTop: "12px", padding: "10px 20px", borderRadius: "10px", border: "none", background: accent, color: "#111827", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>Record first payment</button>
              </div>
            ) : (
              filteredPayments.map((pay, idx) => (
                <div key={pay.id} style={{ padding: "16px 18px", borderBottom: idx < filteredPayments.length - 1 ? `1px solid ${border}` : "none", display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", cursor: "pointer" }} onClick={() => router.push(`/admin/finance/receipt/${pay.id}`)}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: 0 }}>
                    {pay.method === "mpesa" ? "📱" : pay.method === "bank" ? "🏦" : "💵"}
                  </div>
                  <div style={{ flex: 1, minWidth: "120px" }}>
                    <div style={{ fontSize: "13px", fontWeight: "700", marginBottom: "2px" }}>{pay.student_name}</div>
                    <div style={{ fontSize: "11px", color: muted }}>{pay.receipt_number ?? "—"}{pay.reference ? ` · ${pay.reference}` : ""}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "16px", fontWeight: "800", color: accent }}>{fmt(Number(pay.amount))}</div>
                    <div style={{ fontSize: "11px", color: muted, marginTop: "2px" }}>{pay.received_at
  ? new Date(pay.received_at).toLocaleDateString("en-KE", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  : "—"}</div>
                  </div>
                  <MethodIcon method={pay.method} />
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === "expenses" && (
        <div style={{ animation: "fadeIn 0.3s ease" }}>
          <div style={{ marginBottom: "14px", display: "flex", gap: "10px", alignItems: "center" }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search description or vendor..." style={inputStyle} />
            {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", color: muted, cursor: "pointer", fontSize: "18px" }}>x</button>}
          </div>
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", overflow: "hidden" }}>
            {loading ? (
              <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>{[1,2,3,4,5].map(i => <Skeleton key={i} h={68} />)}</div>
            ) : filteredExpenses.length === 0 ? (
              <div style={{ textAlign: "center", padding: "56px 20px" }}>
                <div style={{ fontSize: "36px", marginBottom: "12px" }}>💸</div>
                <p style={{ fontSize: "14px", color: muted, fontWeight: "600" }}>No expenses recorded yet</p>
                <button onClick={() => setShowExpModal(true)} style={{ marginTop: "12px", padding: "10px 20px", borderRadius: "10px", border: "none", background: red, color: "#111827", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>Record first expense</button>
              </div>
            ) : (
              filteredExpenses.map((exp, idx) => (
                <div key={exp.id} style={{ padding: "16px 18px", borderBottom: idx < filteredExpenses.length - 1 ? `1px solid ${border}` : "none", display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: 0 }}>💸</div>
                  <div style={{ flex: 1, minWidth: "120px" }}>
                    <div style={{ fontSize: "13px", fontWeight: "700", marginBottom: "2px" }}>{exp.description}</div>
                    <div style={{ fontSize: "11px", color: muted }}>{exp.vendor ? `${exp.vendor} · ` : ""}{new Date(exp.expense_date).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "16px", fontWeight: "800", color: red }}>{fmt(Number(exp.amount))}</div>
                    {exp.paid_via && <MethodIcon method={exp.paid_via} />}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {showPayModal && (
        <Modal title="Record Payment" onClose={() => setShowPayModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={labelStyle}>Invoice *</label>
              {unpaidInvoices.length === 0 ? (
                <div style={{ padding: "14px", background: "#f8fafc", borderRadius: "10px", fontSize: "13px", color: muted, textAlign: "center" }}>No unpaid invoices found</div>
              ) : (
                <select value={payForm.invoice_id} onChange={e => { const inv = invoices.find(i => i.id === e.target.value); const balance = inv ? String(Math.max(0, Number(inv.total_amount) - Number(inv.paid_amount))) : ""; setPayForm(f => ({ ...f, invoice_id: e.target.value, student_id: inv?.student_id ?? "", amount: balance })) }} style={{ ...inputStyle, appearance: "none" }}>
                  <option value="">Select invoice</option>
                  {unpaidInvoices.map(i => (
                    <option key={i.id} value={i.id}>{i.student_name} — {i.term} {i.year} — Balance {fmt(Math.max(0, Number(i.total_amount) - Number(i.paid_amount)))}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label style={labelStyle}>Amount (KES) *</label>
              <input type="number" min="1" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" style={inputStyle} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={labelStyle}>Method *</label>
                <select value={payForm.method} onChange={e => setPayForm(f => ({ ...f, method: e.target.value }))} style={{ ...inputStyle, appearance: "none" }}>
                  <option value="mpesa">Mpesa</option>
                  <option value="cash">Cash</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Bank Account</label>
                <select value={payForm.bank_account_id} onChange={e => setPayForm(f => ({ ...f, bank_account_id: e.target.value }))} style={{ ...inputStyle, appearance: "none" }}>
                  <option value="">Auto</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Reference / Transaction Code</label>
              <input type="text" value={payForm.reference} onChange={e => setPayForm(f => ({ ...f, reference: e.target.value }))} placeholder="e.g. QK7X2Y3Z4A" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Notes</label>
              <input type="text" value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" style={inputStyle} />
            </div>
            <button onClick={handleRecordPayment} disabled={saving || periodLocked || unpaidInvoices.length === 0} style={{ width: "100%", padding: "15px", borderRadius: "12px", border: "none", background: saving || periodLocked || unpaidInvoices.length === 0 ? "rgba(16,185,129,0.3)" : `linear-gradient(135deg, ${accent}, #059669)`, color: "#111827", fontSize: "15px", fontWeight: "800", cursor: saving || periodLocked || unpaidInvoices.length === 0 ? "not-allowed" : "pointer", marginTop: "4px" }}>
              {saving ? "Recording..." : "Record Payment"}
            </button>
          </div>
        </Modal>
      )}

      {showExpModal && (
        <Modal title="Record Expense" onClose={() => setShowExpModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={labelStyle}>Description *</label>
              <input type="text" value={expForm.description} onChange={e => setExpForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Chalk and stationery" style={inputStyle} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={labelStyle}>Amount (KES) *</label>
                <input type="number" min="1" value={expForm.amount} onChange={e => setExpForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Date *</label>
                <input type="date" value={expForm.expense_date} onChange={e => setExpForm(f => ({ ...f, expense_date: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Vendor</label>
              <input type="text" value={expForm.vendor} onChange={e => setExpForm(f => ({ ...f, vendor: e.target.value }))} placeholder="Supplier name (optional)" style={inputStyle} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={labelStyle}>Paid Via *</label>
                <select value={expForm.paid_via} onChange={e => setExpForm(f => ({ ...f, paid_via: e.target.value }))} style={{ ...inputStyle, appearance: "none" }}>
                  <option value="mpesa">Mpesa</option>
                  <option value="cash">Cash</option>
                  <option value="bank">Bank</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Bank Account</label>
                <select value={expForm.bank_account_id} onChange={e => setExpForm(f => ({ ...f, bank_account_id: e.target.value }))} style={{ ...inputStyle, appearance: "none" }}>
                  <option value="">Auto</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>
            <button onClick={handleRecordExpense} disabled={saving || periodLocked} style={{ width: "100%", padding: "15px", borderRadius: "12px", border: "none", background: saving || periodLocked ? "rgba(239,68,68,0.3)" : `linear-gradient(135deg, ${red}, #dc2626)`, color: "#111827", fontSize: "15px", fontWeight: "800", cursor: saving || periodLocked ? "not-allowed" : "pointer", marginTop: "4px" }}>
              {saving ? "Recording..." : "Record Expense"}
            </button>
          </div>
        </Modal>
      )}

    </div>
  )
}
