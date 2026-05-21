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
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-slate-700 rounded-full h-1.5">
          <div className={`${color} h-1.5 rounded-full`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        <span className="text-xs text-slate-400 w-8 text-right">{pct}%</span>
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
    <div className="min-h-screen bg-[#0f172a] text-white">
      {/* Top Bar */}
      <div className="bg-[#1e293b] border-b border-slate-700 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <a href="/admin/reports" className="text-slate-400 hover:text-white text-xl">←</a>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Operational Report</h1>
            <p className="text-xs text-slate-400">Visitors · Meetings · Projects · Resources</p>
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
                  ? 'bg-orange-600 text-white'
                  : 'bg-[#1e293b] text-slate-400 border border-slate-700'
              }`}
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
            className="w-full bg-[#1e293b] border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
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
            <p className="text-slate-400 text-sm">Loading data...</p>
          </div>
        )}

        {/* Visitors */}
        {!loading && tab === 'visitors' && filteredVisitors.length > 0 && (
          <div className="bg-[#1e293b] rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700">
              <p className="text-sm font-semibold">Visitor Log</p>
              <p className="text-xs text-slate-400">{filteredVisitors.length} records</p>
            </div>
            <div className="divide-y divide-slate-700/50">
              {filteredVisitors.slice(0, 100).map((row, i) => (
                <div key={i} className="px-4 py-3 hover:bg-slate-700/20">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">{row.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{row.purpose} · Host: {row.host}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {row.date} · In: {row.time_in} · Out: {row.time_out}
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

        {/* Meetings */}
        {!loading && tab === 'meetings' && meetings.length > 0 && (
          <div className="bg-[#1e293b] rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700">
              <p className="text-sm font-semibold">Meetings</p>
              <p className="text-xs text-slate-400">{meetings.length} records</p>
            </div>
            <div className="divide-y divide-slate-700/50">
              {meetings.slice(0, 100).map((row, i) => (
                <div key={i} className="px-4 py-3 hover:bg-slate-700/20">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">{row.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {row.date} · {row.venue} · {row.attendees} attendee(s)
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

        {/* Projects */}
        {!loading && tab === 'projects' && projects.length > 0 && (
          <div className="bg-[#1e293b] rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700">
              <p className="text-sm font-semibold">Projects</p>
              <p className="text-xs text-slate-400">{projects.length} projects</p>
            </div>
            <div className="divide-y divide-slate-700/50">
              {projects.slice(0, 100).map((row, i) => (
                <div key={i} className="px-4 py-3 hover:bg-slate-700/20">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">{row.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Lead: {row.lead} · Due: {row.due_date}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full capitalize ${statusBadge(row.status)}`}>
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
          <div className="bg-[#1e293b] rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700">
              <p className="text-sm font-semibold">Resource Assets</p>
              <p className="text-xs text-slate-400">{resources.length} assets</p>
            </div>
            <div className="divide-y divide-slate-700/50">
              {resources.slice(0, 100).map((row, i) => (
                <div key={i} className="px-4 py-3 hover:bg-slate-700/20">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">{row.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {row.type} · Qty: {row.quantity} · {row.assigned_to}
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
        {!loading && tab === 'visitors' && filteredVisitors.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🏛️</p>
            <p className="text-slate-400 text-sm">No visitor records found</p>
          </div>
        )}
        {!loading && tab === 'meetings' && meetings.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-slate-400 text-sm">No meeting records found</p>
          </div>
        )}
        {!loading && tab === 'projects' && projects.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🚀</p>
            <p className="text-slate-400 text-sm">No projects found</p>
          </div>
        )}
        {!loading && tab === 'resources' && resources.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">📦</p>
            <p className="text-slate-400 text-sm">No resource assets found</p>
          </div>
        )}

      </div>
    </div>
  )
}
