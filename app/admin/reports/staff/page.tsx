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
    <div className="min-h-screen bg-[#0f172a] text-white">
      {/* Top Bar */}
      <div className="bg-[#1e293b] border-b border-slate-700 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <a href="/admin/reports" className="text-slate-400 hover:text-white text-xl">←</a>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Staff Report</h1>
            <p className="text-xs text-slate-400">Directory · Attendance · Leave · Payroll</p>
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
                  ? 'bg-purple-600 text-white'
                  : 'bg-[#1e293b] text-slate-400 border border-slate-700'
              }`}
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
            className="w-full bg-[#1e293b] border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
        )}

        {/* AI Insight */}
        {insight && (
          <div className="bg-amber-900/40 border border-amber-600/50 rounded-xl px-4 py-3 flex gap-3 items-start">
            <span className="text-xl">🤖</span>
            <p className="text-sm text-amber-200">{insight}</p>
          </div>
        )}

        {/* KPI Cards — directory only */}
        {tab === 'directory' && staffRows.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#1e293b] rounded-xl p-4 border border-slate-700">
              <p className="text-2xl font-bold text-purple-400">{kpis.total}</p>
              <p className="text-xs text-slate-400 mt-1">Total Staff</p>
            </div>
            <div className="bg-[#1e293b] rounded-xl p-4 border border-slate-700">
              <p className="text-2xl font-bold text-green-400">{kpis.active}</p>
              <p className="text-xs text-slate-400 mt-1">Active</p>
            </div>
            <div className="bg-[#1e293b] rounded-xl p-4 border border-slate-700">
              <p className="text-2xl font-bold text-blue-400">{kpis.departments}</p>
              <p className="text-xs text-slate-400 mt-1">Departments</p>
            </div>
            <div className="bg-[#1e293b] rounded-xl p-4 border border-slate-700">
              <p className="text-2xl font-bold text-yellow-400">{kpis.total - kpis.active}</p>
              <p className="text-xs text-slate-400 mt-1">Inactive</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin text-3xl mb-3">⏳</div>
            <p className="text-slate-400 text-sm">Loading staff data...</p>
          </div>
        )}

        {/* Directory Table */}
        {!loading && tab === 'directory' && filteredStaff.length > 0 && (
          <div className="bg-[#1e293b] rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700">
              <p className="text-sm font-semibold">Staff Directory</p>
              <p className="text-xs text-slate-400">{filteredStaff.length} members</p>
            </div>
            <div className="divide-y divide-slate-700/50">
              {filteredStaff.slice(0, 100).map((row, i) => (
                <div key={i} className="px-4 py-3 hover:bg-slate-700/20">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">{row.full_name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{row.role} {row.department ? `· ${row.department}` : ''}</p>
                      {row.email && <p className="text-xs text-slate-500 mt-0.5">{row.email}</p>}
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full capitalize ${statusBadge(row.status ?? '')}`}>
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
          <div className="bg-[#1e293b] rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700">
              <p className="text-sm font-semibold">Staff Attendance</p>
              <p className="text-xs text-slate-400">{attRows.length} records</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#0f172a]">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-slate-400">Name</th>
                    <th className="px-3 py-2.5 text-left text-slate-400">Date</th>
                    <th className="px-3 py-2.5 text-left text-slate-400">Status</th>
                    <th className="px-3 py-2.5 text-left text-slate-400">In</th>
                    <th className="px-3 py-2.5 text-left text-slate-400">Out</th>
                  </tr>
                </thead>
                <tbody>
                  {attRows.slice(0, 100).map((row, i) => (
                    <tr key={i} className="border-t border-slate-700/50 hover:bg-slate-700/20">
                      <td className="px-3 py-2.5 text-white font-medium whitespace-nowrap">{row.staff_name}</td>
                      <td className="px-3 py-2.5 text-slate-300 whitespace-nowrap">{row.date}</td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full capitalize text-xs ${statusBadge(row.status)}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-300">{row.check_in}</td>
                      <td className="px-3 py-2.5 text-slate-300">{row.check_out}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Leave Table */}
        {!loading && tab === 'leave' && leaveRows.length > 0 && (
          <div className="bg-[#1e293b] rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700">
              <p className="text-sm font-semibold">Leave Records</p>
              <p className="text-xs text-slate-400">{leaveRows.length} requests</p>
            </div>
            <div className="divide-y divide-slate-700/50">
              {leaveRows.slice(0, 100).map((row, i) => (
                <div key={i} className="px-4 py-3 hover:bg-slate-700/20">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">{row.staff_name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{row.leave_type} · {row.days} day(s)</p>
                      <p className="text-xs text-slate-500 mt-0.5">{row.start_date} → {row.end_date}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full capitalize ${statusBadge(row.status)}`}>
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
          <div className="bg-[#1e293b] rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700">
              <p className="text-sm font-semibold">Payroll Runs</p>
              <p className="text-xs text-slate-400">{payrollRows.length} runs</p>
            </div>
            <div className="divide-y divide-slate-700/50">
              {payrollRows.map((row, i) => (
                <div key={i} className="px-4 py-3 hover:bg-slate-700/20">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">{row.run_name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Period: {row.period}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Gross: KES {row.total_gross.toLocaleString()} · Net: KES {row.total_net.toLocaleString()}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full capitalize ${statusBadge(row.status)}`}>
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
          <div className="text-center py-12">
            <p className="text-4xl mb-3">👨‍🏫</p>
            <p className="text-slate-400 text-sm">No staff records found</p>
          </div>
        )}
        {!loading && tab === 'attendance' && attRows.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">📅</p>
            <p className="text-slate-400 text-sm">No attendance records found</p>
          </div>
        )}
        {!loading && tab === 'leave' && leaveRows.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🏖️</p>
            <p className="text-slate-400 text-sm">No leave records found</p>
          </div>
        )}
        {!loading && tab === 'payroll' && payrollRows.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">💰</p>
            <p className="text-slate-400 text-sm">No payroll runs found</p>
          </div>
        )}

      </div>
    </div>
  )
}
