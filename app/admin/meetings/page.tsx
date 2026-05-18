'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const C = {
  hero:    '#0a1628',
  heroMid: '#0d2347',
  emerald: '#10b981',
  navy3:   '#0f5fa8',
  bg:      '#f0f4f8',
  border:  '#e2e8f0',
  text:    '#0f172a',
  muted:   '#64748b',
  card:    '#ffffff',
  error:   '#ef4444',
  warning: '#f59e0b',
}

const TYPE_COLORS: Record<string, string> = {
  staff:      '#6366f1',
  department: '#0f5fa8',
  parents:    '#10b981',
  board:      '#f59e0b',
  emergency:  '#ef4444',
}

const TYPE_LABELS: Record<string, string> = {
  staff:      'Staff',
  department: 'Department',
  parents:    'Parents',
  board:      'Board',
  emergency:  'Emergency',
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: '#6366f1',
  live:      '#10b981',
  completed: '#64748b',
  cancelled: '#ef4444',
}

interface Meeting {
  id:            string
  title:         string
  meeting_type:  string
  status:        string
  venue:         string | null
  meeting_link:  string | null
  scheduled_at:  string
  duration_mins: number
  confidentiality: string
}

function Skeleton({ h = 80 }: { h?: number }) {
  return (
    <div style={{
      height: h, borderRadius: 16,
      background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <div style={{
      background: C.card, borderRadius: 16, padding: '16px',
      border: `1px solid ${C.border}`, flex: 1, minWidth: 0,
    }}>
      <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginTop: 2 }}>{label}</div>
    </div>
  )
}

export default function MeetingsPage() {
  const router = useRouter()
  const [schoolId,  setSchoolId]  = useState<string | null>(null)
  const [meetings,  setMeetings]  = useState<Meeting[]>([])
  const [loading,   setLoading]   = useState(true)
  const [filter,    setFilter]    = useState<'all' | 'scheduled' | 'live' | 'completed' | 'cancelled'>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from('profiles').select('school_id').eq('id', user.id).single()
    if (!p) return
    setSchoolId(p.school_id)
    await loadMeetings(p.school_id)
  }

  async function loadMeetings(sid: string) {
    setLoading(true)
    const { data } = await supabase
      .from('meetings')
      .select('*')
      .eq('school_id', sid)
      .order('scheduled_at', { ascending: false })
    setMeetings(data ?? [])
    setLoading(false)
  }

  const filtered = meetings.filter(m => {
    const statusOk = filter === 'all' || m.status === filter
    const typeOk   = typeFilter === 'all' || m.meeting_type === typeFilter
    return statusOk && typeOk
  })

  const stats = {
    total:     meetings.length,
    live:      meetings.filter(m => m.status === 'live').length,
    scheduled: meetings.filter(m => m.status === 'scheduled').length,
    completed: meetings.filter(m => m.status === 'completed').length,
  }

  function formatDate(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  }

  function formatTime(iso: string) {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
  }

  function isToday(iso: string) {
    const d = new Date(iso)
    const n = new Date()
    return d.toDateString() === n.toDateString()
  }

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", color: C.text, paddingBottom: 32 }}>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0 }}>Meetings</h1>
          <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
            {loading ? '…' : `${meetings.length} total meetings`}
          </p>
        </div>
        <button
          onClick={() => router.push('/admin/meetings/new')}
          style={{
            padding: '10px 18px', borderRadius: 12,
            background: C.hero, color: '#fff',
            fontWeight: 700, fontSize: 13,
            border: 'none', cursor: 'pointer',
          }}
        >
          + New
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <StatCard icon="🗓️" label="Total"     value={stats.total}     color={C.text} />
        <StatCard icon="🔴" label="Live"      value={stats.live}      color="#ef4444" />
        <StatCard icon="⏳" label="Upcoming"  value={stats.scheduled} color="#6366f1" />
        <StatCard icon="✅" label="Done"      value={stats.completed} color={C.emerald} />
      </div>

      {/* Status filter */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 12, paddingBottom: 4 }}>
        {['all','scheduled','live','completed','cancelled'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s as typeof filter)}
            style={{
              flexShrink: 0, padding: '6px 14px', borderRadius: 99,
              fontSize: 12, fontWeight: filter === s ? 700 : 500,
              background: filter === s ? C.hero : C.card,
              color: filter === s ? '#fff' : C.muted,
              border: `1px solid ${filter === s ? C.hero : C.border}`,
              cursor: 'pointer', textTransform: 'capitalize',
            }}
          >
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Type filter */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 20, paddingBottom: 4 }}>
        {['all','staff','department','parents','board','emergency'].map(t => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            style={{
              flexShrink: 0, padding: '5px 12px', borderRadius: 99,
              fontSize: 11, fontWeight: typeFilter === t ? 700 : 500,
              background: typeFilter === t ? (TYPE_COLORS[t] ?? C.hero) : C.card,
              color: typeFilter === t ? '#fff' : C.muted,
              border: `1px solid ${typeFilter === t ? (TYPE_COLORS[t] ?? C.hero) : C.border}`,
              cursor: 'pointer',
            }}
          >
            {t === 'all' ? 'All Types' : TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {/* List */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1,2,3].map(i => <Skeleton key={i} />)}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 16px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🗓️</div>
          <p style={{ color: C.muted, fontSize: 14 }}>No meetings found. Tap <strong>+ New</strong> to schedule one.</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(m => {
            const today = isToday(m.scheduled_at)
            return (
              <div
                key={m.id}
                onClick={() => router.push(`/admin/meetings/${m.id}`)}
                style={{
                  background: C.card, borderRadius: 16,
                  border: `1px solid ${today ? C.emerald : C.border}`,
                  padding: 16, cursor: 'pointer',
                  boxShadow: today ? `0 0 0 2px ${C.emerald}22` : '0 1px 3px rgba(0,0,0,0.06)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      {/* Type badge */}
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99,
                        background: TYPE_COLORS[m.meeting_type] + '18',
                        color: TYPE_COLORS[m.meeting_type],
                        textTransform: 'uppercase', letterSpacing: 0.5,
                      }}>
                        {TYPE_LABELS[m.meeting_type]}
                      </span>
                      {/* Status badge */}
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99,
                        background: STATUS_COLORS[m.status] + '18',
                        color: STATUS_COLORS[m.status],
                        textTransform: 'uppercase', letterSpacing: 0.5,
                      }}>
                        {m.status === 'live' ? '🔴 LIVE' : m.status}
                      </span>
                      {today && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99,
                          background: C.emerald + '18', color: C.emerald,
                        }}>
                          TODAY
                        </span>
                      )}
                    </div>

                    <p style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: '0 0 6px' }}>
                      {m.title}
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span style={{ fontSize: 12, color: C.muted }}>
                        📅 {formatDate(m.scheduled_at)} · {formatTime(m.scheduled_at)}
                      </span>
                      <span style={{ fontSize: 12, color: C.muted }}>
                        ⏱ {m.duration_mins} mins
                        {m.venue ? ` · 📍 ${m.venue}` : ''}
                        {m.meeting_link ? ' · 🔗 Virtual' : ''}
                      </span>
                    </div>
                  </div>

                  <span style={{ fontSize: 20, color: C.muted }}>›</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
