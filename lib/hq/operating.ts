import { supabase } from "@/lib/supabase"

export type HQSnapshot = {
  generated_at: string
  users: { total: number; today: number; teachers: number; learners: number }
  schools: { total: number; active: number; today: number }
  teaching: {
    lesson_plans_today: number
    lesson_plans_7d: number
    lessons_taught_today: number
    homework_today: number
    submissions_today: number
    unreviewed_submissions: number
  }
  content: {
    publications_total: number
    publications_live: number
    publications_draft: number
    reads_total: number
  }
  events: { today: number; last_hour: number }
  notifications: { unread: number; critical: number }
  incidents: { open: number }
}

export type HQNotification = {
  id: string
  category: string
  severity: "info" | "success" | "warning" | "critical"
  title: string
  body: string
  route: string | null
  status: "unread" | "read" | "resolved"
  metadata: Record<string, unknown>
  created_at: string
}

export async function loadHQSnapshot(): Promise<HQSnapshot> {
  const { data, error } = await supabase.rpc("hq_get_snapshot")
  if (error) throw error
  return data as HQSnapshot
}

export async function loadHQNotifications(limit = 60): Promise<HQNotification[]> {
  const { data, error } = await supabase.rpc("hq_list_notifications", { p_limit: limit })
  if (error) throw error
  return (data ?? []) as HQNotification[]
}

export async function markHQNotificationRead(id: string) {
  const { error } = await supabase.rpc("hq_mark_notification_read", { p_id: id })
  if (error) throw error
}

export async function resolveHQNotification(id: string) {
  const { error } = await supabase.rpc("hq_resolve_notification", { p_id: id })
  if (error) throw error
}

export async function runHQRules() {
  const { data, error } = await supabase.rpc("hq_generate_operational_alerts")
  if (error) throw error
  return Number(data ?? 0)
}
