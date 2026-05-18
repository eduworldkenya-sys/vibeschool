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
