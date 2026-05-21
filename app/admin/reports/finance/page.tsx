'use client'
import { supabase } from '@/lib/supabase'

import { useEffect, useState } from 'react'


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
    <div style={{minHeight:"100vh",background:"#0f172a",color:"#f1f5f9"}}>
      {/* Top Bar */}
      <div style={{background:"#1e293b",borderBottom:"1px solid #334155",padding:"16px",position:"sticky",top:0,zIndex:10}}>
        <div style={{maxWidth:"672px",margin:"0 auto",display:"flex",alignItems:"center",gap:"12px"}}>
          <a href="/admin/reports" style={{color:"#94a3b8",fontSize:"20px",textDecoration:"none"}}>←</a>
          <div style={{flex:1}}>
            <h1 style={{fontSize:"18px",fontWeight:700,margin:0}}>Finance Report</h1>
            <p style={{fontSize:"11px",color:"#94a3b8",margin:0}}>Fees · Aging · Budget · Expenses</p>
          </div>
        </div>
      </div>

      <div style={{maxWidth:"672px",margin:"0 auto",padding:"20px 16px",display:"flex",flexDirection:"column",gap:"20px"}}>

        {/* Tabs */}
        <div style={{display:"flex",gap:"8px",overflowX:"auto",paddingBottom:"4px"}}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{display:"flex",alignItems:"center",gap:"6px",padding:"8px 16px",borderRadius:"12px",fontSize:"13px",fontWeight:500,whiteSpace:"nowrap",cursor:"pointer"}}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* AI Insight */}
        {insight && (
          <div style={{background:"rgba(120,53,15,0.4)",border:"1px solid rgba(217,119,6,0.5)",borderRadius:"12px",padding:"12px 16px",display:"flex",gap:"12px",alignItems:"flex-start"}}>
            <span style={{fontSize:"20px"}}>🤖</span>
            <p style={{fontSize:"13px",color:"#fde68a",margin:0}}>{insight}</p>
          </div>
        )}

        {/* KPI Cards — Fees tab only */}
        {tab === 'fees' && feeRows.length > 0 && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
            <div style={{background:"#1e293b",borderRadius:"12px",padding:"16px",border:"1px solid #334155"}}>
              <p style={{fontSize:"18px",fontWeight:800,color:"#38bdf8",margin:0}}>KES {kpis.totalInvoiced.toLocaleString()}</p>
              <p style={{fontSize:"11px",color:"#94a3b8",marginTop:"4px"}}>Total Invoiced</p>
            </div>
            <div style={{background:"#1e293b",borderRadius:"12px",padding:"16px",border:"1px solid #334155"}}>
              <p style={{fontSize:"18px",fontWeight:800,color:"#10b981",margin:0}}>KES {kpis.totalPaid.toLocaleString()}</p>
              <p style={{fontSize:"11px",color:"#94a3b8",marginTop:"4px"}}>Total Collected</p>
            </div>
            <div style={{background:"#1e293b",borderRadius:"12px",padding:"16px",border:"1px solid #334155"}}>
              <p style={{fontSize:"18px",fontWeight:800,color:"#ef4444",margin:0}}>KES {kpis.totalBalance.toLocaleString()}</p>
              <p style={{fontSize:"11px",color:"#94a3b8",marginTop:"4px"}}>Outstanding</p>
            </div>
            <div style={{background:"#1e293b",borderRadius:"12px",padding:"16px",border:"1px solid #334155"}}>
              <p style={{fontSize:"18px",fontWeight:800,color:"#f59e0b",margin:0}}>{kpis.collectionRate}%</p>
              <p style={{fontSize:"11px",color:"#94a3b8",marginTop:"4px"}}>Collection Rate</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{textAlign:"center",padding:"48px 0"}}>
            <div style={{fontSize:"30px",marginBottom:"12px"}}>⏳</div>
            <p style={{color:"#94a3b8",fontSize:"14px"}}>Loading finance data...</p>
          </div>
        )}

        {/* Fees Table */}
        {!loading && tab === 'fees' && feeRows.length > 0 && (
          <div style={{background:"#1e293b",borderRadius:"12px",border:"1px solid #334155",overflow:"hidden"}}>
            <div style={{padding:"12px 16px",borderBottom:"1px solid #334155"}}>
              <p style={{fontSize:"13px",fontWeight:600,margin:0,color:"#f1f5f9"}}>Invoice Summary</p>
              <p style={{fontSize:"11px",color:"#94a3b8",margin:0}}>{feeRows.length} invoices</p>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",fontSize:"11px",borderCollapse:"collapse"}}>
                <thead style={{background:"#0f172a"}}>
                  <tr>
                    <th style={{padding:"10px 12px",textAlign:"left",color:"#94a3b8",fontWeight:500}}>Student</th>
                    <th style={{padding:"10px 12px",textAlign:"left",color:"#94a3b8",fontWeight:500}}>Class</th>
                    <th style={{padding:"10px 12px",textAlign:"left",color:"#94a3b8",fontWeight:500}}>Invoiced</th>
                    <th style={{padding:"10px 12px",textAlign:"left",color:"#94a3b8",fontWeight:500}}>Paid</th>
                    <th style={{padding:"10px 12px",textAlign:"left",color:"#94a3b8",fontWeight:500}}>Balance</th>
                    <th style={{padding:"10px 12px",textAlign:"left",color:"#94a3b8",fontWeight:500}}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {feeRows.slice(0, 100).map((row, i) => (
                    <tr key={i} style={{borderTop:"1px solid rgba(51,65,85,0.5)"}}>
                      <td style={{padding:"10px 12px",color:"#f1f5f9",fontWeight:500,whiteSpace:"nowrap"}}>{row.student_name}</td>
                      <td style={{padding:"10px 12px",color:"#cbd5e1",whiteSpace:"nowrap"}}>{row.class_name}</td>
                      <td style={{padding:"10px 12px",color:"#cbd5e1"}}>{row.invoiced.toLocaleString()}</td>
                      <td style={{padding:"10px 12px",color:"#10b981"}}>{row.paid.toLocaleString()}</td>
                      <td style={{padding:"10px 12px",color:"#ef4444"}}>{row.balance.toLocaleString()}</td>
                      <td style={{padding:"10px 12px",fontWeight:600,textTransform:"capitalize",color:row.status.toLowerCase()==='paid'?'#4ade80':row.status.toLowerCase()==='partial'?'#facc15':row.status.toLowerCase()==='overdue'?'#f87171':'#94a3b8'}}>{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Aging Table */}
        {!loading && tab === 'aging' && (
          <div style={{background:"#1e293b",borderRadius:"12px",border:"1px solid #334155",overflow:"hidden"}}>
            <div style={{padding:"12px 16px",borderBottom:"1px solid #334155"}}>
              <p style={{fontSize:"13px",fontWeight:600,margin:0,color:"#f1f5f9"}}>Invoice Aging</p>
              <p style={{fontSize:"11px",color:"#94a3b8",margin:0}}>{agingRows.length} overdue records</p>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",fontSize:"11px",borderCollapse:"collapse"}}>
                <thead style={{background:"#0f172a"}}>
                  <tr>
                    {Object.keys(agingRows[0] ?? {}).slice(0, 6).map(col => (
                      <th key={col} style={{padding:"10px 12px",textAlign:"left",color:"#94a3b8",fontWeight:500,whiteSpace:"nowrap"}}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {agingRows.slice(0, 100).map((row, i) => (
                    <tr key={i} style={{borderTop:"1px solid rgba(51,65,85,0.5)"}}>
                      {Object.keys(row).slice(0, 6).map(col => (
                        <td key={col} style={{padding:"10px 12px",color:"#cbd5e1",whiteSpace:"nowrap"}}>
                          {String((row as any)[col] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {agingRows.length === 0 && (
              <div style={{textAlign:"center",padding:"40px 0",color:"#64748b",fontSize:"13px"}}>No aging data found</div>
            )}
          </div>
        )}

        {/* Budget Table */}
        {!loading && tab === 'budget' && (
          <div style={{background:"#1e293b",borderRadius:"12px",border:"1px solid #334155",overflow:"hidden"}}>
            <div style={{padding:"12px 16px",borderBottom:"1px solid #334155"}}>
              <p style={{fontSize:"13px",fontWeight:600,margin:0,color:"#f1f5f9"}}>Budget vs Actual</p>
              <p style={{fontSize:"11px",color:"#94a3b8",margin:0}}>{budgetRows.length} line items</p>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",fontSize:"11px",borderCollapse:"collapse"}}>
                <thead style={{background:"#0f172a"}}>
                  <tr>
                    {Object.keys(budgetRows[0] ?? {}).slice(0, 6).map(col => (
                      <th key={col} style={{padding:"10px 12px",textAlign:"left",color:"#94a3b8",fontWeight:500,whiteSpace:"nowrap"}}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {budgetRows.slice(0, 100).map((row, i) => (
                    <tr key={i} style={{borderTop:"1px solid rgba(51,65,85,0.5)"}}>
                      {Object.keys(row).slice(0, 6).map(col => (
                        <td key={col} style={{padding:"10px 12px",color:"#cbd5e1",whiteSpace:"nowrap"}}>
                          {String((row as any)[col] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {budgetRows.length === 0 && (
              <div style={{textAlign:"center",padding:"40px 0",color:"#64748b",fontSize:"13px"}}>No budget data found</div>
            )}
          </div>
        )}

        {/* Expenses Table */}
        {!loading && tab === 'expenses' && (
          <div style={{background:"#1e293b",borderRadius:"12px",border:"1px solid #334155",overflow:"hidden"}}>
            <div style={{padding:"12px 16px",borderBottom:"1px solid #334155"}}>
              <p style={{fontSize:"13px",fontWeight:600,margin:0,color:"#f1f5f9"}}>Expenses</p>
              <p style={{fontSize:"11px",color:"#94a3b8",margin:0}}>{expenseRows.length} records</p>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",fontSize:"11px",borderCollapse:"collapse"}}>
                <thead style={{background:"#0f172a"}}>
                  <tr>
                    {Object.keys(expenseRows[0] ?? {}).slice(0, 5).map(col => (
                      <th key={col} style={{padding:"10px 12px",textAlign:"left",color:"#94a3b8",fontWeight:500,whiteSpace:"nowrap"}}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {expenseRows.slice(0, 100).map((row, i) => (
                    <tr key={i} style={{borderTop:"1px solid rgba(51,65,85,0.5)"}}>
                      {Object.keys(row).slice(0, 5).map(col => (
                        <td key={col} style={{padding:"10px 12px",color:"#cbd5e1",whiteSpace:"nowrap"}}>
                          {String((row as any)[col] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {expenseRows.length === 0 && (
              <div style={{textAlign:"center",padding:"40px 0",color:"#64748b",fontSize:"13px"}}>No expense data found</div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
