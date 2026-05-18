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
