import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true

  const authHeader = req.headers.get('authorization') ?? ''
  if (authHeader === `Bearer ${cronSecret}`) return true

  const { searchParams } = new URL(req.url)
  if (searchParams.get('secret') === cronSecret) return true

  return false
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 1. Find all TPAD deadlines where self_appraisal_due is within the next 7 days and in the future
    const sevenDaysOut = new Date(today)
    sevenDaysOut.setDate(sevenDaysOut.getDate() + 7)

    const { data: deadlines, error: dlErr } = await adminSupabase
      .from('tpad_deadlines')
      .select('school_id, term_id, self_appraisal_due')
      .gte('self_appraisal_due', today.toISOString().split('T')[0])
      .lte('self_appraisal_due', sevenDaysOut.toISOString().split('T')[0])

    if (dlErr) {
      return NextResponse.json({ error: dlErr.message }, { status: 500 })
    }
    if (!deadlines || deadlines.length === 0) {
      return NextResponse.json({ ok: true, reminders_sent: 0, message: 'No TPAD deadlines in the next 7 days' })
    }

    // Only remind on specific day-counts to avoid spamming daily: 7, 3, 1 days before
    const remindDayCounts = new Set([7, 3, 1])

    let totalReminders = 0
    const results: { school_id: string; term_id: string; days_left: number; reminders: number }[] = []

    for (const dl of deadlines) {
      const dueDate = new Date(dl.self_appraisal_due + 'T00:00:00')
      const daysLeft = Math.round((dueDate.getTime() - today.getTime()) / 86400000)

      if (!remindDayCounts.has(daysLeft)) continue

      // 2. Find all teachers in this school via school_members
      const { data: members } = await adminSupabase
        .from('school_members')
        .select('profile_id')
        .eq('school_id', dl.school_id)
        .eq('role', 'teacher')

      if (!members || members.length === 0) continue
      const teacherIds = members.map((m: { profile_id: string }) => m.profile_id)

      // 3. Find which teachers have already submitted their appraisal for this term
      const { data: submitted } = await adminSupabase
        .from('tpad_appraisals')
        .select('teacher_id')
        .eq('term_id', dl.term_id)
        .in('teacher_id', teacherIds)
        .not('submitted_at', 'is', null)

      const submittedIds = new Set((submitted ?? []).map((s: { teacher_id: string }) => s.teacher_id))
      const pendingTeachers = teacherIds.filter((id: string) => !submittedIds.has(id))

      if (pendingTeachers.length === 0) continue

      // 4. Duplicate-safe: skip if a reminder for this exact day-count already went out today
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
        ? `TPAD self-appraisal is due tomorrow. Please complete it today.`
        : `TPAD self-appraisal is due in ${daysLeft} days. Don't leave it to the last hour.`

      const { error: insertErr } = await adminSupabase.from('notifications').insert(
        pendingTeachers.map((tid: string) => ({
          user_id:   tid,
          school_id: dl.school_id,
          type:      'tpad_reminder',
          title:     'TPAD Self-Appraisal Due Soon',
          body:      msg,
          is_read:   false,
        }))
      )

      if (!insertErr) {
        totalReminders += pendingTeachers.length
        results.push({ school_id: dl.school_id, term_id: dl.term_id, days_left: daysLeft, reminders: pendingTeachers.length })
      }
    }

    return NextResponse.json({ ok: true, reminders_sent: totalReminders, details: results })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Server error' }, { status: 500 })
  }
}

