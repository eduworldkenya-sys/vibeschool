import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase server credentials are not configured')
  return createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  return req.headers.get('authorization') === `Bearer ${cronSecret}`
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const adminSupabase = getAdminSupabase()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const sevenDaysOut = new Date(today)
    sevenDaysOut.setDate(sevenDaysOut.getDate() + 7)

    const { data: deadlines, error: dlErr } = await adminSupabase
      .from('tpad_deadlines')
      .select('school_id, term_id, self_appraisal_due')
      .gte('self_appraisal_due', today.toISOString().split('T')[0])
      .lte('self_appraisal_due', sevenDaysOut.toISOString().split('T')[0])

    if (dlErr) return NextResponse.json({ error: dlErr.message }, { status: 500 })
    if (!deadlines || deadlines.length === 0) {
      return NextResponse.json({ ok: true, reminders_sent: 0, message: 'No TPAD deadlines in the next 7 days' })
    }

    const remindDayCounts = new Set([7, 3, 1])
    let totalReminders = 0
    const results: { school_id: string; term_id: string; days_left: number; reminders: number }[] = []

    for (const dl of deadlines) {
      const dueDate = new Date(dl.self_appraisal_due + 'T00:00:00')
      const daysLeft = Math.round((dueDate.getTime() - today.getTime()) / 86400000)
      if (!remindDayCounts.has(daysLeft)) continue

      const { data: members } = await adminSupabase
        .from('school_members')
        .select('profile_id')
        .eq('school_id', dl.school_id)
        .eq('role', 'teacher')
      if (!members || members.length === 0) continue

      const teacherIds = members.map((m: { profile_id: string }) => m.profile_id)
      const { data: submitted } = await adminSupabase
        .from('tpad_appraisals')
        .select('teacher_id')
        .eq('term_id', dl.term_id)
        .in('teacher_id', teacherIds)
        .not('submitted_at', 'is', null)

      const submittedIds = new Set((submitted ?? []).map((s: { teacher_id: string }) => s.teacher_id))
      const pendingTeachers = teacherIds.filter((id: string) => !submittedIds.has(id))
      if (pendingTeachers.length === 0) continue

      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const { data: existing } = await adminSupabase
        .from('notifications')
        .select('id')
        .eq('type', 'tpad_reminder')
        .ilike('body', `%${daysLeft} day%`)
        .gte('created_at', todayStart.toISOString())
        .in('user_id', pendingTeachers)
      if (existing && existing.length > 0) continue

      const msg = daysLeft === 1
        ? 'TPAD self-appraisal is due tomorrow. Please complete it today.'
        : `TPAD self-appraisal is due in ${daysLeft} days. Don't leave it to the last hour.`

      const { error: insertErr } = await adminSupabase.from('notifications').insert(
        pendingTeachers.map((tid: string) => ({
          user_id: tid,
          school_id: dl.school_id,
          type: 'tpad_reminder',
          title: 'TPAD Self-Appraisal Due Soon',
          body: msg,
          is_read: false,
        })),
      )

      if (!insertErr) {
        totalReminders += pendingTeachers.length
        results.push({ school_id: dl.school_id, term_id: dl.term_id, days_left: daysLeft, reminders: pendingTeachers.length })
      }
    }

    return NextResponse.json({ ok: true, reminders_sent: totalReminders, details: results })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 })
  }
}
