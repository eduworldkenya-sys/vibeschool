export type LiveSummary = {
  id: string
  title: string
  mode: 'school' | 'tuition' | 'homeschool' | 'open'
  status: 'active' | 'paused'
  canJoin: boolean
  own: boolean
}

const ROOM_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MODES = new Set(['school', 'tuition', 'homeschool', 'open'])

// This is display filtering only. The existing server-side Live command is
// always responsible for authentication and authorization at join time.
export function eligibleRoom(value: unknown): value is LiveSummary {
  if (!value || typeof value !== 'object') return false
  const room = value as Partial<LiveSummary>
  return typeof room.id === 'string' && ROOM_ID.test(room.id)
    && typeof room.title === 'string' && room.title.length > 0 && room.title.length <= 120
    && room.status === 'active' && room.canJoin === true && room.own === false
    && typeof room.mode === 'string' && MODES.has(room.mode)
}
