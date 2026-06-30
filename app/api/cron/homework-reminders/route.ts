import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Vercel Cron triggers this with a GET request and includes a special header
// when CRON_SECRET is configured. We also accept a manual `?secret=` query
// param as a fallback for manual testing.
function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true // no secret configured — open (not recommended for prod)

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
    const tomorrowIso = (() => {
      const d = new Date()
      d.setDate(d.getDate() + 1)
      return d.toISOString().split('T')[0]
    })()

    // 1. Find all homework due tomorrow
    const { data: dueHw, error: hwErr } = await adminSupabase
      .from('homework')
      .select('id, title, subject, class_id, school_id, due_date')
      .eq('due_date', tomorrowIso)

    if (hwErr) {
      return NextResponse.json({ error: hwErr.message }, { status: 500 })
    }
    if (!dueHw || dueHw.length === 0) {
      return NextResponse.json({ ok: true, reminders_sent: 0, message: 'No homework due tomorrow' })
    }

    let totalReminders = 0
    const results: { homework_id: string; title: string; reminders: number }[] = []

    for (const hw of dueHw) {
      // 2. Get all students in that class
      const { data: students } = await adminSupabase
        .from('students')
        .select('id')
        .eq('class_id', hw.class_id)

      if (!students || students.length === 0) continue

      // 3. Get all submissions for this homework
      const { data: submissions } = await adminSupabase
        .from('homework_submissions')
        .select('student_id')
        .eq('homework_id', hw.id)

      const submittedIds = new Set((submissions ?? []).map((s: { student_id: string }) => s.student_id))
      const notSubmitted = students.filter((s: { id: string }) => !submittedIds.has(s.id))

      if (notSubmitted.length === 0) continue

      // 4. Check if a reminder was already sent today for this homework (avoid duplicate spam on re-runs)
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      const { data: existingReminders } = await adminSupabase
        .from('notifications')
        .select('id')
        .eq('type', 'homework_reminder')
        .ilike('message', `%${hw.title}%`)
        .gte('created_at', todayStart.toISOString())
        .in('user_id', notSubmitted.map((s: { id: string }) => s.id))

      // Conservative: if ANY reminder for this homework went out today, skip the whole batch to avoid duplicates
      if (existingReminders && existingReminders.length > 0) {
        continue
      }

      const msg = `Reminder: "${hw.title}" (${hw.subject}) is due tomorrow. Please submit on time.`

      const { error: insertErr } = await adminSupabase.from('notifications').insert(
        notSubmitted.map((s: { id: string }) => ({
          user_id:   s.id,
          school_id: hw.school_id,
          type:      'homework_reminder',
          title:     'Homework Due Tomorrow',
          message:   msg,
          is_read:   false,
        }))
      )

      if (!insertErr) {
        totalReminders += notSubmitted.length
        results.push({ homework_id: hw.id, title: hw.title, reminders: notSubmitted.length })
      }
    }

    return NextResponse.json({ ok: true, reminders_sent: totalReminders, details: results })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Server error' }, { status: 500 })
  }
}

