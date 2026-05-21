'use client'
import { supabase } from '@/lib/supabase'

import { useEffect, useState } from 'react'


type TabType = 'visitors' | 'meetings' | 'projects' | 'resources'

interface VisitorRow {
  name: string
  purpose: string
  host: string
  date: string
  time_in: string
  time_out: string
  status: string
}

interface MeetingRow {
  title: string
  date: string
  attendees: number
  status: string
  venue: string
}

interface ProjectRow {
  name: string
  status: string
  progress: number
  lead: string
  due_date: string
}

interface ResourceRow {
  name: string
  type: string
  status: string
  assigned_to: string
  quantity: number
}

export default function OperationalReportPage() {
  const [tab, setTab] = useState<TabType>('visitors')
  const [visitors, setVisitors] = useState<VisitorRow[]>([])
  const [meetings, setMeetings] = useState<MeetingRow[]>([])
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [resources, setResources] = useState<ResourceRow[]>([])
  const [loading, setLoading] = useState(false)
  const [insight, setInsight] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => { loadTab(tab) }, [tab])

  async function loadTab(t: TabType) {
    setLoading(true)
    setInsight('')
    setSearch('')
    try {
      if (t === 'visitors') await fetchVisitors()
      if (t === 'meetings') await fetchMeetings()
      if (t === 'projects') await fetchProjects()
      if (t === 'resources') await fetchResources()
    } finally {
      setLoading(false)
    }
  }

  async function fetchVisitors() {
    const { data, error } = await supabase
      .from('admin_visitors')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) { console.error(error); return }
    const rows: VisitorRow[] = (data || []).map((r: any) => ({
      name: r.name ?? r.visitor_name ?? '—',
      purpose: r.purpose ?? '—',
      host: r.host ?? r.host_name ?? '—',
      date: r.date ?? r.visit_date ?? '—',
      time_in: r.time_in ?? r.check_in ?? '—',
      time_out: r.time_out ?? r.check_out ?? '—',
      status: r.status ?? 'visited',
    }))
    setVisitors(rows)
    const today = rows.filter(r => r.date === new Date().toISOString().split('T')[0]).length
    setInsight(`🏛️ ${rows.length} visitor records. ${today} visitor(s) logged today.`)
  }

  async function fetchMeetings() {
    const { data, error } = await supabase
      .from('admin_meetings')
      .select('*, admin_meeting_attendees(id)')
      .order('date', { ascending: false })
      .limit(100)
    if (error) { console.error(error); return }
    const rows: MeetingRow[] = (data || []).map((r: any) => ({
      title: r.title ?? r.name ?? '—',
      date: r.date ?? '—',
      attendees: r.admin_meeting_attendees?.length ?? 0,
      status: r.status ?? '—',
      venue: r.venue ?? r.location ?? '—',
    }))
    setMeetings(rows)
    const completed = rows.filter(r => r.status?.toLowerCase() === 'completed').length
    setInsight(`📋 ${rows.length} meetings recorded. ${completed} completed.`)
  }

  async function fetchProjects() {
    const { data, error } = await supabase
      .from('v_project_summary')
      .select('*')
      .limit(100)
    if (error) {
      // fallback to admin_projects
      const { data: d2, error: e2 } = await supabase
        .from('admin_projects')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
      if (e2) { console.error(e2); return }
      const rows: ProjectRow[] = (d2 || []).map((r: any) => ({
        name: r.name ?? r.title ?? '—',
        status: r.status ?? '—',
        progress: Number(r.progress ?? 0),
        lead: r.lead ?? r.owner ?? '—',
        due_date: r.due_date ?? r.end_date ?? '—',
      }))
      setProjects(rows)
      setInsight(`🚀 ${rows.length} projects tracked.`)
      return
    }
    const rows: ProjectRow[] = (data || []).map((r: any) => ({
      name: r.name ?? r.title ?? '—',
      status: r.status ?? '—',
      progress: Number(r.progress ?? 0),
      lead: r.lead ?? r.owner ?? '—',
      due_date: r.due_date ?? r.end_date ?? '—',
    }))
    setProjects(rows)
    const active = rows.filter(r => r.status?.toLowerCase() === 'active').length
    setInsight(`🚀 ${rows.length} projects. ${active} currently active.`)
  }

  async function fetchResources() {
    const { data, error } = await supabase
      .from('resource_assets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) { console.error(error); return }
    const rows: ResourceRow[] = (data || []).map((r: any) => ({
      name: r.name ?? '—',
      type: r.type ?? r.category ?? '—',
      status: r.status ?? '—',
      assigned_to: r.assigned_to ?? '—',
      quantity: Number(r.quantity ?? 1),
    }))
    setResources(rows)
    const available = rows.filter(r => r.status?.toLowerCase() === 'available').length
    setInsight(`📦 ${rows.length} assets tracked. ${available} currently available.`)
  }

  function statusBadge(status: string) {
    const s = (status ?? '').toLowerCase()
    if (['active', 'completed', 'visited', 'available'].includes(s))
      return 'bg-green-900/50 text-green-400 border border-green-700'
    if (['pending', 'in progress', 'in_progress', 'ongoing'].includes(s))
      return 'bg-yellow-900/50 text-yellow-400 border border-yellow-700'
    if (['cancelled', 'overdue', 'unavailable', 'inactive'].includes(s))
      return 'bg-red-900/50 text-red-400 border border-red-700'
    return 'bg-slate-700 text-slate-300'
  }

  function progressBar(pct: number) {
    const color = pct >= 80 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500'
    return (
      <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
        <div style={{flex:1,background:"#334155",borderRadius:"99px",height:"6px"}}>
          <div style={{height:"6px",borderRadius:"99px",background:"#10b981",width:`${Math.min(pct, 100)}%`}} />
        </div>
        <span style={{fontSize:"11px",color:"#94a3b8",width:"32px",textAlign:"right"}}>{pct}%</span>
      </div>
    )
  }

  const tabs: { key: TabType; label: string; icon: string }[] = [
    { key: 'visitors',  label: 'Visitors',  icon: '🏛️' },
    { key: 'meetings',  label: 'Meetings',  icon: '📋' },
    { key: 'projects',  label: 'Projects',  icon: '🚀' },
    { key: 'resources', label: 'Resources', icon: '📦' },
  ]

  const filteredVisitors = visitors.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.purpose.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{minHeight:"100vh",background:"#0f172a",color:"#f1f5f9"}}>
      {/* Top Bar */}
      <div style={{background:"#1e293b",borderBottom:"1px solid #334155",padding:"16px",position:"sticky",top:0,zIndex:10}}>
        <div style={{maxWidth:"672px",margin:"0 auto",display:"flex",alignItems:"center",gap:"12px"}}>
          <a href="/admin/reports" style={{color:"#94a3b8",fontSize:"20px",textDecoration:"none"}}>←</a>
          <div style={{flex:1}}>
            <h1 style={{fontSize:"18px",fontWeight:700,margin:0}}>Operational Report</h1>
            <p style={{fontSize:"11px",color:"#94a3b8",margin:0}}>Visitors · Meetings · Projects · Resources</p>
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

        {/* Search — visitors only */}
        {tab === 'visitors' && (
          <input
            type="text"
            placeholder="Search visitors by name or purpose..."
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
            <p style={{color:"#94a3b8",fontSize:"14px"}}>Loading data...</p>
          </div>
        )}

        {/* Visitors */}
        {!loading && tab === 'visitors' && filteredVisitors.length > 0 && (
          <div style={{background:"#1e293b",borderRadius:"12px",border:"1px solid #334155",overflow:"hidden"}}>
            <div style={{padding:"12px 16px",borderBottom:"1px solid #334155"}}>
              <p style={{fontSize:"13px",fontWeight:600,margin:0,color:"#f1f5f9"}}>Visitor Log</p>
              <p style={{fontSize:"11px",color:"#94a3b8",margin:0}}>{filteredVisitors.length} records</p>
            </div>
            <div style={{}}>
              {filteredVisitors.slice(0, 100).map((row, i) => (
                <div key={i} style={{padding:"12px 16px"}}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"8px"}}>
                    <div style={{flex:1}}>
                      <p style={{fontSize:"13px",fontWeight:600,color:"#f1f5f9",margin:0}}>{row.name}</p>
                      <p style={{fontSize:"11px",color:"#94a3b8",marginTop:"2px"}}>{row.purpose} · Host: {row.host}</p>
                      <p style={{fontSize:"11px",color:"#64748b",marginTop:"2px"}}>
                        {row.date} · In: {row.time_in} · Out: {row.time_out}
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

        {/* Meetings */}
        {!loading && tab === 'meetings' && meetings.length > 0 && (
          <div style={{background:"#1e293b",borderRadius:"12px",border:"1px solid #334155",overflow:"hidden"}}>
            <div style={{padding:"12px 16px",borderBottom:"1px solid #334155"}}>
              <p style={{fontSize:"13px",fontWeight:600,margin:0,color:"#f1f5f9"}}>Meetings</p>
              <p style={{fontSize:"11px",color:"#94a3b8",margin:0}}>{meetings.length} records</p>
            </div>
            <div style={{}}>
              {meetings.slice(0, 100).map((row, i) => (
                <div key={i} style={{padding:"12px 16px"}}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"8px"}}>
                    <div style={{flex:1}}>
                      <p style={{fontSize:"13px",fontWeight:600,color:"#f1f5f9",margin:0}}>{row.title}</p>
                      <p style={{fontSize:"11px",color:"#94a3b8",marginTop:"2px"}}>
                        {row.date} · {row.venue} · {row.attendees} attendee(s)
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

        {/* Projects */}
        {!loading && tab === 'projects' && projects.length > 0 && (
          <div style={{background:"#1e293b",borderRadius:"12px",border:"1px solid #334155",overflow:"hidden"}}>
            <div style={{padding:"12px 16px",borderBottom:"1px solid #334155"}}>
              <p style={{fontSize:"13px",fontWeight:600,margin:0,color:"#f1f5f9"}}>Projects</p>
              <p style={{fontSize:"11px",color:"#94a3b8",margin:0}}>{projects.length} projects</p>
            </div>
            <div style={{}}>
              {projects.slice(0, 100).map((row, i) => (
                <div key={i} style={{padding:"12px 16px"}}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"8px",marginBottom:"8px"}}>
                    <div style={{flex:1}}>
                      <p style={{fontSize:"13px",fontWeight:600,color:"#f1f5f9",margin:0}}>{row.name}</p>
                      <p style={{fontSize:"11px",color:"#94a3b8",marginTop:"2px"}}>
                        Lead: {row.lead} · Due: {row.due_date}
                      </p>
                    </div>
                    <span style={{fontSize:"11px",padding:"2px 8px",borderRadius:"99px",textTransform:"capitalize"}}>
                      {row.status}
                    </span>
                  </div>
                  {progressBar(row.progress)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resources */}
        {!loading && tab === 'resources' && resources.length > 0 && (
          <div style={{background:"#1e293b",borderRadius:"12px",border:"1px solid #334155",overflow:"hidden"}}>
            <div style={{padding:"12px 16px",borderBottom:"1px solid #334155"}}>
              <p style={{fontSize:"13px",fontWeight:600,margin:0,color:"#f1f5f9"}}>Resource Assets</p>
              <p style={{fontSize:"11px",color:"#94a3b8",margin:0}}>{resources.length} assets</p>
            </div>
            <div style={{}}>
              {resources.slice(0, 100).map((row, i) => (
                <div key={i} style={{padding:"12px 16px"}}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"8px"}}>
                    <div style={{flex:1}}>
                      <p style={{fontSize:"13px",fontWeight:600,color:"#f1f5f9",margin:0}}>{row.name}</p>
                      <p style={{fontSize:"11px",color:"#94a3b8",marginTop:"2px"}}>
                        {row.type} · Qty: {row.quantity} · {row.assigned_to}
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
        {!loading && tab === 'visitors' && filteredVisitors.length === 0 && (
          <div style={{textAlign:"center",padding:"48px 0"}}>
            <p style={{fontSize:"36px",marginBottom:"12px"}}>🏛️</p>
            <p style={{color:"#94a3b8",fontSize:"14px"}}>No visitor records found</p>
          </div>
        )}
        {!loading && tab === 'meetings' && meetings.length === 0 && (
          <div style={{textAlign:"center",padding:"48px 0"}}>
            <p style={{fontSize:"36px",marginBottom:"12px"}}>📋</p>
            <p style={{color:"#94a3b8",fontSize:"14px"}}>No meeting records found</p>
          </div>
        )}
        {!loading && tab === 'projects' && projects.length === 0 && (
          <div style={{textAlign:"center",padding:"48px 0"}}>
            <p style={{fontSize:"36px",marginBottom:"12px"}}>🚀</p>
            <p style={{color:"#94a3b8",fontSize:"14px"}}>No projects found</p>
          </div>
        )}
        {!loading && tab === 'resources' && resources.length === 0 && (
          <div style={{textAlign:"center",padding:"48px 0"}}>
            <p style={{fontSize:"36px",marginBottom:"12px"}}>📦</p>
            <p style={{color:"#94a3b8",fontSize:"14px"}}>No resource assets found</p>
          </div>
        )}

      </div>
    </div>
  )
}
