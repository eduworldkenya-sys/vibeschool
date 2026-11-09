/** Client-side reminder evaluation. Times follow the learner's local device timezone. */
export type ReminderItem = {
  id: string
  title: string
  kind: 'task' | 'study'
  starts_at: string | null
  due_at: string | null
  repeat_rule: 'none' | 'daily' | 'weekly'
  completed_at: string | null
  reminder_minutes: number | null
  reminder_seen_occurrence_at: string | null
}

export type DueReminder = { item: ReminderItem; occurrence: Date; fireAt: Date }

function localDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/**
 * Calculates the most recent event in learner-local calendar time.
 * Repeating events keep their clock time through daylight-saving changes.
 */
export function mostRecentOccurrence(item: ReminderItem, now: Date): Date | null {
  const baseIso = item.starts_at ?? item.due_at
  if (!baseIso) return null
  const base = new Date(baseIso)
  if (!Number.isFinite(base.getTime())) return null
  if (item.repeat_rule === 'none') return base
  const baseDay = localDay(base)
  const nowDay = localDay(now)
  const days = Math.round((nowDay.getTime() - baseDay.getTime()) / 86400000)
  if (days < 0) return base
  const step = item.repeat_rule === 'daily' ? 1 : 7
  const candidate = new Date(base.getFullYear(), base.getMonth(), base.getDate() + Math.floor(days / step) * step, base.getHours(), base.getMinutes(), base.getSeconds())
  // A reminder can fall before an occurrence; the candidate is valid until
  // the following occurrence reaches its notification window.
  const next = new Date(candidate.getFullYear(), candidate.getMonth(), candidate.getDate() + step, base.getHours(), base.getMinutes(), base.getSeconds())
  return next.getTime() - (item.reminder_minutes ?? 0) * 60000 <= now.getTime() ? next : candidate
}

export function dueReminders(items: ReminderItem[], now = new Date()): DueReminder[] {
  return items.flatMap(item => {
    if (item.completed_at || item.reminder_minutes === null || item.reminder_minutes === undefined) return []
    const occurrence = mostRecentOccurrence(item, now)
    if (!occurrence) return []
    const fireAt = new Date(occurrence.getTime() - item.reminder_minutes * 60000)
    // Deliver only reasonably recent reminders; no historic notification floods.
    if (now.getTime() < fireAt.getTime() || now.getTime() - fireAt.getTime() > 12 * 3600000) return []
    const seen = item.reminder_seen_occurrence_at ? new Date(item.reminder_seen_occurrence_at).getTime() : -Infinity
    if (seen >= occurrence.getTime()) return []
    return [{ item, occurrence, fireAt }]
  }).sort((a,b)=>a.fireAt.getTime()-b.fireAt.getTime())
}
