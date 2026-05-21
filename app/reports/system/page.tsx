'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type TabType = 'audit' | 'health' | 'notifications'

interface AuditRow {
  user: string
  action: string
  table_name: string
  created_at: string
  ip: string
}

interface HealthRow {
  service: string
  status: string
  response_time: number
  checked_at: string
  message: string
}

interface NotifRow {
  title: string
  body: string
  type: string
  created_at: string
  read: boolean
}

export default function SystemReportPage() {
  const [tab, setTab] = useState<TabType>('audit')
  const [auditRows, setAuditRows] = useState<AuditRow[]>([])
  const [healthRows, setHealthRows] = useState<HealthRow[]>([])
  const [notifRows, setNotifRows] = useState<NotifRow[]>([])
  const [loading, setLoading] = useState(false)
  const [insight, setInsight] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => { loadTab(tab) }, [tab])

  async function loadTab(t: TabType) {
    setLoading(true)
    setInsight('')
    setSearch('')
    try {
      if (t === 'audit') await fetchAudit()
      if (t === 'health') await fetchHealth()
      if (t === 'notifications') await fetchNotifications()
    } finally {
      setLoading(false)
    }
  }

  async function fetchAudit() {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) { console.error(error); return }
    const rows: AuditRow[] = (data || []).map((r: any) => ({
      user: r.user_id ?? r.user ?? r.performed_by ?? '—',
      action: r.action ?? r.event ?? '—',
      table_name: r.table_name ?? r.resource ?? '—',
      created_at: r.created_at ?? '—',
      ip: r.ip_address ?? r.ip ?? '—',
    }))
    setAuditRows(rows)
    const today = rows.filter(r =>
      r.created_at?.startsWith(new Date().toISOString().split('T')[0])
    ).length
    setInsight(`🔐 ${rows.length} audit events logged. ${today} actions recorded today.`)
  }

  async function fetchHealth() {
    const { data, error } = await supabase
      .from('system_health_logs')
      .select('*')
      .order('checked_at', { ascending: false })
      .limit(100)
    if (error) { console.error(error); return }
    const rows: HealthRow[] = (data || []).map((r: any) => ({
      service: r.service ?? r.name ?? '—',
      status: r.status ?? '—',
      response_time: Number(r.response_time ?? 0),
      checked_at: r.checked_at ?? r.created_at ?? '—',
      message: r.message ?? '—',
    }))
    setHealthRows(rows)
    const down = rows.filter(r => r.status?.toLowerCase() !== 'ok' && r.status?.toLowerCase() !== 'healthy').length
    if (down > 0) {
      setInsight(`⚠️ ${down} service(s) reporting issues. Check system health immediately.`)
    } else {
      setInsight(`✅ All ${rows.length} system health checks passing. Everything looks good.`)
    }
  }

  async function fetchNotifications() {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) { console.error(error); return }
    const rows: NotifRow[] = (data || []).map((r: any) => ({
      title: r.title ?? r.subject ?? '—',
      body: r.body ?? r.message ?? r.content ?? '—',
      type: r.type ?? r.category ?? '—',
      created_at: r.created_at ?? '—',
      read: Boolean(r.read ?? r.is_read ?? false),
    }))
    setNotifRows(rows)
    const unread = rows.filter(r => !r.read).length
    setInsight(`🔔 ${rows.length} notifications total. ${unread} unread.`)
  }

  function statusBadge(status: string) {
    const s = (status ?? '').toLowerCase()
    if (['ok', 'healthy', 'active'].includes(s))
      return 'bg-green-900/50 text-green-400 border border-green-700'
    if (['warning', 'degraded'].includes(s))
      return 'bg-yellow-900/50 text-yellow-400 border border-yellow-700'
    if (['error', 'down', 'critical'].includes(s))
      return 'bg-red-900/50 text-red-400 border border-red-700'
    return 'bg-slate-700 text-slate-300'
  }

  function actionColor(action: string) {
    const a = (action ?? '').toLowerCase()
    if (a.includes('delete') || a.includes('remove')) return 'text-red-400'
    if (a.includes('insert') || a.includes('create')) return 'text-green-400'
    if (a.includes('update') || a.includes('edit')) return 'text-yellow-400'
    return 'text-blue-400'
  }

  function formatDate(dt: string) {
    if (!dt || dt === '—') return '—'
    try {
      return new Date(dt).toLocaleString('en-KE', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })
    } catch { return dt }
  }

  const tabs: { key: TabType; label: string; icon: string }[] = [
    { key: 'audit',         label: 'Audit Trail',    icon: '🔐' },
    { key: 'health',        label: 'System Health',  icon: '💚' },
    { key: 'notifications', label: 'Notifications',  icon: '🔔' },
  ]

  const filteredAudit = auditRows.filter(r =>
    r.action.toLowerCase().includes(search.toLowerCase()) ||
    r.table_name.toLowerCase().includes(search.toLowerCase()) ||
    r.user.toLowerCase().includes(search.toLowerCase())
  )

  const filteredNotifs = notifRows.filter(r =>
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    r.type.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      {/* Top Bar */}
      <div className="bg-[#1e293b] border-b border-slate-700 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <a href="/reports" className="text-slate-400 hover:text-white text-xl">←</a>
          <div className="flex-1">
            <h1 className="text-lg font-bold">System Report</h1>
            <p className="text-xs text-slate-400">Audit · Health · Notifications</p>
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
                  ? 'bg-red-700 text-white'
                  : 'bg-[#1e293b] text-slate-400 border border-slate-700'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        {(tab === 'audit' || tab === 'notifications') && (
          <input
            type="text"
            placeholder={tab === 'audit' ? 'Search by user, action, table...' : 'Search notifications...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#1e293b] border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
          />
        )}

        {/* AI Insight */}
        {insight && (
          <div className="bg-amber-900/40 border border-amber-600/50 rounded-xl px-4 py-3 flex gap-3 items-start">
            <span className="text-xl">🤖</span>
            <p className="text-sm text-amber-200">{insight}</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin text-3xl mb-3">⏳</div>
            <p className="text-slate-400 text-sm">Loading system data...</p>
          </div>
        )}

        {/* Audit Trail */}
        {!loading && tab === 'audit' && filteredAudit.length > 0 && (
          <div className="bg-[#1e293b] rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700">
              <p className="text-sm font-semibold">Audit Trail</p>
              <p className="text-xs text-slate-400">{filteredAudit.length} events</p>
            </div>
            <div className="divide-y divide-slate-700/50">
              {filteredAudit.slice(0, 100).map((row, i) => (
                <div key={i} className="px-4 py-3 hover:bg-slate-700/20">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold uppercase ${actionColor(row.action)}`}>
                          {row.action}
                        </span>
                        <span className="text-xs text-slate-400">on {row.table_name}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        By: {row.user} {row.ip !== '—' ? `· IP: ${row.ip}` : ''}
                      </p>
                    </div>
                    <p className="text-xs text-slate-500 whitespace-nowrap">{formatDate(row.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
            {filteredAudit.length > 100 && (
              <div className="px-4 py-3 border-t border-slate-700 text-xs text-slate-400">
                Showing 100 of {filteredAudit.length} events
              </div>
            )}
          </div>
        )}

        {/* System Health */}
        {!loading && tab === 'health' && healthRows.length > 0 && (
          <div className="bg-[#1e293b] rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700">
              <p className="text-sm font-semibold">System Health</p>
              <p className="text-xs text-slate-400">{healthRows.length} checks</p>
            </div>
            <div className="divide-y divide-slate-700/50">
              {healthRows.slice(0, 100).map((row, i) => (
                <div key={i} className="px-4 py-3 hover:bg-slate-700/20">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">{row.service}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {row.response_time > 0 ? `${row.response_time}ms` : ''} {row.message !== '—' ? `· ${row.message}` : ''}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">{formatDate(row.checked_at)}</p>
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

        {/* Notifications */}
        {!loading && tab === 'notifications' && filteredNotifs.length > 0 && (
          <div className="bg-[#1e293b] rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700">
              <p className="text-sm font-semibold">Notifications</p>
              <p className="text-xs text-slate-400">{filteredNotifs.length} records</p>
            </div>
            <div className="divide-y divide-slate-700/50">
              {filteredNotifs.slice(0, 100).map((row, i) => (
                <div key={i} className={`px-4 py-3 hover:bg-slate-700/20 ${!row.read ? 'border-l-2 border-blue-500' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${!row.read ? 'text-white' : 'text-slate-300'}`}>
                        {row.title}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{row.body}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{row.type} · {formatDate(row.created_at)}</p>
                    </div>
                    {!row.read && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty states */}
        {!loading && tab === 'audit' && filteredAudit.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🔐</p>
            <p className="text-slate-400 text-sm">No audit events found</p>
          </div>
        )}
        {!loading && tab === 'health' && healthRows.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">💚</p>
            <p className="text-slate-400 text-sm">No health logs found</p>
          </div>
        )}
        {!loading && tab === 'notifications' && filteredNotifs.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🔔</p>
            <p className="text-slate-400 text-sm">No notifications found</p>
          </div>
        )}

      </div>
    </div>
  )
}
