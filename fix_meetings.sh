#!/bin/bash
set -e
echo "🚀 VibeSchool Meetings — Full Gap Fix"

# ── 1. lib/meetings.ts ──────────────────────────────────────────────────────
mkdir -p lib
cat > lib/meetings.ts << 'EOF'
import { supabase } from './supabase'

export async function getMeetings(schoolId: string) {
  const { data, error } = await supabase
    .from('meetings')
    .select(`
      *,
      chair:profiles!meetings_chair_id_fkey(id, full_name),
      secretary:profiles!meetings_secretary_id_fkey(id, full_name),
      attendees:meeting_attendees(count),
      actions:meeting_actions(count)
    `)
    .eq('school_id', schoolId)
    .order('scheduled_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getMeeting(id: string) {
  const { data, error } = await supabase
    .from('meetings')
    .select(`
      *,
      chair:profiles!meetings_chair_id_fkey(id, full_name),
      secretary:profiles!meetings_secretary_id_fkey(id, full_name),
      agenda_items:meeting_agenda_items(* , presenter:profiles(id, full_name)),
      attendees:meeting_attendees(*, profile:profiles(id, full_name, avatar_url)),
      actions:meeting_actions(*,  owner:profiles(id, full_name)),
      minutes:meeting_minutes(*)
    `)
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createMeeting(payload: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('meetings')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateMeeting(id: string, payload: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('meetings')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteMeeting(id: string) {
  const { error } = await supabase.from('meetings').delete().eq('id', id)
  if (error) throw error
}

// ── Agenda ──────────────────────────────────────────────────────────────────
export async function upsertAgendaItem(item: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('meeting_agenda_items')
    .upsert(item)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteAgendaItem(id: string) {
  const { error } = await supabase.from('meeting_agenda_items').delete().eq('id', id)
  if (error) throw error
}

// ── Attendees ────────────────────────────────────────────────────────────────
export async function upsertAttendee(payload: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('meeting_attendees')
    .upsert(payload, { onConflict: 'meeting_id,profile_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateRSVP(meetingId: string, profileId: string, rsvp: string) {
  const { error } = await supabase
    .from('meeting_attendees')
    .update({ rsvp })
    .eq('meeting_id', meetingId)
    .eq('profile_id', profileId)
  if (error) throw error
}

export async function markAttendance(meetingId: string, profileId: string, attended: boolean) {
  const { error } = await supabase
    .from('meeting_attendees')
    .update({ attended })
    .eq('meeting_id', meetingId)
    .eq('profile_id', profileId)
  if (error) throw error
}

// ── Actions ──────────────────────────────────────────────────────────────────
export async function upsertAction(payload: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('meeting_actions')
    .upsert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateActionStatus(id: string, status: string) {
  const { error } = await supabase
    .from('meeting_actions')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// ── Minutes ──────────────────────────────────────────────────────────────────
export async function upsertMinutes(payload: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('meeting_minutes')
    .upsert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function approveMinutes(id: string, approverId: string) {
  const { error } = await supabase
    .from('meeting_minutes')
    .update({
      status: 'approved',
      approved_by: approverId,
      approved_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
}
EOF
echo "✅ lib/meetings.ts"

# ── 2. components/admin/meetings/ ───────────────────────────────────────────
mkdir -p components/admin/meetings

cat > components/admin/meetings/MeetingCard.tsx << 'EOF'
'use client'
import { useRouter } from 'next/navigation'

const TYPE_COLORS: Record<string, string> = {
  staff: '#6366f1', department: '#0f5fa8',
  parents: '#10b981', board: '#f59e0b', emergency: '#ef4444',
}
const TYPE_LABELS: Record<string, string> = {
  staff: 'Staff', department: 'Department',
  parents: 'Parents', board: 'Board', emergency: 'Emergency',
}
const STATUS_COLORS: Record<string, string> = {
  scheduled: '#6366f1', live: '#10b981',
  completed: '#64748b', cancelled: '#ef4444',
}

interface Props {
  meeting: {
    id: string; title: string; meeting_type: string; status: string
    venue: string | null; meeting_link: string | null
    scheduled_at: string; duration_mins: number; confidentiality: string
  }
}

export default function MeetingCard({ meeting: m }: Props) {
  const router = useRouter()
  const C = { text: '#0f172a', muted: '#64748b', border: '#e2e8f0', emerald: '#10b981', card: '#ffffff' }

  const isToday = (() => {
    const d = new Date(m.scheduled_at), n = new Date()
    return d.toDateString() === n.toDateString()
  })()

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })

  return (
    <div
      onClick={() => router.push(`/admin/meetings/${m.id}`)}
      style={{
        background: C.card, borderRadius: 16,
        border: `1px solid ${isToday ? C.emerald : C.border}`,
        padding: 16, cursor: 'pointer',
        boxShadow: isToday ? `0 0 0 2px ${C.emerald}22` : '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99,
              background: TYPE_COLORS[m.meeting_type] + '18', color: TYPE_COLORS[m.meeting_type],
              textTransform: 'uppercase', letterSpacing: 0.5,
            }}>{TYPE_LABELS[m.meeting_type]}</span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99,
              background: STATUS_COLORS[m.status] + '18', color: STATUS_COLORS[m.status],
              textTransform: 'uppercase', letterSpacing: 0.5,
            }}>{m.status === 'live' ? '🔴 LIVE' : m.status}</span>
            {m.confidentiality !== 'public' && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99,
                background: '#f59e0b18', color: '#f59e0b',
              }}>🔒 {m.confidentiality === 'board_only' ? 'Board Only' : 'Staff Only'}</span>
            )}
            {isToday && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99,
                background: C.emerald + '18', color: C.emerald,
              }}>TODAY</span>
            )}
          </div>
          <p style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: '0 0 6px' }}>{m.title}</p>
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
}
EOF
echo "✅ components/admin/meetings/MeetingCard.tsx"

cat > components/admin/meetings/MeetingStats.tsx << 'EOF'
'use client'
interface Stats { total: number; live: number; scheduled: number; completed: number }
interface Props { stats: Stats }
const C = { text: '#0f172a', muted: '#64748b', border: '#e2e8f0', emerald: '#10b981', card: '#ffffff' }

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <div style={{ background: C.card, borderRadius: 16, padding: 16, border: `1px solid ${C.border}`, flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginTop: 2 }}>{label}</div>
    </div>
  )
}

export default function MeetingStats({ stats }: Props) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
      <StatCard icon="🗓️" label="Total"    value={stats.total}     color={C.text} />
      <StatCard icon="🔴" label="Live"     value={stats.live}      color="#ef4444" />
      <StatCard icon="⏳" label="Upcoming" value={stats.scheduled} color="#6366f1" />
      <StatCard icon="✅" label="Done"     value={stats.completed} color={C.emerald} />
    </div>
  )
}
EOF
echo "✅ components/admin/meetings/MeetingStats.tsx"

cat > components/admin/meetings/AttendeeSelector.tsx << 'EOF'
'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Profile { id: string; full_name: string; role: string }
interface Props {
  schoolId: string
  selected: string[]
  onChange: (ids: string[]) => void
}

const C = { text: '#0f172a', muted: '#64748b', border: '#e2e8f0', emerald: '#10b981', card: '#ffffff', bg: '#f0f4f8' }

export default function AttendeeSelector({ schoolId, selected, onChange }: Props) {
  const [staff, setStaff]   = useState<Profile[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    supabase.from('profiles').select('id, full_name, role')
      .eq('school_id', schoolId)
      .then(({ data }) => setStaff(data ?? []))
  }, [schoolId])

  const filtered = staff.filter(s =>
    s.full_name?.toLowerCase().includes(search.toLowerCase())
  )

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id])
  }

  return (
    <div>
      <input
        placeholder="Search staff..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          width: '100%', padding: '10px 14px', borderRadius: 10,
          border: `1px solid ${C.border}`, fontSize: 13,
          background: C.bg, marginBottom: 10, boxSizing: 'border-box',
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
        {filtered.map(s => {
          const on = selected.includes(s.id)
          return (
            <div
              key={s.id}
              onClick={() => toggle(s.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                background: on ? C.emerald + '12' : C.card,
                border: `1px solid ${on ? C.emerald : C.border}`,
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: 6,
                background: on ? C.emerald : 'transparent',
                border: `2px solid ${on ? C.emerald : C.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {on && <span style={{ color: '#fff', fontSize: 12 }}>✓</span>}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{s.full_name}</div>
                <div style={{ fontSize: 11, color: C.muted, textTransform: 'capitalize' }}>{s.role}</div>
              </div>
            </div>
          )
        })}
      </div>
      {selected.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 12, color: C.emerald, fontWeight: 600 }}>
          {selected.length} selected
        </div>
      )}
    </div>
  )
}
EOF
echo "✅ components/admin/meetings/AttendeeSelector.tsx"

cat > components/admin/meetings/ActionItems.tsx << 'EOF'
'use client'
import { useState } from 'react'
import { updateActionStatus } from '@/lib/meetings'

interface Action {
  id: string; title: string; status: string; priority: string
  due_date: string | null; owner: { full_name: string } | null
}
interface Props { actions: Action[]; onRefresh: () => void }

const PRIORITY_COLOR: Record<string, string> = { low: '#10b981', medium: '#f59e0b', high: '#ef4444' }
const STATUS_COLOR:   Record<string, string> = {
  pending: '#6366f1', in_progress: '#f59e0b', done: '#10b981', overdue: '#ef4444',
}
const C = { text: '#0f172a', muted: '#64748b', border: '#e2e8f0', card: '#ffffff' }

export default function ActionItems({ actions, onRefresh }: Props) {
  const [updating, setUpdating] = useState<string | null>(null)

  async function cycle(a: Action) {
    const next: Record<string, string> = { pending: 'in_progress', in_progress: 'done', done: 'pending', overdue: 'in_progress' }
    setUpdating(a.id)
    await updateActionStatus(a.id, next[a.status] ?? 'pending')
    onRefresh()
    setUpdating(null)
  }

  if (!actions.length) return (
    <div style={{ textAlign: 'center', padding: '32px 16px', color: '#94a3b8', fontSize: 13 }}>
      No action items yet
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {actions.map(a => (
        <div key={a.id} style={{
          background: C.card, borderRadius: 12, padding: 12,
          border: `1px solid ${C.border}`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: '0 0 4px' }}>{a.title}</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                  background: PRIORITY_COLOR[a.priority] + '18', color: PRIORITY_COLOR[a.priority],
                }}>{a.priority}</span>
                {a.owner && <span style={{ fontSize: 11, color: C.muted }}>👤 {a.owner.full_name}</span>}
                {a.due_date && <span style={{ fontSize: 11, color: C.muted }}>📅 {a.due_date}</span>}
              </div>
            </div>
            <button
              onClick={() => cycle(a)}
              disabled={updating === a.id}
              style={{
                fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 99,
                background: STATUS_COLOR[a.status] + '18', color: STATUS_COLOR[a.status],
                border: `1px solid ${STATUS_COLOR[a.status]}44`,
                cursor: 'pointer', flexShrink: 0, textTransform: 'uppercase',
              }}
            >
              {updating === a.id ? '…' : a.status.replace('_', ' ')}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
EOF
echo "✅ components/admin/meetings/ActionItems.tsx"

# ── 3. Patch page.tsx — fix auth redirect + dead state + confidentiality ────
cat > app/admin/meetings/page.tsx << 'EOF'
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
EOF
echo "✅ app/admin/meetings/page.tsx patched"

# ── 4. SQL for meeting_minutes ───────────────────────────────────────────────
cat > supabase_meetings_minutes.sql << 'EOF'
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS meeting_minutes (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id  uuid REFERENCES meetings(id) ON DELETE CASCADE,
  content     text,
  status      text CHECK (status IN ('draft','review','approved','distributed')) DEFAULT 'draft',
  drafted_by  uuid REFERENCES profiles(id),
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- RLS on all meeting tables
ALTER TABLE meetings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_agenda_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_attendees    ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_actions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_minutes      ENABLE ROW LEVEL SECURITY;

-- meetings: school members only
CREATE POLICY "school_meetings" ON meetings FOR ALL
  USING (school_id IN (
    SELECT school_id FROM profiles WHERE id = auth.uid()
  ));

-- agenda items: via parent meeting
CREATE POLICY "school_agenda_items" ON meeting_agenda_items FOR ALL
  USING (meeting_id IN (
    SELECT id FROM meetings WHERE school_id IN (
      SELECT school_id FROM profiles WHERE id = auth.uid()
    )
  ));

-- attendees: via parent meeting
CREATE POLICY "school_attendees" ON meeting_attendees FOR ALL
  USING (meeting_id IN (
    SELECT id FROM meetings WHERE school_id IN (
      SELECT school_id FROM profiles WHERE id = auth.uid()
    )
  ));

-- actions: via parent meeting
CREATE POLICY "school_actions" ON meeting_actions FOR ALL
  USING (meeting_id IN (
    SELECT id FROM meetings WHERE school_id IN (
      SELECT school_id FROM profiles WHERE id = auth.uid()
    )
  ));

-- minutes: via parent meeting
CREATE POLICY "school_minutes" ON meeting_minutes FOR ALL
  USING (meeting_id IN (
    SELECT id FROM meetings WHERE school_id IN (
      SELECT school_id FROM profiles WHERE id = auth.uid()
    )
  ));

-- Storage bucket (run separately in Supabase dashboard > Storage > New bucket)
-- Name: meeting-files
-- Public: false
EOF
echo "✅ supabase_meetings_minutes.sql — ready to run in Supabase SQL Editor"

# ── 5. TypeScript check ──────────────────────────────────────────────────────
echo ""
echo "Running tsc..."
npx tsc --noEmit && echo "✅ No TypeScript errors" || echo "⚠️ Fix TS errors above"

echo ""
echo "════════════════════════════════════════"
echo "✅ All gaps fixed. Now do:"
echo "  1. Run supabase_meetings_minutes.sql in Supabase SQL Editor"
echo "  2. Create bucket 'meeting-files' in Supabase Storage (non-public)"
echo "  3. git add -A && git commit -m 'fix: close all meetings module gaps' && git push"
echo "════════════════════════════════════════"
