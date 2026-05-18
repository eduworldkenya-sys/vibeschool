'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import MeetingCard from '@/components/admin/meetings/MeetingCard'
import MeetingStats from '@/components/admin/meetings/MeetingStats'

const C = {
  hero: '#0a1628', heroMid: '#0d2347', emerald: '#10b981',
  bg: '#f0f4f8', border: '#e2e8f0', text: '#0f172a',
  muted: '#64748b', card: '#ffffff',
}

const TYPE_COLORS: Record<string, string> = {
  staff: '#6366f1', department: '#0f5fa8',
  parents: '#10b981', board: '#f59e0b', emergency: '#ef4444',
}
const TYPE_LABELS: Record<string, string> = {
  staff: 'Staff', department: 'Department',
  parents: 'Parents', board: 'Board', emergency: 'Emergency',
}

interface Meeting {
  id: string; title: string; meeting_type: string; status: string
  venue: string | null; meeting_link: string | null
  scheduled_at: string; duration_mins: number; confidentiality: string
}

function Skeleton() {
  return (
    <div style={{
      height: 80, borderRadius: 16,
      background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite',
    }} />
  )
}

export default function MeetingsPage() {
  const router = useRouter()
  const [meetings,   setMeetings]   = useState<Meeting[]>([])
  const [loading,    setLoading]    = useState(true)
  const [filter,     setFilter]     = useState<'all'|'scheduled'|'live'|'completed'|'cancelled'>('all')
  const [typeFilter, setTypeFilter] = useState('all')

  useEffect(() => { init() }, [])

  async function init() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/admin/login'); return }

      const { data: p } = await supabase
        .from('profiles').select('school_id').eq('id', user.id).single()
      if (!p) { router.push('/admin/login'); return }

      await loadMeetings(p.school_id)
    } catch {
      router.push('/admin/login')
    }
  }

  async function loadMeetings(sid: string) {
    setLoading(true)
    const { data } = await supabase
      .from('meetings').select('*')
      .eq('school_id', sid)
      .order('scheduled_at', { ascending: false })
    setMeetings(data ?? [])
    setLoading(false)
  }

  const filtered = meetings.filter(m =>
    (filter === 'all' || m.status === filter) &&
    (typeFilter === 'all' || m.meeting_type === typeFilter)
  )

  const stats = {
    total:     meetings.length,
    live:      meetings.filter(m => m.status === 'live').length,
    scheduled: meetings.filter(m => m.status === 'scheduled').length,
    completed: meetings.filter(m => m.status === 'completed').length,
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
            padding: '10px 18px', borderRadius: 12, background: C.hero,
            color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer',
          }}
        >+ New</button>
      </div>

      <MeetingStats stats={stats} />

      {/* Status filter */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 12, paddingBottom: 4 }}>
        {(['all','scheduled','live','completed','cancelled'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{
            flexShrink: 0, padding: '6px 14px', borderRadius: 99,
            fontSize: 12, fontWeight: filter === s ? 700 : 500,
            background: filter === s ? C.hero : C.card,
            color: filter === s ? '#fff' : C.muted,
            border: `1px solid ${filter === s ? C.hero : C.border}`,
            cursor: 'pointer', textTransform: 'capitalize',
          }}>
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Type filter */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 20, paddingBottom: 4 }}>
        {['all','staff','department','parents','board','emergency'].map(t => (
          <button key={t} onClick={() => setTypeFilter(t)} style={{
            flexShrink: 0, padding: '5px 12px', borderRadius: 99,
            fontSize: 11, fontWeight: typeFilter === t ? 700 : 500,
            background: typeFilter === t ? (TYPE_COLORS[t] ?? C.hero) : C.card,
            color: typeFilter === t ? '#fff' : C.muted,
            border: `1px solid ${typeFilter === t ? (TYPE_COLORS[t] ?? C.hero) : C.border}`,
            cursor: 'pointer',
          }}>
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
          <p style={{ color: C.muted, fontSize: 14 }}>
            No meetings found. Tap <strong>+ New</strong> to schedule one.
          </p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(m => <MeetingCard key={m.id} meeting={m} />)}
        </div>
      )}
    </div>
  )
}
