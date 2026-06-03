"use client";
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
