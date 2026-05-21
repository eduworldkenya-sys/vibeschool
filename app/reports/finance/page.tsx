'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface FeeRow {
  student_name: string
  admission_number: string
  class_name: string
  invoiced: number
  paid: number
  balance: number
  status: string
}

interface AgingRow {
  student_name?: string
  invoice_number?: string
  amount?: number
  days_overdue?: number
  status?: string
}

type TabType = 'fees' | 'aging' | 'budget' | 'expenses'

export default function FinanceReportPage() {
  const [tab, setTab] = useState<TabType>('fees')
  const [feeRows, setFeeRows] = useState<FeeRow[]>([])
  const [agingRows, setAgingRows] = useState<AgingRow[]>([])
  const [budgetRows, setBudgetRows] = useState<any[]>([])
  const [expenseRows, setExpenseRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [insight, setInsight] = useState('')
  const [kpis, setKpis] = useState({ totalInvoiced: 0, totalPaid: 0, totalBalance: 0, collectionRate: 0 })
  const [sortAsc, setSortAsc] = useState(false)

  useEffect(() => { loadTab(tab) }, [tab])

  async function loadTab(t: TabType) {
    setLoading(true)
    setInsight('')
    try {
      if (t === 'fees') await fetchFees()
      if (t === 'aging') await fetchAging()
      if (t === 'budget') await fetchBudget()
      if (t === 'expenses') await fetchExpenses()
    } finally {
      setLoading(false)
    }
  }

  async function fetchFees() {
    const { data, error } = await supabase
      .from('finance_invoices')
      .select(`
        total_amount,
        amount_paid,
        status,
        students(full_name, admission_number),
        classes(name)
      `)
      .limit(300)

    if (error) { console.error(error); return }

    const rows: FeeRow[] = (data || []).map((r: any) => ({
      student_name: r.students?.full_name ?? '—',
      admission_number: r.students?.admission_number ?? '—',
      class_name: r.classes?.name ?? '—',
      invoiced: Number(r.total_amount ?? 0),
      paid: Number(r.amount_paid ?? 0),
      balance: Number(r.total_amount ?? 0) - Number(r.amount_paid ?? 0),
      status: r.status ?? '—',
    }))

    setFeeRows(rows)

    const totalInvoiced = rows.reduce((a, b) => a + b.invoiced, 0)
    const totalPaid = rows.reduce((a, b) => a + b.paid, 0)
    const totalBalance = rows.reduce((a, b) => a + b.balance, 0)
    const collectionRate = totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0
    setKpis({ totalInvoiced, totalPaid, totalBalance, collectionRate })

    if (collectionRate < 60) {
      setInsight(`⚠️ Fee collection rate is ${collectionRate}%. KES ${totalBalance.toLocaleString()} still outstanding.`)
    } else if (collectionRate >= 90) {
      setInsight(`✅ Excellent collection rate of ${collectionRate}%. Only KES ${totalBalance.toLocaleString()} remaining.`)
    } else {
      setInsight(`📊 ${collectionRate}% collected. KES ${totalBalance.toLocaleString()} outstanding across ${rows.filter(r => r.balance > 0).length} invoices.`)
    }
  }

  async function fetchAging() {
    const { data, error } = await supabase
      .from('v_invoice_aging')
      .select('*')
      .limit(200)
    if (error) { console.error(error); return }
    setAgingRows(data || [])
    if ((data || []).length > 0) {
      setInsight(`📋 ${data!.length} overdue invoices found. Review and follow up with parents.`)
    }
  }

  async function fetchBudget() {
    const { data, error } = await supabase
      .from('v_budget_vs_actual')
      .select('*')
      .limit(100)
    if (error) { console.error(error); return }
    setBudgetRows(data || [])
    if ((data || []).length > 0) {
      setInsight(`📊 Budget vs Actual loaded. Review variance columns for overspend alerts.`)
    }
  }

  async function fetchExpenses() {
    const { data, error } = await supabase
      .from('finance_expenses')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) { console.error(error); return }
    setExpenseRows(data || [])
    const total = (data || []).reduce((a: number, b: any) => a + Number(b.amount ?? 0), 0)
    setInsight(`💸 Total expenses: KES ${total.toLocaleString()} across ${data!.length} records.`)
  }

  function statusColor(status: string) {
    const s = status.toLowerCase()
    if (s === 'paid') return 'text-green-400'
    if (s === 'partial') return 'text-yellow-400'
    if (s === 'overdue') return 'text-red-400'
    return 'text-slate-400'
  }

  const tabs: { key: TabType; label: string; icon: string }[] = [
    { key: 'fees', label: 'Fees', icon: '💳' },
    { key: 'aging', label: 'Aging', icon: '📋' },
    { key: 'budget', label: 'Budget', icon: '📊' },
    { key: 'expenses', label: 'Expenses', icon: '💸' },
  ]

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      {/* Top Bar */}
      <div className="bg-[#1e293b] border-b border-slate-700 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <a href="/reports" className="text-slate-400 hover:text-white text-xl">←</a>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Finance Report</h1>
            <p className="text-xs text-slate-400">Fees · Aging · Budget · Expenses</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                tab === t.key
                  ? 'bg-yellow-600 text-white'
                  : 'bg-[#1e293b] text-slate-400 border border-slate-700'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* AI Insight */}
        {insight && (
          <div className="bg-amber-900/40 border border-amber-600/50 rounded-xl px-4 py-3 flex gap-3 items-start">
            <span className="text-xl">🤖</span>
            <p className="text-sm text-amber-200">{insight}</p>
          </div>
        )}

        {/* KPI Cards — Fees tab only */}
        {tab === 'fees' && feeRows.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#1e293b] rounded-xl p-4 border border-slate-700">
              <p className="text-lg font-bold text-blue-400">KES {kpis.totalInvoiced.toLocaleString()}</p>
              <p className="text-xs text-slate-400 mt-1">Total Invoiced</p>
            </div>
            <div className="bg-[#1e293b] rounded-xl p-4 border border-slate-700">
              <p className="text-lg font-bold text-green-400">KES {kpis.totalPaid.toLocaleString()}</p>
              <p className="text-xs text-slate-400 mt-1">Total Collected</p>
            </div>
            <div className="bg-[#1e293b] rounded-xl p-4 border border-slate-700">
              <p className="text-lg font-bold text-red-400">KES {kpis.totalBalance.toLocaleString()}</p>
              <p className="text-xs text-slate-400 mt-1">Outstanding</p>
            </div>
            <div className="bg-[#1e293b] rounded-xl p-4 border border-slate-700">
              <p className="text-lg font-bold text-yellow-400">{kpis.collectionRate}%</p>
              <p className="text-xs text-slate-400 mt-1">Collection Rate</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin text-3xl mb-3">⏳</div>
            <p className="text-slate-400 text-sm">Loading finance data...</p>
          </div>
        )}

        {/* Fees Table */}
        {!loading && tab === 'fees' && feeRows.length > 0 && (
          <div className="bg-[#1e293b] rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700">
              <p className="text-sm font-semibold">Invoice Summary</p>
              <p className="text-xs text-slate-400">{feeRows.length} invoices</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#0f172a]">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-slate-400">Student</th>
                    <th className="px-3 py-2.5 text-left text-slate-400">Class</th>
                    <th className="px-3 py-2.5 text-left text-slate-400">Invoiced</th>
                    <th className="px-3 py-2.5 text-left text-slate-400">Paid</th>
                    <th className="px-3 py-2.5 text-left text-slate-400">Balance</th>
                    <th className="px-3 py-2.5 text-left text-slate-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {feeRows.slice(0, 100).map((row, i) => (
                    <tr key={i} className="border-t border-slate-700/50 hover:bg-slate-700/20">
                      <td className="px-3 py-2.5 text-white font-medium whitespace-nowrap">{row.student_name}</td>
                      <td className="px-3 py-2.5 text-slate-300 whitespace-nowrap">{row.class_name}</td>
                      <td className="px-3 py-2.5 text-slate-300">{row.invoiced.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-green-400">{row.paid.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-red-400">{row.balance.toLocaleString()}</td>
                      <td className={`px-3 py-2.5 font-semibold capitalize ${statusColor(row.status)}`}>{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Aging Table */}
        {!loading && tab === 'aging' && (
          <div className="bg-[#1e293b] rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700">
              <p className="text-sm font-semibold">Invoice Aging</p>
              <p className="text-xs text-slate-400">{agingRows.length} overdue records</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#0f172a]">
                  <tr>
                    {Object.keys(agingRows[0] ?? {}).slice(0, 6).map(col => (
                      <th key={col} className="px-3 py-2.5 text-left text-slate-400 whitespace-nowrap">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {agingRows.slice(0, 100).map((row, i) => (
                    <tr key={i} className="border-t border-slate-700/50 hover:bg-slate-700/20">
                      {Object.keys(row).slice(0, 6).map(col => (
                        <td key={col} className="px-3 py-2.5 text-slate-300 whitespace-nowrap">
                          {String((row as any)[col] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {agingRows.length === 0 && (
              <div className="text-center py-10 text-slate-500 text-sm">No aging data found</div>
            )}
          </div>
        )}

        {/* Budget Table */}
        {!loading && tab === 'budget' && (
          <div className="bg-[#1e293b] rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700">
              <p className="text-sm font-semibold">Budget vs Actual</p>
              <p className="text-xs text-slate-400">{budgetRows.length} line items</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#0f172a]">
                  <tr>
                    {Object.keys(budgetRows[0] ?? {}).slice(0, 6).map(col => (
                      <th key={col} className="px-3 py-2.5 text-left text-slate-400 whitespace-nowrap">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {budgetRows.slice(0, 100).map((row, i) => (
                    <tr key={i} className="border-t border-slate-700/50 hover:bg-slate-700/20">
                      {Object.keys(row).slice(0, 6).map(col => (
                        <td key={col} className="px-3 py-2.5 text-slate-300 whitespace-nowrap">
                          {String((row as any)[col] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {budgetRows.length === 0 && (
              <div className="text-center py-10 text-slate-500 text-sm">No budget data found</div>
            )}
          </div>
        )}

        {/* Expenses Table */}
        {!loading && tab === 'expenses' && (
          <div className="bg-[#1e293b] rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700">
              <p className="text-sm font-semibold">Expenses</p>
              <p className="text-xs text-slate-400">{expenseRows.length} records</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#0f172a]">
                  <tr>
                    {Object.keys(expenseRows[0] ?? {}).slice(0, 5).map(col => (
                      <th key={col} className="px-3 py-2.5 text-left text-slate-400 whitespace-nowrap">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {expenseRows.slice(0, 100).map((row, i) => (
                    <tr key={i} className="border-t border-slate-700/50 hover:bg-slate-700/20">
                      {Object.keys(row).slice(0, 5).map(col => (
                        <td key={col} className="px-3 py-2.5 text-slate-300 whitespace-nowrap">
                          {String((row as any)[col] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {expenseRows.length === 0 && (
              <div className="text-center py-10 text-slate-500 text-sm">No expense data found</div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
