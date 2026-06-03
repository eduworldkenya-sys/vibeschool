"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

const dark    = "#0a1628"
const accent  = "#10b981"
const amber   = "#f59e0b"
const red     = "#ef4444"
const violet  = "#8b5cf6"
const blue    = "#3b82f6"
const surface = "rgba(255,255,255,0.03)"
const card    = "rgba(255,255,255,0.05)"
const border  = "#334155"
const muted   = "rgba(255,255,255,0.4)"
const white   = "#1e293b"

const fmt  = (n: number) => `KES ${Number(n).toLocaleString("en-KE", { minimumFractionDigits: 0 })}`
const fmtK = (n: number) => n >= 1000000 ? `KES ${(n/1000000).toFixed(1)}M` : n >= 1000 ? `KES ${(n/1000).toFixed(0)}K` : fmt(n)

const inputStyle: React.CSSProperties = {
  padding: "9px 14px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "10px", color: "#f1f5f9", fontSize: "14px", outline: "none",
  boxSizing: "border-box",
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

type TabType = "trial" | "pl" | "budget"

interface Period {
  id: string
  term: string
  year: number
  status: string
}

interface Account {
  id: string
  code: string
  name: string
  type: string
  is_active: boolean
}

interface TransactionLine {
  id: string
  transaction_id: string
  account_id: string
  debit: number
  credit: number
}

interface TrialRow {
  account: Account
  totalDebit: number
  totalCredit: number
  balance: number
}

interface PLData {
  revenue: number
  expenses: number
  grossProfit: number
  expenseLines: Array<{ name: string; amount: number }>
}

interface BudgetRow {
  id: string
  account_id: string
  account_name: string
  budgeted: number
  actual: number
  variance: number
}

export default function ReportsPage() {
  const router = useRouter()

  const [schoolId, setSchoolId]   = useState<string | null>(null)
  const [tab, setTab]             = useState<TabType>("trial")
  const [periods, setPeriods]     = useState<Period[]>([])
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("")
  const [selectedPeriod, setSelectedPeriod]     = useState<Period | null>(null)
  const [loading, setLoading]     = useState(true)
  const [toast, setToast]         = useState({ msg: "", type: "success" })

  // Trial Balance
  const [trialRows, setTrialRows]       = useState<Record<string, TrialRow[]>>({})
  const [totalDebits, setTotalDebits]   = useState(0)
  const [totalCredits, setTotalCredits] = useState(0)
  const [trialLoading, setTrialLoading] = useState(false)

  // P&L
  const [plData, setPlData]       = useState<PLData | null>(null)
  const [plLoading, setPlLoading] = useState(false)

  // Budget vs Actual
  const [budgetRows, setBudgetRows]       = useState<BudgetRow[]>([])
  const [budgetLoading, setBudgetLoading] = useState(false)

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type })
    setTimeout(() => setToast({ msg: "", type: "success" }), 3500)
  }

  // ── Load periods ─────────────────────────────────────────────────────────
  const loadPeriods = useCallback(async (sid: string) => {
    const { data } = await supabase
      .from("finance_periods")
      .select("*")
      .eq("school_id", sid)
      .order("year", { ascending: false })
    const list = data ?? []
    setPeriods(list)
    if (list.length > 0) {
      setSelectedPeriodId(list[0].id)
      setSelectedPeriod(list[0])
    }
  }, [])

  // ── Trial Balance ─────────────────────────────────────────────────────────
  const loadTrial = useCallback(async (sid: string) => {
    setTrialLoading(true)
    try {
      const { data: accounts } = await supabase
        .from("finance_accounts")
        .select("id, code, name, type, is_active")
        .eq("school_id", sid)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("code")

      const { data: txLines } = await supabase
        .from("finance_transaction_lines")
        .select("id, transaction_id, account_id, debit, credit")
        .in("account_id", (accounts ?? []).map((a: Account) => a.id))

      const lineMap: Record<string, { debit: number; credit: number }> = {}
      for (const line of (txLines ?? []) as TransactionLine[]) {
        if (!lineMap[line.account_id]) lineMap[line.account_id] = { debit: 0, credit: 0 }
        lineMap[line.account_id].debit  += Number(line.debit  ?? 0)
        lineMap[line.account_id].credit += Number(line.credit ?? 0)
      }

      const groups: Record<string, TrialRow[]> = {}
      let totD = 0
      let totC = 0

      for (const acc of (accounts ?? []) as Account[]) {
        const d = lineMap[acc.id]?.debit  ?? 0
        const c = lineMap[acc.id]?.credit ?? 0
        totD += d
        totC += c
        const row: TrialRow = { account: acc, totalDebit: d, totalCredit: c, balance: d - c }
        if (!groups[acc.type]) groups[acc.type] = []
        groups[acc.type].push(row)
      }

      setTrialRows(groups)
      setTotalDebits(totD)
      setTotalCredits(totC)
    } catch {
      showToast("Failed to load trial balance", "error")
    } finally {
      setTrialLoading(false)
    }
  }, [])

  // ── P&L ──────────────────────────────────────────────────────────────────
  const loadPL = useCallback(async (sid: string, period: Period) => {
    setPlLoading(true)
    try {
      // Revenue = sum of payments in this term/year via invoices
      const { data: invoices } = await supabase
        .from("finance_invoices")
        .select("id")
        .eq("school_id", sid)
        .eq("term", period.term)
        .eq("year", period.year)
        .is("deleted_at", null)

      const invoiceIds = (invoices ?? []).map((i: { id: string }) => i.id)

      let revenue = 0
      if (invoiceIds.length > 0) {
        const { data: payments } = await supabase
          .from("finance_payments")
          .select("amount")
          .eq("school_id", sid)
          .in("invoice_id", invoiceIds)
          .is("deleted_at", null)
        revenue = (payments ?? []).reduce((s: number, p: { amount: number }) => s + Number(p.amount ?? 0), 0)
      }

      // Expenses = finance_expenses in this term/year
      const yearStart = `${period.year}-01-01`
      const yearEnd   = `${period.year}-12-31`
      const { data: expenses } = await supabase
        .from("finance_expenses")
        .select("amount, description, account_id")
        .eq("school_id", sid)
        .gte("expense_date", yearStart)
        .lte("expense_date", yearEnd)
        .is("deleted_at", null)

      const expList = expenses ?? []
      const totalExpenses = expList.reduce((s: number, e: { amount: number }) => s + Number(e.amount ?? 0), 0)

      // Group expense lines by account_id for display
      const expByAccount: Record<string, { name: string; amount: number }> = {}
      const accountIds = Array.from(new Set(expList.map((e: { account_id: string }) => e.account_id).filter(Boolean)))

      const accountNames: Record<string, string> = {}
      if (accountIds.length > 0) {
        const { data: accs } = await supabase
          .from("finance_accounts")
          .select("id, name")
          .in("id", accountIds)
        for (const a of (accs ?? []) as Array<{ id: string; name: string }>) {
          accountNames[a.id] = a.name
        }
      }

      for (const e of expList as Array<{ amount: number; account_id: string; description: string }>) {
        const key = e.account_id ?? "other"
        if (!expByAccount[key]) expByAccount[key] = { name: accountNames[key] ?? e.description ?? "Other", amount: 0 }
        expByAccount[key].amount += Number(e.amount ?? 0)
      }

      setPlData({
        revenue,
        expenses: totalExpenses,
        grossProfit: revenue - totalExpenses,
        expenseLines: Object.values(expByAccount),
      })
    } catch {
      showToast("Failed to load P&L", "error")
    } finally {
      setPlLoading(false)
    }
  }, [])

  // ── Budget vs Actual ──────────────────────────────────────────────────────
  const loadBudget = useCallback(async (sid: string, period: Period) => {
    setBudgetLoading(true)
    try {
      const { data: budgets } = await supabase
        .from("finance_budgets")
        .select("id, account_id, term, year, amount")
        .eq("school_id", sid)
        .eq("term", period.term)
        .eq("year", period.year)

      const accountIds = Array.from(new Set((budgets ?? []).map((b: { account_id: string }) => b.account_id).filter(Boolean)))

      const accountNames: Record<string, string> = {}
      if (accountIds.length > 0) {
        const { data: accs } = await supabase
          .from("finance_accounts")
          .select("id, name")
          .in("id", accountIds)
        for (const a of (accs ?? []) as Array<{ id: string; name: string }>) {
          accountNames[a.id] = a.name
        }
      }

      // Actual spend per account
      const yearStart = `${period.year}-01-01`
      const yearEnd   = `${period.year}-12-31`
      const { data: expenses } = await supabase
        .from("finance_expenses")
        .select("amount, account_id")
        .eq("school_id", sid)
        .gte("expense_date", yearStart)
        .lte("expense_date", yearEnd)
        .is("deleted_at", null)

      const actualMap: Record<string, number> = {}
      for (const e of (expenses ?? []) as Array<{ amount: number; account_id: string }>) {
        if (!e.account_id) continue
        actualMap[e.account_id] = (actualMap[e.account_id] ?? 0) + Number(e.amount ?? 0)
      }

      const rows: BudgetRow[] = (budgets ?? []).map((b: { id: string; account_id: string; amount: number }) => {
        const actual   = actualMap[b.account_id] ?? 0
        const budgeted = Number(b.amount ?? 0)
        return {
          id:           b.id,
          account_id:   b.account_id,
          account_name: accountNames[b.account_id] ?? "Unknown",
          budgeted,
          actual,
          variance:     budgeted - actual,
        }
      })

      setBudgetRows(rows)
    } catch {
      showToast("Failed to load budget data", "error")
    } finally {
      setBudgetLoading(false)
    }
  }, [])

  // ── Auth + init ───────────────────────────────────────────────────────────
  const init = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/admin/login"); return }
    const { data: p } = await supabase.from("profiles").select("school_id").eq("id", user.id).single()
    if (!p?.school_id) { router.push("/admin/login"); return }
    setSchoolId(p.school_id)
    await loadPeriods(p.school_id)
    await loadTrial(p.school_id)
    setLoading(false)
  }, [router, loadPeriods, loadTrial])

  useEffect(() => { init() }, [init])

  // ── Reload tab data when period or tab changes ────────────────────────────
  useEffect(() => {
    if (!schoolId || !selectedPeriod) return
    if (tab === "trial") loadTrial(schoolId)
    if (tab === "pl")    loadPL(schoolId, selectedPeriod)
    if (tab === "budget") loadBudget(schoolId, selectedPeriod)
  }, [tab, selectedPeriod, schoolId, loadTrial, loadPL, loadBudget])

  const handlePeriodChange = (id: string) => {
    setSelectedPeriodId(id)
    const p = periods.find(x => x.id === id) ?? null
    setSelectedPeriod(p)
  }

  const ACCOUNT_TYPES = ["asset", "liability", "equity", "revenue", "expense"]

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#f1f5f9", fontFamily: "system-ui, sans-serif", padding: "20px 16px 60px" }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        select option { background:#1e293b; color:#f1f5f9 }
        * { box-sizing:border-box }
      `}</style>

      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <button onClick={() => router.back()} style={{
          background:"none", border:"none", color: muted,
          fontSize:"13px", cursor:"pointer", display:"flex", alignItems:"center",
          gap:"6px", marginBottom:"20px", padding:0
        }}>← Back</button>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12, marginBottom:24 }}>
          <div>
            <h1 style={{ margin:"0 0 4px", fontSize:24, fontWeight:900 }}>Financial Reports</h1>
            <p style={{ margin:0, fontSize:14, color:muted }}>Trial Balance · P&amp;L · Budget vs Actual</p>
          </div>
          {/* Period filter */}
          <select
            value={selectedPeriodId}
            onChange={e => handlePeriodChange(e.target.value)}
            style={{ ...inputStyle, minWidth: 180 }}
          >
            {periods.map(p => (
              <option key={p.id} value={p.id}>{p.term} {p.year}</option>
            ))}
          </select>
        </div>

        {/* Tab bar */}
        <div style={{ display:"flex", gap:8, marginBottom:24, background:card, borderRadius:14, padding:6, border:`1px solid ${border}` }}>
          {([
            { key:"trial", label:"Trial Balance" },
            { key:"pl",    label:"P&L Statement" },
            { key:"budget",label:"Budget vs Actual" },
          ] as Array<{ key: TabType; label: string }>).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex:1, padding:"10px 8px", borderRadius:10, border:"none",
                background: tab === t.key ? accent : "transparent",
                color: tab === t.key ? dark : muted,
                fontSize:13, fontWeight:700, cursor:"pointer",
                transition:"all 0.2s",
              }}
            >{t.label}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <Skeleton h={60} /><Skeleton h={200} /><Skeleton h={120} />
          </div>
        ) : (
          <div style={{ animation:"fadeIn 0.3s ease" }}>

            {/* ── TRIAL BALANCE ─────────────────────────────────────────── */}
            {tab === "trial" && (
              <div>
                {Math.abs(totalDebits - totalCredits) > 0.01 && (
                  <div style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)",
                    borderRadius:12, padding:"12px 16px", marginBottom:16, display:"flex", alignItems:"center", gap:10 }}>
                    <span>⚠️</span>
                    <span style={{ fontSize:13, color:red, fontWeight:600 }}>
                      Trial balance does not balance. Debits: {fmt(totalDebits)} · Credits: {fmt(totalCredits)}
                    </span>
                  </div>
                )}
                {trialLoading ? (
                  <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                    <Skeleton h={60} /><Skeleton h={100} /><Skeleton h={80} />
                  </div>
                ) : (
                  <>
                    {ACCOUNT_TYPES.map(type => {
                      const rows = trialRows[type]
                      if (!rows || rows.length === 0) return null
                      const groupDebit  = rows.reduce((s, r) => s + r.totalDebit, 0)
                      const groupCredit = rows.reduce((s, r) => s + r.totalCredit, 0)
                      return (
                        <div key={type} style={{ background:card, border:`1px solid ${border}`, borderRadius:16, padding:20, marginBottom:14 }}>
                          <h3 style={{ margin:"0 0 14px", fontSize:13, fontWeight:800, textTransform:"uppercase",
                            letterSpacing:"1px", color:
                              type==="asset"    ? blue  :
                              type==="revenue"  ? accent:
                              type==="expense"  ? red   :
                              type==="liability"? amber : violet
                          }}>{type}</h3>
                          <div style={{ overflowX:"auto" }}>
                            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                              <thead>
                                <tr>
                                  {["Code","Account","Debit","Credit","Balance"].map(h => (
                                    <th key={h} style={{ textAlign: h==="Code"||h==="Account" ? "left":"right",
                                      fontSize:11, color:muted, fontWeight:600, textTransform:"uppercase",
                                      letterSpacing:"0.5px", paddingBottom:10, paddingRight:12 }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {rows.map(row => (
                                  <tr key={row.account.id} style={{ borderTop:`1px solid ${border}` }}>
                                    <td style={{ padding:"10px 12px 10px 0", fontFamily:"monospace", fontSize:12, color:muted }}>{row.account.code}</td>
                                    <td style={{ padding:"10px 12px 10px 0", color:white }}>{row.account.name}</td>
                                    <td style={{ padding:"10px 12px 10px 0", textAlign:"right", color:white }}>{row.totalDebit > 0 ? fmt(row.totalDebit) : "—"}</td>
                                    <td style={{ padding:"10px 12px 10px 0", textAlign:"right", color:white }}>{row.totalCredit > 0 ? fmt(row.totalCredit) : "—"}</td>
                                    <td style={{ padding:"10px 0", textAlign:"right",
                                      color: row.balance > 0 ? accent : row.balance < 0 ? red : muted,
                                      fontWeight:600 }}>{fmt(Math.abs(row.balance))}</td>
                                  </tr>
                                ))}
                                <tr style={{ borderTop:`2px solid ${border}` }}>
                                  <td colSpan={2} style={{ padding:"10px 12px 10px 0", fontWeight:700, fontSize:12 }}>Subtotal</td>
                                  <td style={{ padding:"10px 12px 10px 0", textAlign:"right", fontWeight:700, color:blue }}>{fmt(groupDebit)}</td>
                                  <td style={{ padding:"10px 12px 10px 0", textAlign:"right", fontWeight:700, color:violet }}>{fmt(groupCredit)}</td>
                                  <td style={{ padding:"10px 0", textAlign:"right", fontWeight:700 }}>{fmt(Math.abs(groupDebit-groupCredit))}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )
                    })}

                    {/* Grand totals */}
                    <div style={{ background:"rgba(16,185,129,0.05)", border:`1px solid rgba(16,185,129,0.2)`, borderRadius:16, padding:20 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:16 }}>
                        <div style={{ textAlign:"center" }}>
                          <p style={{ margin:"0 0 4px", fontSize:11, color:muted, fontWeight:600, textTransform:"uppercase" }}>Total Debits</p>
                          <p style={{ margin:0, fontSize:20, fontWeight:800, color:blue }}>{fmtK(totalDebits)}</p>
                        </div>
                        <div style={{ textAlign:"center" }}>
                          <p style={{ margin:"0 0 4px", fontSize:11, color:muted, fontWeight:600, textTransform:"uppercase" }}>Total Credits</p>
                          <p style={{ margin:0, fontSize:20, fontWeight:800, color:violet }}>{fmtK(totalCredits)}</p>
                        </div>
                        <div style={{ textAlign:"center" }}>
                          <p style={{ margin:"0 0 4px", fontSize:11, color:muted, fontWeight:600, textTransform:"uppercase" }}>Difference</p>
                          <p style={{ margin:0, fontSize:20, fontWeight:800,
                            color: Math.abs(totalDebits-totalCredits) < 0.01 ? accent : red }}>
                            {fmt(Math.abs(totalDebits-totalCredits))}
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── P&L ───────────────────────────────────────────────────── */}
            {tab === "pl" && (
              <div>
                {plLoading ? (
                  <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                    <Skeleton h={80} /><Skeleton h={200} /><Skeleton h={80} />
                  </div>
                ) : plData ? (
                  <div style={{ background:card, border:`1px solid ${border}`, borderRadius:16, overflow:"hidden" }}>
                    {/* Header */}
                    <div style={{ padding:"20px 24px", borderBottom:`1px solid ${border}`, textAlign:"center" }}>
                      <p style={{ margin:"0 0 4px", fontSize:11, color:muted, fontWeight:600, textTransform:"uppercase", letterSpacing:"1px" }}>
                        Profit & Loss Statement
                      </p>
                      <p style={{ margin:0, fontSize:14, color:muted }}>
                        {selectedPeriod?.term} {selectedPeriod?.year}
                      </p>
                    </div>

                    <div style={{ padding:"24px" }}>
                      {/* Revenue */}
                      <div style={{ marginBottom:24 }}>
                        <p style={{ margin:"0 0 12px", fontSize:12, fontWeight:800, textTransform:"uppercase",
                          letterSpacing:"1px", color:accent }}>Revenue</p>
                        <div style={{ display:"flex", justifyContent:"space-between", padding:"12px 0", borderBottom:`1px solid ${border}` }}>
                          <span style={{ fontSize:14, color:white }}>School Fees Collected</span>
                          <span style={{ fontSize:14, fontWeight:700, color:accent }}>{fmt(plData.revenue)}</span>
                        </div>
                        <div style={{ display:"flex", justifyContent:"space-between", padding:"10px 0 0" }}>
                          <span style={{ fontSize:13, fontWeight:700 }}>Total Revenue</span>
                          <span style={{ fontSize:15, fontWeight:800, color:accent }}>{fmt(plData.revenue)}</span>
                        </div>
                      </div>

                      {/* Expenses */}
                      <div style={{ marginBottom:24 }}>
                        <p style={{ margin:"0 0 12px", fontSize:12, fontWeight:800, textTransform:"uppercase",
                          letterSpacing:"1px", color:red }}>Expenses</p>
                        {plData.expenseLines.length === 0 ? (
                          <p style={{ color:muted, fontSize:13 }}>No expenses recorded for this period.</p>
                        ) : (
                          plData.expenseLines.map((line, i) => (
                            <div key={i} style={{ display:"flex", justifyContent:"space-between",
                              padding:"12px 0", borderBottom:`1px solid ${border}` }}>
                              <span style={{ fontSize:14, color:white }}>{line.name}</span>
                              <span style={{ fontSize:14, color:red }}>{fmt(line.amount)}</span>
                            </div>
                          ))
                        )}
                        <div style={{ display:"flex", justifyContent:"space-between", padding:"10px 0 0" }}>
                          <span style={{ fontSize:13, fontWeight:700 }}>Total Expenses</span>
                          <span style={{ fontSize:15, fontWeight:800, color:red }}>{fmt(plData.expenses)}</span>
                        </div>
                      </div>

                      {/* Net */}
                      <div style={{ background: plData.grossProfit >= 0 ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                        border:`1px solid ${plData.grossProfit >= 0 ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`,
                        borderRadius:12, padding:"16px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <span style={{ fontSize:15, fontWeight:800 }}>
                          {plData.grossProfit >= 0 ? "Net Surplus" : "Net Deficit"}
                        </span>
                        <span style={{ fontSize:22, fontWeight:900,
                          color: plData.grossProfit >= 0 ? accent : red }}>
                          {fmt(Math.abs(plData.grossProfit))}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p style={{ color:muted }}>No data available.</p>
                )}
              </div>
            )}

            {/* ── BUDGET VS ACTUAL ──────────────────────────────────────── */}
            {tab === "budget" && (
              <div>
                {budgetLoading ? (
                  <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                    <Skeleton h={70} /><Skeleton h={70} /><Skeleton h={70} />
                  </div>
                ) : budgetRows.length === 0 ? (
                  <div style={{ background:card, border:`1px solid ${border}`, borderRadius:16, padding:40, textAlign:"center" }}>
                    <p style={{ color:muted, fontSize:14, margin:0 }}>No budget lines found for {selectedPeriod?.term} {selectedPeriod?.year}.</p>
                  </div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                    {budgetRows.map(row => {
                      const pct     = row.budgeted > 0 ? Math.min(100, (row.actual / row.budgeted) * 100) : 0
                      const over    = row.variance < 0
                      const barClr  = over ? red : accent
                      return (
                        <div key={row.id} style={{ background:card, border:`1px solid ${border}`, borderRadius:14, padding:"18px 20px" }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:8, marginBottom:12 }}>
                            <span style={{ fontSize:14, fontWeight:700, color:white }}>{row.account_name}</span>
                            <span style={{ fontSize:13, fontWeight:700,
                              color: over ? red : accent,
                              background: over ? "rgba(239,68,68,0.12)" : "rgba(16,185,129,0.12)",
                              padding:"2px 10px", borderRadius:20 }}>
                              {over ? "▲ Over" : "▼ Under"} {fmt(Math.abs(row.variance))}
                            </span>
                          </div>
                          {/* Progress bar */}
                          <div style={{ height:7, background:"#1e293b", borderRadius:99, overflow:"hidden", marginBottom:10 }}>
                            <div style={{ height:"100%", width:`${pct}%`, background:barClr, borderRadius:99, transition:"width 0.5s ease" }} />
                          </div>
                          <div style={{ display:"flex", justifyContent:"space-between", fontSize:12 }}>
                            <span style={{ color:muted }}>Budgeted: <span style={{ color:white, fontWeight:600 }}>{fmt(row.budgeted)}</span></span>
                            <span style={{ color:muted }}>Actual: <span style={{ color:barClr, fontWeight:600 }}>{fmt(row.actual)}</span></span>
                            <span style={{ color:muted }}>{pct.toFixed(0)}% used</span>
                          </div>
                        </div>
                      )
                    })}

                    {/* Summary */}
                    <div style={{ background:"rgba(255,255,255,0.03)", border:`1px solid ${border}`, borderRadius:14, padding:"16px 20px" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
                        <div>
                          <p style={{ margin:"0 0 2px", fontSize:11, color:muted, fontWeight:600, textTransform:"uppercase" }}>Total Budgeted</p>
                          <p style={{ margin:0, fontSize:18, fontWeight:800, color:white }}>
                            {fmtK(budgetRows.reduce((s, r) => s + r.budgeted, 0))}
                          </p>
                        </div>
                        <div>
                          <p style={{ margin:"0 0 2px", fontSize:11, color:muted, fontWeight:600, textTransform:"uppercase" }}>Total Actual</p>
                          <p style={{ margin:0, fontSize:18, fontWeight:800, color:amber }}>
                            {fmtK(budgetRows.reduce((s, r) => s + r.actual, 0))}
                          </p>
                        </div>
                        <div>
                          <p style={{ margin:"0 0 2px", fontSize:11, color:muted, fontWeight:600, textTransform:"uppercase" }}>Net Variance</p>
                          <p style={{ margin:0, fontSize:18, fontWeight:800,
                            color: budgetRows.reduce((s,r) => s+r.variance, 0) >= 0 ? accent : red }}>
                            {fmtK(Math.abs(budgetRows.reduce((s, r) => s + r.variance, 0)))}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </div>

      {toast.msg && (
        <div style={{
          position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)",
          background: toast.type==="error" ? "rgba(239,68,68,0.95)" : "rgba(16,185,129,0.95)",
          color:white, padding:"12px 24px", borderRadius:12, fontSize:14, fontWeight:600,
          zIndex:200, animation:"slideUp 0.3s ease", whiteSpace:"nowrap", maxWidth:"90vw",
          boxShadow:"0 8px 32px rgba(0,0,0,0.4)",
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
