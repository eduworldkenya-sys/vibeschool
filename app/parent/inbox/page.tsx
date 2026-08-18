"use client"

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type ParentEvent = {
  id: string
  student_id: string | null
  category: string
  severity: string
  title: string
  body: string | null
  action_href: string | null
  metadata: Record<string, unknown> | null
  occurred_at: string
  read_at: string | null
  acknowledged_at: string | null
}

const C = { navy: '#0f172a', indigo: '#1e1b4b', emerald: '#059669', border: '#e2e8f0', muted: '#64748b', bg: '#f8fafc' }

function eventIcon(category: string) {
  if (category === 'attendance') return 'A'
  if (category === 'homework') return 'H'
  if (category === 'report' || category === 'assessment') return 'R'
  if (category === 'finance') return 'KES'
  if (category === 'teacher_message') return 'T'
  if (category === 'school_notice') return 'S'
  return 'i'
}

function tone(severity: string) {
  if (severity === 'urgent') return { bg: '#fee2e2', color: '#b91c1c', border: '#fecaca' }
  if (severity === 'warning') return { bg: '#fef3c7', color: '#92400e', border: '#fde68a' }
  if (severity === 'success') return { bg: '#dcfce7', color: '#166534', border: '#bbf7d0' }
  return { bg: '#dbeafe', color: '#1d4ed8', border: '#bfdbfe' }
}

export default function ParentInboxPage() {
  const router = useRouter()
  const [events, setEvents] = useState<ParentEvent[]>([])
  const [students, setStudents] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState<'unread' | 'all'>('unread')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.replace('/'); return }
        const { data, error: eventError } = await supabase
          .from('parent_events')
          .select('id, student_id, category, severity, title, body, action_href, metadata, occurred_at, read_at, acknowledged_at')
          .eq('parent_id', user.id)
          .order('occurred_at', { ascending: false })
          .limit(100)
        if (eventError) throw eventError
        const normalized = (data ?? []) as ParentEvent[]
        if (cancelled) return
        setEvents(normalized)
        const studentIds = Array.from(new Set(normalized.map(row => row.student_id).filter((value): value is string => Boolean(value))))
        if (studentIds.length > 0) {
          const { data: studentRows } = await supabase.from('students').select('id, name').in('id', studentIds)
          const names: Record<string, string> = {}
          ;(studentRows ?? []).forEach(student => { names[student.id] = student.name })
          if (!cancelled) setStudents(names)
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Inbox could not be loaded.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [router])

  const unreadCount = events.filter(event => !event.read_at).length
  const visible = useMemo(() => filter === 'unread' ? events.filter(event => !event.read_at) : events, [events, filter])

  async function markRead(event: ParentEvent, follow = false) {
    if (!event.read_at) {
      const now = new Date().toISOString()
      const { error: updateError } = await supabase.from('parent_events').update({ read_at: now }).eq('id', event.id)
      if (!updateError) setEvents(current => current.map(row => row.id === event.id ? { ...row, read_at: now } : row))
    }
    if (follow && event.action_href) router.push(event.action_href)
  }

  async function markAllRead() {
    const unread = events.filter(event => !event.read_at)
    if (unread.length === 0) return
    const now = new Date().toISOString()
    const ids = unread.map(event => event.id)
    const { error: updateError } = await supabase.from('parent_events').update({ read_at: now }).in('id', ids)
    if (!updateError) setEvents(current => current.map(row => ids.includes(row.id) ? { ...row, read_at: now } : row))
  }

  if (loading) return <section style={card}>Loading family inbox…</section>

  return (
    <div>
      <section style={{ background: `linear-gradient(145deg,${C.navy},${C.indigo})`, color: '#fff', borderRadius: 20, padding: 18, marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: '#a7f3d0', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1 }}>Family inbox</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'end' }}>
          <div><h1 style={{ margin: '5px 0 3px', fontSize: 21 }}>Everything important, one stream</h1><p style={{ margin: 0, color: '#cbd5e1', fontSize: 12 }}>Attendance, homework, reports, school notices, teacher updates and fees.</p></div>
          <div style={{ minWidth: 54, textAlign: 'center', border: '1px solid rgba(255,255,255,.16)', background: 'rgba(255,255,255,.08)', borderRadius: 12, padding: 8 }}><div style={{ fontSize: 18, fontWeight: 900 }}>{unreadCount}</div><div style={{ fontSize: 9, color: '#cbd5e1' }}>unread</div></div>
        </div>
      </section>

      {error && <div style={errorBox}>{error}</div>}

      <section style={{ ...card, padding: 10 }}>
        <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
          <button onClick={() => setFilter('unread')} style={filterButton(filter === 'unread')}>Unread</button>
          <button onClick={() => setFilter('all')} style={filterButton(filter === 'all')}>All</button>
          <div style={{ flex: 1 }} />
          {unreadCount > 0 && <button onClick={markAllRead} style={{ border: 'none', background: 'transparent', color: C.emerald, fontSize: 10, fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit' }}>Mark all read</button>}
        </div>
      </section>

      {visible.length === 0 ? <section style={{ ...card, textAlign: 'center', padding: 26 }}><div style={{ fontSize: 28, marginBottom: 8 }}>✓</div><h2 style={{ margin: '0 0 5px', fontSize: 16 }}>Nothing waiting</h2><p style={{ margin: 0, color: C.muted, fontSize: 11 }}>{filter === 'unread' ? 'You are caught up. New school and child events will appear here automatically.' : 'No family events have been recorded yet.'}</p></section> : <div style={{ display: 'grid', gap: 8 }}>
        {visible.map(event => {
          const t = tone(event.severity)
          const studentName = event.student_id ? students[event.student_id] : null
          const needsAck = Boolean(event.metadata && event.metadata.requires_ack) && !event.acknowledged_at
          return <button key={event.id} onClick={() => void markRead(event, Boolean(event.action_href))} style={{ border: `1px solid ${event.read_at ? C.border : t.border}`, background: event.read_at ? '#fff' : '#fff', borderRadius: 14, padding: 12, display: 'flex', gap: 11, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', boxShadow: event.read_at ? 'none' : '0 3px 12px rgba(15,23,42,.05)' }}>
            <span style={{ width: 34, height: 34, borderRadius: 11, background: t.bg, color: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: event.category === 'finance' ? 9 : 12, fontWeight: 900, flexShrink: 0 }}>{eventIcon(event.category)}</span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}><strong style={{ fontSize: 12, color: C.navy }}>{event.title}</strong>{!event.read_at && <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.emerald }} />}{needsAck && <span style={{ fontSize: 8, fontWeight: 900, background: '#fef3c7', color: '#92400e', borderRadius: 999, padding: '2px 6px' }}>ACK REQUIRED</span>}</span>
              <span style={{ display: 'block', marginTop: 3, color: C.muted, fontSize: 10, lineHeight: 1.4 }}>{event.body || event.category.replaceAll('_',' ')}</span>
              <span style={{ display: 'block', marginTop: 5, color: '#94a3b8', fontSize: 9 }}>{studentName ? `${studentName} · ` : ''}{new Date(event.occurred_at).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
            </span>
            {event.action_href && <span style={{ color: '#94a3b8', fontSize: 18, alignSelf: 'center' }}>›</span>}
          </button>
        })}
      </div>}

      <section style={{ ...card, marginTop: 12 }}>
        <div style={{ fontSize: 9, fontWeight: 900, color: C.emerald, textTransform: 'uppercase', letterSpacing: 1 }}>Conversations</div>
        <h2 style={{ margin: '4px 0 6px', fontSize: 16 }}>Need to talk to the school?</h2>
        <p style={{ margin: '0 0 10px', color: C.muted, fontSize: 11 }}>Inbox events are system records. Teacher conversations and school circular acknowledgements stay in VibeConnect.</p>
        <button onClick={() => router.push('/parent/messages')} style={primaryButton}>Open messages & school notices</button>
      </section>
    </div>
  )
}

const card: React.CSSProperties = { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 15, padding: 14, marginBottom: 10 }
const errorBox: React.CSSProperties = { border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', borderRadius: 12, padding: 11, marginBottom: 10, fontSize: 11 }
const primaryButton: React.CSSProperties = { width: '100%', border: 'none', borderRadius: 11, background: C.emerald, color: '#fff', padding: 11, fontWeight: 900, fontFamily: 'inherit', cursor: 'pointer' }
function filterButton(active: boolean): React.CSSProperties { return { border: `1px solid ${active ? C.emerald : C.border}`, background: active ? '#ecfdf5' : '#fff', color: active ? '#065f46' : C.muted, borderRadius: 999, padding: '6px 10px', fontSize: 10, fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit' } }
