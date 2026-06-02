"use client";
'use client'
import { supabase } from '@/lib/supabase'

import { useEffect, useState } from 'react'


type TabType = 'directory' | 'attendance' | 'leave' | 'payroll'

interface StaffRow {
  id: string
  full_name: string
  role: string
  department: string
  email: string
  phone: string
  status: string
}

interface AttRow {
  staff_name: string
  date: string
  status: string
  check_in: string
  check_out: string
}

interface LeaveRow {
  staff_name: string
  leave_type: string
  start_date: string
  end_date: string
  status: string
  days: number
}

interface PayrollRow {
  run_name: string
  period: string
  total_gross: number
  total_net: number
  status: string
}

export default function StaffReportPage() {
  const [tab, setTab] = useState<TabType>('directory')
  const [staffRows, setStaffRows] = useState<StaffRow[]>([])
  const [attRows, setAttRows] = useState<AttRow[]>([])
  const [leaveRows, setLeaveRows] = useState<LeaveRow[]>([])
  const [payrollRows, setPayrollRows] = useState<PayrollRow[]>([])
  const [loading, setLoading] = useState(false)
  const [insight, setInsight] = useState('')
  const [kpis, setKpis] = useState({ total: 0, active: 0, onLeave: 0, departments: 0 })
  const [search, setSearch] = useState('')

  useEffect(() => { loadTab(tab) }, [tab])

  async function loadTab(t: TabType) {
    setLoading(true)
    setInsight('')
    try {
      if (t === 'directory') await fetchDirectory()
      if (t === 'attendance') await fetchAttendance()
      if (t === 'leave') await fetchLeave()
      if (t === 'payroll') await fetchPayroll()
    } finally {
      setLoading(false)
    }
  }

  async function fetchDirectory() {
    const { data, error } = await supabase
      .from('staff')
      .select('id, full_name, role, department, email, phone, status')
      .order('full_name')
      .limit(300)
    if (error) { console.error(error); return }
    const rows = (data || []) as StaffRow[]
    setStaffRows(rows)
    const active = rows.filter(r => String(r.status).toLowerCase() === 'active').length
    const depts = new Set(rows.map(r => r.department).filter(Boolean)).size
    setKpis({ total: rows.length, active, onLeave: 0, departments: depts })
    setInsight(`👥 ${rows.length} staff members across ${depts} departments. ${active} currently active.`)
  }

  async function fetchAttendance() {
    const { data, error } = await supabase
      .from('staff_attendance')
      .select('*, staff(full_name)')
      .order('date', { ascending: false })
      .limit(200)
    if (error) { console.error(error); return }
    const rows: AttRow[] = (data || []).map((r: any) => ({
      staff_name: r.staff?.full_name ?? '—',
      date: r.date ?? '—',
      status: r.status ?? '—',
      check_in: r.check_in ?? '—',
      check_out: r.check_out ?? '—',
    }))
    setAttRows(rows)
    const present = rows.filter(r => r.status.toLowerCase() === 'present').length
    const rate = rows.length ? Math.round((present / rows.length) * 100) : 0
    setInsight(`📅 Staff attendance rate: ${rate}% across ${rows.length} records.`)
  }

  async function fetchLeave() {
    const { data, error } = await supabase
      .from('staff_leave')
      .select('*, staff(full_name)')
      .order('start_date', { ascending: false })
      .limit(200)
    if (error) { console.error(error); return }
    const rows: LeaveRow[] = (data || []).map((r: any) => {
      const start = new Date(r.start_date)
      const end = new Date(r.end_date)
      const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000))
      return {
        staff_name: r.staff?.full_name ?? '—',
        leave_type: r.leave_type ?? '—',
        start_date: r.start_date ?? '—',
        end_date: r.end_date ?? '—',
        status: r.status ?? '—',
        days,
      }
    })
    setLeaveRows(rows)
    const pending = rows.filter(r => r.status.toLowerCase() === 'pending').length
    setInsight(`🏖️ ${rows.length} leave records. ${pending} pending approval.`)
  }

  async function fetchPayroll() {
    const { data, error } = await supabase
      .from('finance_payroll_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) { console.error(error); return }
    const rows: PayrollRow[] = (data || []).map((r: any) => ({
      run_name: r.name ?? r.title ?? '—',
      period: r.period ?? r.month ?? '—',
      total_gross: Number(r.total_gross ?? 0),
      total_net: Number(r.total_net ?? 0),
      status: r.status ?? '—',
    }))
    setPayrollRows(rows)
    const totalNet = rows.reduce((a, b) => a + b.total_net, 0)
    setInsight(`💰 ${rows.length} payroll runs. Total net paid: KES ${totalNet.toLocaleString()}.`)
  }

  function statusBadge(status: string) {
    const s = status.toLowerCase()
    if (s === 'active' || s === 'present' || s === 'approved' || s === 'paid') {
      return 'bg-green-900/50 text-green-400 border border-green-700'
    }
    if (s === 'pending') return 'bg-yellow-900/50 text-yellow-400 border border-yellow-700'
    if (s === 'absent' || s === 'rejected' || s === 'inactive') {
      return 'bg-red-900/50 text-red-400 border border-red-700'
    }
    return 'bg-slate-700 text-slate-300'
  }

  const tabs: { key: TabType; label: string; icon: string }[] = [
    { key: 'directory', label: 'Directory', icon: '👨‍🏫' },
    { key: 'attendance', label: 'Attendance', icon: '📅' },
    { key: 'leave', label: 'Leave', icon: '🏖️' },
    { key: 'payroll', label: 'Payroll', icon: '💰' },
  ]

  const filteredStaff = staffRows.filter(r =>
    r.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.department?.toLowerCase().includes(search.toLowerCase()) ||
    r.role?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{minHeight:"100vh",background:"#0f172a",color:"#f1f5f9"}}>
      {/* Top Bar */}
      <div style={{background:"#1e293b",borderBottom:"1px solid #334155",padding:"16px",position:"sticky",top:0,zIndex:10}}>
        <div style={{maxWidth:"672px",margin:"0 auto",display:"flex",alignItems:"center",gap:"12px"}}>
          <a href="/admin/reports" style={{color:"#94a3b8",fontSize:"20px",textDecoration:"none"}}>←</a>
          <div style={{flex:1}}>
            <h1 style={{fontSize:"18px",fontWeight:700,margin:0}}>Staff Report</h1>
            <p style={{fontSize:"11px",color:"#94a3b8",margin:0}}>Directory · Attendance · Leave · Payroll</p>
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

        {/* Search — directory only */}
        {tab === 'directory' && (
          <input
            type="text"
            placeholder="Search staff by name, role, department..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{width:"100%",background:"#1e293b",border:"1px solid #475569",borderRadius:"12px",padding:"10px 16px",fontSize:"13px",color:"#f1f5f9",outline:"none"}}
          />
        )}

        {/* AI Insight */}
        {insight && (
          <div style={{background:"rgba(120,53,15,0.4)",border:"1px solid rgba(217,119,6,0.5)",borderRadius:"12px",padding:"12px 16px",display:"flex",gap:"12px",alignItems:"flex-start"}}>
            <span style={{fontSize:"20px"}}>🤖</span>
            <p style={{fontSize:"13px",color:"#fde68a",margin:0}}>{insight}</p>
          </div>
        )}

        {/* KPI Cards — directory only */}
        {tab === 'directory' && staffRows.length > 0 && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
            <div style={{background:"#1e293b",borderRadius:"12px",padding:"16px",border:"1px solid #334155"}}>
              <p style={{fontSize:"24px",fontWeight:800,color:"#8b5cf6",margin:0}}>{kpis.total}</p>
              <p style={{fontSize:"11px",color:"#94a3b8",marginTop:"4px"}}>Total Staff</p>
            </div>
            <div style={{background:"#1e293b",borderRadius:"12px",padding:"16px",border:"1px solid #334155"}}>
              <p style={{fontSize:"24px",fontWeight:800,color:"#10b981",margin:0}}>{kpis.active}</p>
              <p style={{fontSize:"11px",color:"#94a3b8",marginTop:"4px"}}>Active</p>
            </div>
            <div style={{background:"#1e293b",borderRadius:"12px",padding:"16px",border:"1px solid #334155"}}>
              <p style={{fontSize:"24px",fontWeight:800,color:"#38bdf8",margin:0}}>{kpis.departments}</p>
              <p style={{fontSize:"11px",color:"#94a3b8",marginTop:"4px"}}>Departments</p>
            </div>
            <div style={{background:"#1e293b",borderRadius:"12px",padding:"16px",border:"1px solid #334155"}}>
              <p style={{fontSize:"24px",fontWeight:800,color:"#f59e0b",margin:0}}>{kpis.total - kpis.active}</p>
              <p style={{fontSize:"11px",color:"#94a3b8",marginTop:"4px"}}>Inactive</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{textAlign:"center",padding:"48px 0"}}>
            <div style={{fontSize:"30px",marginBottom:"12px"}}>⏳</div>
            <p style={{color:"#94a3b8",fontSize:"14px"}}>Loading staff data...</p>
          </div>
        )}

        {/* Directory Table */}
        {!loading && tab === 'directory' && filteredStaff.length > 0 && (
          <div style={{background:"#1e293b",borderRadius:"12px",border:"1px solid #334155",overflow:"hidden"}}>
            <div style={{padding:"12px 16px",borderBottom:"1px solid #334155"}}>
              <p style={{fontSize:"13px",fontWeight:600,margin:0,color:"#f1f5f9"}}>Staff Directory</p>
              <p style={{fontSize:"11px",color:"#94a3b8",margin:0}}>{filteredStaff.length} members</p>
            </div>
            <div style={{}}>
              {filteredStaff.slice(0, 100).map((row, i) => (
                <div key={i} style={{padding:"12px 16px"}}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"8px"}}>
                    <div style={{flex:1}}>
                      <p style={{fontSize:"13px",fontWeight:600,color:"#f1f5f9",margin:0}}>{row.full_name}</p>
                      <p style={{fontSize:"11px",color:"#94a3b8",marginTop:"2px"}}>{row.role} {row.department ? `· ${row.department}` : ''}</p>
                      {row.email && <p style={{fontSize:"11px",color:"#64748b",marginTop:"2px"}}>{row.email}</p>}
                    </div>
                    <span style={{fontSize:"11px",padding:"2px 8px",borderRadius:"99px",textTransform:"capitalize"}}>
                      {row.status ?? '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Attendance Table */}
        {!loading && tab === 'attendance' && attRows.length > 0 && (
          <div style={{background:"#1e293b",borderRadius:"12px",border:"1px solid #334155",overflow:"hidden"}}>
            <div style={{padding:"12px 16px",borderBottom:"1px solid #334155"}}>
              <p style={{fontSize:"13px",fontWeight:600,margin:0,color:"#f1f5f9"}}>Staff Attendance</p>
              <p style={{fontSize:"11px",color:"#94a3b8",margin:0}}>{attRows.length} records</p>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",fontSize:"11px",borderCollapse:"collapse"}}>
                <thead style={{background:"#0f172a"}}>
                  <tr>
                    <th style={{padding:"10px 12px",textAlign:"left",color:"#94a3b8",fontWeight:500}}>Name</th>
                    <th style={{padding:"10px 12px",textAlign:"left",color:"#94a3b8",fontWeight:500}}>Date</th>
                    <th style={{padding:"10px 12px",textAlign:"left",color:"#94a3b8",fontWeight:500}}>Status</th>
                    <th style={{padding:"10px 12px",textAlign:"left",color:"#94a3b8",fontWeight:500}}>In</th>
                    <th style={{padding:"10px 12px",textAlign:"left",color:"#94a3b8",fontWeight:500}}>Out</th>
                  </tr>
                </thead>
                <tbody>
                  {attRows.slice(0, 100).map((row, i) => (
                    <tr key={i} style={{borderTop:"1px solid rgba(51,65,85,0.5)"}}>
                      <td style={{padding:"10px 12px",color:"#f1f5f9",fontWeight:500,whiteSpace:"nowrap"}}>{row.staff_name}</td>
                      <td style={{padding:"10px 12px",color:"#cbd5e1",whiteSpace:"nowrap"}}>{row.date}</td>
                      <td style={{padding:"10px 12px"}}>
                        <span style={{fontSize:"11px",padding:"2px 8px",borderRadius:"99px",textTransform:"capitalize"}}>
                          {row.status}
                        </span>
                      </td>
                      <td style={{padding:"10px 12px",color:"#cbd5e1"}}>{row.check_in}</td>
                      <td style={{padding:"10px 12px",color:"#cbd5e1"}}>{row.check_out}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Leave Table */}
        {!loading && tab === 'leave' && leaveRows.length > 0 && (
          <div style={{background:"#1e293b",borderRadius:"12px",border:"1px solid #334155",overflow:"hidden"}}>
            <div style={{padding:"12px 16px",borderBottom:"1px solid #334155"}}>
              <p style={{fontSize:"13px",fontWeight:600,margin:0,color:"#f1f5f9"}}>Leave Records</p>
              <p style={{fontSize:"11px",color:"#94a3b8",margin:0}}>{leaveRows.length} requests</p>
            </div>
            <div style={{}}>
              {leaveRows.slice(0, 100).map((row, i) => (
                <div key={i} style={{padding:"12px 16px"}}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"8px"}}>
                    <div style={{flex:1}}>
                      <p style={{fontSize:"13px",fontWeight:600,color:"#f1f5f9",margin:0}}>{row.staff_name}</p>
                      <p style={{fontSize:"11px",color:"#94a3b8",marginTop:"2px"}}>{row.leave_type} · {row.days} day(s)</p>
                      <p style={{fontSize:"11px",color:"#64748b",marginTop:"2px"}}>{row.start_date} → {row.end_date}</p>
                    </div>
                    <span style={{fontSize:"11px",padding:"2px 8px",borderRadius:"99px",textTransform:"capitalize"}}>
                      {row.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payroll Table */}
        {!loading && tab === 'payroll' && payrollRows.length > 0 && (
          <div style={{background:"#1e293b",borderRadius:"12px",border:"1px solid #334155",overflow:"hidden"}}>
            <div style={{padding:"12px 16px",borderBottom:"1px solid #334155"}}>
              <p style={{fontSize:"13px",fontWeight:600,margin:0,color:"#f1f5f9"}}>Payroll Runs</p>
              <p style={{fontSize:"11px",color:"#94a3b8",margin:0}}>{payrollRows.length} runs</p>
            </div>
            <div style={{}}>
              {payrollRows.map((row, i) => (
                <div key={i} style={{padding:"12px 16px"}}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"8px"}}>
                    <div style={{flex:1}}>
                      <p style={{fontSize:"13px",fontWeight:600,color:"#f1f5f9",margin:0}}>{row.run_name}</p>
                      <p style={{fontSize:"11px",color:"#94a3b8",marginTop:"2px"}}>Period: {row.period}</p>
                      <p style={{fontSize:"11px",color:"#64748b",marginTop:"2px"}}>
                        Gross: KES {row.total_gross.toLocaleString()} · Net: KES {row.total_net.toLocaleString()}
                      </p>
                    </div>
                    <span style={{fontSize:"11px",padding:"2px 8px",borderRadius:"99px",textTransform:"capitalize"}}>
                      {row.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty states */}
        {!loading && tab === 'directory' && filteredStaff.length === 0 && (
          <div style={{textAlign:"center",padding:"48px 0"}}>
            <p style={{fontSize:"36px",marginBottom:"12px"}}>👨‍🏫</p>
            <p style={{color:"#94a3b8",fontSize:"14px"}}>No staff records found</p>
          </div>
        )}
        {!loading && tab === 'attendance' && attRows.length === 0 && (
          <div style={{textAlign:"center",padding:"48px 0"}}>
            <p style={{fontSize:"36px",marginBottom:"12px"}}>📅</p>
            <p style={{color:"#94a3b8",fontSize:"14px"}}>No attendance records found</p>
          </div>
        )}
        {!loading && tab === 'leave' && leaveRows.length === 0 && (
          <div style={{textAlign:"center",padding:"48px 0"}}>
            <p style={{fontSize:"36px",marginBottom:"12px"}}>🏖️</p>
            <p style={{color:"#94a3b8",fontSize:"14px"}}>No leave records found</p>
          </div>
        )}
        {!loading && tab === 'payroll' && payrollRows.length === 0 && (
          <div style={{textAlign:"center",padding:"48px 0"}}>
            <p style={{fontSize:"36px",marginBottom:"12px"}}>💰</p>
            <p style={{color:"#94a3b8",fontSize:"14px"}}>No payroll runs found</p>
          </div>
        )}

      </div>
    </div>
  )
}
