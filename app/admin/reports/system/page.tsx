"use client";
import { nairobiDateStr } from '@/lib/time'
export const dynamic = "force-dynamic";
import { supabase } from '@/lib/supabase'

import { useEffect, useState } from 'react'


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
      r.created_at?.startsWith(nairobiDateStr())
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
    <div style={{minHeight:"100vh",background:"#0f172a",color:"#f1f5f9"}}>
      {/* Top Bar */}
      <div style={{background:"#1e293b",borderBottom:"1px solid #334155",padding:"16px",position:"sticky",top:0,zIndex:10}}>
        <div style={{maxWidth:"672px",margin:"0 auto",display:"flex",alignItems:"center",gap:"12px"}}>
          <a href="/admin/reports" style={{color:"#94a3b8",fontSize:"20px",textDecoration:"none"}}>←</a>
          <div style={{flex:1}}>
            <h1 style={{fontSize:"18px",fontWeight:700,margin:0}}>System Report</h1>
            <p style={{fontSize:"11px",color:"#94a3b8",margin:0}}>Audit · Health · Notifications</p>
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

        {/* Search */}
        {(tab === 'audit' || tab === 'notifications') && (
          <input
            type="text"
            placeholder={tab === 'audit' ? 'Search by user, action, table...' : 'Search notifications...'}
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

        {/* Loading */}
        {loading && (
          <div style={{textAlign:"center",padding:"48px 0"}}>
            <div style={{fontSize:"30px",marginBottom:"12px"}}>⏳</div>
            <p style={{color:"#94a3b8",fontSize:"14px"}}>Loading system data...</p>
          </div>
        )}

        {/* Audit Trail */}
        {!loading && tab === 'audit' && filteredAudit.length > 0 && (
          <div style={{background:"#1e293b",borderRadius:"12px",border:"1px solid #334155",overflow:"hidden"}}>
            <div style={{padding:"12px 16px",borderBottom:"1px solid #334155"}}>
              <p style={{fontSize:"13px",fontWeight:600,margin:0,color:"#f1f5f9"}}>Audit Trail</p>
              <p style={{fontSize:"11px",color:"#94a3b8",margin:0}}>{filteredAudit.length} events</p>
            </div>
            <div style={{}}>
              {filteredAudit.slice(0, 100).map((row, i) => (
                <div key={i} style={{padding:"12px 16px"}}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"8px"}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                        <span style={{fontSize:"11px",fontWeight:700,textTransform:"uppercase",color:"#94a3b8"}}>
                          {row.action}
                        </span>
                        <span style={{fontSize:"11px",color:"#94a3b8",margin:0}}>on {row.table_name}</span>
                      </div>
                      <p style={{fontSize:"11px",color:"#64748b",marginTop:"2px"}}>
                        By: {row.user} {row.ip !== '—' ? `· IP: ${row.ip}` : ''}
                      </p>
                    </div>
                    <p style={{fontSize:"11px",color:"#64748b",whiteSpace:"nowrap"}}>{formatDate(row.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
            {filteredAudit.length > 100 && (
              <div style={{padding:"12px 16px",borderTop:"1px solid #334155",fontSize:"11px",color:"#94a3b8"}}>
                Showing 100 of {filteredAudit.length} events
              </div>
            )}
          </div>
        )}

        {/* System Health */}
        {!loading && tab === 'health' && healthRows.length > 0 && (
          <div style={{background:"#1e293b",borderRadius:"12px",border:"1px solid #334155",overflow:"hidden"}}>
            <div style={{padding:"12px 16px",borderBottom:"1px solid #334155"}}>
              <p style={{fontSize:"13px",fontWeight:600,margin:0,color:"#f1f5f9"}}>System Health</p>
              <p style={{fontSize:"11px",color:"#94a3b8",margin:0}}>{healthRows.length} checks</p>
            </div>
            <div style={{}}>
              {healthRows.slice(0, 100).map((row, i) => (
                <div key={i} style={{padding:"12px 16px"}}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"8px"}}>
                    <div style={{flex:1}}>
                      <p style={{fontSize:"13px",fontWeight:600,color:"#f1f5f9",margin:0}}>{row.service}</p>
                      <p style={{fontSize:"11px",color:"#94a3b8",marginTop:"2px"}}>
                        {row.response_time > 0 ? `${row.response_time}ms` : ''} {row.message !== '—' ? `· ${row.message}` : ''}
                      </p>
                      <p style={{fontSize:"11px",color:"#64748b",marginTop:"2px"}}>{formatDate(row.checked_at)}</p>
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

        {/* Notifications */}
        {!loading && tab === 'notifications' && filteredNotifs.length > 0 && (
          <div style={{background:"#1e293b",borderRadius:"12px",border:"1px solid #334155",overflow:"hidden"}}>
            <div style={{padding:"12px 16px",borderBottom:"1px solid #334155"}}>
              <p style={{fontSize:"13px",fontWeight:600,margin:0,color:"#f1f5f9"}}>Notifications</p>
              <p style={{fontSize:"11px",color:"#94a3b8",margin:0}}>{filteredNotifs.length} records</p>
            </div>
            <div style={{}}>
              {filteredNotifs.slice(0, 100).map((row, i) => (
                <div key={i} style={{padding:"12px 16px"}}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"8px"}}>
                    <div style={{flex:1}}>
                      <p className={`text-sm font-semibold ${!row.read ? 'text-white' : 'text-slate-300'}`}>
                        {row.title}
                      </p>
                      <p style={{fontSize:"11px",color:"#94a3b8",marginTop:"2px",overflow:"hidden",display:"-webkit-box",WebkitLineClamp:1,WebkitBoxOrient:"vertical"}}>{row.body}</p>
                      <p style={{fontSize:"11px",color:"#64748b",marginTop:"2px"}}>{row.type} · {formatDate(row.created_at)}</p>
                    </div>
                    {!row.read && (
                      <span style={{width:"8px",height:"8px",borderRadius:"50%",background:"#3b82f6",marginTop:"6px",flexShrink:0}} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty states */}
        {!loading && tab === 'audit' && filteredAudit.length === 0 && (
          <div style={{textAlign:"center",padding:"48px 0"}}>
            <p style={{fontSize:"36px",marginBottom:"12px"}}>🔐</p>
            <p style={{color:"#94a3b8",fontSize:"14px"}}>No audit events found</p>
          </div>
        )}
        {!loading && tab === 'health' && healthRows.length === 0 && (
          <div style={{textAlign:"center",padding:"48px 0"}}>
            <p style={{fontSize:"36px",marginBottom:"12px"}}>💚</p>
            <p style={{color:"#94a3b8",fontSize:"14px"}}>No health logs found</p>
          </div>
        )}
        {!loading && tab === 'notifications' && filteredNotifs.length === 0 && (
          <div style={{textAlign:"center",padding:"48px 0"}}>
            <p style={{fontSize:"36px",marginBottom:"12px"}}>🔔</p>
            <p style={{color:"#94a3b8",fontSize:"14px"}}>No notifications found</p>
          </div>
        )}

      </div>
    </div>
  )
}
